const Buffer = require("../buffers");
const {
  attachView,
  detachView,
} = require("../../core/adapters/platform/contentViewHost");

function bindBufferEvents(manager, buffer) {
  buffer.setContentUiOptions(manager.contentUiOptions);
  buffer.on("updated", (event = {}) => {
    manager.notify({ kind: event.kind || "metadata", activeChanged: false });
  });
  buffer.on("visit", (event = {}) => {
    manager.notify({
      kind: "visit",
      activeChanged: false,
      sourceBufferId: buffer.id,
      url: event.url,
      title: event.title,
      timestampMs: event.timestampMs,
    });
  });
  buffer.on("title-updated", (event = {}) => {
    manager.notify({
      kind: "title-updated",
      activeChanged: false,
      sourceBufferId: buffer.id,
      url: event.url,
      title: event.title,
      timestampMs: event.timestampMs,
    });
  });
  manager.attachPaneTracking(buffer, () =>
    manager.resolvePaneForBuffer(buffer),
  );
}

function createBuffer(manager, url = "about:blank", options = {}) {
  if (!manager.window) {
    throw new Error(
      "BufferManager must be initialized with a window before create().",
    );
  }

  const activate = options.activate !== false;
  const buffer = new Buffer(0, options);
  bindBufferEvents(manager, buffer);

  manager.buffers.push(buffer);
  attachView(manager.window, buffer.view);
  manager.reindexBuffers();
  if (typeof manager.registerBufferWithExtensionRuntime === "function") {
    manager.registerBufferWithExtensionRuntime(buffer);
  }

  if (activate || manager.activeIndex < 0) {
    manager.activeIndex = manager.buffers.length - 1;
    manager.focusedPane = "left";
  }

  manager.layoutViews();

  if (url) {
    buffer.load(url);
  }

  manager.notify({ kind: "structure", activeChanged: activate });
  return buffer;
}

function rememberClosedBuffer(manager, buffer, index) {
  if (!buffer) {
    return;
  }

  const snapshot = {
    url: typeof buffer.url === "string" ? buffer.url : "about:blank",
    kind: typeof buffer.kind === "string" ? buffer.kind : "web",
    title: typeof buffer.title === "string" ? buffer.title : "[No title]",
    virtualUrl: typeof buffer.virtualUrl === "string" ? buffer.virtualUrl : "",
    virtualDocument:
      buffer.virtualDocument && typeof buffer.virtualDocument === "object"
        ? {
            url:
              typeof buffer.virtualDocument.url === "string"
                ? buffer.virtualDocument.url
                : "",
            title:
              typeof buffer.virtualDocument.title === "string"
                ? buffer.virtualDocument.title
                : "",
            html:
              typeof buffer.virtualDocument.html === "string"
                ? buffer.virtualDocument.html
                : "",
          }
        : null,
    index: Number.isInteger(index)
      ? index
      : manager.buffers.findIndex((item) => item === buffer),
  };

  manager.closedBuffers.push(snapshot);
  if (manager.closedBuffers.length > manager.maxClosedBuffers) {
    manager.closedBuffers.splice(
      0,
      manager.closedBuffers.length - manager.maxClosedBuffers,
    );
  }
}

function closeBuffer(manager, id = null) {
  if (manager.buffers.length === 0) return null;

  let target = null;

  if (id === null) {
    if (
      manager.split.enabled &&
      manager.split.mode === "regular" &&
      manager.focusedPane === "right" &&
      manager.split.rightPaneSourceBuffer
    ) {
      target = manager.split.rightPaneSourceBuffer;
    } else {
      target = manager.getLeftBuffer();
    }
  } else {
    target = manager.buffers.find((buffer) => buffer.id === id) || null;
  }

  if (!target) return null;

  const index = manager.buffers.findIndex((buffer) => buffer === target);
  if (index === -1) return null;

  rememberClosedBuffer(manager, target, index);
  if (typeof manager.removeBufferFromExtensionRuntime === "function") {
    manager.removeBufferFromExtensionRuntime(target);
  }
  manager.buffers.splice(index, 1);

  detachView(manager.window, target.view);

  if (manager.split.rightPaneSourceBuffer === target) {
    manager.split.rightPaneSourceBuffer = null;
  }

  target.destroy();

  if (manager.buffers.length === 0) {
    manager.activeIndex = -1;
    manager.openConfiguredBuffer();
    manager.focusActive();
    return manager.getActive();
  }

  if (index < manager.activeIndex) {
    manager.activeIndex -= 1;
  }

  if (manager.activeIndex >= manager.buffers.length) {
    manager.activeIndex = manager.buffers.length - 1;
  }

  manager.reindexBuffers();
  manager.reconcileSplitSources();
  manager.syncDevtoolsTargetToLeftBuffer();
  manager.layoutViews();
  manager.focusActive();
  manager.notify({ kind: "structure", activeChanged: true });
  return manager.getActive();
}

