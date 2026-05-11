function createPanelRenderTransport({ resolveWebContents, delayMs = 16 } = {}) {
  let renderTimer = null;
  let lastRenderedHtml = "";

  function clearTimer() {
    if (!renderTimer) return;
    clearTimeout(renderTimer);
    renderTimer = null;
  }

  function cancelPending() {
    clearTimer();
  }

  function scheduleHtmlRender(html) {
    const webContents =
      typeof resolveWebContents === "function" ? resolveWebContents() : null;
    if (!webContents) {
      return;
    }

    if (html === lastRenderedHtml) {
      return;
    }

    lastRenderedHtml = html;
    clearTimer();
    renderTimer = setTimeout(() => {
      renderTimer = null;
      const nextWebContents =
        typeof resolveWebContents === "function" ? resolveWebContents() : null;
      if (!nextWebContents) {
        return;
      }

      nextWebContents.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(lastRenderedHtml)}`,
      );
    }, delayMs);
  }

  return {
    scheduleHtmlRender,
    cancelPending,
  };
}

module.exports = {
  createPanelRenderTransport,
};
