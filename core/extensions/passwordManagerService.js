const {
  PASSWORD_MANAGER_PROVIDER_IDS,
  isPasswordManagerEnabled,
  resolvePasswordManagerProvider,
} = require("./passwordManagerProviders");

function getConfigProvider(configService) {
  if (configService && typeof configService.getConfigValue === "function") {
    return configService.getConfigValue(
      "browser.password_manager.provider",
      PASSWORD_MANAGER_PROVIDER_IDS.NONE,
    );
  }

  if (configService && typeof configService.getConfig === "function") {
    return configService.getConfig()?.browser?.password_manager?.provider;
  }

  return PASSWORD_MANAGER_PROVIDER_IDS.NONE;
}

function sanitizeFailureMessage(error, fallback) {
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

function createStatus(provider, state, message = "") {
  const enabled = isPasswordManagerEnabled(provider.name);
  return {
    provider: provider.name,
    label: provider.label,
    support: provider.support,
    state,
    extensionId: provider.id,
    enabled,
    canOpen: enabled && state === "loaded",
    message,
  };
}

class PasswordManagerService {
  constructor({
    configService,
    session = null,
    extensionRuntime = null,
    notificationsService = null,
    installer = null,
    loadExtension = null,
    updateExtensions = null,
    onStatusChange = null,
  } = {}) {
    this.configService = configService;
    this.session = session;
    this.extensionRuntime = extensionRuntime;
    this.notificationsService = notificationsService;
    this.installer = installer;
    this.loadExtension = loadExtension;
    this.updateExtensions = updateExtensions;
    this.onStatusChange = onStatusChange;
    this.installAttemptedExtensionIds = new Set();
    this.initializeInFlight = null;
    this.status = createStatus(
      resolvePasswordManagerProvider(PASSWORD_MANAGER_PROVIDER_IDS.NONE),
      "disabled",
    );
  }

  getStatus() {
    return { ...this.status };
  }

  setStatus(provider, state, message = "") {
    this.status = createStatus(provider, state, message);

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
    const provider = resolvePasswordManagerProvider(
      getConfigProvider(this.configService),
    );

    if (!isPasswordManagerEnabled(provider.name)) {
      return this.setStatus(provider, "disabled");
    }

    if (!this.extensionRuntime || this.extensionRuntime.enabled === false) {
      return this.fail(provider, "Chrome extension runtime is unavailable.");
    }

    let phase = "startup";

    try {
      await this.initializeInstaller(provider);

      if (this.hasInstalledExtension(provider.id)) {
        phase = "load";
        this.setStatus(provider, "loading");
        await this.updateProviderExtensions(provider);
        await this.loadProviderExtension(provider);
        return this.setStatus(provider, "loaded");
      }

      if (!this.installer) {
        return this.fail(provider, "Password manager extension is not installed.");
      }

      if (this.installAttemptedExtensionIds.has(provider.id)) {
        return this.fail(
          provider,
          "Password manager extension is not installed. Restart Noctra or change provider to retry installation.",
        );
      }

      phase = "install";
      this.installAttemptedExtensionIds.add(provider.id);
      this.setStatus(provider, "installing");
      this.notifyInstallStarted(provider);
      await this.installProviderExtension(provider);
      phase = "load";
      this.setStatus(provider, "loading");
      await this.loadProviderExtension(provider);
      return this.setStatus(provider, "loaded");
    } catch (error) {
      return this.fail(
        provider,
        sanitizeFailureMessage(
          error,
          "Password manager extension failed to initialize.",
        ),
        {
          code:
            phase === "install"
              ? "password_manager_extension_install_failed"
              : "password_manager_extension_failed",
        },
      );
    }
  }

  async initializeInstaller(provider) {
    if (!hasMethod(this.installer, "initialize")) {
      return null;
    }

    return this.installer.initialize({ provider, session: this.session });
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

  async installProviderExtension(provider) {
    if (!this.installer) {
      return null;
    }

    if (typeof this.installer === "function") {
      return this.installer(provider.id, { provider, session: this.session });
    }

    if (typeof this.installer.installExtension === "function") {
      return this.installer.installExtension(provider.id, {
        provider,
        session: this.session,
      });
    }

    throw new TypeError("Password manager installer is invalid.");
  }

  async loadProviderExtension(provider) {
    if (typeof this.loadExtension === "function") {
      const extension = await this.loadExtension(provider, { session: this.session });
      await this.startProviderServiceWorker(provider, extension);
      return extension;
    }

    if (hasMethod(this.installer, "loadExtension")) {
      const extension = await this.installer.loadExtension(provider.id, {
        provider,
        session: this.session,
      });
      await this.startProviderServiceWorker(provider, extension);
      return extension;
    }

    return null;
  }

  async startProviderServiceWorker(provider, extension) {
    const manifest = extension?.manifest || extension;
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
        `chrome-extension://${provider.id}/`,
      );
    } catch (error) {
      this.notifyWarning({
        severity: "info",
        code: "password_manager_service_worker_start_failed",
        message:
          "Password manager background worker explicit start was skipped; popup support may still work.",
        detail: sanitizeFailureMessage(
          error,
          "Password manager background worker failed to start.",
        ),
      });
      return null;
    }
  }

  async updateProviderExtensions(provider) {
    try {
      if (typeof this.updateExtensions === "function") {
        return await this.updateExtensions({ provider, session: this.session });
      }

      if (hasMethod(this.installer, "updateExtensions")) {
        return await this.installer.updateExtensions({
          provider,
          session: this.session,
        });
      }
    } catch (error) {
      this.notifyUpdateFailed(provider, error);
    }

    return null;
  }

  notifyInstallStarted(provider) {
    if (!hasMethod(this.notificationsService, "notify")) {
      return;
    }

    this.notificationsService.notify({
      severity: "info",
      code: "password_manager_extension_install_started",
      message: `Installing ${provider.label} extension.`,
      source: "passwordManagerService",
      persist: false,
    });
  }

  notifyUpdateFailed(provider, error) {
    if (!hasMethod(this.notificationsService, "notify")) {
      return;
    }

    this.notificationsService.notify({
      severity: "warning",
      code: "password_manager_extension_update_failed",
      message: `${provider.label} update failed; using installed extension if available.`,
      source: "passwordManagerService",
      context: {
        message: sanitizeFailureMessage(error, "Extension update failed."),
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
      source: "passwordManagerService",
      context: detail ? { message: detail } : undefined,
      toast: false,
      persist: false,
    });
  }

  fail(provider, message, options = {}) {
    const status = this.setStatus(provider, "failed", message);

    if (hasMethod(this.notificationsService, "notify")) {
      this.notificationsService.notify({
        severity: "warning",
        code: options.code || "password_manager_extension_failed",
        message,
        source: "passwordManagerService",
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
        resolvePasswordManagerProvider(status.provider),
        "Password manager popup is unavailable.",
      );
    }

    let opened = false;
    try {
      opened = await this.extensionRuntime.openActionPopup(status.provider);
    } catch (error) {
      return this.fail(
        resolvePasswordManagerProvider(status.provider),
        sanitizeFailureMessage(error, "Password manager popup is unavailable."),
      );
    }

    if (opened === false) {
      return this.fail(
        resolvePasswordManagerProvider(status.provider),
        "Password manager popup is unavailable.",
      );
    }

    return this.getStatus();
  }
}

module.exports = {
  PasswordManagerService,
  createStatus,
};
