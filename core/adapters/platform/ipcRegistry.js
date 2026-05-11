function registerIpcContracts({ ipcMain, events = {}, handlers = {} }) {
  if (!ipcMain) {
    return () => {};
  }

  for (const [channel, listener] of Object.entries(events)) {
    if (typeof listener !== "function") continue;
    ipcMain.on(channel, listener);
  }

  for (const [channel, listener] of Object.entries(handlers)) {
    if (typeof listener !== "function") continue;
    ipcMain.handle(channel, listener);
  }

  return () => {
    for (const [channel, listener] of Object.entries(events)) {
      if (typeof listener !== "function") continue;
      ipcMain.removeListener(channel, listener);
    }

    for (const channel of Object.keys(handlers)) {
      ipcMain.removeHandler(channel);
    }
  };
}

module.exports = {
  registerIpcContracts,
};
