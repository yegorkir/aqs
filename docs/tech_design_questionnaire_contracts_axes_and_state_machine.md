# Tech Design: Questionnaire Contracts, Axes, And State Machine

> Детерминированная система без ML/AI.
>
> Этот документ объединяет контракты данных (JSON), runtime‑состояние, стейт‑машину, выбор следующего вопроса, а также Safety (Lines/Veils). Дополнительно описаны кластеры (если используются) и explainability.

---

## 0) Цели техдизайна

- Единый движок, полностью управляемый данными.
- Адаптивность через **score + confidence** по осям и модулям.
- Follow‑ups (как «акинатор») без жёсткого дерева.
- Приватность: шаринг результата без истории ответов; Lines/Veils — только по явному согласию.

---

## 1) Термины

- **Axis (ось)** — измерение предпочтений игрока (направление + интенсивность + уверенность).
- **Score** — куда склоняется игрок по оси (может быть отрицательным/положительным).
- **Confidence** — насколько хорошо эта ось измерена (0..1).
- **Evidence** — количество/вес наблюдений, которые увеличивали confidence.
- **Conflict** — противоречивые сильные ответы по одной оси, понижает confidence и триггерит уточнение.
- **Module (interest)** — интенсивность интереса к модулю (0..3) + confidence.
- **Mode (implementation)** — допустимость/запрет формата (bool/tri_bool/enum).
- **Safety (Lines/Veils)** — ограничения контента, не предпочтения.
- **Question** — единица взаимодействия (choice / slider / mode / safety). Может иметь followups.
- **Option** — ответ в choice‑вопросе.
- **Slider** — вопрос со значением в диапазоне; эффекты и followups зависят от range.
- **Effect** — изменение состояния (оси/модули/моды/теги/метаданные).
- **Cluster** — кандидатный «сеттинг» или профиль, выраженный через цели по осям/тегам (опционально).

---

## 2) Модель профиля: слои + safety

Система хранит четыре независимых слоя данных:

1. **Core axes** — спектры опыта (score + confidence)
2. **Interest modules** — интенсивности 0..3 (level + confidence)
3. **Implementation modes** — флаги/энумы допустимости (без score)
4. **SafetyProfile (Lines/Veils)** — ограничения контента (не предпочтения)

Важно: (1)(2) участвуют в расчёте рекомендаций; (3)(4) — ограничивают/настраивают реализацию и допустимость вопросов/контента.

---

## 3) Контракты данных

### 3.1 Axes

#### AxisDefinition

```json
{
  "id": "tone",
  "title": "Тон",
  "description": "Пояснение для новичков (опционально)",
  "polarity": { "neg_label": "Уютный", "pos_label": "Мрачный" },
  "scale": { "min": -2, "max": 2, "step": 1 },
  "score_range": { "min": -10, "max": 10 },
  "defaults": { "score": 0, "confidence": 0, "evidence": 0 },
  "decay": { "enabled": false, "half_life_questions": 999 },
  "conflict": { "window": 6, "strong_delta": 2.0, "penalty": 0.15, "threshold": 1 }
}
```

Notes:
- `scale` — UI‑шкала (например, для визуализации). `score_range` — ожидаемые границы суммарного score (калибровка). Можно хранить оба.
- `defaults` — стартовое состояние оси.
- `decay` обычно выключен для MVP.

#### AxisState (runtime)

```json
{ "score": 1.0, "confidence": 0.38, "evidence": 2.2, "recent_deltas": [1.0, -2.0], "conflicts": 1 }
```

Notes:
- Источник истины для confidence — `evidence` и `conflicts`; confidence пересчитывается детерминированно после каждого ответа.
- Каноническая формула (MVP): `base = clamp(1 - exp(-k * evidence), 0, 1)`; затем `confidence = max(0, base - conflicts * conflict.penalty)`.

### 3.2 Interest modules

#### ModuleDefinition

```json
{ "id": "m_detective", "title": "Детективность", "levels": ["нет","фоном","заметно","в центре"], "defaults": { "level": 0, "confidence": 0, "evidence": 0 } }
```

#### ModuleState

```json
{ "level": 2, "confidence": 0.55, "evidence": 1.7 }
```

### 3.3 Implementation modes

#### ModeDefinition

```json
{ "id": "romance.pc_npc", "type": "tri_bool", "title": "Романтика PC↔NPC", "default": "unknown" }
```

Mode types:

- `bool`: true/false
- `tri_bool`: true/false/unknown
- `enum`: oneOf

### 3.4 Safety (Lines/Veils)

#### SafetyTagDefinition

```json
{
  "id": "explicit_gore",
  "label": "Подробное насилие/кровь",
  "group": "violence",
  "aliases": ["gore"],
  "ui_topic": "body_horror"
}
```

