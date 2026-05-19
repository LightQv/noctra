const test = require("node:test");
const assert = require("node:assert/strict");

const {
  mapBrowserLanguageToAcceptLanguage,
  resolveBrowserLanguage,
  resolveSystemLanguageTag,
} = require("../../runtime/browserLanguagePolicy");

test("browser language policy maps explicit languages", () => {
  assert.equal(
    mapBrowserLanguageToAcceptLanguage("fr"),
    "fr-FR,fr;q=0.9,en;q=0.8",
  );
  assert.equal(mapBrowserLanguageToAcceptLanguage("en"), "en-US,en;q=0.9");
});

test("browser language policy resolves system language from app preferred list", () => {
  const resolved = resolveBrowserLanguage("system", {
    app: {
      getPreferredSystemLanguages: () => ["fr-CA", "en-US"],
      getLocale: () => "en-US",
    },
  });
  assert.equal(resolved, "fr");
});

test("browser language policy falls back to English for non-French system locales", () => {
  const resolved = resolveBrowserLanguage("system", {
    app: {
      getPreferredSystemLanguages: () => ["de-DE"],
      getLocale: () => "de-DE",
    },
  });
  assert.equal(resolved, "en");
});

test("browser language policy resolves a concrete system language tag", () => {
  const systemTag = resolveSystemLanguageTag({
    app: {
      getPreferredSystemLanguages: () => [],
      getLocale: () => "fr-FR",
    },
  });
  assert.equal(systemTag, "fr-FR");
});
