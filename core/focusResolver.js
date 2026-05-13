const { isEditorFocused } = require("./editorFocusState");

function resolveFocusOwner(snapshot = {}) {
  if (snapshot.bookmarkModalActive) {
    return "BOOKMARK_MODAL";
  }

  if (snapshot.downloadsModalActive) {
    return "DOWNLOADS_MODAL";
  }

  if (snapshot.telescopeActive) {
    return "TELESCOPE";
  }

  if (snapshot.historyPanelFocused) {
    return "TREE";
  }

  if (snapshot.urllineEditing) {
    return "URLLINE";
  }

  if (snapshot.commandMode) {
    return "COMMAND";
  }

  if (snapshot.editorFocused && snapshot.activeBufferEditable) {
    return "EDITOR";
  }

  return "WEB";
}

function resolveFocusSnapshot({
  state,
  buffers,
  historyPanel,
  bookmarkInsertScopeModal,
  telescopeService,
  downloadsModal,
}) {
  const activeBuffer =
    buffers && typeof buffers.getActive === "function"
      ? buffers.getActive()
      : null;

  return {
    bookmarkModalActive: Boolean(
      bookmarkInsertScopeModal && bookmarkInsertScopeModal.isActive(),
    ),
    downloadsModalActive: Boolean(downloadsModal && downloadsModal.isActive()),
    telescopeActive: Boolean(telescopeService && telescopeService.isActive()),
    historyPanelVisible: Boolean(historyPanel && historyPanel.isVisible()),
    historyPanelFocused: Boolean(historyPanel && historyPanel.isFocused()),
    historyPanelTextInputActive: Boolean(
      historyPanel && historyPanel.isTextInputActive(),
    ),
    urllineEditing: Boolean(state && state.urllineEditing),
    commandMode: Boolean(state && state.mode === "COMMAND"),
    editorFocused: isEditorFocused(state),
    activeBufferEditable: Boolean(activeBuffer && activeBuffer.isEditable),
  };
}

module.exports = {
  resolveFocusOwner,
  resolveFocusSnapshot,
};
