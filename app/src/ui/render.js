const ICONS = {
  share: "./assets/share_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg",
  info: "./assets/info_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg",
  arrow: "./assets/arrow_forward_ios_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg",
};

export function renderPlayer(root, view, handlers) {
  root.innerHTML = "";

  const screen = document.createElement("div");
  const phaseClass = view.phase ? ` phase-${view.phase}` : "";
  screen.className = `screen${phaseClass}`;
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
      "Важная инфоррмация!",
      "Отвечая, прислушивайся к себе — здесь нет неправильных ответов, и отсутствие ответа тоже считается ответом.\n\nКогда получишь результат, ты можешь остановиться — я не заставляю отвечать дальше. Но если захочется, можно продолжать отвечать, пока вопросы не закончатся.\n\n**Чем больше ответишь, тем точнее мы сможем подобрать приключение!**"
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

  if (view.phase === "preconfig") {
    screen.appendChild(renderPreconfigScreen(view, handlers));
    root.appendChild(screen);
    return;
  }

  if (view.phase === "preconfig_specify") {
    screen.appendChild(renderPreconfigSpecifyScreen(view, handlers));
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
      : "Кажется ты уже готов получить результат, но если хочешь можешь ответить на ещё несколько вопросов **для большей точности**.";
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
    helpIcon.appendChild(makeIcon(ICONS.info, ""));
    const tooltip = document.createElement("span");
    tooltip.className = "tooltip";
    tooltip.textContent = q.help;
    helpIcon.appendChild(tooltip);
    const alignTooltip = () => positionTooltip(helpIcon, tooltip);
    helpIcon.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = helpIcon.classList.toggle("is-open");
      helpIcon.setAttribute("aria-expanded", String(isOpen));
      if (isOpen) alignTooltip();
    });
    helpIcon.addEventListener("mouseenter", alignTooltip);
    helpIcon.addEventListener("focus", alignTooltip);
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

    const minLabel =
      q.slider?.min_label ??
      q.slider?.labels?.[String(q.slider?.min)] ??
      "Минимум";
    const maxLabel =
      q.slider?.max_label ??
      q.slider?.labels?.[String(q.slider?.max)] ??
      "Максимум";

    const poles = document.createElement("div");
    poles.className = "slider-poles";
    const leftPole = document.createElement("span");
    leftPole.className = "slider-pole";
    leftPole.textContent = minLabel;
    const rightPole = document.createElement("span");
    rightPole.className = "slider-pole";
    rightPole.textContent = maxLabel;
    poles.appendChild(leftPole);
    poles.appendChild(rightPole);

    const input = document.createElement("input");
    input.type = "range";
    input.min = q.slider?.min ?? 0;
    input.max = q.slider?.max ?? 10;
    input.step = q.slider?.step ?? 1;
    input.value = q.slider?.default ?? input.min;

    const labels = q.slider?.labels ?? {};
    const labelEntries = Object.entries(labels)
      .map(([value, label]) => [Number(value), label])
      .filter(([value, label]) => Number.isFinite(value) && label)
      .sort((a, b) => a[0] - b[0]);
    let levels = null;
    if (labelEntries.length) {
      levels = document.createElement("div");
      levels.className = "slider-levels";
      for (const [value, label] of labelEntries) {
        const level = document.createElement("div");
        level.className = "slider-level";
        const val = document.createElement("span");
        val.className = "slider-level-value";
        val.textContent = String(value);
        const text = document.createElement("span");
        text.className = "slider-level-text";
        text.textContent = label;
        level.appendChild(val);
        level.appendChild(text);
        levels.appendChild(level);
      }
    }

    const submit = makeButton("Продолжить", "btn", ICONS.arrow);
    submit.addEventListener("click", () =>
      handlers.onAnswer({
        qid: q.id,
        type: q.type,
        value: Number(input.value),
      })
    );

    wrapper.appendChild(poles);
    wrapper.appendChild(input);
    if (levels) wrapper.appendChild(levels);
    wrapper.appendChild(submit);
    const actionCard = document.createElement("div");
    actionCard.className = "card soft";
    actionCard.appendChild(wrapper);
    screen.appendChild(actionCard);
    screen.appendChild(renderHint("Это помогает настроить профиль точнее."));
  }

  root.appendChild(screen);
}

