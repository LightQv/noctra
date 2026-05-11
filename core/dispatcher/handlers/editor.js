const { INTENTS } = require("../../intents");
const {
  setEditorFocused,
  toggleEditorFocused,
} = require("../../editorFocusState");
const { setEditorMode } = require("../../state/editorModeState");

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
      setEditorFocused(state, true);
      setEditorMode(state, "NORMAL");
    },
    [INTENTS.OPEN_NOTIFICATIONS_BUFFER]: ({ state }) => {
      focusEditableBufferSurface(openNotificationsBuffer());
      buffers.focusActive();
      setEditorFocused(state, true);
      setEditorMode(state, "NORMAL");
    },
    [INTENTS.TOGGLE_FOCUS_CONTEXT]: ({ state }) => {
      const active = buffers.getActive();
      if (!active || !active.isEditable) {
        return;
      }

      const focused = toggleEditorFocused(state);
      if (focused) {
        setEditorMode(state, "NORMAL");
        focusEditableBufferSurface(active);
      } else {
        blurEditableBufferSurface(active);
      }
    },
  };
}

module.exports = { createEditorHandlers };
