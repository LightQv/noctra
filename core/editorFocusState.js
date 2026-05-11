function isEditorFocused(state) {
  return Boolean(state && state.editorFocus === true);
}

function setEditorFocused(state, focused) {
  if (!state) {
    return false;
  }

  state.editorFocus = focused === true;
  return state.editorFocus;
}

function toggleEditorFocused(state) {
  return setEditorFocused(state, !isEditorFocused(state));
}

module.exports = {
  isEditorFocused,
  setEditorFocused,
  toggleEditorFocused,
};
