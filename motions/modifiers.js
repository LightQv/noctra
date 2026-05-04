const { getModAction } = require("./keymap");
const { rememberRepeatableIntent } = require("./repeat");

function isModPressed(input) {
  if (!input) return false;
  if (process.platform === "darwin") {
    return Boolean(input.ctrl && !input.meta);
  }
  return Boolean(input.ctrl && !input.meta);
}

function handleMod(state, key) {
  const builder = getModAction(key);
  if (!builder) return null;
  const intent = builder(state, 1);
  rememberRepeatableIntent(state, intent, builder.actionId);
  return intent;
}

module.exports = { isModPressed, handleMod };
