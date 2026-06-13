const {
  isExtensionInternalUrl,
  validateNavigableUrl,
} = require("../security/urlPolicy");

function hasLiveWebContents(buffer) {
  return Boolean(
    buffer &&
      buffer.webContents &&
      typeof buffer.webContents.isDestroyed === "function" &&
      !buffer.webContents.isDestroyed(),
  );
}

function isRegisterableBuffer(buffer) {
  if (!hasLiveWebContents(buffer)) {
    return false;
  }

  if (buffer.isEditable || buffer.kind === "editable" || buffer.kind === "settings") {
    return false;
  }

  return true;
}

function getBufferByWebContents(bufferManager, webContents) {
  if (!bufferManager || !webContents) {
    return null;
  }

  if (typeof bufferManager.getBufferByWebContents === "function") {
    return bufferManager.getBufferByWebContents(webContents);
  }

  const buffers = Array.isArray(bufferManager.buffers) ? bufferManager.buffers : [];
  return buffers.find((buffer) => buffer && buffer.webContents === webContents) || null;
}

function getActiveBuffer(bufferManager) {
  if (!bufferManager || typeof bufferManager.getActive !== "function") {
    return null;
  }

  return bufferManager.getActive();
}

function resolveExtensionCreatedUrl(rawUrl) {
  const url = typeof rawUrl === "string" && rawUrl.trim()
    ? rawUrl.trim()
    : "about:blank";

  if (isExtensionInternalUrl(url)) {
    return "about:blank";
  }

  const validation = validateNavigableUrl(url);
  return validation.ok ? validation.url : "about:blank";
}

class NoopChromeExtensionRuntime {
  get enabled() {
    return false;
  }

  registerBuffer() {
    return false;
  }

  selectBuffer() {
    return false;
  }

  removeBuffer() {
    return false;
  }

  openActionPopup() {
    return false;
  }

  getContextMenuItems() {
    return [];
  }
}

class ChromeExtensionRuntime {
  constructor({
    ExtensionRuntimeClass,
    session = null,
    bufferManager,
    getBrowserWindow,
    notificationsService = null,
    license = null,
    handleCrxProtocol = true,
    onActionPopupCreated = null,
  } = {}) {
    if (typeof ExtensionRuntimeClass !== "function") {
      throw new TypeError("ExtensionRuntimeClass must be a constructor");
    }
    if (!bufferManager) {
      throw new TypeError("bufferManager is required");
    }
    if (typeof getBrowserWindow !== "function") {
      throw new TypeError("getBrowserWindow is required");
    }

    this.bufferManager = bufferManager;
    this.getBrowserWindow = getBrowserWindow;
    this.notificationsService = notificationsService;
    this.onActionPopupCreated = onActionPopupCreated;
    this.registeredWebContents = new WeakSet();

    if (
      handleCrxProtocol &&
      session &&
      typeof ExtensionRuntimeClass.handleCRXProtocol === "function"
    ) {
      ExtensionRuntimeClass.handleCRXProtocol(session);
    }

    const options = {
      session,
      createTab: (details) => this.createTab(details),
      selectTab: (webContents, browserWindow) =>
        this.selectTab(webContents, browserWindow),
      removeTab: (webContents, browserWindow) =>
        this.removeTab(webContents, browserWindow),
      createWindow: (details) => this.createWindow(details),
      removeWindow: (browserWindow) => this.removeWindow(browserWindow),
      assignTabDetails: (details, webContents) =>
        this.assignTabDetails(details, webContents),
    };

    if (typeof license === "string" && license.trim()) {
      options.license = license.trim();
    }

    this.extensions = new ExtensionRuntimeClass(options);
    if (typeof this.extensions.on === "function") {
      this.extensions.on("browser-action-popup-created", (popup) => {
        if (typeof this.onActionPopupCreated === "function") {
          this.onActionPopupCreated(popup);
        }
      });
    }
  }

  get enabled() {
    return true;
  }

  registerBuffer(buffer, browserWindow = this.getBrowserWindow()) {
    if (!isRegisterableBuffer(buffer) || !browserWindow) {
      return false;
    }

    this.extensions.addTab(buffer.webContents, browserWindow);
    this.registeredWebContents.add(buffer.webContents);
    return true;
  }

  selectBuffer(buffer) {
    if (!isRegisterableBuffer(buffer)) {
      return false;
    }

    const browserWindow = this.getBrowserWindow();
    this.registerBuffer(buffer, browserWindow);
    this.extensions.selectTab(buffer.webContents);
    return true;
  }

  removeBuffer(buffer) {
    if (!hasLiveWebContents(buffer)) {
      return false;
    }

    return this.registeredWebContents.has(buffer.webContents);
  }

