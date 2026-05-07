const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("uiShell", {
  windowAction(action) {
    ipcRenderer.send("ui-shell:window-action", { action });
  },
  openSettings() {
    ipcRenderer.send("ui-shell:open-settings");
  },
  newTab() {
    ipcRenderer.send("ui-shell:new-tab");
  },
  openHistory() {
    ipcRenderer.send("ui-shell:open-history");
  },
  activateTab(id) {
    ipcRenderer.send("ui-shell:tab-activate", { id });
  },
  closeTab(id) {
    ipcRenderer.send("ui-shell:tab-close", { id });
  },
  startUrllineEdit(pane) {
    ipcRenderer.send("ui-shell:urlline-start-edit", { pane });
  },
  urllineAction(pane, action) {
    ipcRenderer.send("ui-shell:urlline-action", { pane, action });
  },
  editorReady() {
    ipcRenderer.send("ui-shell:editor-ready");
  },
  editorModeChange(mode) {
    ipcRenderer.send("ui-shell:editor-mode-change", { mode });
  },
  editorFocusRequest() {
    ipcRenderer.send("ui-shell:editor-focus-request");
  },
  editorOpenCommand(initialText = "") {
    ipcRenderer.send("ui-shell:editor-open-command", { initialText });
  },
  editorToggleContext() {
    ipcRenderer.send("ui-shell:editor-toggle-context");
  },
  onThemeUpdate(handler) {
    if (typeof handler !== "function") {
      return () => {};
    }

    const listener = (_, message) => {
      if (!message || message.type !== "theme:update") return;
      handler(message.payload || {});
    };

    ipcRenderer.on("ui-shell:push", listener);

    return () => {
      ipcRenderer.removeListener("ui-shell:push", listener);
    };
  },
});
