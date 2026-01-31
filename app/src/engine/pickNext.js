import { questionSafetyStatus } from "./safety.js";
import { passesEligibility, passesEligibilityFocus } from "./eligibility.js";

export function pickNextQuestion(state, bundle) {
  const followupPick = pickAllowedFollowup(state, bundle);
  if (followupPick) {
    return {
      pick: followupPick,
      debug: {
        top: [],
        count: 0,
        rejected: { asked: 0, cooldown: 0, eligibility: 0, safety: 0 },
        followup_forced: true,
        followup_qid: followupPick,
      },
    };
  }

  const candidates = [];
  const rejected = {
    asked: 0,
    cooldown: 0,
    eligibility: 0,
    safety: 0,
    pool_exclude: 0,
    priority: 0,
  };

  for (const q of bundle.questions ?? []) {
    if (q.tags?.includes("pool_exclude")) {
      rejected.pool_exclude += 1;
      continue;
    }
    const allowRepeatForMode = state.focus?.type === "mode";
    if (state.asked.includes(q.id) && !allowRepeatForMode) {
      rejected.asked += 1;
      continue;
    }
    const cd = state.cooldowns[q.id];
    if (cd && state.asked.length < cd.until) {
      rejected.cooldown += 1;
      continue;
    }
    if (state.focus) {
      if (!passesEligibilityFocus(q, state)) {
        rejected.eligibility += 1;
        continue;
      }
    } else if (!passesEligibility(q, state)) {
      rejected.eligibility += 1;
      continue;
    }
    const s = questionSafetyStatus(q, state, bundle);
    if (!s.allowed) {
      rejected.safety += 1;
      continue;
    }

    const score = scoreQuestion(q, state, s.veiled, bundle);
    if (state.focus) {
      if (state.focus.type === "axis" && !score.touchedAxes.has(state.focus.id)) {
        rejected.eligibility += 1;
        continue;
      }
      if (state.focus.type === "module" && !score.touchedModules.has(state.focus.id)) {
        rejected.eligibility += 1;
        continue;
      }
      if (state.focus.type === "mode" && !score.touchedModes.has(state.focus.id)) {
        rejected.eligibility += 1;
        continue;
      }
    }
    candidates.push({
      qid: q.id,
      score,
      veiled: s.veiled,
      why: score.why,
      isDilemma: q.tags?.includes("dilemma") ?? false,
    });
  }

  candidates.sort((a, b) => b.score.total - a.score.total);
  const priorityPick = pickPriorityCandidate(state, candidates);
  const pick = priorityPick?.pick ?? candidates[0] ?? null;
  const margin = priorityPick?.margin ?? computeMargin(candidates);

  return {
    pick: pick?.qid ?? null,
    debug: {
      top: priorityPick?.top ?? candidates.slice(0, 5),
      count: candidates.length,
      rejected,
      followup_forced: false,
      margin,
      priority: priorityPick?.debug ?? null,
    },
  };
}

function pickAllowedFollowup(state, bundle) {
  while (state.pending_followups?.length) {
    const qid = state.pending_followups.shift();
    const q = bundle.questionsById?.[qid];
    if (!q) continue;
    if (state.asked.includes(qid)) continue;
    const cd = state.cooldowns[qid];
    if (cd && state.asked.length < cd.until) continue;
    if (!passesEligibility(q, state)) continue;
    const s = questionSafetyStatus(q, state, bundle);
    if (!s.allowed) continue;
    return qid;
  }
  return null;
}

function pickPriorityCandidate(state, candidates) {
  const priority = state.axis_priority ?? {};
  const tierAxes = getPriorityTierAxes(priority);
  if (!tierAxes.length) return null;

  const axesSet = new Set(tierAxes);
  const prioritized = candidates.filter(
    (c) => c.isDilemma && hasAnyAxis(c.score.touchedAxes, axesSet)
  );
  if (!prioritized.length) {
    return null;
  }

  const pick = prioritized[Math.floor(Math.random() * prioritized.length)];
  const top = [...prioritized].sort((a, b) => b.score.total - a.score.total).slice(0, 5);

  return {
    pick,
    top,
    margin: computeMargin(prioritized),
    debug: {
      tier: Math.max(...tierAxes.map((id) => priority[id]?.tier ?? 0)),
      axes: tierAxes,
      candidates_count: prioritized.length,
      pick: pick?.qid ?? null,
    },
  };
}

function getPriorityTierAxes(priority) {
  const tier2 = [];
  const tier1 = [];
  for (const [axisId, entry] of Object.entries(priority)) {
    if (entry?.tier === 2) tier2.push(axisId);
    else if (entry?.tier === 1) tier1.push(axisId);
  }
  return tier2.length ? tier2 : tier1;
}

function hasAnyAxis(touchedAxes, axesSet) {
  for (const axisId of touchedAxes) {
    if (axesSet.has(axisId)) return true;
  }
  return false;
}