function renderPreconfigScreen(view, handlers) {
  const wrapper = document.createElement("div");
  wrapper.className = "card";
  const title = document.createElement("h2");
  title.textContent = "Предварительная настройка";
  wrapper.appendChild(title);

  const lead = document.createElement("p");
  lead.className = "muted";
  lead.textContent =
    "Выбери значения по ощущениям.\n\nЕсли не понимаешь или не хочешь выбирать, слайдер можно не трогать — мы поможем уточнить позже.\nЕсли хочешь выбрать середину, просто немного подвигай его и оставь посередине, он должен загореться синим.";
  wrapper.appendChild(lead);

  const form = document.createElement("div");
  form.className = "preconfig-form";

  const axesBlock = document.createElement("div");
  axesBlock.className = "preconfig-block";
  const axesTitle = document.createElement("h3");
  axesTitle.textContent = "Оси";
  axesBlock.appendChild(axesTitle);
  for (const axis of view.bundle?.axes ?? []) {
    axesBlock.appendChild(renderPreconfigAxis(axis));
  }
  form.appendChild(axesBlock);

  const modulesBlock = document.createElement("div");
  modulesBlock.className = "preconfig-block";
  const modulesTitle = document.createElement("h3");
  modulesTitle.textContent = "Модули интереса";
  modulesBlock.appendChild(modulesTitle);
  for (const mod of view.bundle?.modules ?? []) {
    modulesBlock.appendChild(renderPreconfigModule(mod));
  }
  form.appendChild(modulesBlock);

  wrapper.appendChild(form);

  const actions = document.createElement("div");
  actions.className = "actions";
  const nextBtn = makeButton("Продолжить", "btn", ICONS.arrow);
  nextBtn.addEventListener("click", () => {
    const axes = {};
    const modules = {};
    const inputs = form.querySelectorAll("input[data-kind]");
    for (const input of inputs) {
      if (input.dataset.touched !== "1") continue;
      const value = Number(input.value);
      if (!Number.isFinite(value)) continue;
      const normalized = value / 100;
      if (input.dataset.kind === "axis") {
        axes[input.dataset.id] = normalized;
      } else if (input.dataset.kind === "module") {
        modules[input.dataset.id] = normalized;
      }
    }
    handlers.onPreconfigSubmit?.({ axes, modules });
  });
  actions.appendChild(nextBtn);
  wrapper.appendChild(actions);

  return wrapper;
}

