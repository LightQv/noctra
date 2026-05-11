const test = require("node:test");
const assert = require("node:assert/strict");

const { defaultConfig } = require("../../core/config/defaults");
const { runSecurityBaselineChecks } = require("../../scripts/check-security-baseline");

test("security baseline check passes on default config", () => {
  const errors = runSecurityBaselineChecks(defaultConfig);
  assert.deepEqual(errors, []);
});

test("security baseline check fails on insecure defaults", () => {
  const insecure = {
    ...defaultConfig,
    browser: {
      ...defaultConfig.browser,
      trusted_http_hosts: ["example.com"],
      downloads: {
        ...defaultConfig.browser.downloads,
        policy: "allow",
        allow_trusted_surfaces: true,
      },
    },
  };

  const errors = runSecurityBaselineChecks(insecure);
  assert.ok(errors.length > 0);
  assert.ok(errors.some((message) => message.includes("trusted_http_hosts")));
  assert.ok(errors.some((message) => message.includes("allow_trusted_surfaces")));
});
