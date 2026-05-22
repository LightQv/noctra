const { contextBridge, ipcRenderer } = require("electron");

const uiShellApi = {
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
  openDownloads() {
    ipcRenderer.send("ui-shell:open-downloads");
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
  stopUrllineEdit() {
    ipcRenderer.send("ui-shell:stop-urlline-edit");
  },
  contextMenu(payload) {
    ipcRenderer.send("ui-shell:context-menu", payload);
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
};

if (process.env.NOCTRA_SMOKE_TEST === "1") {
  uiShellApi.probePrivilegedIpc = function probePrivilegedIpc() {
    return ipcRenderer.invoke("security:probe-privileged-ipc");
  };
}

contextBridge.exposeInMainWorld("uiShell", uiShellApi);