  setActionPopupHandler(handler) {
    this.onActionPopupCreated = typeof handler === "function" ? handler : null;
  }

  async createTab(details = {}) {
    const url = resolveExtensionCreatedUrl(details.url);
    const activate = details.active !== false;
    const buffer = this.bufferManager.create(url, { activate });
    const browserWindow = this.getBrowserWindow();

    this.registerBuffer(buffer, browserWindow);
    if (activate) {
      this.selectBuffer(buffer);
    }

    return [buffer.webContents, browserWindow];
  }

  selectTab(webContents) {
    const buffer = getBufferByWebContents(this.bufferManager, webContents);
    if (!buffer || typeof this.bufferManager.switchTo !== "function") {
      return null;
    }

    return this.bufferManager.switchTo(buffer.id);
  }

  removeTab(webContents) {
    const buffer = getBufferByWebContents(this.bufferManager, webContents);
    if (!buffer || typeof this.bufferManager.close !== "function") {
      return null;
    }

    return this.bufferManager.close(buffer.id);
  }

  async createWindow(details = {}) {
    const url = Array.isArray(details.url) ? details.url[0] : details.url;
    const normalizedUrl = resolveExtensionCreatedUrl(url);
    const buffer = this.bufferManager.create(normalizedUrl, { activate: true });
    const browserWindow = this.getBrowserWindow();

    this.registerBuffer(buffer, browserWindow);
    this.selectBuffer(buffer);

    return browserWindow;
  }

  async removeWindow() {
    if (
      this.notificationsService &&
      typeof this.notificationsService.notify === "function"
    ) {
      this.notificationsService.notify({
        severity: "warning",
        code: "extension_window_remove_ignored",
        message: "Extension requested window removal; Noctra ignored it.",
        source: "chromeExtensionRuntime",
        persist: false,
      });
    }

    return null;
  }

  assignTabDetails(details, webContents) {
    if (!details || typeof details !== "object") {
      return;
    }

    const buffer = getBufferByWebContents(this.bufferManager, webContents);
    const activeBuffer = getActiveBuffer(this.bufferManager);

    details.discarded = false;
    details.frozen = false;
    details.groupId = -1;
    details.active = Boolean(buffer && activeBuffer && buffer === activeBuffer);

    if (buffer && typeof buffer.title === "string") {
      details.title = buffer.title;
    }
    if (buffer && typeof buffer.url === "string") {
      details.url = buffer.url;
    }
  }

  openActionPopup(providerName) {
    if (typeof this.extensions.openActionPopup === "function") {
      return this.extensions.openActionPopup(providerName);
    }

    const provider = resolvePasswordManagerProviderSafe(providerName);
    const browserAction = this.extensions.api?.browserAction;
    const activeTab = this.extensions.ctx?.store?.getActiveTabOfCurrentWindow?.();
    const browserWindow = this.getBrowserWindow();
    if (
      provider.id &&
      browserAction &&
      typeof browserAction.activateClick === "function" &&
      activeTab &&
      browserWindow &&
      typeof browserWindow.getSize === "function"
    ) {
      const [width] = browserWindow.getSize();
      const anchorSize = 64;
      browserAction.activateClick({
        eventType: "click",
        extensionId: provider.id,
        tabId: activeTab.id,
        anchorRect: {
          x: Math.max(0, width - anchorSize),
          y: 0,
          width: anchorSize,
          height: anchorSize,
        },
      });
      return true;
    }

    return false;
  }

  getContextMenuItems(webContents, params) {
    if (typeof this.extensions.getContextMenuItems !== "function") {
      return [];
    }

    return this.extensions.getContextMenuItems(webContents, params);
  }
}

function resolvePasswordManagerProviderSafe(providerName) {
  try {
    return require("./passwordManagerProviders").resolvePasswordManagerProvider(
      providerName,
    );
  } catch {
    return { id: "" };
  }
}

function createChromeExtensionRuntime(options = {}) {
  if (typeof options.ExtensionRuntimeClass !== "function") {
    return new NoopChromeExtensionRuntime();
  }

  try {
    return new ChromeExtensionRuntime(options);
  } catch (error) {
    if (
      options.notificationsService &&
      typeof options.notificationsService.notify === "function"
    ) {
      options.notificationsService.notify({
        severity: "warning",
        code: "chrome_extension_runtime_unavailable",
        message:
          error && error.message
            ? error.message
            : "Chrome extension runtime is unavailable.",
        source: "chromeExtensionRuntime",
        persist: false,
      });
    }
    return new NoopChromeExtensionRuntime();
  }
}

module.exports = {
  ChromeExtensionRuntime,
  NoopChromeExtensionRuntime,
  createChromeExtensionRuntime,
  isRegisterableBuffer,
  resolveExtensionCreatedUrl,
};
