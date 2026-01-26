export function recomputeAxisConfidence(axisState, axisDef) {
  const k = 0.8;
  const base = clamp(1 - Math.exp(-k * axisState.evidence), 0, 1);
  const penalty = (axisDef.conflict?.penalty ?? 0.15) * (axisState.conflicts ?? 0);
  axisState.confidence = clamp(base - penalty, 0, 1);
}

function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}
