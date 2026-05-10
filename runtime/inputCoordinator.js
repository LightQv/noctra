function createInputCoordinator({
  buffers,
  webModeSyncService,
  handleRawInput,
}) {
  let activeInputWebContents = null;
  let inputListener = null;

  function bindInputToActiveBuffer() {
    const nextWebContents = buffers.getActiveWebContents();
    if (!nextWebContents) return;

    const activeBuffer = buffers.getActive();
    const shouldTrackWebMode = Boolean(activeBuffer && !activeBuffer.isEditable);

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
      activeInputWebContents.removeListener("before-input-event", inputListener);
    }

    webModeSyncService.unbind();

    inputListener = (event, input) => {
      handleRawInput(event, input);
    };

    nextWebContents.on("before-input-event", inputListener);
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
      activeInputWebContents.removeListener("before-input-event", inputListener);
    }
    webModeSyncService.unbind();
    activeInputWebContents = null;
    inputListener = null;
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
