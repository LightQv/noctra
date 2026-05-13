function broadcastUiShellPush({ win, buffers, type, payload = {} }) {
  if (!win || typeof type !== "string" || !type.length) return;

  const targets = new Map();
  const addTarget = (webContents) => {
    if (!webContents || webContents.isDestroyed()) return;
    targets.set(webContents.id, webContents);
  };

  addTarget(win.webContents);
  for (const webContents of buffers.getAllWebContents()) {
    addTarget(webContents);
  }

  for (const webContents of targets.values()) {
    webContents.send("ui-shell:push", { type, payload });
  }
}

module.exports = {
  broadcastUiShellPush,
};
