const { isEditorFocused } = require("./editorFocusState");

function normalizeTreeKind(treeKind) {
  if (treeKind === "bookmarks") return "bookmarks";
  if (treeKind === "downloads") return "downloads";
  return "history";
}

function resolveSemanticContext({
  state,
  buffers,
  sidepanelController,
  focusSnapshot,
} = {}) {
  const sidepanel = sidepanelController;
  const activeBuffer =
    buffers && typeof buffers.getActive === "function"
      ? buffers.getActive()
      : null;
  const snapshot = focusSnapshot || {};
  const historyFocused =
    typeof snapshot.sidepanelFocused === "boolean"
      ? snapshot.sidepanelFocused
      : Boolean(sidepanel && sidepanel.isFocused && sidepanel.isFocused());

  if (historyFocused) {
    const treeKind =
      sidepanel && typeof sidepanel.getTreeKind === "function"
        ? sidepanel.getTreeKind()
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
