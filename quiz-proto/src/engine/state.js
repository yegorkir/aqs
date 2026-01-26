export function initState(bundle) {
  const axes = {};
  for (const a of bundle.axes ?? []) {
    axes[a.id] = {
      score: a.defaults?.score ?? 0,
      confidence: a.defaults?.confidence ?? 0,
      evidence: a.defaults?.evidence ?? 0,
      recent_deltas: [],
      conflicts: 0,
    };
  }

  const modules = {};
  for (const m of bundle.modules ?? []) {
    modules[m.id] = {
      level: m.defaults?.level ?? 0,
      confidence: m.defaults?.confidence ?? 0,
      evidence: m.defaults?.evidence ?? 0,
    };
  }

  const modes = {};
  for (const md of bundle.modes ?? []) {
    modes[md.id] = md.default ?? "unknown";
  }

  return {
    session_id: getSessionId(),
    phase: "quiz",
    asked: [],
    answers: [],
    pending_followups: [],
    focus: null,
    axes,
    modules,
    modes,
    safety: {
      lines: [],
      veils: [],
      completion_mode: "unset",
    },
    tags: [],
    cooldowns: {},
    candidates: null,
    stop: bundle.stop ?? {
      min_questions: 10,
      target_margin: 0.12,
      min_axis_confidence: 0.35,
    },
    last: {
      qid: null,
      type: null,
    },
  };
}

function getSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sess_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
