const {
  MANAGED_EXTENSION_CATEGORIES,
  MANAGED_EXTENSION_IDS,
  getManagedExtensionsByCategory,
  resolveManagedExtensionByExtensionId,
  resolveManagedExtensionByExtensionUrl,
} = require("./managedExtensionRegistry");

const PASSWORD_MANAGER_PROVIDER_IDS = Object.freeze({
  NONE: "none",
  BITWARDEN: MANAGED_EXTENSION_IDS.BITWARDEN,
  ONE_PASSWORD: MANAGED_EXTENSION_IDS.ONE_PASSWORD,
});

const PASSWORD_MANAGER_PROVIDERS = Object.freeze({
  [PASSWORD_MANAGER_PROVIDER_IDS.NONE]: Object.freeze({
    id: null,
    name: PASSWORD_MANAGER_PROVIDER_IDS.NONE,
    label: "None",
    category: MANAGED_EXTENSION_CATEGORIES.PASSWORD_MANAGER,
    support: "disabled",
  }),
  ...Object.fromEntries(
    getManagedExtensionsByCategory(
      MANAGED_EXTENSION_CATEGORIES.PASSWORD_MANAGER,
    ).map((provider) => [provider.name, provider]),
  ),
});

function normalizePasswordManagerProviderName(value) {
  if (typeof value !== "string") {
    return PASSWORD_MANAGER_PROVIDER_IDS.NONE;
  }

  const normalized = value.trim().toLowerCase();
  if (Object.hasOwn(PASSWORD_MANAGER_PROVIDERS, normalized)) {
    return normalized;
  }

  return PASSWORD_MANAGER_PROVIDER_IDS.NONE;
}

function resolvePasswordManagerProvider(value) {
  return PASSWORD_MANAGER_PROVIDERS[normalizePasswordManagerProviderName(value)];
}

function resolvePasswordManagerProviderByExtensionId(extensionId) {
  const provider = resolveManagedExtensionByExtensionId(extensionId);
  return provider && provider.category === MANAGED_EXTENSION_CATEGORIES.PASSWORD_MANAGER
    ? provider
    : null;
}

function resolvePasswordManagerProviderByExtensionUrl(rawUrl) {
  const provider = resolveManagedExtensionByExtensionUrl(rawUrl);
  return provider && provider.category === MANAGED_EXTENSION_CATEGORIES.PASSWORD_MANAGER
    ? provider
    : null;
}

function isKnownPasswordManagerExtensionUrl(rawUrl) {
  return Boolean(resolvePasswordManagerProviderByExtensionUrl(rawUrl));
}

function isPasswordManagerEnabled(configOrProvider) {
  const providerName =
    typeof configOrProvider === "string"
      ? configOrProvider
      : configOrProvider?.browser?.password_manager?.provider;

  return (
    normalizePasswordManagerProviderName(providerName) !==
    PASSWORD_MANAGER_PROVIDER_IDS.NONE
  );
}

module.exports = {
  PASSWORD_MANAGER_PROVIDER_IDS,
  PASSWORD_MANAGER_PROVIDERS,
  isPasswordManagerEnabled,
  isKnownPasswordManagerExtensionUrl,
  normalizePasswordManagerProviderName,
  resolvePasswordManagerProviderByExtensionId,
  resolvePasswordManagerProviderByExtensionUrl,
  resolvePasswordManagerProvider,
};
