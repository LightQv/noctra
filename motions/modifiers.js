const { getCtrlAction } = require("./keymap");
const { rememberRepeatableIntent } = require("./repeat");

function handleCtrl(state, key) {
  const builder = getCtrlAction(key);
  if (!builder) return null;
  const intent = builder(state, 1);
  rememberRepeatableIntent(state, intent, builder.actionId);
  return intent;
}

module.exports = { handleCtrl };
