const ICONS = {
  share: "./assets/share_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg",
  info: "./assets/info_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg",
  arrow: "./assets/arrow_forward_ios_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg",
};

export function renderPlayer(root, view, handlers) {
  root.innerHTML = "";

  const screen = document.createElement("div");
  screen.className = "screen";
  screen.appendChild(renderTop(view));

  if (view.status === "loading") {
    screen.appendChild(renderCard("Загружаем вопросы", "Секунду, сейчас всё подготовим."));
    root.appendChild(screen);
    return;
  }

  if (view.status === "error") {
    screen.appendChild(renderCard("Возникла ошибка", view.message));
    root.appendChild(screen);
    return;
  }

  if (view.phase === "welcome") {
    const intro = renderCard(
      "Поможем найти твоё приключение",
      "Не нужно ничего знать заранее. Можно отвечать интуитивно — мы подстроимся."
    );
    const actions = document.createElement("div");
    actions.className = "actions";
    const startBtn = makeButton("Начать исследование", "btn", ICONS.arrow);
    startBtn.addEventListener("click", () => handlers.onStart?.());
    actions.appendChild(startBtn);
    intro.appendChild(actions);
    screen.appendChild(intro);
    screen.appendChild(renderHint("Нет неправильного ответа. Если сложно — это нормально."));
    root.appendChild(screen);
    return;
  }

  if (view.phase === "result") {
    screen.appendChild(renderResultScreen(view, handlers));
    root.appendChild(screen);
    return;
  }

  if (view.phase === "propose_result") {
    const forced = view.stopInfo?.reasons?.includes("max_questions_forced");
    const text = forced
      ? "Спасибо, что отвечаешь так внимательно. Мы уже можем показать результат, но он пока не уверен."
      : "Кажется, у нас уже достаточно данных. Можно посмотреть результат или продолжить.";
    const card = renderCard("Можно перейти к результату", text);
    const actions = document.createElement("div");
    actions.className = "actions";
    const showBtn = makeButton("Показать результат", "btn", ICONS.arrow);
    showBtn.addEventListener("click", () => handlers.onShowResult?.());
    const contBtn = makeButton("Хочу ещё поотвечать", "btn secondary");
    contBtn.addEventListener("click", () => handlers.onContinue?.());
    actions.appendChild(showBtn);
    actions.appendChild(contBtn);
    card.appendChild(actions);
    screen.appendChild(card);
    screen.appendChild(renderHint("Ты всегда можешь вернуться к вопросам из результата."));
    root.appendChild(screen);
    return;
  }

  const q = view.question;
  if (!q) {
    const card = renderCard("Вопросы закончились", "Можно перейти к результату или начать сначала.");
    const actions = document.createElement("div");
    actions.className = "actions";
    const showBtn = makeButton("Перейти к результату", "btn", ICONS.arrow);
    showBtn.addEventListener("click", () => handlers.onShowResult?.({ force: true }));
    const resetBtn = makeButton("Начать заново", "btn secondary");
    resetBtn.addEventListener("click", () => handlers.onReset?.());
    actions.appendChild(showBtn);
    actions.appendChild(resetBtn);
    card.appendChild(actions);
    screen.appendChild(card);
    root.appendChild(screen);
    return;
  }

  const isDilemma = q.tags?.includes("dilemma");
  const questionCard = document.createElement("div");
  questionCard.className = `card${view.isFollowup ? " soft" : ""}`;
  if (isDilemma) {
    questionCard.classList.add("dilemma");
  }
  if (view.isFollowup) {
    const tag = document.createElement("div");
    tag.className = "card-tag";
    tag.textContent = "Хочу уточнить";
    questionCard.appendChild(tag);
  }
  const title = document.createElement("h2");
  title.className = "question-title";
  title.textContent = q.prompt ?? "Вопрос";
  questionCard.appendChild(title);
  if (q.help) {
    const helper = document.createElement("div");
    helper.className = "question-help";
    const helpIcon = document.createElement("button");
    helpIcon.className = "help-icon";
    helpIcon.type = "button";
    helpIcon.setAttribute("aria-label", "Пояснение к вопросу");
    helpIcon.setAttribute("aria-expanded", "false");
    helpIcon.setAttribute("data-tooltip", q.help);
    helpIcon.appendChild(makeIcon(ICONS.info, ""));
    helpIcon.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = helpIcon.classList.toggle("is-open");
      helpIcon.setAttribute("aria-expanded", String(isOpen));
    });
    helpIcon.addEventListener("blur", () => {
      helpIcon.classList.remove("is-open");
      helpIcon.setAttribute("aria-expanded", "false");
    });
    helper.appendChild(helpIcon);
    const helperText = document.createElement("span");
    helperText.textContent = "Пояснение к вопросу";
    helper.appendChild(helperText);
    questionCard.appendChild(helper);
  }
  if (view.proposeSeen) {
    const showBtn = makeButton(
      "Перейти к результату",
      isDilemma ? "btn ghost" : "btn secondary"
    );
    showBtn.addEventListener("click", () => handlers.onShowResult?.());
    questionCard.appendChild(showBtn);
  }
  if (view.veilApplied) {
    const note = document.createElement("p");
    note.className = "hint";
    note.textContent = "Вопрос адаптирован с учётом границ.";
    questionCard.appendChild(note);
  }
  screen.appendChild(questionCard);

  if (q.type === "choice") {
    const opts = document.createElement("div");
    opts.className = "options";

    for (const o of q.options ?? []) {
      const btn = document.createElement("button");
      btn.className = "option-btn";
      btn.textContent = o.label ?? o.id;
      btn.addEventListener("click", () => handlers.onAnswer({ qid: q.id, type: q.type, oid: o.id }));
      opts.appendChild(btn);
    }

    const actionCard = document.createElement("div");
    actionCard.className = "card soft";
    actionCard.appendChild(opts);
    screen.appendChild(actionCard);
    screen.appendChild(renderHint("Можно выбирать интуитивно. Если не уверены — это нормально."));
    root.appendChild(screen);
    return;
  }

  if (q.type === "safety") {
    const isTriState = (q.tags ?? []).includes("safety_lines_veils");
    const wrapper = document.createElement("div");
    wrapper.className = "options";

    if (isTriState) {
      const selections = new Map();
      for (const o of q.options ?? []) {
        selections.set(o.id, "ok");
        const row = document.createElement("div");
        row.className = "safety-row";
        const label = document.createElement("div");
        label.className = "safety-label";
        label.textContent = o.label ?? o.id;
        const choices = document.createElement("div");
        choices.className = "safety-choices";
        const variants = [
          { value: "ok", label: "Ок" },
          { value: "veil", label: "Вуаль" },
          { value: "line", label: "Линия" },
        ];
        for (const v of variants) {
          const item = document.createElement("label");
          item.className = "safety-choice";
          const input = document.createElement("input");
          input.type = "radio";
          input.name = `safety_${q.id}_${o.id}`;
          input.value = v.value;
          input.checked = v.value === "ok";
          input.addEventListener("change", () => {
            if (input.checked) selections.set(o.id, v.value);
          });
          const text = document.createElement("span");
          text.textContent = v.label;
          item.appendChild(input);
          item.appendChild(text);
          choices.appendChild(item);
        }
        row.appendChild(label);
        row.appendChild(choices);
        wrapper.appendChild(row);
      }
      const submit = makeButton("Продолжить", "btn", ICONS.arrow);
      submit.addEventListener("click", () =>
        handlers.onAnswer({
          qid: q.id,
          type: q.type,
          selections: Object.fromEntries(selections),
        })
      );
      wrapper.appendChild(submit);
    } else {
      const selections = new Set();
      for (const o of q.options ?? []) {
        const label = document.createElement("label");
        label.className = "option-checkbox";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.value = o.id;
        input.addEventListener("change", () => {
          if (input.checked) selections.add(o.id);
          else selections.delete(o.id);
        });
        const text = document.createElement("span");
        text.textContent = o.label ?? o.id;
        label.appendChild(input);
        label.appendChild(text);
        wrapper.appendChild(label);
      }
      const submit = makeButton("Продолжить", "btn", ICONS.arrow);
      submit.addEventListener("click", () =>
        handlers.onAnswer({
          qid: q.id,
          type: q.type,
          selections: Array.from(selections),
        })
      );
      wrapper.appendChild(submit);
    }
    const actionCard = document.createElement("div");
    actionCard.className = "card soft";
    actionCard.appendChild(wrapper);
    screen.appendChild(actionCard);
    screen.appendChild(renderHint("Границы можно изменить позже."));
    root.appendChild(screen);
    return;
  }

  if (q.type === "slider") {
    const wrapper = document.createElement("div");
    wrapper.className = "slider";

    const input = document.createElement("input");
    input.type = "range";
    input.min = q.slider?.min ?? 0;
    input.max = q.slider?.max ?? 10;
    input.step = q.slider?.step ?? 1;
    input.value = q.slider?.default ?? input.min;

    const labels = document.createElement("div");
    labels.className = "slider-labels";
    labels.textContent = `${q.slider?.min_label ?? "Минимум"} — ${q.slider?.max_label ?? "Максимум"}`;

    const submit = makeButton("Продолжить", "btn", ICONS.arrow);
    submit.addEventListener("click", () =>
      handlers.onAnswer({
        qid: q.id,
        type: q.type,
        value: Number(input.value),
      })
    );

    wrapper.appendChild(labels);
    wrapper.appendChild(input);
    wrapper.appendChild(submit);
    const actionCard = document.createElement("div");
    actionCard.className = "card soft";
    actionCard.appendChild(wrapper);
    screen.appendChild(actionCard);
    screen.appendChild(renderHint("Это помогает настроить профиль точнее."));
  }

  root.appendChild(screen);
}