function computeMargin(candidates) {
  const ordered = [...candidates].sort((a, b) => b.score.total - a.score.total);
  return ordered.length >= 2 ? ordered[0].score.total - ordered[1].score.total : null;
}

function scoreQuestion(q, state, isVeiled, bundle) {
  const touchedAxes = new Set();
  const touchedModules = new Set();
  const touchedModes = new Set();

  if (q.type === "safety") {
    const penalty = (q.fatigue_cost ?? 0) * 0.15 + (isVeiled ? 0.4 : 0);
    const base = 0.6;
    const total = base - penalty;
    return {
      total,
      why: { axes: {}, penalties: { fatigue: (q.fatigue_cost ?? 0) * 0.15, veil: isVeiled ? 0.4 : 0 } },
      base,
      penalty,
      touchedAxes,
      touchedModules,
      touchedModes,
    };
  }

  if (q.type === "choice") {
    for (const o of q.options ?? []) {
      for (const k of Object.keys(o.effects?.axis_deltas ?? {})) touchedAxes.add(k);
      for (const k of Object.keys(o.effects?.axis_evidence ?? {})) touchedAxes.add(k);
      for (const k of Object.keys(o.effects?.module_evidence ?? {})) touchedModules.add(k);
      for (const k of Object.keys(o.effects?.module_delta_levels ?? {}))
        touchedModules.add(k);
      for (const k of Object.keys(o.effects?.set_modes ?? {})) touchedModes.add(k);
      for (const k of Object.keys(o.effects?.set_module_level ?? {})) touchedModules.add(k);
    }
  } else if (q.type === "slider") {
    for (const r of q.effects_by_range ?? []) {
      for (const k of Object.keys(r.effects?.axis_deltas ?? {})) touchedAxes.add(k);
      for (const k of Object.keys(r.effects?.axis_evidence ?? {})) touchedAxes.add(k);
      for (const k of Object.keys(r.effects?.module_evidence ?? {})) touchedModules.add(k);
      for (const k of Object.keys(r.effects?.module_delta_levels ?? {}))
        touchedModules.add(k);
      for (const k of Object.keys(r.effects?.set_modes ?? {})) touchedModes.add(k);
      for (const k of Object.keys(r.effects?.set_module_level ?? {})) touchedModules.add(k);
    }
  }

  const w1 = 1.0;
  const w2 = 1.2;
  let base = 0;
  const why = { axes: {}, penalties: {}, prior: {} };

  for (const axisId of touchedAxes) {
    const ax = state.axes[axisId];
    if (!ax) continue;
    const need_conf = 1 - (ax.confidence ?? 0);
    const need_conflict = (ax.conflicts ?? 0) > 0 ? 0.35 : 0;
    const need = w1 * need_conf + w2 * need_conflict;
    base += need;
    why.axes[axisId] = { need_conf, need_conflict, need };
  }

  const prior = computePriorGain(state, touchedAxes, touchedModules, bundle);
  const priorGain = prior.total;
  why.prior = prior.why;

  let penalty = 0;
  penalty += (q.fatigue_cost ?? 0) * 0.15;
  if (isVeiled) penalty += 0.4;

  why.penalties = {
    fatigue: (q.fatigue_cost ?? 0) * 0.15,
    veil: isVeiled ? 0.4 : 0,
  };

  const total = base + priorGain - penalty;
  return { total, why, base, priorGain, penalty, touchedAxes, touchedModules, touchedModes };
}

function computePriorGain(state, touchedAxes, touchedModules, bundle) {
  const adjusted = state?.preconfig?.adjusted;
  const axisValues = adjusted?.axes ?? {};
  const moduleValues = adjusted?.modules ?? {};
  const axisUniverse = (bundle?.axes ?? []).map((a) => a.id);
  const values = axisUniverse.length
    ? axisUniverse.map((id) => {
        const v = Number(axisValues[id]);
        return Number.isFinite(v) ? v : 0.5;
      })
    : Object.keys(axisValues)
        .map((id) => Number(axisValues[id]))
        .filter((v) => Number.isFinite(v));
  if (!values.length) return { total: 0, why: { axes: {}, modules: {} } };

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / Math.max(values.length, 1);
  const std = Math.sqrt(variance);
  const denom = Math.max(std, 0.05);
  const weight = 0.8;

  let total = 0;
  const why = { axes: {}, modules: {} };

  for (const axisId of touchedAxes) {
    const val = Number(axisValues[axisId]);
    if (!Number.isFinite(val)) continue;
    const conf = state.axes[axisId]?.confidence ?? 0;
    const peak = Math.abs(val - mean) / denom;
    const gain = weight * peak * (1 - conf);
    total += gain;
    why.axes[axisId] = { value: val, mean, std, peak, gain };
  }

  for (const modId of touchedModules) {
    const val = Number(moduleValues[modId]);
    if (!Number.isFinite(val)) continue;
    const conf = state.modules[modId]?.confidence ?? 0;
    const gain = weight * val * (1 - conf);
    total += gain;
    why.modules[modId] = { value: val, gain };
  }

  return { total, why };
}
