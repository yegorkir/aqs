export function evaluateStop(state, bundle) {
  const {
    min_questions,
    max_questions,
    min_axis_confidence,
    target_margin,
  } = state.stop;

  const n = state.asked.length;
  if (n < min_questions) return { propose: false, reasons: ["min_questions"] };
  if (n >= max_questions) return { propose: true, reasons: ["max_questions_forced"] };

  const keyAxes = bundle.key_axes ?? (bundle.axes ?? []).map((a) => a.id);
  const minConf = Math.min(...keyAxes.map((id) => state.axes[id]?.confidence ?? 0));
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

  return { propose: true, reasons: ["saturated"] };
}
