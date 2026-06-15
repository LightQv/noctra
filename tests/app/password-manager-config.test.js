const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeConfig } = require("../../core/config/schema");
const {
  PASSWORD_MANAGER_PROVIDER_IDS,
  isPasswordManagerEnabled,
  normalizePasswordManagerProviderName,
  resolvePasswordManagerProvider,
} = require("../../core/extensions/passwordManagerProviders");
const {
  MANAGED_EXTENSION_CATEGORIES,
  getManagedExtensionIds,
  resolveManagedExtension,
  resolveManagedExtensionByExtensionUrl,
} = require("../../core/extensions/managedExtensionRegistry");

test("password manager defaults to none", () => {
  const config = normalizeConfig({});

  assert.equal(config.browser.password_manager.provider, "none");
  assert.equal(isPasswordManagerEnabled(config), false);
});

test("password manager accepts Bitwarden provider", () => {
  const config = normalizeConfig({
    browser: {
      password_manager: {
        provider: "bitwarden",
      },
    },
  });

  assert.equal(config.browser.password_manager.provider, "bitwarden");
  assert.equal(isPasswordManagerEnabled(config), true);
});

test("password manager accepts 1Password provider", () => {
  const config = normalizeConfig({
    browser: {
      password_manager: {
        provider: "1password",
      },
    },
  });

  assert.equal(config.browser.password_manager.provider, "1password");
  assert.equal(isPasswordManagerEnabled(config), true);
});

test("password manager normalizes invalid provider to none", () => {
  const config = normalizeConfig({
    browser: {
      password_manager: {
        provider: "not-a-provider",
      },
    },
  });

  assert.equal(config.browser.password_manager.provider, "none");
  assert.equal(isPasswordManagerEnabled(config), false);
});

test("password manager malformed shape does not throw", () => {
  assert.doesNotThrow(() =>
    normalizeConfig({ browser: { password_manager: "broken" } }),
  );

  const config = normalizeConfig({ browser: { password_manager: "broken" } });

  assert.equal(config.browser.password_manager.provider, "none");
});

test("password manager provider registry resolves stable metadata", () => {
  const provider = resolvePasswordManagerProvider(" bitwarden ");

  assert.equal(provider.name, PASSWORD_MANAGER_PROVIDER_IDS.BITWARDEN);
  assert.equal(provider.id, "nngceckbapebfimnlniiiahkandclblb");
  assert.equal(provider.label, "Bitwarden");
  assert.equal(provider.category, MANAGED_EXTENSION_CATEGORIES.PASSWORD_MANAGER);
  assert.equal(provider.support, "stable");
});

test("password manager provider registry resolves experimental metadata", () => {
  const provider = resolvePasswordManagerProvider("1PASSWORD");

  assert.equal(provider.name, PASSWORD_MANAGER_PROVIDER_IDS.ONE_PASSWORD);
  assert.equal(provider.id, "aeblfdkhhhdcdjpifhhbdiojplfjncoa");
  assert.equal(provider.label, "1Password");
  assert.equal(provider.support, "experimental");
});

test("password manager provider names normalize safely", () => {
  assert.equal(normalizePasswordManagerProviderName(null), "none");
  assert.equal(normalizePasswordManagerProviderName(""), "none");
  assert.equal(normalizePasswordManagerProviderName(" BITWARDEN "), "bitwarden");
});

test("managed extension registry resolves known extension URLs generically", () => {
  const extension = resolveManagedExtensionByExtensionUrl(
    "chrome-extension://nngceckbapebfimnlniiiahkandclblb/popup/index.html",
  );

  assert.equal(extension.name, "bitwarden");
  assert.equal(extension.category, MANAGED_EXTENSION_CATEGORIES.PASSWORD_MANAGER);
  assert.deepEqual(getManagedExtensionIds(), [
    "nngceckbapebfimnlniiiahkandclblb",
    "aeblfdkhhhdcdjpifhhbdiojplfjncoa",
  ]);
  assert.equal(resolveManagedExtension("1PASSWORD").label, "1Password");
});