function renderTop(view) {
  const top = document.createElement("div");
  top.className = "screen-top";
  const left = document.createElement("div");
  const brand = document.createElement("h1");
  brand.className = "brand";
  brand.textContent = "Адаптивный опросник";
  const tagline = document.createElement("p");
  tagline.className = "tagline";
  tagline.textContent = "Диалог, который помогает понять себя.";
  left.appendChild(brand);
  left.appendChild(tagline);
  const stage = document.createElement("div");
  stage.className = "stage-pill";
  stage.textContent = getProgressStage(view);
  top.appendChild(left);
  top.appendChild(stage);
  return top;
}

function renderCard(titleText, bodyText) {
  const card = document.createElement("div");
  card.className = "card";
  const title = document.createElement("h2");
  title.className = "question-title";
  title.textContent = titleText;
  const body = document.createElement("p");
  body.className = "hint";
  body.textContent = bodyText;
  card.appendChild(title);
  card.appendChild(body);
  return card;
}

function renderHint(text) {
  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = text;
  return hint;
}

function makeButton(label, className, iconSrc) {
  const btn = document.createElement("button");
  btn.className = className;
  btn.type = "button";
  if (iconSrc) {
    btn.appendChild(makeIcon(iconSrc, ""));
  }
  btn.appendChild(document.createTextNode(label));
  return btn;
}

