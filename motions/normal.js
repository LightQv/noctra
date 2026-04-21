const keymap = require("./keymap");
const { handleCtrl } = require("./modifiers");

function handleNormal(state, input) {
  console.log(input);
  const now = Date.now();

  if (now - state.lastKeyTime > state.sequenceTimeout) {
    state.keyBuffer = "";
    state.countBuffer = "";
  }

  state.lastKeyTime = now;

  const { key, ctrl } = input;

  if (key === ":") {
    state.mode = "COMMAND";
    return { type: "SHOW_COMMAND" };
  }

  if (!ctrl && /[0-9]/.test(key)) {
    state.countBuffer += key;
    return null;
  }

  if (ctrl) {
    return handleCtrl(state, key);
  }

  state.keyBuffer += key;

  const match = keymap[state.keyBuffer];

  if (match) {
    const count = parseInt(state.countBuffer || "1", 10);
    state.countBuffer = "";
    state.keyBuffer = "";

    return match(state, count);
  }

  if (state.keyBuffer.length > 3) {
    state.keyBuffer = "";
  }

  return null;
}

module.exports = { handleNormal };
