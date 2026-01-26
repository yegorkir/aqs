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
    root.appendChild(makeTitle("Result snapshot"));
    root.appendChild(makeParagraph("Prototype ended. Review debug panel for state."));
    return;
  }

  if (view.phase === "propose_result") {
    root.appendChild(makeTitle("Ready to stop?"));
    root.appendChild(
      makeParagraph(
        "Stop conditions met. You can continue answering or finish and review result."
      )
    );
    return;
  }

  const q = view.question;
  if (!q) {
    root.appendChild(makeParagraph("No question available."));
    return;
  }

  root.appendChild(makeTitle(q.prompt ?? "Question"));

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
