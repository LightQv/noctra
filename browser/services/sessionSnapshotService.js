const { detachView } = require("../../core/adapters/platform/contentViewHost");
const { isExtensionInternalUrl } = require("../../core/security/urlPolicy");

function isSessionRestorableBuffer(manager, buffer) {
  if (!buffer || buffer.kind !== "web") {
    return false;
  }

  const url = typeof buffer.url === "string" ? buffer.url.trim() : "";
  if (!url || url === "about:blank") {
    return false;
  }

  if (
    url.startsWith("noctra://") ||
    url.startsWith("data:") ||
    isExtensionInternalUrl(url)
  ) {
    return false;
  }

  return true;
}

function exportSessionSnapshot(manager) {
  const entries = manager.buffers
    .filter((buffer) => isSessionRestorableBuffer(manager, buffer))
    .map((buffer) => ({
      url: buffer.url,
    }));

  const active = manager.getFocusedMainBuffer() || manager.getLeftBuffer();
  const activeRestorableIndex = manager.buffers
    .filter((buffer) => isSessionRestorableBuffer(manager, buffer))
    .findIndex((buffer) => buffer === active);

  return {
    version: 1,
    savedAtMs: Date.now(),
    activeIndex: activeRestorableIndex >= 0 ? activeRestorableIndex : 0,
    buffers: entries,
  };
}

function restoreSessionSnapshot(manager, snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    return false;
  }

  const entries = Array.isArray(snapshot.buffers)
    ? snapshot.buffers
        .map((entry) => {
          const url = typeof entry?.url === "string" ? entry.url.trim() : "";
          if (
            !url ||
            url === "about:blank" ||
            url.startsWith("noctra://") ||
            url.startsWith("data:") ||
            isExtensionInternalUrl(url)
          ) {
            return null;
          }
          return { url };
        })
        .filter(Boolean)
    : [];

  if (entries.length === 0 || !manager.window) {
    return false;
  }

  if (manager.split.enabled) {
    manager.closeRightSplit();
  }

  for (const buffer of manager.buffers) {
    detachView(manager.window, buffer.view);
    buffer.destroy();
  }

  manager.buffers = [];
  manager.activeIndex = -1;
  manager.closedBuffers = [];
  manager.reindexBuffers();

  for (const entry of entries) {
    manager.create(entry.url, { activate: false });
  }

  const rawActiveIndex = Number.isInteger(snapshot.activeIndex)
    ? snapshot.activeIndex
    : 0;
  const safeActiveIndex = Math.max(
    0,
    Math.min(rawActiveIndex, manager.buffers.length - 1),
  );
  manager.activeIndex = safeActiveIndex;
  manager.focusedPane = "left";
  manager.layoutViews();
  manager.focusActive();
  manager.notify({ kind: "structure", activeChanged: true });
  return true;
}

module.exports = {
  isSessionRestorableBuffer,
  exportSessionSnapshot,
  restoreSessionSnapshot,
};