function renderPreconfigAxis(axis) {
  const item = document.createElement("div");
  item.className = "preconfig-item";

  const head = document.createElement("div");
  head.className = "preconfig-head";
  const labelWrap = document.createElement("div");
  labelWrap.className = "preconfig-title-wrap";
  const label = document.createElement("div");
  label.className = "preconfig-title";
  label.textContent = axis.title ?? axis.id;
  const notAbout = axis.not_about?.length ? `Не про: ${axis.not_about.join(", ")}` : "";
  labelWrap.appendChild(label);
  if (notAbout) labelWrap.appendChild(makeHelpIcon(notAbout));
  head.appendChild(labelWrap);
  item.appendChild(head);

  if (axis.goal) {
    const goal = document.createElement("p");
    goal.className = "muted";
    goal.textContent = axis.goal;
    item.appendChild(goal);
  }

  const slider = document.createElement("div");
  slider.className = "slider slider--no-fill";
  const labels = document.createElement("div");
  labels.className = "slider-labels";
  const neg = document.createElement("span");
  neg.className = "slider-label";
  neg.textContent = axis.polarity?.neg_label ?? "Низко";
  const pos = document.createElement("span");
  pos.className = "slider-label";
  pos.textContent = axis.polarity?.pos_label ?? "Высоко";
  labels.appendChild(neg);
  labels.appendChild(pos);
  slider.appendChild(labels);
  const textCol = buildPreconfigTextCol(
    axis.polarity?.pos_label ?? "Высоко",
    axis.polarity?.pos_tooltip ?? "",
    axis.polarity?.neg_label ?? "Низко",
    axis.polarity?.neg_tooltip ?? ""
  );
  slider.appendChild(textCol);
  const mobileLabels = document.createElement("div");
  mobileLabels.className = "slider-mobile-labels";
  const mobileLeft = document.createElement("span");
  mobileLeft.className = "slider-mobile-label";
  mobileLeft.textContent = axis.polarity?.neg_label ?? "Низко";
  const mobileRight = document.createElement("span");
  mobileRight.className = "slider-mobile-label";
  mobileRight.textContent = axis.polarity?.pos_label ?? "Высоко";
  mobileLabels.appendChild(mobileLeft);
  mobileLabels.appendChild(mobileRight);
  const input = document.createElement("input");
  input.type = "range";
  input.min = "0";
  input.max = "100";
  input.step = "1";
  input.value = "50";
  input.defaultValue = "50";
  input.dataset.kind = "axis";
  input.dataset.id = axis.id;
  input.dataset.touched = "0";
  setRangeFill(input);
  attachSliderTouchBehavior(input, slider);
  slider.appendChild(input);
  slider.appendChild(mobileLabels);
  item.appendChild(slider);

  const poles = document.createElement("div");
  poles.className = "preconfig-poles";
  const left = document.createElement("div");
  left.className = "preconfig-pole pole-neg";
  left.textContent = axis.polarity?.neg_tooltip ?? "";
  const sep = document.createElement("div");
  sep.className = "preconfig-sep";
  const right = document.createElement("div");
  right.className = "preconfig-pole pole-pos";
  right.textContent = axis.polarity?.pos_tooltip ?? "";
  poles.appendChild(left);
  poles.appendChild(sep);
  poles.appendChild(right);
  item.appendChild(poles);

  return item;
}

function renderPreconfigModule(mod) {
  const item = document.createElement("div");
  item.className = "preconfig-item";

  const head = document.createElement("div");
  head.className = "preconfig-head";
  const labelWrap = document.createElement("div");
  labelWrap.className = "preconfig-title-wrap";
  const label = document.createElement("div");
  label.className = "preconfig-title";
  label.textContent = mod.title ?? mod.id;
  const notAbout = mod.not_about?.length ? `Не про: ${mod.not_about.join(", ")}` : "";
  labelWrap.appendChild(label);
  if (notAbout) labelWrap.appendChild(makeHelpIcon(notAbout));
  head.appendChild(labelWrap);
  item.appendChild(head);

  if (mod.goal) {
    const goal = document.createElement("p");
    goal.className = "muted";
    goal.textContent = mod.goal;
    item.appendChild(goal);
  }

  const slider = document.createElement("div");
  slider.className = "slider slider--no-fill";
  const labels = document.createElement("div");
  labels.className = "slider-labels";
  const levels = mod.levels ?? [];
  const neg = document.createElement("span");
  neg.className = "slider-label";
  neg.textContent = levels[0] ?? "нет";
  const pos = document.createElement("span");
  pos.className = "slider-label";
  pos.textContent = levels[levels.length - 1] ?? "в центре";
  labels.appendChild(neg);
  labels.appendChild(pos);
  slider.appendChild(labels);
  const textCol = buildPreconfigTextCol(
    levels[levels.length - 1] ?? "в центре",
    (mod.level_tooltips ?? []).slice(-1)[0] ?? "",
    levels[0] ?? "нет",
    (mod.level_tooltips ?? [])[0] ?? ""
  );
  slider.appendChild(textCol);
  const mobileLabels = document.createElement("div");
  mobileLabels.className = "slider-mobile-labels";
  const mobileLeft = document.createElement("span");
  mobileLeft.className = "slider-mobile-label";
  mobileLeft.textContent = levels[0] ?? "нет";
  const mobileRight = document.createElement("span");
  mobileRight.className = "slider-mobile-label";
  mobileRight.textContent = levels[levels.length - 1] ?? "в центре";
  mobileLabels.appendChild(mobileLeft);
  mobileLabels.appendChild(mobileRight);
  const input = document.createElement("input");
  input.type = "range";
  input.min = "0";
  input.max = "100";
  input.step = "1";
  input.value = "50";
  input.defaultValue = "50";
  input.dataset.kind = "module";
  input.dataset.id = mod.id;
  input.dataset.touched = "0";
  setRangeFill(input);
  attachSliderTouchBehavior(input, slider);
  slider.appendChild(input);
  slider.appendChild(mobileLabels);
  item.appendChild(slider);

  const poles = document.createElement("div");
  poles.className = "preconfig-poles";
  const left = document.createElement("div");
  left.className = "preconfig-pole pole-neg";
  left.textContent = (mod.level_tooltips ?? [])[0] ?? "";
  const sep = document.createElement("div");
  sep.className = "preconfig-sep";
  const right = document.createElement("div");
  right.className = "preconfig-pole pole-pos";
  right.textContent = (mod.level_tooltips ?? []).slice(-1)[0] ?? "";
  poles.appendChild(left);
  poles.appendChild(sep);
  poles.appendChild(right);
  item.appendChild(poles);

  return item;
}

