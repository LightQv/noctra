const { INTENTS } = require("../../intents");

function createEditorHandlers(deps) {
  const {
    buffers,
    openSettingsBuffer,
    openNotificationsBuffer,
    focusEditableBufferSurface,
    blurEditableBufferSurface,
    blurFocusedWebInput,
  } = deps;

  return {
    [INTENTS.ENTER_INSERT]: () => {
      // state already changed in motion layer
    },
    [INTENTS.ENTER_NORMAL]: () => {
      blurFocusedWebInput(buffers.getActive());
    },
    [INTENTS.OPEN_SETTINGS_BUFFER]: ({ state }) => {
      focusEditableBufferSurface(openSettingsBuffer());
      buffers.focusActive();
      state.interactionContext = "EDITOR";
      state.editorMode = "NORMAL";
    },
    [INTENTS.OPEN_NOTIFICATIONS_BUFFER]: ({ state }) => {
      focusEditableBufferSurface(openNotificationsBuffer());
      buffers.focusActive();
      state.interactionContext = "EDITOR";
      state.editorMode = "NORMAL";
    },
    [INTENTS.TOGGLE_FOCUS_CONTEXT]: ({ state }) => {
      const active = buffers.getActive();
      if (!active || !active.isEditable) {
        return;
      }

      state.interactionContext = state.interactionContext === "EDITOR" ? "SHELL" : "EDITOR";
      if (state.interactionContext === "EDITOR") {
        state.editorMode = "NORMAL";
        focusEditableBufferSurface(active);
      } else {
        blurEditableBufferSurface(active);
      }
    },
  };
}

module.exports = { createEditorHandlers };
