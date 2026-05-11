const { setCommandTarget, setCommandBuffer } = require("./state/commandState");

function normalizeMode(mode) {
  if (mode === "INSERT" || mode === "COMMAND") {
    return mode;
  }
  return "NORMAL";
}

function warnIllegalTransition(message, details) {
  try {
    console.warn(`[mode-transition] ${message}`, details || {});
  } catch {
    // noop
  }
}

function setMode(state, nextMode, _reason = "") {
  if (!state || typeof state !== "object") {
    return false;
  }

  const normalized = normalizeMode(nextMode);
  const previous = normalizeMode(state.mode);

  if (previous === normalized) {
    return false;
  }

  state.mode = normalized;
  return true;
}

function enterInsertMode(state, reason = "") {
  return setMode(state, "INSERT", reason || "enter-insert");
}

function enterNormalMode(state, reason = "") {
  return setMode(state, "NORMAL", reason || "enter-normal");
}

function enterCommandMode(state, options = {}) {
  if (!state || typeof state !== "object") {
    return false;
  }

  const target = options.target === "EDITOR" ? "EDITOR" : "SHELL";
  const initialText =
    typeof options.initialText === "string" ? options.initialText : "";
  const explicitCursor = Number.isFinite(options.cursorIndex)
    ? Math.trunc(options.cursorIndex)
    : initialText.length;
  const clampedCursor = Math.max(
    0,
    Math.min(explicitCursor, initialText.length),
  );

  setMode(state, "COMMAND", options.reason || "enter-command");
  setCommandTarget(state, target);
  setCommandBuffer(state, initialText, clampedCursor);
  return true;
}

function exitCommandMode(state, options = {}) {
  if (!state || typeof state !== "object") {
    return false;
  }

  if (state.mode !== "COMMAND") {
    warnIllegalTransition("Exiting command mode while not in command mode", {
      mode: state.mode,
      reason: options.reason || "",
    });
  }

  setMode(state, "NORMAL", options.reason || "exit-command");
  setCommandTarget(state, "SHELL");
  if (options.clearBuffer !== false) {
    setCommandBuffer(state, "", 0);
  }
  return true;
}

module.exports = {
  enterInsertMode,
  enterNormalMode,
  enterCommandMode,
  exitCommandMode,
  setMode,
};
