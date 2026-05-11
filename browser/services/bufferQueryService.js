function getLeftBuffer(manager) {
  if (manager.activeIndex < 0) return null;
  return manager.buffers[manager.activeIndex] || null;
}

function getFocusedMainBuffer(manager) {
  if (
    manager.split.enabled &&
    manager.split.mode === "regular" &&
    manager.focusedPane === "right" &&
    manager.split.rightPaneSourceBuffer
  ) {
    return manager.split.rightPaneSourceBuffer;
  }

  return getLeftBuffer(manager);
}

function getActive(manager) {
  if (manager.split.enabled && manager.split.mode === "regular" && manager.focusedPane === "right") {
    const left = getLeftBuffer(manager);
    if (manager.split.rightPaneSourceBuffer && manager.split.rightPaneSourceBuffer !== left) {
      return manager.split.rightPaneSourceBuffer;
    }

    if (manager.split.rightPaneBuffer) {
      return manager.split.rightPaneBuffer;
    }

    if (manager.split.rightPaneSourceBuffer) {
      return manager.split.rightPaneSourceBuffer;
    }
  }

  return getLeftBuffer(manager);
}

function getActiveWebContents(manager) {
  if (manager.split.enabled && manager.focusedPane === "right") {
    if (manager.split.mode === "regular") {
      const left = getLeftBuffer(manager);
      if (manager.split.rightPaneSourceBuffer && manager.split.rightPaneSourceBuffer !== left) {
        return manager.split.rightPaneSourceBuffer.webContents;
      }

      if (manager.split.rightPaneBuffer) {
        return manager.split.rightPaneBuffer.webContents;
      }

      if (manager.split.rightPaneSourceBuffer) {
        return manager.split.rightPaneSourceBuffer.webContents;
      }
    }

    if (manager.split.mode === "devtools" && manager.devtoolsView) {
      return manager.devtoolsView.webContents;
    }
  }

  const left = getLeftBuffer(manager);
  return left ? left.webContents : null;
}

function getRightPaneBuffer(manager) {
  if (!manager.split.enabled || manager.split.mode !== "regular") {
    return null;
  }

  const left = getLeftBuffer(manager);
  if (manager.split.rightPaneSourceBuffer && manager.split.rightPaneSourceBuffer !== left) {
    return manager.split.rightPaneSourceBuffer;
  }

  if (manager.split.rightPaneBuffer) {
    return manager.split.rightPaneBuffer;
  }

  return manager.split.rightPaneSourceBuffer || null;
}

function getPaneBuffer(manager, pane = "left") {
  if (pane === "right") {
    return getRightPaneBuffer(manager);
  }

  return getLeftBuffer(manager);
}

function getAllWebContents(manager) {
  const items = [];

  for (const buffer of manager.buffers) {
    if (buffer && buffer.webContents && !buffer.webContents.isDestroyed()) {
      items.push(buffer.webContents);
    }
  }

  if (
    manager.split.rightPaneBuffer &&
    manager.split.rightPaneBuffer.webContents &&
    !manager.split.rightPaneBuffer.webContents.isDestroyed()
  ) {
    items.push(manager.split.rightPaneBuffer.webContents);
  }

  if (manager.devtoolsView && manager.devtoolsView.webContents && !manager.devtoolsView.webContents.isDestroyed()) {
    items.push(manager.devtoolsView.webContents);
  }

  return items;
}

function getBufferByWebContents(manager, webContents) {
  if (!webContents || webContents.isDestroyed()) {
    return null;
  }

  for (const buffer of manager.buffers) {
    if (buffer && buffer.webContents === webContents) {
      return buffer;
    }
  }

  if (manager.split.rightPaneBuffer && manager.split.rightPaneBuffer.webContents === webContents) {
    return manager.split.rightPaneBuffer;
  }

  return null;
}

function isEditableWebContents(manager, webContents) {
  const buffer = getBufferByWebContents(manager, webContents);
  return Boolean(buffer && buffer.isEditable);
}

module.exports = {
  getLeftBuffer,
  getFocusedMainBuffer,
  getActive,
  getActiveWebContents,
  getRightPaneBuffer,
  getPaneBuffer,
  getAllWebContents,
  getBufferByWebContents,
  isEditableWebContents,
};
