function setEditorMode(state, mode) {
  state.editorMode = mode === "INSERT" ? "INSERT" : "NORMAL";
}

module.exports = {
  setEditorMode,
};
