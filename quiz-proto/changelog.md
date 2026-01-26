# Changelog: quiz-proto

## 2026-01-26
- Added static prototype shell with engine, UI, logging, and validation warnings.
- Added fenced-JSON parsing in loader to handle markdown-wrapped bundle/schema files.
- Added `crypto.randomUUID` fallback for session ids.
- Added immediate follow-up queueing and forced selection in question picker.
- Expanded JSONL logging with session/event metadata and decision context.
- Added explicit "unsure" options in bundle and removed UI auto "Not sure" button.
- Added pool exclusion tag handling for followup-only questions.
- Added additional log events for reset and safety toggle; pickNext now reports pool_exclude rejections.
- Added 15 new sig/scene/reference questions with anonymized reference vibes and eligibility gating.
- Added followups for reference questions and reduced evidence weights in new questions.
- Added 12 new dilemma questions to the bundle with min_asked gating.
