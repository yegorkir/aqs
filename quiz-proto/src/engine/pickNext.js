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

    const score = scoreQuestion(q, state, s.veiled);
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
    candidates.push({ qid: q.id, score, veiled: s.veiled, why: score.why });
  }

  candidates.sort((a, b) => b.score.total - a.score.total);
  const pick = candidates[0] ?? null;
  const margin =
    candidates.length >= 2
      ? candidates[0].score.total - candidates[1].score.total
      : null;

  return {
    pick: pick?.qid ?? null,
    debug: {
      top: candidates.slice(0, 5),
      count: candidates.length,
      rejected,
      followup_forced: false,
      margin,
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

function scoreQuestion(q, state, isVeiled) {
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
  const why = { axes: {}, penalties: {} };

  for (const axisId of touchedAxes) {
    const ax = state.axes[axisId];
    if (!ax) continue;
    const need_conf = 1 - (ax.confidence ?? 0);
    const need_conflict = (ax.conflicts ?? 0) > 0 ? 0.35 : 0;
    const need = w1 * need_conf + w2 * need_conflict;
    base += need;
    why.axes[axisId] = { need_conf, need_conflict, need };
  }

  let penalty = 0;
  penalty += (q.fatigue_cost ?? 0) * 0.15;
  if (isVeiled) penalty += 0.4;

  why.penalties = {
    fatigue: (q.fatigue_cost ?? 0) * 0.15,
    veil: isVeiled ? 0.4 : 0,
  };

  const total = base - penalty;
  return { total, why, base, penalty, touchedAxes, touchedModules, touchedModes };
}
