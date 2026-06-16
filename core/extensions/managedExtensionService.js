function sanitizeManagedExtensionFailureMessage(error, fallback) {
  if (!error || typeof error.message !== "string") {
    return fallback;
  }

  const message = error.message.trim();
  if (!message) {
    return fallback;
  }

  return message.slice(0, 180);
}

function hasMethod(target, methodName) {
  return target && typeof target[methodName] === "function";
}

class ManagedExtensionService {
  constructor({
    configService,
    session = null,
    extensionRuntime = null,
    notificationsService = null,
    installer = null,
    loadExtension = null,
    updateExtensions = null,
    onStatusChange = null,
    getConfiguredExtension,
    isExtensionEnabled,
    createStatus,
    initialExtension,
    messages = {},
    codes = {},
    source = "managedExtensionService",
  } = {}) {
    if (typeof getConfiguredExtension !== "function") {
      throw new TypeError("getConfiguredExtension is required");
    }
    if (typeof isExtensionEnabled !== "function") {
      throw new TypeError("isExtensionEnabled is required");
    }
    if (typeof createStatus !== "function") {
      throw new TypeError("createStatus is required");
    }

    this.configService = configService;
    this.session = session;
    this.extensionRuntime = extensionRuntime;
    this.notificationsService = notificationsService;
    this.installer = installer;
    this.loadExtension = loadExtension;
    this.updateExtensions = updateExtensions;
    this.onStatusChange = onStatusChange;
    this.getConfiguredExtension = getConfiguredExtension;
    this.isExtensionEnabled = isExtensionEnabled;
    this.createStatus = createStatus;
    this.messages = messages;
    this.codes = codes;
    this.source = source;
    this.installAttemptedExtensionIds = new Set();
    this.initializeInFlight = null;
    this.activeExtension = null;
    this.status = createStatus(initialExtension, "disabled");
  }

  getStatus() {
    return { ...this.status };
  }

  setStatus(extension, state, message = "") {
    this.status = this.createStatus(extension, state, message);

    if (typeof this.onStatusChange === "function") {
      this.onStatusChange(this.getStatus());
    }

    return this.getStatus();
  }

  async initialize() {
    if (this.initializeInFlight) {
      return this.initializeInFlight;
    }

    this.initializeInFlight = this.runInitialize().finally(() => {
      this.initializeInFlight = null;
    });
    return this.initializeInFlight;
  }

  async runInitialize() {
    const extension = this.getConfiguredExtension(this.configService);

    const lifecycleStatus = await this.resolveExtensionLifecycle(extension);
    if (lifecycleStatus) {
      return lifecycleStatus;
    }

    if (!this.isExtensionEnabled(extension.name)) {
      return this.setStatus(extension, "disabled");
    }

    if (!this.extensionRuntime || this.extensionRuntime.enabled === false) {
      return this.fail(extension, this.messages.runtimeUnavailable);
    }

    let phase = "startup";

    try {
      await this.initializeInstaller(extension);

      if (this.hasInstalledExtension(extension.id)) {
        phase = "load";
        this.setStatus(extension, "loading");
        await this.updateManagedExtensions(extension);
        await this.loadManagedExtension(extension);
        this.activeExtension = extension;
        return this.setStatus(extension, "loaded");
      }

      if (!this.installer) {
        return this.fail(extension, this.messages.notInstalled);
      }

      if (this.installAttemptedExtensionIds.has(extension.id)) {
        return this.fail(extension, this.messages.retryInstall);
      }

      phase = "install";
      this.installAttemptedExtensionIds.add(extension.id);
      this.setStatus(extension, "installing");
      this.notifyInstallStarted(extension);
      await this.installManagedExtension(extension);
      phase = "load";
      this.setStatus(extension, "loading");
      await this.loadManagedExtension(extension);
      this.activeExtension = extension;
      return this.setStatus(extension, "loaded");
    } catch (error) {
      return this.fail(
        extension,
        sanitizeManagedExtensionFailureMessage(
          error,
          this.messages.initializeFailed,
        ),
        {
          code:
            phase === "install"
              ? this.codes.installFailed
              : this.codes.extensionFailed,
        },
      );
    }
  }

