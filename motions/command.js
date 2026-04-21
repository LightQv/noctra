const { parseCommand } = require("../core/commandParser");

function handleCommand(state, input) {
  if (input.type === "COMMAND_INPUT") {
    state.commandBuffer = input.value;
    return { type: "COMMAND_INPUT" };
  }

  if (input.key === "Escape") {
    state.mode = "NORMAL";
    state.commandBuffer = "";
    return { type: "HIDE_COMMAND" };
  }

  if (input.key === "Enter") {
    const cmd = state.commandBuffer;
    state.mode = "NORMAL";
    state.commandBuffer = "";

    return {
      type: "HIDE_COMMAND",
      next: parseCommand(cmd),
    };
  }

  return null;
}

module.exports = { handleCommand };
