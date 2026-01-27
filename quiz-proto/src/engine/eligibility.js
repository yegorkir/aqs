export function passesEligibility(q, state) {
  return passesEligibilityCore(q, state, null);
}

export function passesEligibilityFocus(q, state) {
  const focusAxisId = state.focus?.type === "axis" ? state.focus.id : null;
  return passesEligibilityCore(q, state, focusAxisId);
}

function passesEligibilityCore(q, state, ignoreAxisId) {
  const req = q.eligibility?.requires ?? {};
  const fb = q.eligibility?.forbids ?? {};

  if (typeof req.min_asked === "number" && state.asked.length < req.min_asked) {
    return false;
  }

  if (req.axes_confidence_lt) {
    for (const [axisId, thr] of Object.entries(req.axes_confidence_lt)) {
      if (ignoreAxisId && axisId === ignoreAxisId) continue;
      if ((state.axes[axisId]?.confidence ?? 0) >= thr) return false;
    }
  }

  if (req.axes_confidence_gte) {
    for (const [axisId, thr] of Object.entries(req.axes_confidence_gte)) {
      if (ignoreAxisId && axisId === ignoreAxisId) continue;
      if ((state.axes[axisId]?.confidence ?? 0) < thr) return false;
    }
  }

  const tags = new Set(state.tags ?? []);
  if (Array.isArray(req.tags_all)) {
    for (const t of req.tags_all) {
      if (!tags.has(t)) return false;
    }
  }

  if (Array.isArray(req.tags_any) && req.tags_any.length) {
    if (!req.tags_any.some((t) => tags.has(t))) return false;
  }

  if (req.modes) {
    for (const [mid, v] of Object.entries(req.modes)) {
      if (!modeValueMatches(state.modes?.[mid], v)) return false;
    }
  }

  if (Array.isArray(fb.tags_any) && fb.tags_any.length) {
    if (fb.tags_any.some((t) => tags.has(t))) return false;
  }

  if (fb.modes) {
    for (const [mid, v] of Object.entries(fb.modes)) {
      if (modeValueMatches(state.modes?.[mid], v)) return false;
    }
  }

  return true;
}

export function modeValueMatches(stateValue, expectedValue) {
  return normalizeModeValue(stateValue) === normalizeModeValue(expectedValue);
}

function normalizeModeValue(value) {
  if (value === true || value === "true" || value === "yes") return "true";
  if (value === false || value === "false" || value === "no") return "false";
  if (value == null) return "unknown";
  return String(value);
}
