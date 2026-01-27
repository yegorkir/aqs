import { passesEligibility } from "./eligibility.js";
import { questionSafetyStatus } from "./safety.js";

export function resolveFollowup(state, bundle, question, answer) {
  if (question.type === "choice") {
    return resolveChoiceFollowup(state, bundle, question, answer);
  }
  if (question.type === "slider") {
    return resolveSliderFollowup(state, bundle, question, answer);
  }
  return null;
}

function resolveChoiceFollowup(state, bundle, question, answer) {
  const rules = question.followups ?? [];
  for (const rule of rules) {
    const ids = rule.when?.option_id_in ?? [];
    if (!ids.includes(answer.oid)) continue;
    const qid = pickFromPool(state, bundle, rule.policy?.pool ?? []);
    return qid ? { qid, rule } : null;
  }
  return null;
}

function resolveSliderFollowup(state, bundle, question, answer) {
  const rules = question.followups_by_range ?? [];
  for (const rule of rules) {
    const min = rule.range?.min;
    const max = rule.range?.max;
    if (typeof min !== "number" || typeof max !== "number") continue;
    if (answer.value < min || answer.value > max) continue;
    const qid = pickFromPool(state, bundle, rule.policy?.pool ?? []);
    return qid ? { qid, rule } : null;
  }
  return null;
}

function pickFromPool(state, bundle, pool) {
  for (const qid of pool) {
    const q = bundle.questionsById?.[qid];
    if (!q) continue;
    if (state.asked.includes(qid)) continue;
    if (state.pending_followups.includes(qid)) continue;
    const cd = state.cooldowns[qid];
    if (cd && state.asked.length < cd.until) continue;
    if (!passesEligibility(q, state)) continue;
    const safety = questionSafetyStatus(q, state, bundle);
    if (!safety.allowed) continue;
    return qid;
  }
  return null;
}
