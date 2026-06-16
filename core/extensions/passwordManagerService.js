const {
  ManagedExtensionService,
} = require("./managedExtensionService");
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

function createStatus(provider, state, message = "") {
  const enabled = isPasswordManagerEnabled(provider.name);
  const restartRequired = state.endsWith("_restart_required");
  return {
    provider: provider.name,
    label: provider.label,
    support: provider.support,
    state,
    extensionId: provider.id,
    enabled,
    restartRequired,
    canOpen: enabled && state === "loaded",
    message,
  };
}

const PASSWORD_MANAGER_MESSAGES = Object.freeze({
  runtimeUnavailable: "Chrome extension runtime is unavailable.",
  notInstalled: "Password manager extension is not installed.",
  retryInstall:
    "Password manager extension is not installed. Restart Noctra or change provider to retry installation.",
  initializeFailed: "Password manager extension failed to initialize.",
  invalidInstaller: "Password manager installer is invalid.",
  serviceWorkerStartSkipped:
    "Password manager background worker explicit start was skipped; popup support may still work.",
  serviceWorkerStartFailed:
    "Password manager background worker failed to start.",
  popupUnavailable: "Password manager popup is unavailable.",
});

const PASSWORD_MANAGER_CODES = Object.freeze({
  installFailed: "password_manager_extension_install_failed",
  extensionFailed: "password_manager_extension_failed",
  disableRestartRequired: "password_manager_disable_restart_required",
  switchRestartRequired: "password_manager_switch_restart_required",
  unloadFailed: "password_manager_extension_unload_failed",
  serviceWorkerStartFailed: "password_manager_service_worker_start_failed",
  installStarted: "password_manager_extension_install_started",
  updateFailed: "password_manager_extension_update_failed",
});

class PasswordManagerService extends ManagedExtensionService {
  constructor(options = {}) {
    super({
      ...options,
      getConfiguredExtension: (configService) =>
        resolvePasswordManagerProvider(getConfigProvider(configService)),
      isExtensionEnabled: isPasswordManagerEnabled,
      createStatus,
      initialExtension: resolvePasswordManagerProvider(
        PASSWORD_MANAGER_PROVIDER_IDS.NONE,
      ),
      messages: PASSWORD_MANAGER_MESSAGES,
      codes: PASSWORD_MANAGER_CODES,
      source: "passwordManagerService",
    });
  }

  get activeProvider() {
    return this.activeExtension;
  }

  set activeProvider(provider) {
    this.activeExtension = provider;
  }
}

module.exports = {
  PasswordManagerService,
  createStatus,
};
