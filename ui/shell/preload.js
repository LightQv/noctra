const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("uiShell", {
  emit(type, payload = {}) {
    ipcRenderer.send("ui-shell:event", { type, payload });
  },
});
