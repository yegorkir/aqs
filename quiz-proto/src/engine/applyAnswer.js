import { recomputeAxisConfidence } from "./explain.js";

export function applyAnswer(state, bundle, answer) {
  const q = bundle.questionsById[answer.qid];
  const log = {
    qid: q.id,
    answer,
    axis_changes: {},
    module_changes: {},
    mode_changes: {},
    tags_added: [],
    tags_removed: [],
  };

  const effects = resolveEffects(q, answer);

  if (effects.axis_deltas) {
    for (const [axisId, delta] of Object.entries(effects.axis_deltas)) {
      const ax = state.axes[axisId];
      if (!ax) continue;
      ax.score += delta;
      ax.recent_deltas.push(delta);
      ax.recent_deltas = ax.recent_deltas.slice(-6);
      log.axis_changes[axisId] = log.axis_changes[axisId] ?? {};
      log.axis_changes[axisId].delta = (log.axis_changes[axisId].delta ?? 0) + delta;
    }
  }

  if (effects.axis_evidence) {
    for (const [axisId, ev] of Object.entries(effects.axis_evidence)) {
      const ax = state.axes[axisId];
      if (!ax) continue;
      ax.evidence += ev;
      log.axis_changes[axisId] = log.axis_changes[axisId] ?? {};
      log.axis_changes[axisId].evidence = (log.axis_changes[axisId].evidence ?? 0) + ev;
    }
  }

  detectConflicts(state, bundle, log);

  for (const axisId of Object.keys(log.axis_changes)) {
    const axDef = bundle.axesById[axisId];
    if (!axDef) continue;
    recomputeAxisConfidence(state.axes[axisId], axDef);
  }

  if (effects.module_delta_levels) {
    for (const [mid, d] of Object.entries(effects.module_delta_levels)) {
      const ms = state.modules[mid];
      if (!ms) continue;
      ms.level = clamp(ms.level + d, 0, 3);
      log.module_changes[mid] = { delta_level: d, level: ms.level };
    }
  }

  if (effects.module_evidence) {
    for (const [mid, ev] of Object.entries(effects.module_evidence)) {
      const ms = state.modules[mid];
      if (!ms) continue;
      ms.evidence += ev;
      log.module_changes[mid] = { ...(log.module_changes[mid] ?? {}), evidence: ev };
      ms.confidence = clamp(1 - Math.exp(-0.8 * ms.evidence), 0, 1);
    }
  }

  if (effects.set_modes) {
    for (const [modeId, v] of Object.entries(effects.set_modes)) {
      state.modes[modeId] = v;
      log.mode_changes[modeId] = v;
    }
  }

  if (effects.set_tags) {
    for (const t of effects.set_tags) {
      if (!state.tags.includes(t)) {
        state.tags.push(t);
        log.tags_added.push(t);
      }
    }
  }

  if (effects.unset_tags) {
    for (const t of effects.unset_tags) {
      const i = state.tags.indexOf(t);
      if (i >= 0) {
        state.tags.splice(i, 1);
        log.tags_removed.push(t);
      }
    }
  }

  state.asked.push(q.id);
  state.answers.push({ ...answer, ts: Date.now() });
  state.last = { qid: q.id, type: q.type };

  if (q.cooldown?.questions) {
    state.cooldowns[q.id] = { until: state.asked.length + q.cooldown.questions };
  }

  return { state, log };
}

function resolveEffects(q, answer) {
  if (q.type === "choice") {
    const opt = q.options?.find((o) => o.id === answer.oid);
    return opt?.effects ?? {};
  }
  if (q.type === "slider") {
    const v = answer.value;
    const hit = (q.effects_by_range ?? []).find(
      (r) => v >= r.range.min && v <= r.range.max
    );
    return hit?.effects ?? {};
  }
  return {};
}

function detectConflicts(state, bundle, log) {
  for (const [axisId] of Object.entries(log.axis_changes)) {
    const axDef = bundle.axesById[axisId];
    const ax = state.axes[axisId];
    if (!axDef || !ax) continue;
    const strong = axDef.conflict?.strong_delta ?? 2.0;
    const w = axDef.conflict?.window ?? 6;
    const xs = ax.recent_deltas.slice(-w);
    const hasPos = xs.some((d) => d >= strong);
    const hasNeg = xs.some((d) => d <= -strong);
    if (hasPos && hasNeg) {
      ax.conflicts += 1;
    }
  }
}

function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}
