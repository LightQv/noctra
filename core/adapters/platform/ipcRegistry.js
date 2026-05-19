const HANDLER_STACKS = new WeakMap();

function getHandlerStacks(ipcMain) {
  let stacks = HANDLER_STACKS.get(ipcMain);
  if (!stacks) {
    stacks = new Map();
    HANDLER_STACKS.set(ipcMain, stacks);
  }
  return stacks;
}

function registerIpcContracts({ ipcMain, events = {}, handlers = {} }) {
  if (!ipcMain) {
    return () => {};
  }

  for (const [channel, listener] of Object.entries(events)) {
    if (typeof listener !== "function") continue;
    ipcMain.on(channel, listener);
  }

  const handlerStacks = getHandlerStacks(ipcMain);
  for (const [channel, listener] of Object.entries(handlers)) {
    if (typeof listener !== "function") continue;

    let stack = handlerStacks.get(channel);
    if (!stack) {
      stack = { listeners: new Set() };
      handlerStacks.set(channel, stack);
      ipcMain.handle(channel, async (...args) => {
        const activeStack = getHandlerStacks(ipcMain).get(channel);
        if (!activeStack || activeStack.listeners.size === 0) {
          return undefined;
        }

        for (const candidate of activeStack.listeners) {
          const result = await candidate(...args);
          if (typeof result !== "undefined") {
            return result;
          }
        }

        return undefined;
      });
    }

    stack.listeners.add(listener);
  }

  return () => {
    for (const [channel, listener] of Object.entries(events)) {
      if (typeof listener !== "function") continue;
      ipcMain.removeListener(channel, listener);
    }

    for (const [channel, listener] of Object.entries(handlers)) {
      if (typeof listener !== "function") {
        ipcMain.removeHandler(channel);
        continue;
      }
      const stack = getHandlerStacks(ipcMain).get(channel);
      if (!stack) {
        ipcMain.removeHandler(channel);
        continue;
      }
      stack.listeners.delete(listener);
      if (stack.listeners.size === 0) {
        getHandlerStacks(ipcMain).delete(channel);
        ipcMain.removeHandler(channel);
      }
    }
  };
}

module.exports = {
  registerIpcContracts,
};
