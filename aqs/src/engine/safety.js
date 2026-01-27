export function questionSafetyStatus(q, state, bundle) {
  const sensitiveGroups = new Set(bundle?.safety_config?.sensitive_groups ?? []);
  const tagsById = bundle?.safetyTagsById ?? {};
  const lines = new Set(state.safety.lines ?? []);
  const veils = new Set(state.safety.veils ?? []);
  const qTags = new Set(q.content_tags ?? []);
  const optTags = new Set((q.options ?? []).flatMap((o) => o.content_tags ?? []));
  const all = new Set([...qTags, ...optTags]);

  if (sensitiveGroups.size && state.safety.completion_mode !== "completed") {
    for (const t of all) {
      const tag = tagsById[t];
      if (tag && sensitiveGroups.has(tag.group)) {
        return { allowed: false, reason: "pre_safety_gate", tag: t, group: tag.group };
      }
    }
  }

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
