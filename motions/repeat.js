const { INTENTS } = require("../core/intents");

function cloneIntent(intent) {
  if (!intent || typeof intent !== "object") {
    return null;
  }

  return JSON.parse(JSON.stringify(intent));
}

function rememberRepeatableIntent(state, intent, actionId) {
  if (!state || !intent || actionId === "repeat_last_action") {
    return;
  }

  const copied = cloneIntent(intent);
  if (!copied || copied.type === INTENTS.NOOP) {
    return;
  }

  state.lastRepeatableIntent = copied;
}

module.exports = {
  cloneIntent,
  rememberRepeatableIntent,
};
