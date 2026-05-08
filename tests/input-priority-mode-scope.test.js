const test = require("node:test");
const assert = require("node:assert/strict");

const { resolveInputPriority } = require("../core/inputPriorityResolver");

test("leader key is prioritized over focused tree routing", () => {
  const priority = resolveInputPriority(
    { type: "keyDown", key: "Space", ctrl: false, meta: false, alt: false },
    { historyPanelFocused: true, historyPanelTextInputActive: false },
    { leaderKey: "Space", leaderActive: false },
    "darwin",
  );

  assert.equal(priority.shouldPrioritizeLeader, true);
  assert.equal(priority.shouldRouteFocusedTreeInput, false);
});

test("focused tree routes input when leader is not active", () => {
  const priority = resolveInputPriority(
    { type: "keyDown", key: "j", ctrl: false, meta: false, alt: false },
    { historyPanelFocused: true, historyPanelTextInputActive: false },
    { leaderKey: "Space", leaderActive: false },
    "linux",
  );

  assert.equal(priority.shouldPrioritizeLeader, false);
  assert.equal(priority.shouldRouteFocusedTreeInput, true);
});

test("command paste shortcut is recognized by platform", () => {
  const priorityMac = resolveInputPriority(
    { type: "keyDown", key: "v", ctrl: false, meta: true, alt: false },
    { commandMode: true },
    {},
    "darwin",
  );
  assert.equal(priorityMac.isCommandPasteShortcut, true);

  const priorityLinux = resolveInputPriority(
    { type: "keyDown", key: "v", ctrl: true, meta: false, alt: false },
    { commandMode: true },
    {},
    "linux",
  );
  assert.equal(priorityLinux.isCommandPasteShortcut, true);
});
