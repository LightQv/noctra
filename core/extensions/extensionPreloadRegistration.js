const EXTENSION_PRELOAD_MODULES = Object.freeze([
  "electron-chrome-extensions/preload",
  "electron-chrome-web-store/preload",
]);

function resolvePreloadFilePath(moduleName) {
  return require.resolve(moduleName);
}

function getExistingPreloads(sessionRef) {
  if (!sessionRef || typeof sessionRef.getPreloads !== "function") {
    return [];
  }

  const preloads = sessionRef.getPreloads();
  return Array.isArray(preloads) ? preloads : [];
}

function registerPreload(sessionRef, filePath) {
  if (!sessionRef) {
    return { filePath, registered: false, method: "none" };
  }

  if (typeof sessionRef.registerPreloadScript === "function") {
    const scriptId = sessionRef.registerPreloadScript({
      type: "frame",
      filePath,
    });
    return { filePath, registered: true, method: "registerPreloadScript", scriptId };
  }

  if (typeof sessionRef.setPreloads === "function") {
    const existingPreloads = getExistingPreloads(sessionRef);
    if (!existingPreloads.includes(filePath)) {
      sessionRef.setPreloads([...existingPreloads, filePath]);
    }
    return { filePath, registered: true, method: "setPreloads" };
  }

  return { filePath, registered: false, method: "unsupported" };
}

function registerChromeExtensionPreloads({
  session,
  moduleNames = EXTENSION_PRELOAD_MODULES,
  resolveModule = resolvePreloadFilePath,
} = {}) {
  const sessionRef = session?.defaultSession || session;
  const results = [];

  for (const moduleName of moduleNames) {
    const filePath = resolveModule(moduleName);
    results.push({ moduleName, ...registerPreload(sessionRef, filePath) });
  }

  return results;
}

module.exports = {
  EXTENSION_PRELOAD_MODULES,
  registerChromeExtensionPreloads,
  registerPreload,
};
