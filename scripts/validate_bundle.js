#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const bundlePath = process.argv[2] || path.join("content", "bundle.json");
const raw = fs.readFileSync(bundlePath, "utf8");

const cleaned = raw
  .replace(/^```[a-z]*\s*\n/i, "")
  .replace(/\n```\s*$/i, "");

let bundle;
try {
  bundle = JSON.parse(cleaned);
} catch (err) {
  console.error(`Invalid JSON in ${bundlePath}: ${err.message}`);
  process.exit(1);
}

const errors = [];

const requireTopLevel = [
  "schema_version",
  "content_version",
  "axes",
  "modules",
  "modes",
  "safety_tags",
  "questions",
];

for (const key of requireTopLevel) {
  if (!(key in bundle)) errors.push(`Missing top-level field: ${key}`);
}

const ensureArray = (key) => {
  if (key in bundle && !Array.isArray(bundle[key])) {
    errors.push(`Top-level "${key}" must be an array`);
  }
};

["axes", "modules", "modes", "safety_tags", "questions"].forEach(ensureArray);

const uniqueIds = (items, label) => {
  const seen = new Set();
  for (const item of items || []) {
    if (!item?.id) {
      errors.push(`${label}: item without id`);
      continue;
    }
    if (seen.has(item.id)) errors.push(`${label}: duplicate id "${item.id}"`);
    seen.add(item.id);
  }
  return seen;
};

const axisIds = uniqueIds(bundle.axes, "axes");
const moduleIds = uniqueIds(bundle.modules, "modules");
const modeIds = uniqueIds(bundle.modes, "modes");
const safetyIds = uniqueIds(bundle.safety_tags, "safety_tags");
const questionIds = uniqueIds(bundle.questions, "questions");

const checkEffects = (effects, ctx) => {
  if (!effects) return;
  const {
    axis_deltas,
    axis_evidence,
    module_delta_levels,
    set_module_level,
    module_evidence,
    set_modes,
  } = effects;

  const checkKeys = (obj, ids, label) => {
    if (!obj) return;
    for (const key of Object.keys(obj)) {
      if (!ids.has(key)) {
        errors.push(`${ctx}: ${label} references unknown id "${key}"`);
      }
    }
  };

  checkKeys(axis_deltas, axisIds, "axis_deltas");
  checkKeys(axis_evidence, axisIds, "axis_evidence");
  checkKeys(module_delta_levels, moduleIds, "module_delta_levels");
  checkKeys(set_module_level, moduleIds, "set_module_level");
  checkKeys(module_evidence, moduleIds, "module_evidence");
  checkKeys(set_modes, modeIds, "set_modes");
};

const checkContentTags = (tags, ctx) => {
  if (!tags) return;
  for (const tag of tags) {
    if (!safetyIds.has(tag)) {
      errors.push(`${ctx}: content_tag "${tag}" not found in safety_tags`);
    }
  }
};

for (const q of bundle.questions || []) {
  if (!q?.id) continue;
  const qCtx = `question "${q.id}"`;

  checkContentTags(q.content_tags, qCtx);

  const optionIds = new Set();
  for (const opt of q.options || []) {
    const oCtx = `${qCtx} option "${opt?.id ?? "unknown"}"`;
    if (!opt?.id) errors.push(`${qCtx}: option missing id`);
    if (opt?.id && optionIds.has(opt.id)) {
      errors.push(`${qCtx}: duplicate option id "${opt.id}"`);
    }
    if (opt?.id) optionIds.add(opt.id);

    checkContentTags(opt.content_tags, oCtx);
    checkEffects(opt.effects, oCtx);
  }

  const followups = q.followups || [];
  for (const rule of followups) {
    const pool = rule?.policy?.pool || [];
    for (const id of pool) {
      if (!questionIds.has(id)) {
        errors.push(`${qCtx}: followup pool references unknown question "${id}"`);
      }
    }
  }

  const followupsByRange = q.followups_by_range || [];
  for (const rule of followupsByRange) {
    const pool = rule?.policy?.pool || [];
    for (const id of pool) {
      if (!questionIds.has(id)) {
        errors.push(`${qCtx}: followup_by_range pool references unknown question "${id}"`);
      }
    }
  }
}

if (errors.length) {
  console.error("Bundle validation failed:");
  for (const err of errors) console.error(`- ${err}`);
  process.exit(1);
}

console.log(`OK: ${bundlePath}`);
