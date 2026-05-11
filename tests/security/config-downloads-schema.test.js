const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeConfig } = require("../../core/config/schema");

test("config schema keeps prompt download policy defaults", () => {
  const config = normalizeConfig({});
  assert.equal(config.browser.downloads.policy, "prompt");
  assert.equal(config.browser.downloads.allow_trusted_surfaces, false);
  assert.equal(config.browser.downloads.default_directory, null);
  assert.equal(config.browser.downloads.auto_open, false);
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
