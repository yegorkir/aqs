import { loadBundleAndSchema, indexBundle } from "./load.js";
import { validateBundleLight, validateBundleSanity } from "./validate.js";
import { initState } from "./engine/state.js";
import { applyAnswer } from "./engine/applyAnswer.js";
import { pickNextQuestion } from "./engine/pickNext.js";
import { evaluateStop } from "./engine/stop.js";
import { resolveFollowup } from "./engine/followup.js";
import { questionSafetyStatus } from "./engine/safety.js";
import { createLogger, downloadText } from "./log/logger.js";
import { renderPlayer, renderDebug } from "./ui/render.js";

const playerRoot = document.querySelector("#playerRoot");
const debugRoot = document.querySelector("#debugRoot");
const resetBtn = document.querySelector("#resetBtn");
const exportBtn = document.querySelector("#exportBtn");
const toggleSafetyBtn = document.querySelector("#toggleSafetyBtn");
const continueBtn = document.querySelector("#continueBtn");

let bundle = null;
let state = null;
let validationWarnings = [];
let validationBlockers = [];
let lastLog = null;
let nextDebug = null;
let stopInfo = null;
let proposeSeen = false;

const logger = createLogger();
let eventSeq = 0;

init();

resetBtn.addEventListener("click", () => resetFlow());
exportBtn.addEventListener("click", () => {
  const text = logger.exportLines();
  downloadText(`quiz-log-${Date.now()}.jsonl`, text);
});

continueBtn.addEventListener("click", () => {
  if (state?.phase === "propose_result") {
    state.phase = "quiz";
    stopInfo = null;
    stepPick();
    render();
  }
});

let safetyConfigured = false;

toggleSafetyBtn.addEventListener("click", () => {
  safetyConfigured = !safetyConfigured;
  toggleSafetyBtn.textContent = `Safety configured: ${safetyConfigured ? "on" : "off"}`;
  state.safety.lines = safetyConfigured ? ["violence"] : [];
  state.safety.veils = safetyConfigured ? ["romance"] : [];
  logEvent("safety_toggle", {
    enabled: safetyConfigured,
    lines: state.safety.lines,
    veils: state.safety.veils,
  });
  render();
});

async function init() {
  renderStatus("loading");

  try {
    const res = await loadBundleAndSchema();
    bundle = indexBundle(res.bundle);
    validationWarnings = validateBundleLight(bundle);
    validationBlockers = validateBundleSanity(bundle);
    if (validationBlockers.length) {
      renderStatus("error", "Content sanity check failed.");
      return;
    }
    resetFlow();
  } catch (err) {
    renderStatus("error", err.message);
  }
}

function resetFlow() {
  if (!bundle) return;
  state = initState(bundle);
  logger.reset();
  eventSeq = 0;
  lastLog = null;
  stopInfo = null;
  proposeSeen = false;
  logEvent("reset", { session_id: state.session_id });
  stepPick();
  render();
}

function stepPick() {
  const next = pickNextQuestion(state, bundle);
  nextDebug = next.debug;
  state.candidates = next.debug ? { margin: next.debug.margin } : null;
  if (next.pick) {
    state.next_qid = next.pick;
  } else {
    state.next_qid = null;
  }
  logEvent("pick_next", {
    pick: state.next_qid,
    debug: nextDebug,
  });
}

function onAnswer(answer) {
  if (!bundle || !state) return;
  if (answer?.type === "choice") {
    logEvent("ui_click", {
      action: "answer_choice",
      qid: answer.qid,
      choice: answer.oid ?? null,
    });
  } else if (answer?.type === "slider") {
    logEvent("ui_click", {
      action: "answer_slider",
      qid: answer.qid,
      choice: answer.value ?? null,
    });
  }
  const sourceQuestion = bundle.questionsById[answer.qid];
  const result = applyAnswer(state, bundle, answer);
  lastLog = result.log;
  logEvent("answer", {
    ...lastLog,
    prompt: sourceQuestion?.prompt ?? "",
    option_label: resolveAnswerLabel(sourceQuestion, answer),
  });

  const followup = resolveFollowup(state, sourceQuestion, answer);
  if (followup) {
    state.pending_followups.push(followup.qid);
    logEvent("followup_enqueued", {
      from: answer.qid,
      from_prompt: sourceQuestion?.prompt ?? "",
      followup: followup.qid,
      rule: followup.rule ?? null,
    });
  }

  stopInfo = evaluateStop(state, bundle);
  logEvent("stop_check", {
    ...stopInfo,
    metrics: computeStopMetrics(state, bundle),
  });

  if (state.focus) {
    if (state.focus.type === "axis") {
      const axisDef = bundle.axesById?.[state.focus.id];
      const thresholds = axisDef?.result?.confidence_thresholds;
      const high = thresholds?.high ?? 0.66;
      const conf = state.axes[state.focus.id]?.confidence ?? 0;
      if (conf >= high || !hasAvailableFocusQuestion(state, bundle)) {
        logEvent("focus_exit", {
          type: "axis",
          id: state.focus.id,
          reason: conf >= high ? "confidence_high" : "no_questions",
          confidence: conf,
        });
        state.focus = null;
        state.phase = "result";
        render();
        return;
      }
    }
    if (state.focus.type === "module") {
      const modDef = bundle.modulesById?.[state.focus.id];
      const thresholds = modDef?.result?.confidence_thresholds;
      const high = thresholds?.high ?? 0.66;
      const conf = state.modules[state.focus.id]?.confidence ?? 0;
      if (conf >= high || !hasAvailableFocusQuestion(state, bundle)) {
        logEvent("focus_exit", {
          type: "module",
          id: state.focus.id,
          reason: conf >= high ? "confidence_high" : "no_questions",
          confidence: conf,
        });
        state.focus = null;
        state.phase = "result";
        render();
        return;
      }
    }
    if (state.focus.type === "mode") {
      const value = state.modes[state.focus.id];
      if (value !== "unknown" || !hasAvailableFocusQuestion(state, bundle)) {
        logEvent("focus_exit", {
          type: "mode",
          id: state.focus.id,
          reason: value !== "unknown" ? "answered" : "no_questions",
          value,
        });
        state.focus = null;
        state.phase = "result";
        render();
        return;
      }
    }
  }

  if (stopInfo.propose && !proposeSeen) {
    state.phase = "propose_result";
    proposeSeen = true;
  }

  stepPick();
  render();
}