function reopenLastClosed(manager) {
  if (manager.closedBuffers.length === 0 || !manager.window) {
    return null;
  }

  const snapshot = manager.closedBuffers.pop();
  if (!snapshot) {
    return null;
  }

  const snapshotUrl = typeof snapshot.url === "string" ? snapshot.url.trim() : "";
  const hasVirtualDocument = Boolean(
    snapshot.virtualDocument &&
      typeof snapshot.virtualDocument.html === "string" &&
      snapshot.virtualDocument.html.trim(),
  );
  if (!snapshotUrl && !hasVirtualDocument) {
    return null;
  }

  const buffer = new Buffer(0, {
    kind: snapshot.kind || "web",
    activate: false,
  });
  bindBufferEvents(manager, buffer);

  const insertIndex = Number.isInteger(snapshot.index)
    ? Math.max(0, Math.min(snapshot.index, manager.buffers.length))
    : manager.buffers.length;

  manager.buffers.splice(insertIndex, 0, buffer);
  attachView(manager.window, buffer.view);
  manager.reindexBuffers();
  if (typeof manager.registerBufferWithExtensionRuntime === "function") {
    manager.registerBufferWithExtensionRuntime(buffer);
  }
  manager.activeIndex = insertIndex;
  manager.focusedPane = "left";
  manager.reconcileSplitSources();
  manager.syncDevtoolsTargetToLeftBuffer();
  manager.layoutViews();
  if (hasVirtualDocument) {
    buffer.loadVirtualDocument(snapshot.virtualDocument);
  } else {
    buffer.load(snapshotUrl);
  }
  manager.focusActive();
  manager.notify({ kind: "structure", activeChanged: true });
  return buffer;
}

function closeLeftOfActive(manager) {
  const leftBuffer = manager.getLeftBuffer();
  if (!leftBuffer) return null;
  if (manager.activeIndex <= 0) return leftBuffer;

  const removed = manager.buffers.splice(0, manager.activeIndex);
  for (const buffer of removed) {
    rememberClosedBuffer(manager, buffer, 0);
    if (typeof manager.removeBufferFromExtensionRuntime === "function") {
      manager.removeBufferFromExtensionRuntime(buffer);
    }
    detachView(manager.window, buffer.view);
    if (manager.split.rightPaneSourceBuffer === buffer) {
      manager.split.rightPaneSourceBuffer = null;
    }
    buffer.destroy();
  }

  manager.activeIndex = 0;
  manager.reindexBuffers();
  manager.reconcileSplitSources();
  manager.syncDevtoolsTargetToLeftBuffer();
  manager.layoutViews();
  manager.focusActive();
  manager.notify({ kind: "structure", activeChanged: true });
  return manager.getActive();
}

function closeRightOfActive(manager) {
  if (
    manager.activeIndex < 0 ||
    manager.activeIndex >= manager.buffers.length - 1
  ) {
    return manager.getActive();
  }

  const removed = manager.buffers.splice(manager.activeIndex + 1);
  for (const buffer of removed) {
    rememberClosedBuffer(manager, buffer, manager.activeIndex + 1);
    if (typeof manager.removeBufferFromExtensionRuntime === "function") {
      manager.removeBufferFromExtensionRuntime(buffer);
    }
    detachView(manager.window, buffer.view);
    if (manager.split.rightPaneSourceBuffer === buffer) {
      manager.split.rightPaneSourceBuffer = null;
    }
    buffer.destroy();
  }

  manager.reindexBuffers();
  manager.reconcileSplitSources();
  manager.syncDevtoolsTargetToLeftBuffer();
  manager.layoutViews();
  manager.focusActive();
  manager.notify({ kind: "structure", activeChanged: true });
  return manager.getActive();
}

function createManyBuffers(manager, urlEntries) {
  if (!manager.window) {
    throw new Error(
      "BufferManager must be initialized with a window before createMany().",
    );
  }
  if (!Array.isArray(urlEntries) || urlEntries.length === 0) {
    return [];
  }

  const created = [];
  for (const entry of urlEntries) {
    const url = typeof entry === "string" ? entry : entry.url;
    const options = typeof entry === "object" && entry !== null ? entry.options || {} : {};
    const buffer = new Buffer(0, options);
    bindBufferEvents(manager, buffer);
    manager.buffers.push(buffer);
    created.push({ buffer, url });
  }

  manager.reindexBuffers();

  for (const { buffer } of created) {
    attachView(manager.window, buffer.view);
    if (typeof manager.registerBufferWithExtensionRuntime === "function") {
      manager.registerBufferWithExtensionRuntime(buffer);
    }
  }

  manager.layoutViews();

  for (const { buffer, url } of created) {
    if (url) {
      buffer.load(url);
    }
  }

  manager.notify({ kind: "structure", activeChanged: false });
  return created.map((c) => c.buffer);
}