function makeIcon(src, alt) {
  const icon = document.createElement("img");
  icon.className = "icon";
  icon.src = src;
  icon.alt = alt;
  if (!alt) icon.setAttribute("aria-hidden", "true");
  return icon;
}

function getProgressStage(view) {
  if (view.status === "loading") return "Подготовка";
  if (view.phase === "welcome") return "Начинаем";
  if (view.phase === "result") return "Результат";
  if (view.phase === "propose_result") return "Почти готово";
  const asked = view.state?.asked?.length ?? 0;
  if (asked <= 2) return "Начинаем";
  if (view.stopInfo?.propose || view.proposeSeen) return "Почти готово";
  return "Углубляемся";
}

function renderResultScreen(view, handlers) {
  const wrapper = document.createElement("div");
  wrapper.className = "card";

  const header = document.createElement("div");
  header.className = "result-header";

  const title = document.createElement("h2");
  title.className = "result-title";
  title.textContent = "Профиль ожиданий";

  const subtitle = document.createElement("p");
  subtitle.className = "hint";
  subtitle.textContent = "Не тип, а карта предпочтений.";

  if (view.state?.focus) {
    const focusNote = document.createElement("p");
    focusNote.className = "hint";
    let focusLabel = view.state.focus.id;
    if (view.state.focus.type === "axis") {
      focusLabel = view.bundle?.axesById?.[view.state.focus.id]?.title ?? focusLabel;
    } else if (view.state.focus.type === "module") {
      focusLabel = view.bundle?.modulesById?.[view.state.focus.id]?.title ?? focusLabel;
    } else if (view.state.focus.type === "mode") {
      focusLabel = view.bundle?.modesById?.[view.state.focus.id]?.title ?? focusLabel;
    }
    focusNote.textContent = `Сейчас уточняем: ${focusLabel}.`;
    header.appendChild(focusNote);
  }

  const actions = document.createElement("div");
  actions.className = "result-actions";
  const shareBtn = makeButton("Поделиться", "btn", ICONS.share);
  shareBtn.addEventListener("click", () => handlers.onShare?.());
  const continueBtn = makeButton("Хочу ещё поотвечать", "btn secondary");
  continueBtn.addEventListener("click", () => handlers.onContinue?.());
  actions.appendChild(shareBtn);
  actions.appendChild(continueBtn);

  header.appendChild(title);
  header.appendChild(subtitle);
  header.appendChild(actions);
  wrapper.appendChild(header);

  const resultView = buildResultView(view);
  wrapper.appendChild(
    makeSection(
      "Профиль ожиданий",
      renderAxisList(resultView.axes, handlers)
    )
  );
  wrapper.appendChild(makeSection("Модули интереса", renderModuleList(resultView.modules, handlers)));
  if (resultView.safety) {
    wrapper.appendChild(makeSection("Границы контента", renderSafetySummary(resultView.safety, handlers)));
  }
  wrapper.appendChild(makeSection("Формат игры", renderModeList(resultView.modes, handlers)));
  return wrapper;
}

