const { INTENTS } = require("../../intents");

function createCommandUiHandlers(deps) {
  const {
    uiShell,
    buffers,
    enterCommandMode,
    focusEditableBufferSurface,
    runEditableExCommand,
    dispatch,
  } = deps;

  return {
    [INTENTS.SHOW_COMMAND]: ({ state }) => {
      uiShell.showCommand(
        state.commandBuffer,
        state.commandCursorIndex,
        state.commandTarget === "EDITOR" ? "editor" : "shell",
      );
      buffers.focusActive();
    },
    [INTENTS.HIDE_COMMAND]: ({ state }) => {
      state.commandTarget = "SHELL";
      uiShell.hideCommand();
      buffers.focusActive();
      if (state.interactionContext === "EDITOR") {
        focusEditableBufferSurface(buffers.getActive());
      }
    },
    [INTENTS.COMMAND_INPUT]: ({ state }) => {
      uiShell.updateCommand(
        state.commandBuffer,
        state.commandCursorIndex,
        state.commandTarget === "EDITOR" ? "editor" : "shell",
      );
    },
    [INTENTS.SUBMIT_EDITOR_COMMAND]: ({ intent }) => {
      const activeEditableBuffer = buffers.getActive();
      runEditableExCommand(activeEditableBuffer, intent.command);
    },
    [INTENTS.SHOW_WHICHKEY]: ({ intent }) => {
      uiShell.showWhichKey(intent.model || null, intent.timeoutMs, intent.delayMs);
    },
    [INTENTS.UPDATE_WHICHKEY]: ({ intent }) => {
      uiShell.updateWhichKey(intent.model || null, intent.timeoutMs, intent.delayMs);
    },
    [INTENTS.HIDE_WHICHKEY]: () => {
      uiShell.hideWhichKey();
    },
    [INTENTS.OPEN_URL_PROMPT]: ({ state, win }) => {
      enterCommandMode(state, {
        target: "SHELL",
        initialText: "open ",
        reason: "dispatcher-open-url-prompt",
      });
      dispatch(win, { type: INTENTS.SHOW_COMMAND }, state);
      dispatch(win, { type: INTENTS.COMMAND_INPUT }, state);
    },
  };
}

module.exports = { createCommandUiHandlers };
