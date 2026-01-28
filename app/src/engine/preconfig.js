export function computeClarifyPairs(axisValues, preconfig) {
  const pairs = preconfig?.axis_pairs ?? [];
  const minPercent = preconfig?.clarify?.min_percent ?? 50;
  const maxDiff = preconfig?.clarify?.max_diff ?? 10;
  const result = [];
  for (const item of pairs) {
    const [left, right] = item?.pair ?? [];
    if (!left || !right) continue;
    const leftValue = Number(axisValues[left]);
    const rightValue = Number(axisValues[right]);
    if (!Number.isFinite(leftValue) || !Number.isFinite(rightValue)) continue;
    const leftPct = leftValue * 100;
    const rightPct = rightValue * 100;
    const bothHigh = leftPct >= minPercent && rightPct >= minPercent;
    const diffLow = Math.abs(leftPct - rightPct) <= maxDiff;
    if (bothHigh && diffLow) result.push([left, right]);
  }
  return result;
}

export function applyPreconfigAdjustments(axisValues, specify, preconfig) {
  const minMul = preconfig?.clarify?.min_multiplier ?? 0.5;
  const maxMul = preconfig?.clarify?.max_multiplier ?? 1.5;
  const adjusted = { ...axisValues };
  for (const [pairKey, delta] of Object.entries(specify ?? {})) {
    const [left, right] = pairKey.split("-");
    if (!left || !right) continue;
    const shift = Number(delta);
    if (!Number.isFinite(shift)) continue;
    const leftMul = clamp(1 - shift, minMul, maxMul);
    const rightMul = clamp(1 + shift, minMul, maxMul);
    if (Number.isFinite(axisValues[left])) {
      adjusted[left] = clamp01(axisValues[left] * leftMul);
    }
    if (Number.isFinite(axisValues[right])) {
      adjusted[right] = clamp01(axisValues[right] * rightMul);
    }
  }
  return adjusted;
}

export function clamp01(x) {
  return clamp(x, 0, 1);
}

function clamp(x, min, max) {
  return Math.max(min, Math.min(max, x));
}
