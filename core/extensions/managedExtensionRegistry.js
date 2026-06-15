const MANAGED_EXTENSION_CATEGORIES = Object.freeze({
  PASSWORD_MANAGER: "password-manager",
});

const MANAGED_EXTENSION_IDS = Object.freeze({
  BITWARDEN: "bitwarden",
  ONE_PASSWORD: "1password",
});

const MANAGED_EXTENSIONS = Object.freeze({
  [MANAGED_EXTENSION_IDS.BITWARDEN]: Object.freeze({
    id: "nngceckbapebfimnlniiiahkandclblb",
    name: MANAGED_EXTENSION_IDS.BITWARDEN,
    label: "Bitwarden",
    category: MANAGED_EXTENSION_CATEGORIES.PASSWORD_MANAGER,
    support: "stable",
  }),
  [MANAGED_EXTENSION_IDS.ONE_PASSWORD]: Object.freeze({
    id: "aeblfdkhhhdcdjpifhhbdiojplfjncoa",
    name: MANAGED_EXTENSION_IDS.ONE_PASSWORD,
    label: "1Password",
    category: MANAGED_EXTENSION_CATEGORIES.PASSWORD_MANAGER,
    support: "experimental",
  }),
});

function getManagedExtensions() {
  return Object.values(MANAGED_EXTENSIONS);
}

function getManagedExtensionIds() {
  return getManagedExtensions()
    .map((extension) => extension.id)
    .filter(Boolean);
}

function normalizeManagedExtensionName(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return Object.hasOwn(MANAGED_EXTENSIONS, normalized) ? normalized : null;
}

function resolveManagedExtension(value) {
  const name = normalizeManagedExtensionName(value);
  return name ? MANAGED_EXTENSIONS[name] : null;
}

function resolveManagedExtensionByExtensionId(extensionId) {
  if (typeof extensionId !== "string" || !extensionId.trim()) {
    return null;
  }

  const normalizedId = extensionId.trim();
  return (
    getManagedExtensions().find(
      (extension) => extension && extension.id === normalizedId,
    ) || null
  );
}

function resolveManagedExtensionByExtensionUrl(rawUrl) {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    return null;
  }

  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== "chrome-extension:") {
      return null;
    }

    return resolveManagedExtensionByExtensionId(parsed.hostname);
  } catch {
    return null;
  }
}

function isKnownManagedExtensionUrl(rawUrl) {
  return Boolean(resolveManagedExtensionByExtensionUrl(rawUrl));
}

function getManagedExtensionsByCategory(category) {
  return getManagedExtensions().filter(
    (extension) => extension.category === category,
  );
}

module.exports = {
  MANAGED_EXTENSION_CATEGORIES,
  MANAGED_EXTENSION_IDS,
  MANAGED_EXTENSIONS,
  getManagedExtensionIds,
  getManagedExtensions,
  getManagedExtensionsByCategory,
  isKnownManagedExtensionUrl,
  normalizeManagedExtensionName,
  resolveManagedExtension,
  resolveManagedExtensionByExtensionId,
  resolveManagedExtensionByExtensionUrl,
};