function buildResultView(view) {
  const bundleAxes = view.bundle?.axes ?? [];
  const bundleModules = view.bundle?.modules ?? [];
  const bundleModes = view.bundle?.modes ?? [];
  const stateAxes = view.state?.axes ?? {};
  const stateModules = view.state?.modules ?? {};
  const stateModes = view.state?.modes ?? {};
  const safetyState = view.state?.safety ?? {};
  const safetyQuestion = (view.bundle?.questions ?? []).find(
    (q) => q.type === "safety" && (q.tags ?? []).includes("safety_lines_veils")
  );
  const safetyOptions = safetyQuestion?.options ?? [];
  const safetyLines = new Set(safetyState.lines ?? []);
  const safetyVeils = new Set(safetyState.veils ?? []);
  const safety = safetyOptions.length
    ? {
        lines: safetyOptions.filter((o) => safetyLines.has(o.id)).map((o) => o.label ?? o.id),
        veils: safetyOptions.filter((o) => safetyVeils.has(o.id)).map((o) => o.label ?? o.id),
        ok: safetyOptions
          .filter((o) => !safetyLines.has(o.id) && !safetyVeils.has(o.id))
          .map((o) => o.label ?? o.id),
      }
    : null;

  const axes = bundleAxes.map((axis) => {
    const state = stateAxes[axis.id] ?? {};
    const scale = axis.scale ?? { min: -2, max: 2, step: 1 };
    const score = Number(state.score ?? 0);
    const bucket = bucketValue(score, scale);
    const texts = axis.result?.texts ?? {};
    const description = texts[String(bucket)] ?? axis.description ?? "";
    const confidence = Number(state.confidence ?? 0);
    const thresholds = axis.result?.confidence_thresholds;
    return {
      id: axis.id,
      title: axis.title ?? axis.id,
      negLabel: axis.polarity?.neg_label ?? "Низко",
      posLabel: axis.polarity?.pos_label ?? "Высоко",
      scale,
      bucket,
      description,
      confidence,
      confidenceLabel: confidenceLabel(confidence, thresholds),
    };
  });

  const modules = bundleModules.map((mod) => {
    const state = stateModules[mod.id] ?? {};
    const level = Number(state.level ?? 0);
    const confidence = Number(state.confidence ?? 0);
    const thresholds = mod.result?.confidence_thresholds;
    return {
      id: mod.id,
      title: mod.title ?? mod.id,
      level,
      evidence: Number(state.evidence ?? 0),
      levels: mod.levels ?? [],
      confidence,
      confidenceLabel: confidenceLabel(confidence, thresholds),
      canEdit: true,
    };
  });

  const modes = bundleModes.map((mode) => {
    const value = stateModes[mode.id];
    return {
      id: mode.id,
      title: mode.title ?? mode.id,
      value,
      label: modeLabel(mode, value),
      canEdit: true,
    };
  });

  return { axes, modules, modes, safety };
}

