const { INTENTS } = require("../../intents");
const { isEditorFocused } = require("../../editorFocusState");
const { setCommandTarget } = require("../../state/commandState");

function createCommandUiHandlers(deps) {
  const {
    uiShell,
    buffers,
    enterCommandMode,
    focusEditableBufferSurface,
    runEditableExCommand,
    dispatch,
  } = deps;

  function resolveCommandContext(state) {
    if (state.mode === "SEARCH" || state.searchPromptVisible) {
      return "search";
    }
    return state.commandTarget === "EDITOR" ? "editor" : "shell";
  }

  return {
    [INTENTS.SHOW_COMMAND]: ({ state }) => {
      uiShell.showCommand(
        state.commandBuffer,
        state.commandCursorIndex,
        resolveCommandContext(state),
      );
      buffers.focusActive();
    },
    [INTENTS.HIDE_COMMAND]: ({ state }) => {
      setCommandTarget(state, "SHELL");
      uiShell.hideCommand();
      buffers.focusActive();
      if (isEditorFocused(state)) {
        focusEditableBufferSurface(buffers.getActive());
      }
    },
    [INTENTS.COMMAND_INPUT]: ({ state }) => {
      uiShell.updateCommand(
        state.mode === "SEARCH" || state.searchPromptVisible
          ? state.searchQuery
          : state.commandBuffer,
        state.mode === "SEARCH" || state.searchPromptVisible
          ? state.searchQuery.length
          : state.commandCursorIndex,
        resolveCommandContext(state),
      );
      if (state.mode === "SEARCH" || state.searchPromptVisible) {
        uiShell.showCommand(state.searchQuery, state.searchQuery.length, "search");
      }
    },
    [INTENTS.SUBMIT_EDITOR_COMMAND]: ({ intent }) => {
      const activeEditableBuffer = buffers.getActive();
      runEditableExCommand(activeEditableBuffer, intent.command);
    },
    [INTENTS.SHOW_WHICHKEY]: ({ intent }) => {
      uiShell.showWhichKey(
        intent.model || null,
        intent.timeoutMs,
        intent.delayMs,
      );
    },
    [INTENTS.UPDATE_WHICHKEY]: ({ intent }) => {
      uiShell.updateWhichKey(
        intent.model || null,
        intent.timeoutMs,
        intent.delayMs,
      );
    },
    [INTENTS.PAGE_WHICHKEY]: ({ intent }) => {
      uiShell.updateWhichKey(
        { ...(uiShell.whichKeyModel || {}), pageDelta: intent.delta },
        intent.timeoutMs,
        0,
        true,
        true,
      );
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
