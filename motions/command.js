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

function normalizeCommandText(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n|\r|\n/g, " ");
}

function clampCursorIndex(state) {
  const max = state.commandBuffer.length;
  const index = Number.isFinite(state.commandCursorIndex)
    ? Math.trunc(state.commandCursorIndex)
    : max;
  state.commandCursorIndex = Math.max(0, Math.min(index, max));
}

function insertAtCursor(state, text) {
  const chunk = normalizeCommandText(text);
  if (!chunk) return false;

  clampCursorIndex(state);
  const cursor = state.commandCursorIndex;
  state.commandBuffer =
    state.commandBuffer.slice(0, cursor) +
    chunk +
    state.commandBuffer.slice(cursor);
  state.commandCursorIndex = cursor + chunk.length;
  return true;
}

function moveCursor(state, delta) {
  clampCursorIndex(state);
  state.commandCursorIndex = Math.max(
    0,
    Math.min(state.commandCursorIndex + delta, state.commandBuffer.length),
  );
}

function handleCommand(state, input) {
  if (typeof input.pasteText === "string" && input.pasteText.length > 0) {
    if (!insertAtCursor(state, input.pasteText)) {
      return null;
    }
    return { type: INTENTS.COMMAND_INPUT };
  }

  if (input.key === "Escape") {
    state.mode = "NORMAL";
    state.commandBuffer = "";
    state.commandCursorIndex = 0;
    state.commandTarget = "SHELL";
    return { type: INTENTS.HIDE_COMMAND };
  }

  if (input.key === "Enter") {
    const cmd = state.commandBuffer;
    const target = state.commandTarget === "EDITOR" ? "EDITOR" : "SHELL";
    state.mode = "NORMAL";
    state.commandBuffer = "";
    state.commandCursorIndex = 0;
    state.commandTarget = "SHELL";

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
    moveCursor(state, -1);
    return { type: INTENTS.COMMAND_INPUT };
  }

  if (input.key === "Right" || input.key === "ArrowRight") {
    moveCursor(state, 1);
    return { type: INTENTS.COMMAND_INPUT };
  }

  if (input.key === "Home") {
    state.commandCursorIndex = 0;
    return { type: INTENTS.COMMAND_INPUT };
  }

  if (input.key === "End") {
    state.commandCursorIndex = state.commandBuffer.length;
    return { type: INTENTS.COMMAND_INPUT };
  }

  if (input.key === "Backspace") {
    clampCursorIndex(state);
    if (state.commandCursorIndex <= 0) {
      return null;
    }

    const cursor = state.commandCursorIndex;
    state.commandBuffer =
      state.commandBuffer.slice(0, cursor - 1) +
      state.commandBuffer.slice(cursor);
    state.commandCursorIndex = cursor - 1;
    return { type: INTENTS.COMMAND_INPUT };
  }

  if (input.key === "Delete") {
    clampCursorIndex(state);
    const cursor = state.commandCursorIndex;
    if (cursor >= state.commandBuffer.length) {
      return null;
    }

    state.commandBuffer =
      state.commandBuffer.slice(0, cursor) +
      state.commandBuffer.slice(cursor + 1);
    return { type: INTENTS.COMMAND_INPUT };
  }

  const char = toCommandChar(input);
  if (char !== null) {
    if (!insertAtCursor(state, char)) {
      return null;
    }
    return { type: INTENTS.COMMAND_INPUT };
  }

  return null;
}

module.exports = { handleCommand };
