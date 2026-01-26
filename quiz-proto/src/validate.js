export function validateBundleLight(bundle) {
  const warnings = [];

  if (!Array.isArray(bundle.axes) || !bundle.axes.length) {
    warnings.push("Missing or empty axes array.");
  }
  if (!Array.isArray(bundle.questions) || !bundle.questions.length) {
    warnings.push("Missing or empty questions array.");
  }

  warnings.push(...checkIdUniqueness(bundle.axes ?? [], "axis"));
  warnings.push(...checkIdUniqueness(bundle.modules ?? [], "module"));
  warnings.push(...checkIdUniqueness(bundle.modes ?? [], "mode"));
  warnings.push(...checkIdUniqueness(bundle.questions ?? [], "question"));

  const axisIds = new Set((bundle.axes ?? []).map((a) => a.id));
  const moduleIds = new Set((bundle.modules ?? []).map((m) => m.id));
  const modeIds = new Set((bundle.modes ?? []).map((m) => m.id));

  for (const q of bundle.questions ?? []) {
    if (!q.id) {
      warnings.push("Question missing id.");
      continue;
    }
    if (q.type === "slider") {
      const slider = q.slider ?? {};
      if (typeof slider.min !== "number" || typeof slider.max !== "number") {
        warnings.push(`Question ${q.id}: slider min/max must be numbers.`);
      } else if (slider.min >= slider.max) {
        warnings.push(`Question ${q.id}: slider min must be < max.`);
      }
      for (const r of q.effects_by_range ?? []) {
        const min = r.range?.min;
        const max = r.range?.max;
        if (typeof min !== "number" || typeof max !== "number") {
          warnings.push(`Question ${q.id}: range must have numeric min/max.`);
        } else if (min > max) {
          warnings.push(`Question ${q.id}: range min must be <= max.`);
        }
      }
    }

    for (const o of q.options ?? []) {
      const effects = o.effects ?? {};
      warnings.push(...checkAxisRefs(q.id, effects.axis_deltas, axisIds));
      warnings.push(...checkAxisRefs(q.id, effects.axis_evidence, axisIds));
      warnings.push(...checkModuleRefs(q.id, effects.module_delta_levels, moduleIds));
      warnings.push(...checkModuleRefs(q.id, effects.module_evidence, moduleIds));
      warnings.push(...checkModeRefs(q.id, effects.set_modes, modeIds));
    }

    for (const r of q.effects_by_range ?? []) {
      const effects = r.effects ?? {};
      warnings.push(...checkAxisRefs(q.id, effects.axis_deltas, axisIds));
      warnings.push(...checkAxisRefs(q.id, effects.axis_evidence, axisIds));
    }
  }

  return warnings;
}

function checkIdUniqueness(list, label) {
  const seen = new Set();
  const warnings = [];
  for (const item of list) {
    if (!item?.id) continue;
    if (seen.has(item.id)) {
      warnings.push(`Duplicate ${label} id: ${item.id}`);
    }
    seen.add(item.id);
  }
  return warnings;
}

function checkAxisRefs(qid, effectsMap, axisIds) {
  const warnings = [];
  for (const axisId of Object.keys(effectsMap ?? {})) {
    if (!axisIds.has(axisId)) {
      warnings.push(`Question ${qid}: unknown axis id ${axisId}.`);
    }
  }
  return warnings;
}

function checkModuleRefs(qid, effectsMap, moduleIds) {
  const warnings = [];
  for (const moduleId of Object.keys(effectsMap ?? {})) {
    if (!moduleIds.has(moduleId)) {
      warnings.push(`Question ${qid}: unknown module id ${moduleId}.`);
    }
  }
  return warnings;
}

function checkModeRefs(qid, effectsMap, modeIds) {
  const warnings = [];
  for (const modeId of Object.keys(effectsMap ?? {})) {
    if (!modeIds.has(modeId)) {
      warnings.push(`Question ${qid}: unknown mode id ${modeId}.`);
    }
  }
  return warnings;
}