function renderStatus(status, message = "") {
  renderPlayer(playerRoot, { status, message }, { onAnswer });
  renderDebug(debugRoot, {
    validationWarnings,
    validationBlockers,
    logCount: logger.count(),
    state: state ?? { asked: [], axes: {}, modules: {}, modes: {}, phase: status },
    nextDebug,
    lastLog,
    stopInfo,
  });
}

function render() {
  if (!bundle || !state) return;

  const question = state.next_qid ? bundle.questionsById[state.next_qid] : null;
  renderPlayer(
    playerRoot,
    {
      status: "ready",
      phase: state.phase,
      question,
      bundle,
      state,
      stopInfo,
      proposeSeen,
    },
    {
      onAnswer,
      onContinue: () => {
        if (state?.phase === "propose_result" || state?.phase === "result") {
          logEvent("ui_click", { action: "continue_answers", phase: state?.phase ?? "unknown" });
          state.phase = "quiz";
          stopInfo = null;
          stepPick();
          render();
        }
      },
      onShowResult: () => {
        if (state && (state.phase === "propose_result" || proposeSeen)) {
          logEvent("ui_click", { action: "show_result", phase: state?.phase ?? "unknown" });
          state.phase = "result";
          logEvent("result_view", { reason: "user_accept" });
          render();
        }
      },
      onShare: () => {
        logEvent("ui_click", { action: "share_result", phase: state?.phase ?? "unknown" });
        const text = logger.exportLines();
        copyToClipboard(text);
      },
      onEditAxis: (axisId) => {
        if (!state || !bundle) return;
        if (!bundle.axesById?.[axisId]) return;
        logEvent("ui_click", { action: "refine_axis", id: axisId, phase: state?.phase ?? "unknown" });
        state.focus = { type: "axis", id: axisId };
        proposeSeen = true;
        state.phase = "quiz";
        logEvent("focus_enter", { type: "axis", id: axisId });
        stepPick();
        if (!state.next_qid) {
          logEvent("focus_exit", {
            type: "axis",
            id: axisId,
            reason: "no_questions",
            confidence: state.axes[axisId]?.confidence ?? 0,
          });
          state.focus = null;
          state.phase = "result";
        }
        render();
      },
      onEditModule: (moduleId) => {
        if (!state || !bundle) return;
        if (!bundle.modulesById?.[moduleId]) return;
        logEvent("ui_click", { action: "refine_module", id: moduleId, phase: state?.phase ?? "unknown" });
        state.focus = { type: "module", id: moduleId };
        proposeSeen = true;
        state.phase = "quiz";
        logEvent("focus_enter", { type: "module", id: moduleId });
        stepPick();
        if (!state.next_qid) {
          logEvent("focus_exit", {
            type: "module",
            id: moduleId,
            reason: "no_questions",
            confidence: state.modules[moduleId]?.confidence ?? 0,
          });
          state.focus = null;
          state.phase = "result";
        }
        render();
      },
      onEditMode: (modeId) => {
        if (!state || !bundle) return;
        if (!bundle.modesById?.[modeId]) return;
        logEvent("ui_click", { action: "refine_mode", id: modeId, phase: state?.phase ?? "unknown" });
        state.focus = { type: "mode", id: modeId };
        proposeSeen = true;
        state.phase = "quiz";
        logEvent("focus_enter", { type: "mode", id: modeId });
        stepPick();
        if (!state.next_qid) {
          logEvent("focus_exit", {
            type: "mode",
            id: modeId,
            reason: "no_questions",
            value: state.modes[modeId],
          });
          state.focus = null;
          state.phase = "result";
        }
        render();
      },
      onReset: () => {
        logEvent("ui_click", { action: "reset_flow", phase: state?.phase ?? "unknown" });
        resetFlow();
      },
    }
  );

  renderDebug(debugRoot, {
    validationWarnings,
    validationBlockers,
    logCount: logger.count(),
    state,
    nextDebug,
    lastLog,
    stopInfo,
  });

  continueBtn.disabled = state.phase !== "propose_result";
}

