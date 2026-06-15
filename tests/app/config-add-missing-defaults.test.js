const test = require("node:test");
const assert = require("node:assert/strict");

const {
  syncSupportedConfigDefaults,
} = require("../../core/config/service");

test("adds missing default entries without overwriting existing values", () => {
  const config = syncSupportedConfigDefaults(
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

test("removes unsupported user config keys", () => {
  const config = syncSupportedConfigDefaults(
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

  assert.equal(config.custom_plugin, undefined);
  assert.equal(config.global.input.leader_key, "Space");
});

test("does not replace malformed existing values during file sync", () => {
  const config = syncSupportedConfigDefaults(
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
  const config = syncSupportedConfigDefaults({}, defaults);

  config.global.ui.loadingline.enabled = false;

  assert.equal(defaults.global.ui.loadingline.enabled, true);
});

test("preserves dynamic keymap entries", () => {
  const config = syncSupportedConfigDefaults(
    {
      keymap: {
        normal: {
          x: "reload_page",
        },
        search: {
          z: "search_next",
        },
        leader: {
          custom: {
            label: "Custom",
            action: "reload_page",
          },
        },
      },
    },
    {
      keymap: {
        normal: {
          j: "scroll_down",
        },
        search: {
          n: "search_next",
        },
        leader: {},
      },
    },
  );

  assert.deepEqual(config.keymap.normal, {
    x: "reload_page",
    j: "scroll_down",
  });
  assert.deepEqual(config.keymap.search, {
    z: "search_next",
    n: "search_next",
  });
  assert.deepEqual(config.keymap.leader.custom, {
    label: "Custom",
    action: "reload_page",
  });
});
