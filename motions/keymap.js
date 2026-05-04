const { ACTION_BUILDERS } = require("./actionBuilders");
const { NORMAL_KEY_ACTIONS, MOD_KEY_ACTIONS } = require("./constants");

function getBuilderFor(actionId) {
  if (!actionId || typeof actionId !== "string") {
    return null;
  }

  return ACTION_BUILDERS[actionId] || null;
}

function getNormalKeymap() {
  const runtime = {};

  for (const [keys, actionId] of Object.entries(NORMAL_KEY_ACTIONS)) {
    const builder = getBuilderFor(actionId);
    if (!builder) continue;
    runtime[keys] = builder;
  }

  return runtime;
}

function getModAction(key) {
  if (!key) return null;

  const keyText = String(key);
  const actionId = MOD_KEY_ACTIONS[keyText] || MOD_KEY_ACTIONS[keyText.toLowerCase()];
  const builder = getBuilderFor(actionId);
  return builder || null;
}

module.exports = {
  getNormalKeymap,
  getModAction,
};
