const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeConfig } = require("../core/config/schema");

test("keymap defaults stay present when keymap section missing", () => {
  const config = normalizeConfig({});

  assert.equal(config.keymap.normal.j, "scroll_down");
  assert.equal(config.keymap.normal.gg, "scroll_top");
  assert.equal(config.keymap.mod.d, "scroll_half_down");
  assert.equal(config.keymap.mod.T, "reopen_buffer");
});

test("user overrides replace matching normal/mod entries", () => {
  const config = normalizeConfig({
    keymap: {
      normal: {
        j: "scroll_up",
        zz: "reload_page",
      },
      mod: {
        d: "scroll_half_up",
      },
    },
  });

  assert.equal(config.keymap.normal.j, "scroll_up");
  assert.equal(config.keymap.normal.zz, "reload_page");
  assert.equal(config.keymap.mod.d, "scroll_half_up");
  assert.equal(config.keymap.mod.u, "scroll_half_up");
});

test("invalid keymap entries are ignored safely", () => {
  const config = normalizeConfig({
    keymap: {
      normal: {
        j: "not_a_real_action",
        "   ": "scroll_down",
        k: 42,
      },
      mod: {
        x: "still_not_real",
      },
    },
  });

  assert.equal(config.keymap.normal.j, "scroll_down");
  assert.equal(config.keymap.normal.k, "scroll_up");
  assert.equal(config.keymap.normal["   "], undefined);
  assert.equal(config.keymap.mod.x, undefined);
});

test("malformed keymap structures do not throw and preserve usable defaults", () => {
  assert.doesNotThrow(() => normalizeConfig({ keymap: "broken" }));
  const config = normalizeConfig({
    keymap: {
      normal: null,
      mod: ["bad"],
      leader: "bad",
    },
  });

  assert.equal(config.keymap.normal.h, "scroll_left");
  assert.equal(config.keymap.mod.l, "focus_split_right");
  assert.ok(config.keymap.leader && typeof config.keymap.leader === "object");
});
