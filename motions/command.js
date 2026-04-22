const { parseCommand } = require("../core/commandParser");
const { INTENTS } = require("../core/intents");

function toCommandChar(input) {
  if (input.ctrl || input.alt || input.meta) {
    return null;
  }

  if (input.key === "Space") {
    return " ";
  }

  if (typeof input.key === "string" && input.key.length === 1) {
    return input.key;
  }

  return null;
}

function handleCommand(state, input) {
  if (input.key === "Escape") {
    state.mode = "NORMAL";
    state.commandBuffer = "";
    return { type: INTENTS.HIDE_COMMAND };
  }

  if (input.key === "Enter") {
    const cmd = state.commandBuffer;
    state.mode = "NORMAL";
    state.commandBuffer = "";

    return {
      type: INTENTS.HIDE_COMMAND,
      next: parseCommand(cmd),
    };
  }

  if (input.key === "Backspace") {
    state.commandBuffer = state.commandBuffer.slice(0, -1);
    return { type: INTENTS.COMMAND_INPUT };
  }

  const char = toCommandChar(input);
  if (char !== null) {
    state.commandBuffer += char;
    return { type: INTENTS.COMMAND_INPUT };
  }

  return null;
}

module.exports = { handleCommand };
