const { ACTION_BUILDERS } = require("./actionBuilders");
const { getConfigValue } = require("../core/config/service");

function getBuilderFor(actionId) {
  if (!actionId || typeof actionId !== "string") {
    return null;
  }

  return ACTION_BUILDERS[actionId] || null;
}

function getNormalKeymap() {
  const normalActions = getConfigValue("keymap.normal", {});
  const runtime = {};

  for (const [keys, actionId] of Object.entries(normalActions)) {
    const builder = getBuilderFor(actionId);
    if (!builder) continue;
    runtime[keys] = builder;
  }

  return runtime;
}

function getModAction(key) {
  if (!key) return null;

  const keyText = String(key);
  const modActions = getConfigValue("keymap.mod", {});
  const actionId = modActions[keyText] || modActions[keyText.toLowerCase()];
  const builder = getBuilderFor(actionId);
  return builder || null;
}

function getNormalActionMap() {
  return getConfigValue("keymap.normal", {});
}

function getModActionMap() {
  return getConfigValue("keymap.mod", {});
}

module.exports = {
  getNormalKeymap,
  getModAction,
  getNormalActionMap,
  getModActionMap,
};
