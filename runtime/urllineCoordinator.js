function createUrllineCoordinator({
  state,
  uiShell,
  buffers,
  enterInsertMode,
  enterNormalMode,
  startUrllineEditState,
  stopUrllineEditState,
  moveUrllineCursor,
  setUrllineCursor,
  insertUrllineTextAtCursor,
  deleteUrllineBackward,
  deleteUrllineForward,
  resolveInputTarget,
  getDefaultSearchEngine,
  getStatuslineModeLabel,
}) {
  const resolveDefaultSearchEngine =
    typeof getDefaultSearchEngine === "function"
      ? getDefaultSearchEngine
      : () => "duckduckgo";

  function buildUrllineModel() {
    const model = buffers.getUrllineRenderModel();
    if (!state.urllineEditing) {
      return model;
    }

    return {
      ...model,
      editing: {
        active: true,
        pane: state.urllinePane === "right" ? "right" : "left",
        text: state.urllineBuffer,
        cursorIndex: state.urllineCursorIndex,
      },
    };
  }

  function updateUrllineRender() {
    uiShell.renderUrlline(buildUrllineModel());
  }

  function buildLoadinglineModel() {
    return buffers.getLoadinglineRenderModel();
  }

  function updateLoadinglineRender() {
    uiShell.renderLoadingline(buildLoadinglineModel());
  }

  function startUrllineEdit(pane, initialUrl) {
    startUrllineEditState(state, pane, initialUrl);
    enterInsertMode(state, "urlline-start-edit");
    uiShell.updateStatuslineMode(getStatuslineModeLabel());
    updateUrllineRender();
  }

  function stopUrllineEdit() {
    stopUrllineEditState(state);
    enterNormalMode(state, "urlline-stop-edit");
    uiShell.updateStatuslineMode(getStatuslineModeLabel());
    updateUrllineRender();
  }

  function insertUrllineText(text) {
    insertUrllineTextAtCursor(state, text);
  }

  function submitUrlline() {
    const targetPane = state.urllinePane === "right" ? "right" : "left";
    const rawInput = String(state.urllineBuffer || "").trim();
    stopUrllineEdit();

    if (!rawInput) {
      return;
    }

    const target = resolveInputTarget(rawInput, {
      defaultSearchEngine: resolveDefaultSearchEngine(),
    });

    if (target.kind === "invalid") {
      return;
    }

    buffers.focusPane(targetPane);
    const paneBuffer = buffers.getPaneBuffer(targetPane);
    if (!paneBuffer || paneBuffer.isEditable) {
      return;
    }

    paneBuffer.load(target.url);
  }

  function handleUrllineInput(event, input) {
    if (typeof input.pasteText === "string" && input.pasteText.length > 0) {
      insertUrllineText(input.pasteText);
      updateUrllineRender();
      return;
    }

    if (input.key === "Escape") {
      stopUrllineEdit();
      return;
    }

    if (input.key === "Enter") {
      submitUrlline();
      return;
    }

    if (input.key === "Left" || input.key === "ArrowLeft") {
      moveUrllineCursor(state, -1);
      updateUrllineRender();
      return;
    }

    if (input.key === "Right" || input.key === "ArrowRight") {
      moveUrllineCursor(state, 1);
      updateUrllineRender();
      return;
    }

    if (input.key === "Home") {
      setUrllineCursor(state, 0);
      updateUrllineRender();
      return;
    }

    if (input.key === "End") {
      setUrllineCursor(state, state.urllineBuffer.length);
      updateUrllineRender();
      return;
    }

    if (input.key === "Backspace") {
      if (!deleteUrllineBackward(state)) {
        return;
      }
      updateUrllineRender();
      return;
    }

    if (input.key === "Delete") {
      if (!deleteUrllineForward(state)) {
        return;
      }
      updateUrllineRender();
      return;
    }

    if (!input.ctrl && !input.meta && !input.alt) {
      if (input.key === "Space") {
        insertUrllineText(" ");
        updateUrllineRender();
        return;
      }

      if (typeof input.key === "string" && input.key.length === 1) {
        insertUrllineText(input.key);
        updateUrllineRender();
      }
    }
  }

  return {
    buildUrllineModel,
    updateUrllineRender,
    buildLoadinglineModel,
    updateLoadinglineRender,
    startUrllineEdit,
    stopUrllineEdit,
    handleUrllineInput,
  };
}

module.exports = {
  createUrllineCoordinator,
};
