export function renderPlayer(root, view, handlers) {
  root.innerHTML = "";

  if (view.status === "loading") {
    root.appendChild(makeParagraph("Loading bundle..."));
    return;
  }

  if (view.status === "error") {
    root.appendChild(makeParagraph(view.message));
    return;
  }

  if (view.phase === "result") {
    root.appendChild(renderResultScreen(view, handlers));
    return;
  }

  if (view.phase === "propose_result") {
    const forced = view.stopInfo?.reasons?.includes("max_questions_forced");
    root.appendChild(makeTitle("Можно перейти к результату"));
    root.appendChild(
      makeParagraph(
        forced
          ? "Спасибо, что отвечаешь на так много вопросов. Ты уже можешь посмотреть результат, но мы пока не уверены в нём."
          : "Уже достаточно данных. Можно посмотреть результат или продолжить отвечать."
      )
    );
    root.appendChild(
      makeParagraph(
        "Ты всегда сможешь вернуться к опросу из результата и наоборот."
      )
    );
    const actions = document.createElement("div");
    actions.className = "result-actions";
    const showBtn = document.createElement("button");
    showBtn.textContent = "Показать результат";
    showBtn.addEventListener("click", () => handlers.onShowResult?.());
    const contBtn = document.createElement("button");
    contBtn.className = "secondary";
    contBtn.textContent = "Хочу ещё поотвечать на вопросы";
    contBtn.addEventListener("click", () => handlers.onContinue?.());
    actions.appendChild(showBtn);
    actions.appendChild(contBtn);
    root.appendChild(actions);
    return;
  }

  const q = view.question;
  if (!q) {
    root.appendChild(makeTitle("Вопросы закончились"));
    root.appendChild(
      makeParagraph(
        "Вопросы закончились. Можете перейти к результату или начать заново."
      )
    );
    const actions = document.createElement("div");
    actions.className = "result-actions";
    const showBtn = document.createElement("button");
    showBtn.textContent = "Перейти к результату";
    showBtn.addEventListener("click", () => handlers.onShowResult?.({ force: true }));
    const resetBtn = document.createElement("button");
    resetBtn.className = "secondary";
    resetBtn.textContent = "Начать заново";
    resetBtn.addEventListener("click", () => handlers.onReset?.());
    actions.appendChild(showBtn);
    actions.appendChild(resetBtn);
    root.appendChild(actions);
    return;
  }

  const qHeader = document.createElement("div");
  qHeader.className = "question-header";
  const title = makeTitle(q.prompt ?? "Question");
  qHeader.appendChild(title);
  if (q.help) {
    const helpIcon = document.createElement("button");
    helpIcon.className = "help-icon";
    helpIcon.type = "button";
    helpIcon.setAttribute("aria-label", "Пояснение к вопросу");
    helpIcon.setAttribute("aria-expanded", "false");
    helpIcon.setAttribute("data-tooltip", q.help);
    helpIcon.textContent = "?";
    helpIcon.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = helpIcon.classList.toggle("is-open");
      helpIcon.setAttribute("aria-expanded", String(isOpen));
    });
    helpIcon.addEventListener("blur", () => {
      helpIcon.classList.remove("is-open");
      helpIcon.setAttribute("aria-expanded", "false");
    });
    qHeader.appendChild(helpIcon);
  }
  if (view.proposeSeen) {
    const showBtn = document.createElement("button");
    showBtn.className = "secondary";
    showBtn.textContent = "Перейти к результату";
    showBtn.addEventListener("click", () => handlers.onShowResult?.());
    qHeader.appendChild(showBtn);
  }
  root.appendChild(qHeader);
  if (view.veilApplied) {
    const note = makeParagraph("Вопрос адаптирован с учётом границ.");
    note.className = "muted safety-note";
    root.appendChild(note);
  }

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

    root.appendChild(opts);
    return;
  }

  if (q.type === "safety") {
    const wrapper = document.createElement("div");
    wrapper.className = "options";

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

    const submit = document.createElement("button");
    submit.textContent = "Продолжить";
    submit.addEventListener("click", () =>
      handlers.onAnswer({
        qid: q.id,
        type: q.type,
        selections: Array.from(selections),
      })
    );
    wrapper.appendChild(submit);
    root.appendChild(wrapper);
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
    labels.className = "row muted";
    labels.textContent = `${q.slider?.min_label ?? "Low"} — ${q.slider?.max_label ?? "High"}`;

    const submit = document.createElement("button");
    submit.textContent = "Submit";
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
    root.appendChild(wrapper);
  }
}

function renderResultScreen(view, handlers) {
  const wrapper = document.createElement("div");
  const header = document.createElement("div");
  header.className = "result-header";

  const title = document.createElement("h3");
  title.className = "question-title";
  title.textContent = "Профиль ожиданий";

  const subtitle = document.createElement("p");
  subtitle.className = "muted";
  subtitle.textContent = "Не тип, а карта предпочтений.";

  if (view.state?.focus) {
    const focusNote = document.createElement("p");
    focusNote.className = "muted";
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
  const shareBtn = document.createElement("button");
  shareBtn.textContent = "Поделиться";
  shareBtn.addEventListener("click", () => handlers.onShare?.());
  const continueBtn = document.createElement("button");
  continueBtn.className = "secondary";
  continueBtn.textContent = "Хочу ещё поотвечать на вопросы";
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

  return { axes, modules, modes };
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
    const editBtn = document.createElement("button");
    editBtn.className = "secondary edit-btn";
    editBtn.type = "button";
    const icon = document.createElement("img");
    icon.className = "edit-icon";
    icon.alt = "";
    icon.src = "./assets/edit_36dp_1F1F1F_FILL0_wght400_GRAD0_opsz40.svg";
    icon.setAttribute("aria-hidden", "true");
    editBtn.appendChild(icon);
    editBtn.appendChild(document.createTextNode("Уточнить"));
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
      const editBtn = document.createElement("button");
      editBtn.className = "secondary edit-btn";
      editBtn.type = "button";
      const icon = document.createElement("img");
      icon.className = "edit-icon";
      icon.alt = "";
      icon.src = "./assets/edit_36dp_1F1F1F_FILL0_wght400_GRAD0_opsz40.svg";
      icon.setAttribute("aria-hidden", "true");
      editBtn.appendChild(icon);
      editBtn.appendChild(document.createTextNode("Уточнить"));
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
      const editBtn = document.createElement("button");
      editBtn.className = "secondary edit-btn";
      editBtn.type = "button";
      const icon = document.createElement("img");
      icon.className = "edit-icon";
      icon.alt = "";
      icon.src = "./assets/edit_36dp_1F1F1F_FILL0_wght400_GRAD0_opsz40.svg";
      icon.setAttribute("aria-hidden", "true");
      editBtn.appendChild(icon);
      editBtn.appendChild(document.createTextNode("Уточнить"));
      editBtn.addEventListener("click", () => handlers.onEditMode?.(mode.id));
      actions.appendChild(editBtn);
    }
    row.appendChild(title);
    row.appendChild(actions);
    wrapper.appendChild(row);
  }
  const hint = document.createElement("p");
  hint.className = "muted";
  hint.textContent = "Изменить настройки формата (скоро).";
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