function bucketValue(score, scale) {
  const min = Number(scale.min ?? -2);
  const max = Number(scale.max ?? 2);
  const step = Number(scale.step ?? 1);
  const count = Math.round((max - min) / step) + 1;
  const idx = Math.max(0, Math.min(count - 1, Math.round((score - min) / step)));
  const value = min + idx * step;
  return Number.isInteger(value) ? value : Number(value.toFixed(2));
}

function confidenceLabel(value, thresholds) {
  const high = thresholds?.high ?? 0.66;
  const medium = thresholds?.medium ?? 0.4;
  const low = thresholds?.low ?? 0.2;
  if (value >= high) return "уверенно";
  if (value >= medium) return "средне";
  if (value >= low) return "нужно уточнить";
  return "неопределено";
}

function modeLabel(mode, value) {
  if (mode?.labels && value != null) {
    const label = mode.labels[String(value)];
    if (label) return label;
  }
  if (mode?.type === "tri_bool") {
    if (value === true || value === "true" || value === "yes") return "да";
    if (value === false || value === "false" || value === "no") return "нет";
    return "не знаю";
  }
  if (mode?.type === "bool") {
    if (value === true || value === "true") return "да";
    if (value === false || value === "false") return "нет";
    return "не задано";
  }
  if (value == null) return "не задано";
  return String(value);
}

function renderSafetySummary(safety, handlers) {
  const wrapper = document.createElement("div");
  wrapper.className = "safety-summary";

  const head = document.createElement("div");
  head.className = "safety-summary-head";
  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = "Линии исключаются полностью, вуали остаются за кадром.";
  const editBtn = makeButton("Редактировать", "btn secondary edit-btn", ICONS.arrow);
  editBtn.addEventListener("click", () => handlers.onEditSafety?.());
  head.appendChild(hint);
  head.appendChild(editBtn);
  wrapper.appendChild(head);

  wrapper.appendChild(renderSafetyGroup("Запрещено (линии)", safety.lines));
  wrapper.appendChild(renderSafetyGroup("За кадром (вуали)", safety.veils));
  wrapper.appendChild(renderSafetyGroup("Ок в игре", safety.ok));
  return wrapper;
}

function renderSafetyGroup(title, items) {
  const group = document.createElement("div");
  group.className = "safety-group";
  const h = document.createElement("div");
  h.className = "safety-group-title";
  h.textContent = title;
  const list = document.createElement("ul");
  list.className = "safety-list";
  if (!items?.length) {
    const empty = document.createElement("li");
    empty.className = "muted";
    empty.textContent = "—";
    list.appendChild(empty);
  } else {
    for (const item of items) {
      const li = document.createElement("li");
      li.textContent = item;
      list.appendChild(li);
    }
  }
  group.appendChild(h);
  group.appendChild(list);
  return group;
}

function renderAxisList(axes, handlers) {
  const wrapper = document.createElement("div");
  wrapper.className = "result-grid";
  for (const axis of axes) {
    const card = document.createElement("div");
    card.className = "result-card";

    const head = document.createElement("div");
    head.className = "result-card-head";
    const title = document.createElement("div");
    title.className = "result-card-title";
    title.textContent = axis.title;
    const headActions = document.createElement("div");
    headActions.className = "result-card-actions";
    const badge = document.createElement("span");
    badge.className = "badge";
    const confPct = Number.isFinite(axis.confidence) ? Math.round(axis.confidence * 100) : null;
    badge.textContent = confPct == null ? axis.confidenceLabel : `${axis.confidenceLabel} · ${confPct}%`;
    const editBtn = makeButton("Уточнить", "btn secondary edit-btn", ICONS.arrow);
    editBtn.addEventListener("click", () => handlers.onEditAxis?.(axis.id));
    headActions.appendChild(badge);
    headActions.appendChild(editBtn);
    head.appendChild(title);
    head.appendChild(headActions);

    const scale = document.createElement("div");
    scale.className = "scale";
    const min = Number(axis.scale?.min ?? -2);
    const max = Number(axis.scale?.max ?? 2);
    const step = Number(axis.scale?.step ?? 1);
    const steps = Math.round((max - min) / step) + 1;
    scale.style.gridTemplateColumns = `repeat(${steps}, 1fr)`;
    for (let i = 0; i < steps; i += 1) {
      const value = min + i * step;
      const seg = document.createElement("span");
      seg.className = "scale-step";
      if (value === axis.bucket) seg.classList.add("active");
      scale.appendChild(seg);
    }

    const labels = document.createElement("div");
    labels.className = "scale-labels";
    labels.innerHTML = `<span>${axis.negLabel}</span><span>${axis.posLabel}</span>`;

    const desc = document.createElement("p");
    desc.className = "muted";
    desc.textContent = axis.description;

    card.appendChild(head);
    card.appendChild(scale);
    card.appendChild(labels);
    card.appendChild(desc);
    wrapper.appendChild(card);
  }
  return wrapper;
}