function closeAllLeftOf(manager, index) {
  if (index <= 0 || manager.buffers.length === 0) {
    return manager.getActive();
  }

  const removed = manager.buffers.splice(0, index);
  for (const buffer of removed) {
    rememberClosedBuffer(manager, buffer, 0);
    if (typeof manager.removeBufferFromExtensionRuntime === "function") {
      manager.removeBufferFromExtensionRuntime(buffer);
    }
    detachView(manager.window, buffer.view);
    if (manager.split.rightPaneSourceBuffer === buffer) {
      manager.split.rightPaneSourceBuffer = null;
    }
    buffer.destroy();
  }

  if (manager.buffers.length === 0) {
    manager.activeIndex = -1;
    manager.openConfiguredBuffer();
    manager.focusActive();
    manager.notify({ kind: "structure", activeChanged: true });
    return manager.getActive();
  }

  if (manager.activeIndex < index) {
    manager.activeIndex = 0;
  } else {
    manager.activeIndex -= index;
  }

  if (manager.activeIndex >= manager.buffers.length) {
    manager.activeIndex = Math.max(0, manager.buffers.length - 1);
  }

  manager.reindexBuffers();
  manager.reconcileSplitSources();
  manager.syncDevtoolsTargetToLeftBuffer();
  manager.layoutViews();
  manager.focusActive();
  manager.notify({ kind: "structure", activeChanged: true });
  return manager.getActive();
}

function closeAllRightOf(manager, index) {
  if (
    index < 0 ||
    index >= manager.buffers.length - 1
  ) {
    return manager.getActive();
  }

  const removed = manager.buffers.splice(index + 1);
  for (const buffer of removed) {
    rememberClosedBuffer(manager, buffer, index + 1);
    if (typeof manager.removeBufferFromExtensionRuntime === "function") {
      manager.removeBufferFromExtensionRuntime(buffer);
    }
    detachView(manager.window, buffer.view);
    if (manager.split.rightPaneSourceBuffer === buffer) {
      manager.split.rightPaneSourceBuffer = null;
    }
    buffer.destroy();
  }

  if (manager.buffers.length === 0) {
    manager.activeIndex = -1;
    manager.openConfiguredBuffer();
    manager.focusActive();
    manager.notify({ kind: "structure", activeChanged: true });
    return manager.getActive();
  }

  if (manager.activeIndex > index) {
    manager.activeIndex = index;
  }

  if (manager.activeIndex >= manager.buffers.length) {
    manager.activeIndex = Math.max(0, manager.buffers.length - 1);
  }

  manager.reindexBuffers();
  manager.reconcileSplitSources();
  manager.syncDevtoolsTargetToLeftBuffer();
  manager.layoutViews();
  manager.focusActive();
  manager.notify({ kind: "structure", activeChanged: true });
  return manager.getActive();
}

function closeAllBuffers(manager) {
  if (manager.buffers.length === 0) {
    manager.openConfiguredBuffer();
    return manager.getActive();
  }

  for (const buffer of manager.buffers) {
    rememberClosedBuffer(manager, buffer, 0);
    if (typeof manager.removeBufferFromExtensionRuntime === "function") {
      manager.removeBufferFromExtensionRuntime(buffer);
    }
    detachView(manager.window, buffer.view);
    buffer.destroy();
  }

  manager.buffers.length = 0;
  manager.activeIndex = -1;
  manager.split.rightPaneSourceBuffer = null;
  manager.split.enabled = false;
  manager.split.mode = "regular";
  manager.focusedPane = "left";

  manager.openConfiguredBuffer();
  manager.layoutViews();
  manager.focusActive();
  manager.notify({ kind: "structure", activeChanged: true });
  return manager.getActive();
}

function duplicateBuffer(manager, id) {
  const target = manager.buffers.find((buffer) => buffer.id === id) || null;
  if (!target) return null;

  const hasVirtualDocument = Boolean(
    target.virtualDocument &&
      typeof target.virtualDocument === "object" &&
      typeof target.virtualDocument.html === "string" &&
      target.virtualDocument.html.trim(),
  );

  const url = hasVirtualDocument ? null : (target.url || "about:blank");
  const options = {
    kind: typeof target.kind === "string" ? target.kind : "web",
    activate: false,
  };
  const buffer = createBuffer(manager, url, options);

  if (hasVirtualDocument) {
    buffer.loadVirtualDocument(target.virtualDocument);
  }

  return buffer;
}

module.exports = {
  createBuffer,
  createManyBuffers,
  closeBuffer,
  rememberClosedBuffer,
  reopenLastClosed,
  closeLeftOfActive,
  closeRightOfActive,
  closeAllLeftOf,
  closeAllRightOf,
  closeAllBuffers,
  duplicateBuffer,
};
