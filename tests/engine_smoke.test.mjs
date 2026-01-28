import assert from "node:assert/strict";
import { applyAnswer } from "../app/src/engine/applyAnswer.js";
import {
  applyPreconfigAdjustments,
  computeClarifyPairs,
} from "../app/src/engine/preconfig.js";

function makeBaseState() {
  return {
    axes: {},
    modules: {
      m1: { level: 0, confidence: 0, evidence: 0 },
    },
    modes: {},
    safety: { lines: [], veils: [], completion_mode: "unset" },
    tags: [],
    asked: [],
    answers: [],
    pending_followups: [],
    cooldowns: {},
    last: { qid: null, type: null },
  };
}

{
  const q = {
    id: "q1",
    type: "choice",
    options: [
      {
        id: "o1",
        effects: {
          set_module_level: { m1: 2 },
        },
      },
    ],
  };
  const state = makeBaseState();
  const bundle = { questionsById: { q1: q } };
  const answer = { qid: "q1", type: "choice", oid: "o1" };
  const result = applyAnswer(state, bundle, answer);
  assert.equal(result.state.modules.m1.level, 2);
  assert.equal(result.log.module_changes.m1.set_level, 2);
}

{
  const axisValues = { a: 0.9, b: 0.9 };
  const specify = { "a-b": 0.5 };
  const preconfig = { clarify: { min_multiplier: 0.5, max_multiplier: 1.5 } };
  const adjusted = applyPreconfigAdjustments(axisValues, specify, preconfig);
  assert.equal(adjusted.a, 0.45);
  assert.equal(adjusted.b, 1);
}

{
  const preconfig = { clarify: { min_percent: 50, max_diff: 10 } };
  const pairs = [{ pair: ["a", "b"] }];
  const axisValues = { a: 0.7, b: 0.62 };
  const included = computeClarifyPairs(axisValues, { ...preconfig, axis_pairs: pairs });
  assert.deepEqual(included, [["a", "b"]]);

  const axisValuesLoose = { a: 0.7, b: 0.4 };
  const excluded = computeClarifyPairs(axisValuesLoose, { ...preconfig, axis_pairs: pairs });
  assert.deepEqual(excluded, []);
}

console.log("engine_smoke.test.mjs passed");
