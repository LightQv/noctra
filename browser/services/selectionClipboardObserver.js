const { clipboard } = require("electron");
const { getConfigValue } = require("../../core/config/service");
const notificationsService = require("../../core/notifications/service");
const { bindPaneObservers, readSelection } = require("../../core/adapters/platform/webContentsObserver");

function attachPaneTracking(manager, buffer, paneResolver) {
  if (!buffer || !buffer.webContents) return;

  const maybeCopySelectionToClipboard = async () => {
    if (!buffer.webContents || buffer.webContents.isDestroyed() || buffer.isEditable) {
      return;
    }

    const isEnabled = getConfigValue("browser.copy_selection_to_clipboard", false);
    if (!isEnabled) {
      return;
    }

    let selectedText = "";
    try {
      selectedText = await readSelection(buffer.webContents);
    } catch (error) {
      notificationsService.notify({
        severity: "warning",
        code: "selection_copy_failed",
        message: "Failed to read selected text",
        source: "browser.manager",
        context: { error: error?.message || String(error) },
        persist: false,
        toast: false,
      });
      return;
    }

    if (!selectedText) {
      return;
    }

    const now = Date.now();
    const webContentsId = buffer.webContents.id;
    const previous = manager.lastSelectionCopyByWebContentsId.get(webContentsId);
    if (
      previous &&
      previous.text === selectedText &&
      Number.isFinite(previous.timestampMs) &&
      now - previous.timestampMs < 700
    ) {
      return;
    }

    clipboard.writeText(selectedText);
    manager.lastSelectionCopyByWebContentsId.set(webContentsId, {
      text: selectedText,
      timestampMs: now,
    });
    notificationsService.notify({
      severity: "info",
      code: "selection_copied",
      message: "Selection copied",
      source: "browser.manager",
      persist: false,
    });
  };

  const onMouseEvent = (event, input) => {
    if (!input || (input.type !== "mouseDown" && input.type !== "mouseUp")) return;
    if (input.type === "mouseUp") {
      setTimeout(() => {
        maybeCopySelectionToClipboard().catch(() => {});
      }, 0);
    }
    manager.handlePaneInteraction(paneResolver());
  };

  const onFocus = () => {
    manager.handlePaneInteraction(paneResolver());
  };

  bindPaneObservers(buffer.webContents, {
    onMouseEvent,
    onFocus,
    onDestroyed: () => {
      manager.lastSelectionCopyByWebContentsId.delete(buffer.webContents.id);
    },
  });
}

module.exports = {
  attachPaneTracking,
};
