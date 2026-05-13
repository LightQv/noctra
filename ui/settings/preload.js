const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("settingsBridge", {
  get() {
    return ipcRenderer.invoke("settings:get");
  },
  save(content) {
    return ipcRenderer.invoke("settings:save", { content });
  },
  close() {
    return ipcRenderer.invoke("settings:close");
  },
  editorReady() {
    ipcRenderer.send("settings:editor-ready");
  },
  editorModeChange(mode) {
    ipcRenderer.send("settings:editor-mode-change", { mode });
  },
  editorFocusRequest() {
    ipcRenderer.send("settings:editor-focus-request");
  },
  editorOpenCommand(initialText = "") {
    ipcRenderer.send("settings:editor-open-command", { initialText });
  },
  editorToggleContext() {
    ipcRenderer.send("settings:editor-toggle-context");
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
