export async function loadBundleAndSchema() {
  const [bundleRes, schemaRes] = await Promise.all([
    fetch("./content/bundle.json"),
    fetch("./schema/quiz.schema.json"),
  ]);

  if (!bundleRes.ok) {
    throw new Error(`Failed to load bundle.json: ${bundleRes.status}`);
  }
  if (!schemaRes.ok) {
    throw new Error(`Failed to load quiz.schema.json: ${schemaRes.status}`);
  }

  const [bundleText, schemaText] = await Promise.all([
    bundleRes.text(),
    schemaRes.text(),
  ]);

  const bundle = parseJsonWithFenceSupport(bundleText, "bundle.json");
  const schema = parseJsonWithFenceSupport(schemaText, "quiz.schema.json");

  return { bundle, schema };
}

export function indexBundle(bundle) {
  const axesById = toIdMap(bundle.axes ?? []);
  const modulesById = toIdMap(bundle.modules ?? []);
  const modesById = toIdMap(bundle.modes ?? []);
  const questionsById = toIdMap(bundle.questions ?? []);
  const safetyTagsById = toIdMapWithAliases(bundle.safety_tags ?? []);

  return {
    ...bundle,
    axesById,
    modulesById,
    modesById,
    questionsById,
    safetyTagsById,
  };
}

function toIdMap(list) {
  const map = {};
  for (const item of list) {
    if (!item?.id) continue;
    map[item.id] = item;
  }
  return map;
}

function toIdMapWithAliases(list) {
  const map = {};
  for (const item of list) {
    if (!item?.id) continue;
    map[item.id] = item;
    for (const alias of item.aliases ?? []) {
      if (!map[alias]) map[alias] = item;
    }
  }
  return map;
}

function parseJsonWithFenceSupport(text, label) {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    const unwrapped = trimmed.replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/, "");
    return JSON.parse(unwrapped);
  }
  try {
    return JSON.parse(trimmed);
  } catch (err) {
    throw new Error(`${label} is not valid JSON: ${err.message}`);
  }
}
