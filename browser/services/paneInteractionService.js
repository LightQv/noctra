function resolvePaneForBuffer(manager, buffer) {
  if (
    manager.split.enabled &&
    manager.split.mode === "regular" &&
    buffer &&
    buffer === manager.split.rightPaneSourceBuffer &&
    buffer !== manager.getLeftBuffer()
  ) {
    return "right";
  }

  return "left";
}

function handlePaneInteraction(manager, pane) {
  if (!manager.split.enabled) {
    manager.notify({ kind: "pane-interaction", activeChanged: false, pane: "left" });
    return;
  }

  if (pane === "right") {
    if (
      manager.split.mode === "regular" &&
      (manager.split.rightPaneSourceBuffer || manager.split.rightPaneBuffer)
    ) {
      if (manager.focusedPane === "right") return;
      manager.focusedPane = "right";
      manager.layoutViews();
      manager.notify({ kind: "structure", activeChanged: true });
    } else {
      manager.notify({ kind: "pane-interaction", activeChanged: false, pane: "right" });
    }
    return;
  }

  if (manager.focusedPane === "left") {
    manager.notify({ kind: "pane-interaction", activeChanged: false, pane: "left" });
    return;
  }

  manager.focusedPane = "left";
  manager.layoutViews();
  manager.notify({ kind: "structure", activeChanged: true });
}

module.exports = {
  resolvePaneForBuffer,
  handlePaneInteraction,
};
