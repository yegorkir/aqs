import { loadBundleAndSchema, indexBundle } from "./load.js";
import { validateBundleLight } from "./validate.js";
import { initState } from "./engine/state.js";
import { applyAnswer } from "./engine/applyAnswer.js";
import { pickNextQuestion } from "./engine/pickNext.js";
import { evaluateStop } from "./engine/stop.js";
import { resolveFollowup } from "./engine/followup.js";
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
let lastLog = null;
let nextDebug = null;
let stopInfo = null;

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
  logEvent("reset", { session_id: state.session_id });
  stepPick();
  render();
}

function stepPick() {
  const next = pickNextQuestion(state, bundle);
  nextDebug = next.debug;
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

  if (stopInfo.propose) {
    state.phase = "propose_result";
  }

  stepPick();
  render();
}

function renderStatus(status, message = "") {
  renderPlayer(playerRoot, { status, message }, { onAnswer });
  renderDebug(debugRoot, {
    validationWarnings,
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
    },
    { onAnswer }
  );

  renderDebug(debugRoot, {
    validationWarnings,
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

function computeStopMetrics(state, bundle) {
  const keyAxes = bundle.key_axes ?? (bundle.axes ?? []).map((a) => a.id);
  const min_axis_confidence = Math.min(
    ...keyAxes.map((id) => state.axes[id]?.confidence ?? 0)
  );
  const conflicts = keyAxes.reduce(
    (sum, id) => sum + (state.axes[id]?.conflicts ?? 0),
    0
  );
  return {
    key_axes: keyAxes,
    min_axis_confidence,
    conflicts,
    margin: state.candidates?.margin ?? null,
  };
}
