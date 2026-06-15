const fs = require("fs");
const path = require("path");

const DEFAULT_INSTALL_MESSAGE = "Chrome Web Store installer is unavailable.";

function isFunction(value) {
  return typeof value === "function";
}

function createUnavailableInstaller(message = DEFAULT_INSTALL_MESSAGE) {
  return {
    enabled: false,
    initialize() {
      return false;
    },
    installExtension() {
      throw new Error(message);
    },
    loadExtension() {
      return false;
    },
    updateExtensions() {
      return false;
    },
  };
}

function createChromeWebStoreInstaller({
  webStore,
  session = null,
  allowlist = [],
  extensionsPath = undefined,
  autoUpdate = false,
  loadExtensions = true,
} = {}) {
  if (!webStore || !isFunction(webStore.installExtension)) {
    return createUnavailableInstaller();
  }

  let initialized = false;

  function getSession(options = {}) {
    return options.session || session;
  }

  function getBaseOptions(options = {}) {
    const baseOptions = {
      session: getSession(options),
    };

    if (extensionsPath) {
      baseOptions.extensionsPath = extensionsPath;
    }

    return baseOptions;
  }

  function getExtensionPath(extensionId) {
    if (!extensionsPath || !extensionId) {
      return null;
    }

    const extensionRoot = path.join(extensionsPath, extensionId);
    let entries = [];
    try {
      entries = fs.readdirSync(extensionRoot, { withFileTypes: true });
    } catch {
      return null;
    }

    const candidates = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(extensionRoot, entry.name))
      .filter((candidatePath) =>
        fs.existsSync(path.join(candidatePath, "manifest.json")),
      )
      .sort((left, right) =>
        right.localeCompare(left, undefined, { numeric: true }),
      );

    return candidates[0] || null;
  }

  async function initialize(options = {}) {
    if (initialized || !isFunction(webStore.installChromeWebStore)) {
      initialized = true;
      return false;
    }

    await webStore.installChromeWebStore({
      ...getBaseOptions(options),
      autoUpdate,
      loadExtensions,
      allowlist,
    });
    initialized = true;
    return true;
  }

  async function installExtension(extensionId, options = {}) {
    await initialize(options);
    return webStore.installExtension(extensionId, getBaseOptions(options));
  }

  async function loadExtension(extensionId, options = {}) {
    await initialize(options);

    const targetSession = getSession(options);
    const sessionExtensions = targetSession?.extensions || targetSession;
    if (sessionExtensions && isFunction(sessionExtensions.getExtension)) {
      const existingExtension = sessionExtensions.getExtension(extensionId);
      if (existingExtension) {
        return existingExtension;
      }
    }

    const extensionPath = getExtensionPath(extensionId);
    if (
      extensionPath &&
      sessionExtensions &&
      isFunction(sessionExtensions.loadExtension)
    ) {
      return sessionExtensions.loadExtension(extensionPath, {
        allowFileAccess: false,
      });
    }

    if (!extensionsPath || !isFunction(webStore.loadAllExtensions)) {
      return false;
    }

    return webStore.loadAllExtensions(
      targetSession,
      extensionsPath,
      { allowUnpacked: false },
    );
  }

  function hasInstalledExtension(extensionId) {
    return Boolean(getExtensionPath(extensionId));
  }

  async function updateExtensions(options = {}) {
    await initialize(options);
    if (!isFunction(webStore.updateExtensions)) {
      return false;
    }

    return webStore.updateExtensions(getSession(options));
  }

  return {
    enabled: true,
    initialize,
    installExtension,
    loadExtension,
    hasInstalledExtension,
    updateExtensions,
  };
}

module.exports = {
  createChromeWebStoreInstaller,
  createUnavailableInstaller,
};
