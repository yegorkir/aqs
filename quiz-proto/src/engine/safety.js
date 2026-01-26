export function questionSafetyStatus(q, state) {
  const lines = new Set(state.safety.lines ?? []);
  const veils = new Set(state.safety.veils ?? []);
  const qTags = new Set(q.content_tags ?? []);
  const optTags = new Set((q.options ?? []).flatMap((o) => o.content_tags ?? []));
  const all = new Set([...qTags, ...optTags]);

  for (const t of all) {
    if (lines.has(t)) return { allowed: false, reason: "line", tag: t };
  }

  const veiled = [...all].some((t) => veils.has(t));
  if (veiled) {
    if (!q.veil_variants) return { allowed: false, reason: "veil_missing_variants" };
    return { allowed: true, veiled: true };
  }

  return { allowed: true, veiled: false };
}
