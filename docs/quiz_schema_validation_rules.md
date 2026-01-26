# Quiz Schema Validation Rules

This document defines which validations are enforced at build-time (static content) versus runtime (live state).

## Build-time (content validation)

These rules apply to JSON content bundles validated against `schema/quiz.schema.json` plus cross-reference checks.

Required:
- Schema validation against Draft 2020-12.
- `schema_version` and `content_version` must be present and follow the project versioning convention.
- The primary schema entrypoint is the full `QuizContentBundle`; entity-level validation should use `$defs` refs.
- All IDs are unique within their category: axes, modules, modes, safety tags, questions, options.
- All references exist:
  - `question.followups.policy.pool` references existing `QuestionContract` ids.
  - `effects.axis_deltas` and `effects.axis_evidence` keys reference existing axes.
  - `effects.module_delta_levels`, `effects.set_module_level`, and `effects.module_evidence` keys reference existing modules.
  - `effects.set_modes` keys reference existing modes.
  - `content_tags` reference existing `SafetyTagDefinition.id` values (post-normalization).
- `veil_variants` is required for any question that can be shown under a veil (content tags or option tags are in safety veils).
- Eligibility format must match the schema (axes confidence thresholds, tag requirements, and mode requirements).
- Mode defaults are validated by cross-validator rules; JSON Schema alone is not sufficient.

Additional constraints not enforceable by JSON Schema alone:
- `effects.module_delta_levels` and `effects.set_module_level` must not target the same module id (per-module mutual exclusion).
- `OptionContract.id` values are unique within a question.
- `SliderQuestionContract` must declare `coverage_policy`:
  - `full`: `effects_by_range` must cover all valid slider values.
  - `gaps_allowed`: uncovered slider values are permitted.
- `SliderQuestionContract.followups_by_range` ranges must not overlap.
- `ModeDefinition.default` must be valid for the mode type:
  - `bool`: `"true"` or `"false"`
  - `tri_bool`: `"true"`, `"false"`, or `"unknown"`
  - `enum`: one of `options`
- `AxisDefinition.scale` and `score_range` must have `min < max`.
- `AxisDefinition.conflict.window` must be >= the maximum number of `recent_deltas` retained in runtime.
- Safety normalization applies to both content and state:
  - normalize aliases in question/option `content_tags`
  - normalize aliases in `safety.lines` and `safety.veils` before any filtering
- Mode/safety question minimal requirements (build-time):
  - `type: \"mode\"` or `type: \"safety\"` must include `options` and each option must include `effects`.
- Veil support rule (build-time):
  - any question or option with non-empty `content_tags` must include `veil_variants`.

## Runtime validation (state + safety)

These rules are applied when selecting and rendering questions, and when applying answers.

Required:
- Eligibility checks for each question (confidence thresholds, modes, tags).
- Safety checks:
  - Lines: exclude questions/options with `content_tags` intersecting `safety.lines`.
  - Veils: if allowed, only show the question when `veil_variants` are present and applied.
  - Pre-safety gating: while `safety.completion_mode != "completed"`, avoid questions with tags in `SafetyConfig.sensitive_groups`.
- Cooldown checks per question.
- Conflict handling and confidence recomputation after each answer.
- Effect application is deterministic; only declared effects may modify state.

## Versioning

- `schema_version`: bump when the schema structure changes.
- `content_version`: bump when the content set changes without schema changes.