function renderPreconfigSpecifyScreen(view, handlers) {
  const wrapper = document.createElement("div");
  wrapper.className = "card";
  const title = document.createElement("h2");
  title.textContent = "Уточнение приоритетов";
  wrapper.appendChild(title);

  const lead = document.createElement("p");
  lead.className = "lead-strong";
  lead.textContent =
    "Сдвинь ползунок в сторону того, что важнее.\n\nЕсли не понимаешь, как сравнивать, оставь ползунок на середине.";
  wrapper.appendChild(lead);

  const form = document.createElement("div");
  form.className = "preconfig-form";
  const pairs = view.state?.preconfig?.pending_pairs ?? [];
  const config = view.bundle?.preconfig?.clarify ?? {};
  const chosen = view.state?.preconfig?.choose?.axes ?? {};
  for (const [leftId, rightId] of pairs) {
    const left = view.bundle?.axesById?.[leftId];
    const right = view.bundle?.axesById?.[rightId];
    form.appendChild(
      renderPreconfigPair(
        leftId,
        rightId,
        left?.title ?? leftId,
        right?.title ?? rightId,
        left,
        right,
        chosen,
        config
      )
    );
  }
  wrapper.appendChild(form);

  const actions = document.createElement("div");
  actions.className = "actions";
  const nextBtn = makeButton("Продолжить", "btn", ICONS.arrow);
  nextBtn.addEventListener("click", () => {
    const specify = {};
    const step = Number(config.step ?? 0.1);
    const inputs = form.querySelectorAll("input[data-pair]");
    for (const input of inputs) {
      const value = Number(input.value);
      if (!Number.isFinite(value)) continue;
      const key = input.dataset.pair;
      specify[key] = Number((value * step).toFixed(2));
    }
    handlers.onPreconfigSpecifySubmit?.({ specify });
  });
  actions.appendChild(nextBtn);
  wrapper.appendChild(actions);

  return wrapper;
}