function renderModuleList(modules, handlers) {
  const wrapper = document.createElement("div");
  wrapper.className = "result-grid";
  for (const mod of modules) {
    const card = document.createElement("div");
    card.className = "result-card";

    const head = document.createElement("div");
    head.className = "result-card-head";
    const title = document.createElement("div");
    title.className = "result-card-title";
    title.textContent = mod.title;
    const headActions = document.createElement("div");
    headActions.className = "result-card-actions";
    const badge = document.createElement("span");
    badge.className = "badge";
    const confPct = Number.isFinite(mod.confidence) ? Math.round(mod.confidence * 100) : null;
    badge.textContent = confPct == null ? mod.confidenceLabel : `${mod.confidenceLabel} · ${confPct}%`;
    headActions.appendChild(badge);
    if (mod.canEdit) {
      const editBtn = makeButton("Уточнить", "btn secondary edit-btn", ICONS.arrow);
      editBtn.addEventListener("click", () => handlers.onEditModule?.(mod.id));
      headActions.appendChild(editBtn);
    }
    head.appendChild(title);
    head.appendChild(headActions);

    const bar = document.createElement("div");
    bar.className = "intensity";
    const steps = Math.max(1, mod.levels?.length ?? 4);
    bar.style.gridTemplateColumns = `repeat(${steps}, 1fr)`;
    for (let i = 0; i < steps; i += 1) {
      const seg = document.createElement("span");
      seg.className = "intensity-step";
      if (i <= mod.level) seg.classList.add("active");
      bar.appendChild(seg);
    }

    const level = document.createElement("p");
    level.className = "muted";
    const levelLabel = mod.levels?.[mod.level] ?? String(mod.level ?? 0);
    level.textContent = `Уровень: ${levelLabel}`;

    card.appendChild(head);
    card.appendChild(bar);
    card.appendChild(level);
    wrapper.appendChild(card);
  }
  return wrapper;
}

function renderModeList(modes, handlers) {
  const wrapper = document.createElement("div");
  wrapper.className = "mode-list";
  for (const mode of modes) {
    const row = document.createElement("div");
    row.className = "mode-row";
    const title = document.createElement("span");
    title.textContent = mode.title;
    const actions = document.createElement("div");
    actions.className = "result-card-actions";
    const value = document.createElement("span");
    value.className = "badge";
    value.textContent = mode.label;
    actions.appendChild(value);
    if (mode.canEdit) {
      const editBtn = makeButton("Уточнить", "btn secondary edit-btn", ICONS.arrow);
      editBtn.addEventListener("click", () => handlers.onEditMode?.(mode.id));
      actions.appendChild(editBtn);
    }
    row.appendChild(title);
    row.appendChild(actions);
    wrapper.appendChild(row);
  }
  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = "Если нужно — можно уточнить формат позже.";
  wrapper.appendChild(hint);
  return wrapper;
}

export function renderDebug(root, view) {
  root.innerHTML = "";

  if (view.validationBlockers?.length) {
    const block = document.createElement("div");
    block.className = "warning";
    block.innerHTML = `<strong>BLOCKER:</strong><br>${view.validationBlockers.join("<br>")}`;
    root.appendChild(block);
  }

  if (view.validationWarnings?.length) {
    const warn = document.createElement("div");
    warn.className = "warning";
    warn.innerHTML = `<strong>Validation warnings:</strong><br>${view.validationWarnings.join("<br>")}`;
    root.appendChild(warn);
  }

  const summary = document.createElement("div");
  summary.innerHTML = `<div class="row"><span class="pill">Asked: ${view.state.asked.length}</span><span class="pill">Logs: ${view.logCount}</span><span class="pill">Phase: ${view.state.phase}</span><span class="pill">Followups: ${view.state.pending_followups?.length ?? 0}</span></div>`;
  root.appendChild(summary);

  root.appendChild(makeSection("Top candidates", renderCandidates(view.nextDebug)));
  root.appendChild(makeSection("Last effects", renderLastEffects(view.lastLog)));
  root.appendChild(makeSection("Axes", renderAxisTable(view.state)));
  root.appendChild(makeSection("Modules", renderModuleTable(view.state)));
  root.appendChild(makeSection("Modes", renderModeTable(view.state)));
  root.appendChild(makeSection("Stop check", renderStopInfo(view.stopInfo)));
}

