function createInputCoordinator({
  buffers,
  webModeSyncService,
  handleRawInput,
  handleMouseInput,
}) {
  let activeInputWebContents = null;
  let inputListener = null;
  let mouseListener = null;

  function bindInputToActiveBuffer() {
    const nextWebContents = buffers.getActiveWebContents();
    if (!nextWebContents) return;

    const activeBuffer = buffers.getActive();
    const shouldTrackWebMode = Boolean(
      activeBuffer && !activeBuffer.isEditable,
    );

    if (
      activeInputWebContents === nextWebContents &&
      webModeSyncService.getActiveWebContents() === nextWebContents
    ) {
      if (shouldTrackWebMode) {
        webModeSyncService.syncNowIfTracked(nextWebContents);
      }
      buffers.focusActive();
      return;
    }

    if (activeInputWebContents && inputListener) {
      activeInputWebContents.removeListener(
        "before-input-event",
        inputListener,
      );
    }
    if (activeInputWebContents && mouseListener) {
      activeInputWebContents.removeListener(
        "before-mouse-event",
        mouseListener,
      );
    }

    webModeSyncService.unbind();

    inputListener = (event, input) => {
      handleRawInput(event, input);
    };
    mouseListener = (event, input) => {
      if (typeof handleMouseInput === "function") {
        handleMouseInput(event, input);
      }
    };

    nextWebContents.on("before-input-event", inputListener);
    nextWebContents.on("before-mouse-event", mouseListener);
    activeInputWebContents = nextWebContents;

    if (shouldTrackWebMode) {
      webModeSyncService.bind(nextWebContents);
    }

    buffers.focusActive();
  }

  function getActiveInputWebContents() {
    return activeInputWebContents;
  }

  function dispose() {
    if (activeInputWebContents && inputListener) {
      activeInputWebContents.removeListener(
        "before-input-event",
        inputListener,
      );
    }
    if (activeInputWebContents && mouseListener) {
      activeInputWebContents.removeListener(
        "before-mouse-event",
        mouseListener,
      );
    }
    webModeSyncService.unbind();
    activeInputWebContents = null;
    inputListener = null;
    mouseListener = null;
  }

  return {
    bindInputToActiveBuffer,
    getActiveInputWebContents,
    dispose,
  };
}

module.exports = {
  createInputCoordinator,
};
