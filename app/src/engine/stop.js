export function evaluateStop(state, bundle) {
  const {
    min_questions,
    min_axis_confidence,
    target_margin,
    max_questions,
  } = state.stop;

  const keyAxes = bundle.key_axes ?? (bundle.axes ?? []).map((a) => a.id);
  const axisConf = keyAxes.map((id) => state.axes[id]?.confidence ?? 0);

  const thresholds = {
    low: 0.2,
    medium: 0.4,
    high: 0.66,
  };
  const counts = {
    high: axisConf.filter((v) => v >= thresholds.high).length,
    medium: axisConf.filter((v) => v >= thresholds.medium && v < thresholds.high).length,
    low: axisConf.filter((v) => v >= thresholds.low && v < thresholds.medium).length,
    unknown: axisConf.filter((v) => v < thresholds.low).length,
  };
  const moduleIds = Object.keys(state.modules ?? {});
  const moduleConf = moduleIds.map((id) => state.modules[id]?.confidence ?? 0);
  const modulesUnknown = moduleConf.filter((v) => v < thresholds.low).length;
  if (counts.unknown === 0 && modulesUnknown === 0) {
    return { propose: true, reasons: ["axis_module_defined_override"] };
  }
  if (counts.high >= 1 && counts.medium >= 1) {
    return { propose: true, reasons: ["axis_mix_override", counts] };
  }

  const n = state.asked.length;
  if (typeof max_questions === "number" && n >= max_questions) {
    return { propose: true, reasons: ["max_questions_forced", n] };
  }
  if (n < min_questions) return { propose: false, reasons: ["min_questions"] };

  const minConf = Math.min(...axisConf);
  if (minConf < min_axis_confidence) {
    return { propose: false, reasons: ["low_axis_confidence", minConf] };
  }

  const margin = state.candidates?.margin;
  if (typeof margin === "number" && margin < target_margin) {
    return { propose: false, reasons: ["low_margin", margin] };
  }

  const conflicts = keyAxes.reduce(
    (sum, id) => sum + (state.axes[id]?.conflicts ?? 0),
    0
  );
  if (conflicts > 0) return { propose: false, reasons: ["conflicts", conflicts] };

  if (counts.unknown > 0) {
    return { propose: false, reasons: ["axis_undefined", counts.unknown] };
  }
  if (counts.high < 1 || counts.medium < 1 || counts.low < 1) {
    return { propose: false, reasons: ["axis_mix_missing", counts] };
  }

  return { propose: true, reasons: ["saturated"] };
}