function renderCandidates(nextDebug) {
  if (!nextDebug) return makeParagraph("No candidates.");
  const wrapper = document.createElement("div");
  if (nextDebug.followup_forced) {
    const note = makeParagraph(`Forced followup: ${nextDebug.followup_qid}`);
    note.className = "muted";
    wrapper.appendChild(note);
    return wrapper;
  }
  const meta = makeParagraph(
    `Candidates: ${nextDebug.count} | Rejected - asked: ${nextDebug.rejected.asked}, cooldown: ${nextDebug.rejected.cooldown}, eligibility: ${nextDebug.rejected.eligibility}, safety: ${nextDebug.rejected.safety}`
  );
  meta.className = "muted";
  wrapper.appendChild(meta);

  const list = document.createElement("div");
  list.className = "options";
  for (const item of nextDebug.top ?? []) {
    const card = document.createElement("div");
    card.className = "muted";
    card.textContent = `${item.qid} | total ${item.score.total.toFixed(2)} (base ${item.score.base.toFixed(2)} - penalty ${item.score.penalty.toFixed(2)})`;
    list.appendChild(card);
  }
  wrapper.appendChild(list);
  return wrapper;
}

function renderLastEffects(lastLog) {
  if (!lastLog) return makeParagraph("No answers yet.");
  const pre = document.createElement("pre");
  pre.className = "muted";
  pre.textContent = JSON.stringify(lastLog, null, 2);
  return pre;
}

function renderAxisTable(state) {
  const table = document.createElement("table");
  table.className = "table";
  table.innerHTML = "<thead><tr><th>Axis</th><th>Score</th><th>Conf</th><th>Evidence</th><th>Conflicts</th></tr></thead>";
  const tbody = document.createElement("tbody");
  for (const [id, ax] of Object.entries(state.axes)) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${id}</td><td>${ax.score.toFixed(2)}</td><td>${ax.confidence.toFixed(2)}</td><td>${ax.evidence.toFixed(2)}</td><td>${ax.conflicts}</td>`;
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  return table;
}

function renderModuleTable(state) {
  const table = document.createElement("table");
  table.className = "table";
  table.innerHTML = "<thead><tr><th>Module</th><th>Level</th><th>Conf</th><th>Evidence</th></tr></thead>";
  const tbody = document.createElement("tbody");
  for (const [id, mod] of Object.entries(state.modules)) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${id}</td><td>${mod.level}</td><td>${mod.confidence.toFixed(2)}</td><td>${mod.evidence.toFixed(2)}</td>`;
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  return table;
}

function renderModeTable(state) {
  const table = document.createElement("table");
  table.className = "table";
  table.innerHTML = "<thead><tr><th>Mode</th><th>Value</th></tr></thead>";
  const tbody = document.createElement("tbody");
  for (const [id, value] of Object.entries(state.modes)) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${id}</td><td>${value}</td>`;
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  return table;
}

function renderStopInfo(stopInfo) {
  if (!stopInfo) return makeParagraph("Stop evaluation pending.");
  const pre = document.createElement("pre");
  pre.className = "muted";
  pre.textContent = JSON.stringify(stopInfo, null, 2);
  return pre;
}

function makeSection(title, content) {
  const section = document.createElement("div");
  const h = document.createElement("h3");
  h.className = "section-title";
  h.textContent = title;
  section.appendChild(h);
  section.appendChild(content);
  return section;
}

function makeTitle(text) {
  const h = document.createElement("h3");
  h.className = "question-title";
  h.textContent = text;
  return h;
}

function makeParagraph(text) {
  const p = document.createElement("p");
  p.textContent = text;
  return p;
}
