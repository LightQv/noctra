const Buffer = require("../buffers");
const {
  attachView,
  detachView,
} = require("../../core/adapters/platform/contentViewHost");

function ensureRightPaneBuffer(manager) {
  if (manager.split.rightPaneBuffer || !manager.window) return;

  const rightPane = new Buffer(0);
  rightPane.setContentUiOptions(manager.contentUiOptions);
  rightPane.on("updated", (event = {}) => {
    manager.notify({ kind: event.kind || "metadata", activeChanged: false });
  });
  rightPane.on("visit", (event = {}) => {
    manager.notify({
      kind: "visit",
      activeChanged: false,
      sourceBufferId: rightPane.id,
      url: event.url,
      title: event.title,
      timestampMs: event.timestampMs,
    });
  });
  rightPane.on("title-updated", (event = {}) => {
    manager.notify({
      kind: "title-updated",
      activeChanged: false,
      sourceBufferId: rightPane.id,
      url: event.url,
      title: event.title,
      timestampMs: event.timestampMs,
    });
  });
  manager.attachPaneTracking(rightPane, () => "right");

  manager.split.rightPaneBuffer = rightPane;
  attachView(manager.window, rightPane.view);
}

function resolveBufferMirrorUrl(manager, buffer) {
  if (!buffer) {
    return "about:blank";
  }

  const liveUrl =
    buffer.webContents && !buffer.webContents.isDestroyed()
      ? String(buffer.webContents.getURL() || "").trim()
      : "";
  if (liveUrl.length > 0) {
    return liveUrl;
  }

  const trackedUrl = typeof buffer.url === "string" ? buffer.url.trim() : "";
  return trackedUrl.length > 0 ? trackedUrl : "about:blank";
}

function assignRightPaneSource(manager, sourceBuffer) {
  if (!sourceBuffer || !manager.split.rightPaneBuffer) return;

  manager.split.rightPaneSourceBuffer = sourceBuffer;
  manager.split.rightPaneBuffer.kind = sourceBuffer.kind || "web";
  manager.split.rightPaneBuffer.isEditable = Boolean(sourceBuffer.isEditable);

  if (sourceBuffer !== manager.getLeftBuffer()) {
    return;
  }

  const sourceUrl = resolveBufferMirrorUrl(manager, sourceBuffer);
  const rightPaneUrl = manager.split.rightPaneBuffer.url || "";
  if (rightPaneUrl !== sourceUrl) {
    manager.split.rightPaneBuffer.load(sourceUrl);
  }
}

function destroyRightPaneBuffer(manager) {
  const rightPane = manager.split.rightPaneBuffer;
  if (!rightPane) return;

  detachView(manager.window, rightPane.view);

  rightPane.destroy();
  manager.split.rightPaneBuffer = null;
  manager.split.rightPaneSourceBuffer = null;
}

module.exports = {
  ensureRightPaneBuffer,
  resolveBufferMirrorUrl,
  assignRightPaneSource,
  destroyRightPaneBuffer,
};
