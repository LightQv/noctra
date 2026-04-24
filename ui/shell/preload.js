const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("uiShell", {
  emit(type, payload = {}) {
    ipcRenderer.send("ui-shell:event", { type, payload });
  },
  invoke(type, payload = {}) {
    return ipcRenderer.invoke("ui-shell:request", { type, payload });
  },
  on(type, handler) {
    if (typeof type !== "string" || typeof handler !== "function") {
      return () => {};
    }

    const listener = (_, message) => {
      if (!message || message.type !== type) return;
      handler(message.payload || {});
    };

    ipcRenderer.on("ui-shell:push", listener);

    return () => {
      ipcRenderer.removeListener("ui-shell:push", listener);
    };
  },
});
