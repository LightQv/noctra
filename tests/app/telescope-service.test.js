const test = require("node:test");
const assert = require("node:assert/strict");

const { TelescopeService } = require("../../core/telescope/service");

test("telescope service consumes pasteText in INSERT mode", () => {
  const service = new TelescopeService();
  service.active = true;
  service.mode = "INSERT";
  service.items = [];
  service.filteredItems = [];

  const result = service.handleInput({
    type: "keyDown",
    key: "v",
    meta: true,
    ctrl: false,
    alt: false,
    pasteText: "abc",
  });

  assert.equal(result.consumed, true);
  assert.equal(service.getQuery(), "abc");
});

test("telescope service result items expose context metadata", () => {
  const service = new TelescopeService();
  service.filteredItems = [
    { contextKind: "buffers", bufferId: 12 },
    { contextKind: "history", dateKey: "2026-05-20", entryId: "h1" },
  ];

  assert.deepEqual(service.getResultAt(0), {
    contextKind: "buffers",
    bufferId: 12,
  });
  assert.deepEqual(service.getResultAt(1), {
    contextKind: "history",
    dateKey: "2026-05-20",
    entryId: "h1",
  });
  assert.equal(service.getResultAt(8), null);
});
