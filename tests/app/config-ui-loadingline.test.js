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

test("session restore on startup defaults to disabled", () => {
  const config = normalizeConfig({});
  assert.equal(config.global.session.restore_on_startup, false);
});

test("session restore on startup respects boolean override", () => {
  const config = normalizeConfig({
    global: {
      session: {
        restore_on_startup: true,
      },
    },
  });

  assert.equal(config.global.session.restore_on_startup, true);
});

test("session restore on startup ignores non-boolean override", () => {
  const config = normalizeConfig({
    global: {
      session: {
        restore_on_startup: "true",
      },
    },
  });

  assert.equal(config.global.session.restore_on_startup, false);
});
