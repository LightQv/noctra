const test = require("node:test");
const assert = require("node:assert/strict");

const { addMissingDefaults } = require("../../core/config/service");

test("adds missing default entries without overwriting existing values", () => {
  const config = addMissingDefaults(
    {
      global: {
        ui: {
          loadingline: {
            enabled: false,
          },
        },
      },
    },
    {
      global: {
        ui: {
          loadingline: {
            enabled: true,
          },
          new_entry: {
            enabled: true,
          },
        },
      },
    },
  );

  assert.equal(config.global.ui.loadingline.enabled, false);
  assert.deepEqual(config.global.ui.new_entry, { enabled: true });
});

test("preserves unknown user config keys", () => {
  const config = addMissingDefaults(
    {
      custom_plugin: {
        enabled: true,
      },
    },
    {
      global: {
        input: {
          leader_key: "Space",
        },
      },
    },
  );

  assert.deepEqual(config.custom_plugin, { enabled: true });
  assert.equal(config.global.input.leader_key, "Space");
});

test("does not replace malformed existing values during file sync", () => {
  const config = addMissingDefaults(
    {
      global: "broken",
    },
    {
      global: {
        input: {
          leader_key: "Space",
        },
      },
    },
  );

  assert.equal(config.global, "broken");
});

test("clones added defaults so source defaults are not mutated", () => {
  const defaults = {
    global: {
      ui: {
        loadingline: {
          enabled: true,
        },
      },
    },
  };
  const config = addMissingDefaults({}, defaults);

  config.global.ui.loadingline.enabled = false;

  assert.equal(defaults.global.ui.loadingline.enabled, true);
});
