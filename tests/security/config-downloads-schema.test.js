const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeConfig } = require("../../core/config/schema");

test("config schema keeps prompt download policy defaults", () => {
  const config = normalizeConfig({});
  assert.equal(config.browser.language, "system");
  assert.equal(config.browser.default_search_engine, "duckduckgo");
  assert.equal(config.browser.downloads.policy, "prompt");
  assert.equal(config.browser.downloads.allow_trusted_surfaces, false);
  assert.equal(config.browser.downloads.default_directory, null);
  assert.equal(config.browser.downloads.auto_open, false);
});

test("config schema normalizes browser.language", () => {
  const systemConfig = normalizeConfig({
    browser: { language: " SYSTEM " },
  });
  assert.equal(systemConfig.browser.language, "system");

  const frenchConfig = normalizeConfig({
    browser: { language: "fr" },
  });
  assert.equal(frenchConfig.browser.language, "fr");

  const fallbackConfig = normalizeConfig({
    browser: { language: "de" },
  });
  assert.equal(fallbackConfig.browser.language, "system");
});

test("config schema normalizes browser.default_search_engine", () => {
  const googleConfig = normalizeConfig({
    browser: { default_search_engine: " GOOGLE " },
  });
  assert.equal(googleConfig.browser.default_search_engine, "google");

  const ecosiaConfig = normalizeConfig({
    browser: { default_search_engine: "ecosia" },
  });
  assert.equal(ecosiaConfig.browser.default_search_engine, "ecosia");

  const fallbackConfig = normalizeConfig({
    browser: { default_search_engine: "ask" },
  });
  assert.equal(fallbackConfig.browser.default_search_engine, "duckduckgo");
});

test("config schema normalizes browser.downloads overrides", () => {
  const config = normalizeConfig({
    browser: {
      downloads: {
        policy: "ALLOW",
        allow_trusted_surfaces: true,
        default_directory: "  /tmp/noctra-downloads  ",
        auto_open: true,
      },
    },
  });

  assert.equal(config.browser.downloads.policy, "allow");
  assert.equal(config.browser.downloads.allow_trusted_surfaces, true);
  assert.equal(
    config.browser.downloads.default_directory,
    "/tmp/noctra-downloads",
  );
  assert.equal(config.browser.downloads.auto_open, true);
});