#### SafetyProfileState

```json
{
  "lines": ["sexual_violence"],
  "veils": ["explicit_gore", "dismemberment"],
  "completion_mode": "unset"
}
```

Rules:

- **Line**: запрещено → исключаем вопросы/опции с этим `content_tag`.
- **Veil**: допускается без подробностей → вопрос возможен, но нежелателен; при показе используем `veil_variants`.

#### SafetyConfig (optional)

```json
{ "sensitive_groups": ["sex", "violence", "selfharm"] }
```

Notes:
- `id` — канонический `content_tag`, который хранится в вопросах/опциях и в `SafetyProfileState`.
- `aliases` — опциональные синонимы для миграции, не используются в рантайме после нормализации.
- `ui_topic` — опциональная группировка для UI, не участвует в логике.
- Если `sensitive_groups` не задан, чувствительные группы считаются пустыми.

---

## 4) Контракты вопросов

### 4.1 Общий QuestionContract

```json
{
  "id": "q_001",
  "type": "choice",
  "title": "…",
  "prompt": "…",
  "help": "…",
  "tags": ["vibe"],
  "content_tags": ["romance"],
  "complexity": 2,
  "fatigue_cost": 1,
  "cooldown": { "questions": 3 },
  "eligibility": {
    "requires": { "axes_confidence_lt": { "tone": 0.6 } },
    "forbids": { "modes": {}, "tags": [] }
  },
  "veil_variants": { "prompt": "…", "help": "…", "options": { "o1": "…" }, "labels": { "min": "…", "max": "…" } },
  "options": [ /* OptionContract[] */ ],
  "followups": [ /* FollowupRule[] */ ]
}
```

Notes:

- `tags` — баланс и анти‑повторы.
- `content_tags` — для Lines/Veils.
- `veil_variants` — альтернативный мягкий текст при veil; обязателен к применению, если вопрос подпал под veil.
- `eligibility` может содержать min/max по confidence, теги и режимы (конкретный формат фиксируем в JSON‑схеме).
- Правило применения `veil_variants`: всегда заменяем `prompt` и `help` (если заданы); для choice — подмена label по `option.id`; для slider — подмена `labels.min/max`.

### 4.2 OptionContract

```json
{
  "id": "o1",
  "label": "…",
  "sub": "…",
  "content_tags": ["romance_pc_pc"],
  "effects": {
    "axis_deltas": { "tone": 1.0 },
    "axis_evidence": { "tone": 0.22 },
    "module_delta_levels": { "m_detective": 1 },
    "module_evidence": { "m_detective": 0.20 },
    "set_modes": { "romance.pc_npc": "true" },
    "set_tags": ["likes_dialog"],
    "unset_tags": [],
    "notes": "debug string"
  },
  "answer_meta": { "tone": "bold", "is_joke": false }
}
```

Notes:
- `axis_evidence` (и `module_evidence`) предпочтительнее старого `evidence`; в миграции можно поддерживать оба.
- `sub` и `answer_meta` опциональны.
- `module_delta_levels` — инкремент (после чего clamp 0..3); `set_module_level` — прямое значение.
- Валидатор: для одного `module_id` нельзя одновременно задавать `module_delta_levels` и `set_module_level`.

### 4.3 SliderQuestionContract

```json
{
  "id": "q_slider_01",
  "type": "slider",
  "title": "…",
  "prompt": "…",
  "tags": ["refine"],
  "content_tags": [],
  "slider": { "min": 1, "max": 5, "step": 1, "default": 3, "labels": { "min": "…", "max": "…" }, "snap_points": [1,3,5] },
  "effects_by_range": [
    { "range": { "min": 1, "max": 2 }, "effects": { "axis_deltas": { "tone": -1 }, "axis_evidence": { "tone": 0.18 } } },
    { "range": { "min": 3, "max": 3 }, "effects": { "axis_deltas": { "tone": 0 }, "axis_evidence": { "tone": 0.10 } } },
    { "range": { "min": 4, "max": 5 }, "effects": { "axis_deltas": { "tone": 1 }, "axis_evidence": { "tone": 0.18 } } }
  ],
  "followups_by_range": [
    { "range": { "min": 3, "max": 3 }, "policy": { "mode": "pick_from_pool", "pool": ["q_clarify_center"], "why": "slider_center" } }
  ]
}
```

---

## 5) Followups

### 5.1 FollowupRule (choice)

```json
{ "when": { "option_id_in": ["o_unsure","o_unknown"] }, "policy": { "mode": "pick_from_pool", "pool": ["q_clarify_01"], "why": "unsure_followup" } }
```

### 5.2 FollowupPolicy

