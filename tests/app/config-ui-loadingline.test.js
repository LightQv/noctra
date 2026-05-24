const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeConfig } = require("../../core/config/schema");

test("loadingline defaults to enabled", () => {
  const config = normalizeConfig({});
  assert.equal(config.global.ui.loadingline.enabled, true);
});

test("loadingline enabled respects boolean override", () => {
  const config = normalizeConfig({
    global: {
      ui: {
        loadingline: {
          enabled: false,
        },
      },
    },
  });

  assert.equal(config.global.ui.loadingline.enabled, false);
});
