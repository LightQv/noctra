const state = require("./state");
const buffers = require("../browser/manager");
const { handleNormal } = require("../motions/normal");
const { handleInsert } = require("../motions/insert");
const { handleCommand } = require("../motions/command");
const { dispatch } = require("./dispatcher");

function shouldPreventDefault(input) {
  if (input.type !== "keyDown") return false;

  if (state.mode === "COMMAND") {
    return true;
  }

  const activeBuffer = buffers.getActive();

  if (state.interactionContext === "EDITOR" && activeBuffer?.isEditable) {
    return false;
  }

  switch (state.mode) {
    case "NORMAL":
      return true;

    case "COMMAND":
      return true;

    case "INSERT":
      return input.key === "Escape";

    default:
      return false;
  }
}

function handleInput(win, input) {
  if (input.type !== "keyDown") return;

  const activeBuffer = buffers.getActive();

  if (
    state.mode !== "COMMAND" &&
    state.interactionContext === "EDITOR" &&
    activeBuffer?.isEditable
  ) {
    return;
  }

  let intent = null;

  switch (state.mode) {
    case "NORMAL":
      intent = handleNormal(state, input);
      break;

    case "INSERT":
      intent = handleInsert(state, input.key);
      break;

    case "COMMAND":
      intent = handleCommand(state, input);
      break;
  }

  if (intent) {
    dispatch(win, intent, state);
  }
}

module.exports = { handleInput, shouldPreventDefault };