function renderPreconfigPair(leftId, rightId, leftLabel, rightLabel, leftAxis, rightAxis, chosen, config) {
  const item = document.createElement("div");
  item.className = "preconfig-item";

  const head = document.createElement("div");
  head.className = "preconfig-head";
  const labelWrap = document.createElement("div");
  labelWrap.className = "preconfig-title-wrap";
  const leftSpan = document.createElement("span");
  leftSpan.className = "preconfig-title";
  leftSpan.textContent = leftLabel;
  if (leftAxis?.goal) leftSpan.appendChild(makeHelpIcon(leftAxis.goal));
  const mid = document.createElement("span");
  mid.textContent = "↔";
  const rightSpan = document.createElement("span");
  rightSpan.className = "preconfig-title";
  rightSpan.textContent = rightLabel;
  if (rightAxis?.goal) rightSpan.appendChild(makeHelpIcon(rightAxis.goal));
  labelWrap.appendChild(leftSpan);
  labelWrap.appendChild(mid);
  labelWrap.appendChild(rightSpan);
  head.appendChild(labelWrap);
  item.appendChild(head);

  const leftValue = Number(chosen?.[leftId]);
  const rightValue = Number(chosen?.[rightId]);
  const leftText = leftAxis ? formatAxisSummary(leftAxis, leftValue) : "";
  const rightText = rightAxis ? formatAxisSummary(rightAxis, rightValue) : "";

  const slider = document.createElement("div");
  slider.className = "slider slider--no-fill";
  const labels = document.createElement("div");
  labels.className = "slider-labels";
  const neg = document.createElement("span");
  neg.className = "slider-label";
  neg.textContent = leftLabel;
  const pos = document.createElement("span");
  pos.className = "slider-label";
  pos.textContent = rightLabel;
  labels.appendChild(neg);
  labels.appendChild(pos);
  slider.appendChild(labels);
  const textCol = buildPreconfigTextCol(
    rightLabel,
    rightAxis?.polarity?.pos_tooltip ?? "",
    leftLabel,
    leftAxis?.polarity?.neg_tooltip ?? ""
  );
  slider.appendChild(textCol);
  const mobileLabels = document.createElement("div");
  mobileLabels.className = "slider-mobile-labels";
  const mobileLeft = document.createElement("span");
  mobileLeft.className = "slider-mobile-label";
  mobileLeft.textContent = leftLabel;
  const mobileRight = document.createElement("span");
  mobileRight.className = "slider-mobile-label";
  mobileRight.textContent = rightLabel;
  mobileLabels.appendChild(mobileLeft);
  mobileLabels.appendChild(mobileRight);
  const input = document.createElement("input");
  const stepsEachSide = Number(config.steps_each_side ?? 5);
  input.type = "range";
  input.min = String(-stepsEachSide);
  input.max = String(stepsEachSide);
  input.step = "1";
  input.value = "0";
  input.dataset.pair = `${leftId}-${rightId}`;
  input.dataset.touched = "0";
  setRangeFill(input);
  attachSliderTouchBehavior(input, slider);
  slider.appendChild(input);
  slider.appendChild(mobileLabels);
  item.appendChild(slider);

  const resultsRow = document.createElement("div");
  resultsRow.className = "preconfig-poles";
  const leftResult = document.createElement("div");
  leftResult.className = "preconfig-pole pole-neg";
  leftResult.textContent = leftText;
  const sep = document.createElement("div");
  sep.className = "preconfig-sep";
  const rightResult = document.createElement("div");
  rightResult.className = "preconfig-pole pole-pos";
  rightResult.textContent = rightText;
  resultsRow.appendChild(leftResult);
  resultsRow.appendChild(sep);
  resultsRow.appendChild(rightResult);
  item.appendChild(resultsRow);

  return item;
}

function buildPreconfigTextCol(posLabel, posTooltip, negLabel, negTooltip) {
  const col = document.createElement("div");
  col.className = "preconfig-text-col";
  const posTitle = document.createElement("div");
  posTitle.className = "preconfig-title";
  posTitle.textContent = posLabel;
  const posText = document.createElement("div");
  posText.className = "preconfig-pole";
  posText.textContent = posTooltip;
  const sep = document.createElement("div");
  sep.className = "preconfig-sep";
  const negTitle = document.createElement("div");
  negTitle.className = "preconfig-title";
  negTitle.textContent = negLabel;
  const negText = document.createElement("div");
  negText.className = "preconfig-pole";
  negText.textContent = negTooltip;
  col.appendChild(posTitle);
  col.appendChild(posText);
  col.appendChild(sep);
  col.appendChild(negTitle);
  col.appendChild(negText);
  return col;
}

function setRangeFill(input) {
  const slider = input.closest?.(".slider");
  if (slider?.classList.contains("slider--no-fill")) {
    input.style.setProperty("--range-fill", "0%");
    return;
  }
  const min = Number(input.min ?? 0);
  const max = Number(input.max ?? 100);
  const value = Number(input.value ?? min);
  const span = max - min;
  if (!Number.isFinite(span) || span <= 0) {
    input.style.setProperty("--range-fill", "0%");
    return;
  }
  const pct = ((value - min) / span) * 100;
  const clamped = Math.max(0, Math.min(100, pct));
  input.style.setProperty("--range-fill", `${clamped}%`);
}

