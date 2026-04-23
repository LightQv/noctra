const { getConfigValue } = require("../core/config/service");
const { ACTION_BUILDERS } = require("./actionBuilders");

function getBuilderFor(actionId) {
  if (!actionId || typeof actionId !== "string") {
    return null;
  }

  return ACTION_BUILDERS[actionId] || null;
}

function getNormalKeymap() {
  const mappings = getConfigValue("keymap.normal", {});
  const runtime = {};

  if (!mappings || typeof mappings !== "object") {
    return runtime;
  }

  for (const [keys, entry] of Object.entries(mappings)) {
    const builder = getBuilderFor(entry?.action);
    if (!builder) continue;
    runtime[keys] = builder;
  }

  return runtime;
}

function getCtrlAction(key) {
  if (!key) return null;

  const ctrlMap = getConfigValue("keymap.ctrl", {});
  const mapping = ctrlMap?.[String(key).toLowerCase()];
  const builder = getBuilderFor(mapping?.action);
  return builder || null;
}

module.exports = {
  getNormalKeymap,
  getCtrlAction,
};