  async resolveExtensionLifecycle(extension) {
    if (!this.activeExtension || this.activeExtension.name === extension.name) {
      return null;
    }

    const activeExtension = this.activeExtension;
    const unloaded = await this.tryUnloadActiveExtension(activeExtension);
    if (unloaded) {
      this.activeExtension = null;
      return null;
    }

    if (!this.isExtensionEnabled(extension.name)) {
      const message = `${activeExtension.label} remains loaded until Noctra restarts.`;
      this.notifyWarning({
        code: this.codes.disableRestartRequired,
        message,
      });
      return this.setStatus(extension, "disabled_restart_required", message);
    }

    const message = `${activeExtension.label} remains loaded until Noctra restarts. Restart Noctra to switch to ${extension.label}.`;
    this.notifyWarning({
      code: this.codes.switchRestartRequired,
      message: `Restart Noctra to switch from ${activeExtension.label} to ${extension.label}.`,
    });
    return this.setStatus(extension, "switch_restart_required", message);
  }

  async tryUnloadActiveExtension(extension) {
    const extensionsApi = this.session?.extensions;
    if (
      !extension?.id ||
      !extensionsApi ||
      typeof extensionsApi.removeExtension !== "function"
    ) {
      return false;
    }

    try {
      await extensionsApi.removeExtension(extension.id);
      return !this.hasInstalledExtension(extension.id);
    } catch (error) {
      this.notifyWarning({
        code: this.codes.unloadFailed,
        message: `${extension.label} could not be unloaded without restarting Noctra.`,
        detail: sanitizeManagedExtensionFailureMessage(
          error,
          "Extension unload failed.",
        ),
      });
      return false;
    }
  }

  async initializeInstaller(extension) {
    if (!hasMethod(this.installer, "initialize")) {
      return null;
    }

    return this.installer.initialize({
      extension,
      provider: extension,
      session: this.session,
    });
  }

  getInstalledExtensions() {
    const extensionsApi = this.session?.extensions;
    if (
      !extensionsApi ||
      typeof extensionsApi.getAllExtensions !== "function"
    ) {
      return [];
    }

    const extensions = extensionsApi.getAllExtensions();
    return Array.isArray(extensions) ? extensions : [];
  }

  hasInstalledExtension(extensionId) {
    if (!extensionId) {
      return false;
    }

    if (
      this.getInstalledExtensions().some(
        (extension) => extension && extension.id === extensionId,
      )
    ) {
      return true;
    }

    if (hasMethod(this.installer, "hasInstalledExtension")) {
      return this.installer.hasInstalledExtension(extensionId);
    }

    return false;
  }

  async installManagedExtension(extension) {
    if (!this.installer) {
      return null;
    }

    if (typeof this.installer === "function") {
      return this.installer(extension.id, {
        extension,
        provider: extension,
        session: this.session,
      });
    }

    if (typeof this.installer.installExtension === "function") {
      return this.installer.installExtension(extension.id, {
        extension,
        provider: extension,
        session: this.session,
      });
    }

    throw new TypeError(this.messages.invalidInstaller);
  }

  async loadManagedExtension(extension) {
    if (typeof this.loadExtension === "function") {
      const loadedExtension = await this.loadExtension(extension, {
        extension,
        provider: extension,
        session: this.session,
      });
      await this.startManagedExtensionServiceWorker(extension, loadedExtension);
      return loadedExtension;
    }

    if (hasMethod(this.installer, "loadExtension")) {
      const loadedExtension = await this.installer.loadExtension(extension.id, {
        extension,
        provider: extension,
        session: this.session,
      });
      await this.startManagedExtensionServiceWorker(extension, loadedExtension);
      return loadedExtension;
    }

    return null;
  }