function attachSliderTouchBehavior(input, slider) {
  const markTouched = () => {
    if (input.dataset.touched === "1") return;
    input.dataset.touched = "1";
    slider.classList.add("is-touched");
    setRangeFill(input);
  };
  input.addEventListener("input", markTouched);
  input.addEventListener("change", markTouched);
}

function formatAxisSummary(axis, value) {
  if (!Number.isFinite(value)) return "";
  const bucket = Math.max(-2, Math.min(2, Math.round(value * 4 - 2)));
  const text = axis.result?.texts?.[String(bucket)] ?? "";
  return text;
}

function makeHelpIcon(text) {
  const btn = document.createElement("button");
  btn.className = "help-icon";
  btn.type = "button";
  btn.setAttribute("aria-label", "Пояснение");
  btn.setAttribute("aria-expanded", "false");
  btn.appendChild(makeIcon(ICONS.info, ""));
  const tooltip = document.createElement("span");
  tooltip.className = "tooltip";
  tooltip.textContent = text;
  btn.appendChild(tooltip);
  const alignTooltip = () => positionTooltip(btn, tooltip);
  btn.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = btn.classList.toggle("is-open");
    btn.setAttribute("aria-expanded", String(isOpen));
    if (isOpen) alignTooltip();
  });
  window.addEventListener("resize", alignTooltip);
  return btn;
}

function renderTop(view) {
  const top = document.createElement("div");
  top.className = "screen-top";
  const left = document.createElement("div");
  const brand = document.createElement("h1");
  brand.className = "brand";
  brand.textContent = "Определитель пожеланий";
  const tagline = document.createElement("p");
  tagline.className = "tagline";
  tagline.textContent = "Помогаем решить какое приключение подходит именно тебе.";
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
  appendTextWithBold(body, bodyText);
  card.appendChild(title);
  card.appendChild(body);
  return card;
}

function renderHint(text) {
  const hint = document.createElement("p");
  hint.className = "hint";
  appendTextWithBold(hint, text);
  return hint;
}

function appendTextWithBold(target, text) {
  if (text == null || text === "") {
    return;
  }
  const input = String(text);
  const boldPattern = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match;
  while ((match = boldPattern.exec(input))) {
    if (match.index > lastIndex) {
      target.appendChild(document.createTextNode(input.slice(lastIndex, match.index)));
    }
    const strong = document.createElement("strong");
    strong.textContent = match[1];
    target.appendChild(strong);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < input.length) {
    target.appendChild(document.createTextNode(input.slice(lastIndex)));
  }
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

function positionTooltip(anchor, tooltip) {
  const padding = 12;
  tooltip.style.left = "50%";
  tooltip.style.transform = "translateX(-50%)";
  requestAnimationFrame(() => {
    const rect = tooltip.getBoundingClientRect();
    const vw = window.innerWidth;
    let shift = 0;
    if (rect.left < padding) {
      shift += padding - rect.left;
    }
    if (rect.right > vw - padding) {
      shift -= rect.right - (vw - padding);
    }
    if (shift !== 0) {
      tooltip.style.left = `calc(50% + ${shift}px)`;
    }
  });
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

  const subtitle = document.createElement("p");
  subtitle.className = "hint";
  subtitle.textContent = "Отправь результат своему мастеру.";

  const actions = document.createElement("div");
  actions.className = "result-actions";
  const shareBtn = makeButton("Скопировать результат в буфер обмена", "btn", ICONS.share);
  shareBtn.addEventListener("click", () => handlers.onShare?.());
  const continueBtn = makeButton("Хочу ещё поотвечать", "btn secondary");
  continueBtn.addEventListener("click", () => handlers.onContinue?.());
  actions.appendChild(shareBtn);
  actions.appendChild(continueBtn);

  header.appendChild(subtitle);
  header.appendChild(actions);
  wrapper.appendChild(header);
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
