export function resolveFollowup(state, question, answer) {
  if (question.type === "choice") {
    return resolveChoiceFollowup(state, question, answer);
  }
  if (question.type === "slider") {
    return resolveSliderFollowup(state, question, answer);
  }
  return null;
}

function resolveChoiceFollowup(state, question, answer) {
  const rules = question.followups ?? [];
  for (const rule of rules) {
    const ids = rule.when?.option_id_in ?? [];
    if (!ids.includes(answer.oid)) continue;
    const qid = pickFromPool(state, rule.policy?.pool ?? []);
    return qid ? { qid, rule } : null;
  }
  return null;
}

function resolveSliderFollowup(state, question, answer) {
  const rules = question.followups_by_range ?? [];
  for (const rule of rules) {
    const min = rule.range?.min;
    const max = rule.range?.max;
    if (typeof min !== "number" || typeof max !== "number") continue;
    if (answer.value < min || answer.value > max) continue;
    const qid = pickFromPool(state, rule.policy?.pool ?? []);
    return qid ? { qid, rule } : null;
  }
  return null;
}

function pickFromPool(state, pool) {
  for (const qid of pool) {
    if (state.asked.includes(qid)) continue;
    if (state.pending_followups.includes(qid)) continue;
    return qid;
  }
  return null;
}