function logEvent(type, payload) {
  logger.log({
    type,
    session_id: state?.session_id ?? "unknown",
    event_id: eventSeq++,
    ts: Date.now(),
    payload,
  });
}

function resolveAnswerLabel(question, answer) {
  if (!question) return "";
  if (answer.type === "choice") {
    const opt = question.options?.find((o) => o.id === answer.oid);
    return opt?.label ?? answer.oid ?? "";
  }
  if (answer.type === "slider") {
    const labels = question.slider?.labels ?? {};
    const label = labels[answer.value];
    return label ? `${answer.value} (${label})` : String(answer.value);
  }
  return "";
}

async function copyToClipboard(text) {
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // fallback below
    }
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "absolute";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

function computeStopMetrics(state, bundle) {
  const keyAxes = bundle.key_axes ?? (bundle.axes ?? []).map((a) => a.id);
  const axis_ids = keyAxes;
  const axis_conf = axis_ids.map((id) => state.axes[id]?.confidence ?? 0);
  const min_axis_confidence = Math.min(...axis_conf);
  const thresholds = { low: 0.2, medium: 0.4, high: 0.66 };
  const axis_counts = {
    high: axis_conf.filter((v) => v >= thresholds.high).length,
    medium: axis_conf.filter((v) => v >= thresholds.medium && v < thresholds.high).length,
    low: axis_conf.filter((v) => v >= thresholds.low && v < thresholds.medium).length,
    unknown: axis_conf.filter((v) => v < thresholds.low).length,
  };
  const module_ids = Object.keys(state.modules ?? {});
  const module_conf = module_ids.map((id) => state.modules[id]?.confidence ?? 0);
  const module_min_confidence = module_conf.length ? Math.min(...module_conf) : 0;
  const conflicts = keyAxes.reduce(
    (sum, id) => sum + (state.axes[id]?.conflicts ?? 0),
    0
  );
  return {
    key_axes: keyAxes,
    min_axis_confidence,
    axis_ids,
    axis_conf,
    module_ids,
    module_conf,
    thresholds,
    axis_counts,
    module_min_confidence,
    conflicts,
    margin: state.candidates?.margin ?? null,
  };
}

function hasAvailableFocusQuestion(state, bundle) {
  if (!state.focus) return false;
  for (const q of bundle.questions ?? []) {
    if (q.tags?.includes("pool_exclude")) continue;
    if (state.asked.includes(q.id)) continue;
    const cd = state.cooldowns[q.id];
    if (cd && state.asked.length < cd.until) continue;
    if (!passesEligibilityLite(q, state)) continue;
    const safety = questionSafetyStatus(q, state);
    if (!safety.allowed) continue;
    const touches = questionTouchesFocus(q, state.focus);
    if (touches) return true;
  }
  return false;
}

function passesEligibilityLite(q, state) {
  const req = q.eligibility?.requires;
  if (req?.axes_confidence_lt) {
    for (const [axisId, thr] of Object.entries(req.axes_confidence_lt)) {
      if (state.focus?.type === "axis" && axisId === state.focus.id) continue;
      if ((state.axes[axisId]?.confidence ?? 0) >= thr) return false;
    }
  }
  return true;
}

function questionTouchesFocus(q, focus) {
  if (!focus) return false;
  if (q.type === "choice") {
    for (const o of q.options ?? []) {
      if (focus.type === "axis") {
        if (o.effects?.axis_deltas?.[focus.id] != null) return true;
        if (o.effects?.axis_evidence?.[focus.id] != null) return true;
      }
      if (focus.type === "module") {
        if (o.effects?.module_evidence?.[focus.id] != null) return true;
        if (o.effects?.module_delta_levels?.[focus.id] != null) return true;
        if (o.effects?.set_module_level?.[focus.id] != null) return true;
      }
      if (focus.type === "mode") {
        if (o.effects?.set_modes?.[focus.id] != null) return true;
      }
    }
  }
  if (q.type === "slider") {
    for (const r of q.effects_by_range ?? []) {
      if (focus.type === "axis") {
        if (r.effects?.axis_deltas?.[focus.id] != null) return true;
        if (r.effects?.axis_evidence?.[focus.id] != null) return true;
      }
      if (focus.type === "module") {
        if (r.effects?.module_evidence?.[focus.id] != null) return true;
        if (r.effects?.module_delta_levels?.[focus.id] != null) return true;
        if (r.effects?.set_module_level?.[focus.id] != null) return true;
      }
      if (focus.type === "mode") {
        if (r.effects?.set_modes?.[focus.id] != null) return true;
      }
    }
  }
  return false;
}