  async startManagedExtensionServiceWorker(extension, loadedExtension) {
    const manifest = loadedExtension?.manifest || loadedExtension;
    if (
      manifest?.manifest_version !== 3 ||
      !manifest?.background?.service_worker ||
      !this.session?.serviceWorkers ||
      typeof this.session.serviceWorkers.startWorkerForScope !== "function"
    ) {
      return null;
    }

    try {
      return await this.session.serviceWorkers.startWorkerForScope(
        `chrome-extension://${extension.id}/`,
      );
    } catch (error) {
      this.notifyWarning({
        severity: "info",
        code: this.codes.serviceWorkerStartFailed,
        message: this.messages.serviceWorkerStartSkipped,
        detail: sanitizeManagedExtensionFailureMessage(
          error,
          this.messages.serviceWorkerStartFailed,
        ),
      });
      return null;
    }
  }

  async updateManagedExtensions(extension) {
    try {
      if (typeof this.updateExtensions === "function") {
        return await this.updateExtensions({
          extension,
          provider: extension,
          session: this.session,
        });
      }

      if (hasMethod(this.installer, "updateExtensions")) {
        return await this.installer.updateExtensions({
          extension,
          provider: extension,
          session: this.session,
        });
      }
    } catch (error) {
      this.notifyUpdateFailed(extension, error);
    }

    return null;
  }

  notifyInstallStarted(extension) {
    if (!hasMethod(this.notificationsService, "notify")) {
      return;
    }

    this.notificationsService.notify({
      severity: "info",
      code: this.codes.installStarted,
      message: `Installing ${extension.label} extension.`,
      source: this.source,
      persist: false,
    });
  }

  notifyUpdateFailed(extension, error) {
    if (!hasMethod(this.notificationsService, "notify")) {
      return;
    }

    this.notificationsService.notify({
      severity: "warning",
      code: this.codes.updateFailed,
      message: `${extension.label} update failed; using installed extension if available.`,
      source: this.source,
      context: {
        message: sanitizeManagedExtensionFailureMessage(
          error,
          "Extension update failed.",
        ),
      },
      persist: false,
    });
  }

  notifyWarning({ severity = "warning", code, message, detail }) {
    if (!hasMethod(this.notificationsService, "notify")) {
      return;
    }

    this.notificationsService.notify({
      severity,
      code,
      message,
      source: this.source,
      context: detail ? { message: detail } : undefined,
      toast: false,
      persist: false,
    });
  }

  fail(extension, message, options = {}) {
    const status = this.setStatus(extension, "failed", message);

    if (hasMethod(this.notificationsService, "notify")) {
      this.notificationsService.notify({
        severity: "warning",
        code: options.code || this.codes.extensionFailed,
        message,
        source: this.source,
        persist: false,
      });
    }

    return status;
  }

  async open() {
    const status = this.getStatus();
    if (!status.canOpen) {
      return status;
    }

    if (
      !this.extensionRuntime ||
      typeof this.extensionRuntime.openActionPopup !== "function"
    ) {
      return this.fail(
        this.getConfiguredExtensionByStatus(status),
        this.messages.popupUnavailable,
      );
    }

    let opened = false;
    try {
      opened = await this.extensionRuntime.openActionPopup(
        this.getOpenActionTarget(status),
      );
    } catch (error) {
      return this.fail(
        this.getConfiguredExtensionByStatus(status),
        sanitizeManagedExtensionFailureMessage(
          error,
          this.messages.popupUnavailable,
        ),
      );
    }

    if (opened === false) {
      return this.fail(
        this.getConfiguredExtensionByStatus(status),
        this.messages.popupUnavailable,
      );
    }

    return this.getStatus();
  }

  getOpenActionTarget(status) {
    return status.provider || status.extension || status.name;
  }

  getConfiguredExtensionByStatus(status) {
    return this.getConfiguredExtension({
      getConfigValue: () => status.provider || status.extension || status.name,
    });
  }
}

module.exports = {
  ManagedExtensionService,
  hasManagedExtensionMethod: hasMethod,
  sanitizeManagedExtensionFailureMessage,
};
