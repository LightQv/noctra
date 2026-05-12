const { isEditorFocused } = require("./editorFocusState");

function normalizeTreeKind(treeKind) {
  if (treeKind === "bookmarks") return "bookmarks";
  if (treeKind === "downloads") return "downloads";
  return "history";
}

function resolveSemanticContext({
  state,
  buffers,
  historyPanel,
  focusSnapshot,
} = {}) {
  const activeBuffer =
    buffers && typeof buffers.getActive === "function"
      ? buffers.getActive()
      : null;
  const snapshot = focusSnapshot || {};
  const historyFocused =
    typeof snapshot.historyPanelFocused === "boolean"
      ? snapshot.historyPanelFocused
      : Boolean(
          historyPanel && historyPanel.isFocused && historyPanel.isFocused(),
        );

  if (historyFocused) {
    const treeKind =
      historyPanel && typeof historyPanel.getTreeKind === "function"
        ? historyPanel.getTreeKind()
        : "history";
    return normalizeTreeKind(treeKind);
  }

  const inEditorContext =
    isEditorFocused(state) && Boolean(activeBuffer && activeBuffer.isEditable);
  if (inEditorContext) {
    return "editor";
  }

  return "web";
}

module.exports = {
  resolveSemanticContext,
};
