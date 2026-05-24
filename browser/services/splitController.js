function openVerticalSplit(manager, ratio = 0.5) {
  const left = manager.getLeftBuffer();
  if (!left) return null;

  manager.closeDevtoolsSplit();
  manager.ensureRightPaneBuffer();
  manager.assignRightPaneSource(left);

  manager.split.enabled = true;
  manager.split.mode = "regular";
  manager.split.ratio = ratio;
  manager.focusedPane = "right";

  manager.layoutViews();
  manager.focusActive();
  manager.notify({ kind: "structure", activeChanged: true });
  return manager.split.rightPaneBuffer;
}

function closeRightSplit(manager) {
  if (!manager.split.enabled) {
    return;
  }

  if (manager.split.mode === "regular") {
    manager.destroyRightPaneBuffer();
  }

  if (manager.split.mode === "devtools") {
    manager.closeDevtoolsSplit();
  }

  manager.split.enabled = false;
  manager.split.mode = "regular";
  manager.split.ratio = 0.5;
  manager.focusedPane = "left";
  manager.layoutViews();
  manager.focusActive();
  manager.notify({ kind: "structure", activeChanged: true });
}

function focusSplitLeft(manager) {
  if (!manager.split.enabled) return false;
  manager.focusedPane = "left";
  manager.layoutViews();
  manager.focusActive();
  manager.notify({ kind: "structure", activeChanged: true });
  return true;
}

function focusSplitRight(manager) {
  if (!manager.split.enabled) return false;
  manager.focusedPane = "right";
  manager.layoutViews();
  manager.focusActive();
  manager.notify({ kind: "structure", activeChanged: true });
  return true;
}

function focusPane(manager, pane = "left") {
  if (pane === "right") {
    return focusSplitRight(manager);
  }

  if (manager.split.enabled) {
    return focusSplitLeft(manager);
  }

  manager.focusedPane = "left";
  manager.layoutViews();
  manager.focusActive();
  manager.notify({ kind: "structure", activeChanged: true });
  return true;
}

function openUrlInRightSplit(manager, url) {
  if (!manager.window) {
    throw new Error(
      "BufferManager must be initialized with a window before openUrlInRightSplit().",
    );
  }

  manager.closeDevtoolsSplit();
  manager.ensureRightPaneBuffer();

  const buffer = manager.create(url, { activate: false });
  manager.split.enabled = true;
  manager.split.mode = "regular";
  manager.split.rightPaneSourceBuffer = buffer;
  manager.focusedPane = "right";

  manager.layoutViews();
  manager.focusActive();
  manager.notify({ kind: "structure", activeChanged: true });
  return buffer;
}

function openBufferInRightSplit(manager, sourceBuffer) {
  if (!manager.window) {
    throw new Error(
      "BufferManager must be initialized with a window before openBufferInRightSplit().",
    );
  }

  if (!sourceBuffer) {
    return null;
  }

  manager.closeDevtoolsSplit();
  manager.ensureRightPaneBuffer();

  const hasVirtualDocument = Boolean(
    sourceBuffer.virtualDocument &&
      typeof sourceBuffer.virtualDocument.html === "string" &&
      sourceBuffer.virtualDocument.html.trim(),
  );

  const url = hasVirtualDocument ? null : (sourceBuffer.url || "about:blank");
  const buffer = manager.create(url, {
    kind: typeof sourceBuffer.kind === "string" ? sourceBuffer.kind : "web",
    activate: false,
  });

  if (hasVirtualDocument) {
    buffer.loadVirtualDocument(sourceBuffer.virtualDocument);
  }

  manager.split.enabled = true;
  manager.split.mode = "regular";
  manager.split.rightPaneSourceBuffer = buffer;
  manager.focusedPane = "right";

  manager.layoutViews();
  manager.focusActive();
  manager.notify({ kind: "structure", activeChanged: true });
  return buffer;
}

function reconcileSplitSources(manager) {
  if (!manager.split.enabled || manager.split.mode !== "regular") {
    return;
  }

  if (!manager.split.rightPaneBuffer) {
    manager.split.enabled = false;
    manager.focusedPane = "left";
    return;
  }

  if (
    !manager.split.rightPaneSourceBuffer ||
    !manager.buffers.includes(manager.split.rightPaneSourceBuffer)
  ) {
    manager.split.rightPaneSourceBuffer = manager.getLeftBuffer();
    if (manager.split.rightPaneSourceBuffer) {
      manager.assignRightPaneSource(manager.split.rightPaneSourceBuffer);
    } else {
      manager.destroyRightPaneBuffer();
      manager.split.enabled = false;
      manager.focusedPane = "left";
    }
  }
}

module.exports = {
  openVerticalSplit,
  closeRightSplit,
  focusSplitLeft,
  focusSplitRight,
  focusPane,
  openUrlInRightSplit,
  openBufferInRightSplit,
  reconcileSplitSources,
};
