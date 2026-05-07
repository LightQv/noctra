function normalizeTreeKind(treeKind) {
  return treeKind === "bookmarks" ? "bookmarks" : "history";
}

function resolveSemanticContext({ state, buffers, historyPanel, focusSnapshot } = {}) {
  const activeBuffer = buffers && typeof buffers.getActive === "function" ? buffers.getActive() : null;
  const snapshot = focusSnapshot || {};
  const historyFocused =
    typeof snapshot.historyPanelFocused === "boolean"
      ? snapshot.historyPanelFocused
      : Boolean(historyPanel && historyPanel.isFocused && historyPanel.isFocused());

  if (historyFocused) {
    const treeKind =
      historyPanel && typeof historyPanel.getTreeKind === "function"
        ? historyPanel.getTreeKind()
        : "history";
    return normalizeTreeKind(treeKind);
  }

  const inEditorContext =
    Boolean(state && state.interactionContext === "EDITOR") &&
    Boolean(activeBuffer && activeBuffer.isEditable);
  if (inEditorContext) {
    return "editor";
  }

  return "web";
}

module.exports = {
  resolveSemanticContext,
};
