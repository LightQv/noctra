const PASSWORD_MANAGER_PROVIDER_IDS = Object.freeze({
  NONE: "none",
  BITWARDEN: "bitwarden",
  ONE_PASSWORD: "1password",
});

const PASSWORD_MANAGER_PROVIDERS = Object.freeze({
  [PASSWORD_MANAGER_PROVIDER_IDS.NONE]: Object.freeze({
    id: null,
    name: PASSWORD_MANAGER_PROVIDER_IDS.NONE,
    label: "None",
    support: "disabled",
  }),
  [PASSWORD_MANAGER_PROVIDER_IDS.BITWARDEN]: Object.freeze({
    id: "nngceckbapebfimnlniiiahkandclblb",
    name: PASSWORD_MANAGER_PROVIDER_IDS.BITWARDEN,
    label: "Bitwarden",
    support: "stable",
  }),
  [PASSWORD_MANAGER_PROVIDER_IDS.ONE_PASSWORD]: Object.freeze({
    id: "aeblfdkhhhdcdjpifhhbdiojplfjncoa",
    name: PASSWORD_MANAGER_PROVIDER_IDS.ONE_PASSWORD,
    label: "1Password",
    support: "experimental",
  }),
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
  normalizePasswordManagerProviderName,
  resolvePasswordManagerProvider,
};
