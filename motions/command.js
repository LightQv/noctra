const { parseCommand } = require("../core/commandParser");
const { INTENTS } = require("../core/intents");
const { exitCommandMode } = require("../core/modeTransitionService");
const {
  setCommandCursor,
  insertCommandTextAtCursor,
  moveCommandCursor,
  deleteCommandBackward,
  deleteCommandForward,
} = require("../core/state/commandState");

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
  if (typeof input.pasteText === "string" && input.pasteText.length > 0) {
    if (!insertCommandTextAtCursor(state, input.pasteText)) {
      return null;
    }
    return { type: INTENTS.COMMAND_INPUT };
  }

  if (input.key === "Escape") {
    exitCommandMode(state, { reason: "command-escape" });
    return { type: INTENTS.HIDE_COMMAND };
  }

  if (input.key === "Enter") {
    const cmd = state.commandBuffer;
    const target = state.commandTarget === "EDITOR" ? "EDITOR" : "SHELL";
    exitCommandMode(state, { reason: "command-enter" });

    if (target === "EDITOR") {
      return {
        type: INTENTS.HIDE_COMMAND,
        next: {
          type: INTENTS.SUBMIT_EDITOR_COMMAND,
          command: cmd,
        },
      };
    }

    return {
      type: INTENTS.HIDE_COMMAND,
      next: parseCommand(cmd),
    };
  }

  if (input.key === "Left" || input.key === "ArrowLeft") {
    moveCommandCursor(state, -1);
    return { type: INTENTS.COMMAND_INPUT };
  }

  if (input.key === "Right" || input.key === "ArrowRight") {
    moveCommandCursor(state, 1);
    return { type: INTENTS.COMMAND_INPUT };
  }

  if (input.key === "Home") {
    setCommandCursor(state, 0);
    return { type: INTENTS.COMMAND_INPUT };
  }

  if (input.key === "End") {
    setCommandCursor(state, state.commandBuffer.length);
    return { type: INTENTS.COMMAND_INPUT };
  }

  if (input.key === "Backspace") {
    if (!deleteCommandBackward(state)) {
      return null;
    }
    return { type: INTENTS.COMMAND_INPUT };
  }

  if (input.key === "Delete") {
    if (!deleteCommandForward(state)) {
      return null;
    }
    return { type: INTENTS.COMMAND_INPUT };
  }

  const char = toCommandChar(input);
  if (char !== null) {
    if (!insertCommandTextAtCursor(state, char)) {
      return null;
    }
    return { type: INTENTS.COMMAND_INPUT };
  }

  return null;
}

module.exports = { handleCommand };