```json
{
  "mode": "pick_from_pool",
  "pool": ["q_x", "q_y"],
  "constraints": { "not_asked": true, "respect_cooldown": true, "max_repeats": 0 },
  "priority": { "axes": ["risk", "order"], "prefer_low_confidence": true, "prefer_conflict": true },
  "fallback": { "mode": "global_selector" },
  "why": "debug"
}
```

---

## 6) State (runtime)

```json
{
  "session_id": "…",
  "phase": "quiz",
  "asked": ["q_001"],
  "answers": [{ "qid": "q_001", "type": "choice", "oid": "o1", "ts": 1730000000 }],
  "axes": { "tone": { "score": 1.0, "confidence": 0.38, "evidence": 2.2, "recent_deltas": [1.0], "conflicts": 0 } },
  "modules": { "m_detective": { "level": 2, "confidence": 0.55, "evidence": 1.7 } },
  "modes": { "romance.pc_npc": "unknown", "party_conflict": "unknown" },
  "safety": { "lines": [], "veils": [], "completion_mode": "unset" },
  "tags": ["likes_dialog"],
  "cooldowns": { "q_001": { "until": 6 } },
  "candidates": {
    "clusters": { "setting_A": { "score": 0.62, "why": ["risk:+", "mystery:+"] }, "setting_B": { "score": 0.61, "why": [] } },
    "leader": "setting_A",
    "margin": 0.01
  },
  "stop": { "min_questions": 10, "max_questions": 22, "target_margin": 0.12, "min_axis_confidence": 0.35 }
}
```

---

## 7) SafetyProfile: влияние Lines/Veils

### 7.1 Фильтрация вопросов

На этапе выбора следующего вопроса:

1. **Line filter**: исключаем вопрос, если `question.content_tags ∩ safety.lines != ∅`
   - или если любой option имеет `option.content_tags ∩ safety.lines != ∅`.
2. **Veil penalty**: если `question.content_tags ∩ safety.veils != ∅`
   - или если любой option имеет `option.content_tags ∩ safety.veils != ∅`,
   вопрос остаётся, но получает штраф и обязан использовать `veil_variants`. Если `veil_variants` отсутствует — вопрос недопустим.
   - MVP: line/veil на любой опции исключает весь вопрос. Post‑MVP можно скрывать отдельные опции.

### 7.2 Ранний этап до заполнения safety

Рекомендуемое MVP‑правило:

- пока `safety.completion_mode != "completed"`, не задавать вопросы с `content_tags` из «чувствительных» групп (`SafetyConfig.sensitive_groups`), выбирая только нейтральные.
  - вопрос считается «чувствительным», если любой `content_tag` (в вопросе/опциях) имеет `group` ∈ `sensitive_groups` по словарю `SafetyTagDefinition`.
  - если `content_tag` не найден в словаре, считать его нечувствительным (MVP) и логировать предупреждение валидатором.

---

## 8) Стейт‑машина

Состояния:

- **S0 INIT**
- **S1 PICK_NEXT**
- **S2 RENDER_QUESTION** (choice/slider/mode/safety)
- **S3 APPLY_ANSWER** (axes/modules/modes/safety)
- **S4 MAYBE_FOLLOWUP**
- **S5 EVALUATE_STOP**
- **S6 PROPOSE_RESULT** (Variant B)
- **S7 RESULT_VIEW**

Variant B:

- при насыщенности система предлагает показать результат, но не завершает автоматически;
- на RESULT_VIEW есть кнопка «Хочу ещё поотвечать» → возврат к S1 без сброса state.

Allowed transitions from RESULT_VIEW:

- «Хочу ещё поотвечать» → S1
- «Настроить границы контента» → mini‑flow safety‑вопросов → RESULT_VIEW
- «Настроить формат игры» → mini‑flow mode‑вопросов → RESULT_VIEW

---

## 9) Выбор следующего вопроса (router)

### 9.1 Кандидаты

Допустимый вопрос:

- not asked
- eligibility passed
- not in cooldown
- passes safety (lines)
- quotas not broken

### 9.2 Приоритет followups

Если сработал followup‑rule и вопрос допустим по safety → задаём его. Followup‑кандидаты всегда проходят тот же фильтр допустимости, что и глобальный селектор.

### 9.3 Utility

`utility(q) = info_gain(q) + sep_gain(q) - penalties(q)`

- `info_gain`: (1 - confidence) по touched axes/modules
- `sep_gain`: разводит top1/top2 (см. кластеры)
- `penalties`: повтор tags, fatigue, veil‑штраф

`veil_penalty` должен применяться только если `veil_variants` доступны и будут использованы.

### 9.4 Скоринг (детализация)

Считаем `need(axis)`:

