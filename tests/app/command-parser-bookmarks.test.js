const test = require("node:test");
const assert = require("node:assert/strict");
const { parseCommand } = require("../../core/commandParser");
const { INTENTS } = require("../../core/intents");

test("parseCommand supports :bookmarks import", () => {
  const intent = parseCommand("bookmarks import");
  assert.deepEqual(intent, { type: INTENTS.BOOKMARKS_IMPORT });
});

test("parseCommand keeps unknown bookmarks subcommands invalid", () => {
  const intent = parseCommand("bookmarks not-a-real-subcommand");
  assert.equal(intent.type, INTENTS.UNKNOWN_COMMAND);
});
