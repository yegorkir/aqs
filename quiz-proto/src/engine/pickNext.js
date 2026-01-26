import { questionSafetyStatus } from "./safety.js";

export function pickNextQuestion(state, bundle) {
  if (state.pending_followups?.length) {
    const qid = state.pending_followups.shift();
    return {
      pick: qid,
      debug: {
        top: [],
        count: 0,
        rejected: { asked: 0, cooldown: 0, eligibility: 0, safety: 0 },
        followup_forced: true,
        followup_qid: qid,
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
    if (state.asked.includes(q.id)) {
      rejected.asked += 1;
      continue;
    }
    const cd = state.cooldowns[q.id];
    if (cd && state.asked.length < cd.until) {
      rejected.cooldown += 1;
      continue;
    }
    if (!passesEligibility(q, state)) {
      rejected.eligibility += 1;
      continue;
    }
    const s = questionSafetyStatus(q, state);
    if (!s.allowed) {
      rejected.safety += 1;
      continue;
    }

    const score = scoreQuestion(q, state, s.veiled);
    candidates.push({ qid: q.id, score, veiled: s.veiled, why: score.why });
  }

  candidates.sort((a, b) => b.score.total - a.score.total);
  const pick = candidates[0] ?? null;

  return {
    pick: pick?.qid ?? null,
    debug: {
      top: candidates.slice(0, 5),
      count: candidates.length,
      rejected,
      followup_forced: false,
    },
  };
}

function passesEligibility(q, state) {
  const req = q.eligibility?.requires;
  if (req?.axes_confidence_lt) {
    for (const [axisId, thr] of Object.entries(req.axes_confidence_lt)) {
      if ((state.axes[axisId]?.confidence ?? 0) >= thr) return false;
    }
  }
  return true;
}

function scoreQuestion(q, state, isVeiled) {
  const touchedAxes = new Set();
  const touchedModules = new Set();

  if (q.type === "choice") {
    for (const o of q.options ?? []) {
      for (const k of Object.keys(o.effects?.axis_deltas ?? {})) touchedAxes.add(k);
      for (const k of Object.keys(o.effects?.axis_evidence ?? {})) touchedAxes.add(k);
      for (const k of Object.keys(o.effects?.module_evidence ?? {})) touchedModules.add(k);
      for (const k of Object.keys(o.effects?.module_delta_levels ?? {}))
        touchedModules.add(k);
    }
  } else if (q.type === "slider") {
    for (const r of q.effects_by_range ?? []) {
      for (const k of Object.keys(r.effects?.axis_deltas ?? {})) touchedAxes.add(k);
      for (const k of Object.keys(r.effects?.axis_evidence ?? {})) touchedAxes.add(k);
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
  return { total, why, base, penalty };
}
