const { getCtrlAction } = require("./keymap");

function handleCtrl(state, key) {
  const builder = getCtrlAction(key);
  if (!builder) return null;
  return builder(state, 1);
}

module.exports = { handleCtrl };
