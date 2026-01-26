# Checklist: quiz-proto

## 2026-01-26
- [x] Create minimal static prototype files.
- [x] Load bundle and schema from repo paths.
- [x] Implement lightweight validation warnings.
- [x] Implement core engine and state flow.
- [x] Render question + debug panel and support logging/export.
- [ ] Manual browser smoke test.
- [x] Support markdown-fenced JSON loading.
- [x] Add session id fallback without `crypto.randomUUID`.
- [x] Ensure followups are served immediately after triggering answers.
- [x] Add richer JSONL event payloads for debugging.
- [x] Remove UI auto "Not sure" and rely on bundle options.
- [x] Exclude followup-only questions from the main pool via tag.
- [x] Add reset/safety log events and pool_exclude rejection counts.
- [x] Add new sig/scene/reference questions with gating in bundle.
- [x] Add reference followups and reduce evidence weights.
- [x] Add new dilemma questions with gating in bundle.