- `need_conf = (1 - confidence)`
- `need_conflict = conflicts > 0 ? 0.35 : 0`
- `need = w1*need_conf + w2*need_conflict`

Рекомендуемые веса для MVP:

- `w1 = 1.0`
- `w2 = 1.2`

Счёт вопроса:

- `base = sum( need(axis) for axis in touches_axes )`
- `cluster_gain`: насколько вопрос способен развести текущие top2 кластера (см. 10)
- `penalties`: повторяемость, тип‑усталость, длительность

Итог:

`score(q) = base + k*cluster_gain - penalties`

Параметр MVP:

- `k = 0.6`

### 9.5 Итоговый выбор

1) Если из предыдущего ответа есть followup‑policy и она возвращает кандидата → использовать её.
2) Иначе собрать список допустимых вопросов.
3) Посчитать `score(q)` и взять max.
4) Если несколько с одинаковым score:
   - предпочесть другой тип чем предыдущий
   - предпочесть вопрос короче
   - стабильный тай‑брейк: лексикографически по id

---

## 10) Кластеры (сеттинги) как «цели по осям» (опционально)

### 10.1 ClusterDefinition

```json
{
  "id": "setting_A",
  "title": "...",
  "axis_targets": {
    "risk": { "center": 4.0, "tolerance": 2.5 },
    "altruism": { "center": -1.0, "tolerance": 3.0 }
  },
  "tag_affinities": { "likes_high_stakes": 0.4 },
  "importance": { "risk": 1.0, "altruism": 0.6 }
}
```

### 10.2 Счёт кластера (runtime)

MVP‑формула:

- `dist = abs(player.score - center)`
- `axis_fit = clamp(1 - dist/tolerance, 0, 1)`
- умножаем на `player.confidence` и `importance`
- `tag_bonus = sum(tag_affinities[tag] for present tags)`

`cluster_score = normalize( sum(axis_fit*importance*confidence) + tag_bonus )`

Normalize: привести все `cluster_score` к [0..1] через деление на max или softmax (детерминированный).

`margin = top1 - top2`

---

## 11) Stop conditions + предложение результата

Система **может** предложить результат, когда:

- задан минимум вопросов
- key axes confidence ≥ threshold
- conflicts низкие
- margin ≥ threshold
- **override:** если есть хотя бы 1 axis с high confidence и 1 axis с medium confidence — можно предложить результат сразу, независимо от остальных условий
- **override:** если у всех ключевых осей и всех модулей confidence ≥ low (то есть нет «неопределено») — можно предложить результат сразу, независимо от остальных условий

После этого — **S6 PROPOSE_RESULT**.

Если `questions_count == max_questions` — остановить принудительно, но показать: “у нас ничья, предложим 2–3 варианта”.

---

## 12) Шеринг результата

### 12.1 По умолчанию

Share payload включает:

- axes (score+confidence)
- modules (level+confidence)
- modes
- schema version
- safety_included (boolean)
- share_scope ("public" | "gm")

Не включает (по умолчанию):

- историю ответов
- персональные данные
- safety (lines/veils)

### 12.2 Для мастера

Опционально пользователь может включить safety в шаринг (явный чекбокс):

- `share_for_gm`.
- В payload при включении safety передаётся: `"safety": { "lines": [...], "veils": [...] }` (только content_tags).

---

## 13) Логи и объяснимость

Каждый применённый effect должен логироваться:

```json
{
  "qid": "q_risk_01",
  "answer": "o_risk_01_a",
  "axis_changes": {
    "risk": { "delta": 2.0, "evidence": 0.22, "conflict_penalty": 0.0 }
  },
  "tags_added": ["likes_high_stakes"],
  "picked_next": "q_altruism_follow_01",
  "reason": "followup: clarify_self_interest"
}
```

Это позволит выводить игроку “почему мы так решили” простыми фразами.

---

## 14) Мини‑чеклист реализации

- [ ] Парсер JSON контрактов
- [ ] Валидация: уникальность id, корректность ranges, существование ссылок
- [ ] Нормализация safety‑алиасов: заменить `aliases` на канонический `id` в `content_tags` (при загрузке данных)
- [ ] Движок state machine (S0–S7)
- [ ] Применение effects + конфликт‑детектор
- [ ] Селектор next question (followup → global)
- [ ] Подсчёт cluster scores + margin
- [ ] Логи explainability

---

## 15) Минимальные требования к данным

- Каждый кластер должен отличаться минимум по 2–3 осям **с разными центрами**.
- Вопросы должны покрывать оси так, чтобы каждая ключевая ось достигала confidence ≥ 0.35 за 8–12 вопросов.
- Должны быть disambiguation‑вопросы, которые целятся в оси с высокой конфликтностью.
