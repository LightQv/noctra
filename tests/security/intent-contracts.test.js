const test = require("node:test");
const assert = require("node:assert/strict");

const { validateIntentPayload } = require("../../core/contracts/intents");
const { INTENTS } = require("../../core/intents");
const { createUnknownIntentError } = require("../../core/contracts/errors");

test("intent contracts accept SEARCH_WEB payload", () => {
  const result = validateIntentPayload(INTENTS.SEARCH_WEB, {
    type: INTENTS.SEARCH_WEB,
    engine: "google",
    query: "toto",
  });
  assert.equal(result.ok, true);
});

test("intent contracts accept SET_BROWSER_LANGUAGE system payload", () => {
  const result = validateIntentPayload(INTENTS.SET_BROWSER_LANGUAGE, {
    type: INTENTS.SET_BROWSER_LANGUAGE,
    language: "system",
    reload: true,
  });
  assert.equal(result.ok, true);
});

test("intent contracts accept SEARCH_SUBMIT payload", () => {
  const result = validateIntentPayload(INTENTS.SEARCH_SUBMIT, {
    type: INTENTS.SEARCH_SUBMIT,
    query: "noctra",
  });
  assert.equal(result.ok, true);
});

test("intent contracts reject SEARCH_SUBMIT without query", () => {
  const result = validateIntentPayload(INTENTS.SEARCH_SUBMIT, {
    type: INTENTS.SEARCH_SUBMIT,
  });
  assert.equal(result.ok, false);
});

test("intent contracts accept SEARCH_HINT_INPUT payload", () => {
  const result = validateIntentPayload(INTENTS.SEARCH_HINT_INPUT, {
    type: INTENTS.SEARCH_HINT_INPUT,
    input: "af",
  });
  assert.equal(result.ok, true);
});

test("intent contracts reject SEARCH_HINT_INPUT with non-string input", () => {
  const result = validateIntentPayload(INTENTS.SEARCH_HINT_INPUT, {
    type: INTENTS.SEARCH_HINT_INPUT,
    input: 12,
  });
  assert.equal(result.ok, false);
});

test("intent contracts accept SEARCH_JUMP_TO_INDEX payload", () => {
  const result = validateIntentPayload(INTENTS.SEARCH_JUMP_TO_INDEX, {
    type: INTENTS.SEARCH_JUMP_TO_INDEX,
    index: 4,
  });
  assert.equal(result.ok, true);
});

test("intent contracts reject SEARCH_JUMP_TO_INDEX with invalid index", () => {
  const result = validateIntentPayload(INTENTS.SEARCH_JUMP_TO_INDEX, {
    type: INTENTS.SEARCH_JUMP_TO_INDEX,
    index: 2.3,
  });
  assert.equal(result.ok, false);
});

test("intent contracts accept SEARCH_RUNTIME_UPDATE payload", () => {
  const result = validateIntentPayload(INTENTS.SEARCH_RUNTIME_UPDATE, {
    type: INTENTS.SEARCH_RUNTIME_UPDATE,
    requestId: "search-12",
    total: 18,
    activeIndex: 2,
    visibleHintCount: 6,
    activeRect: { x: 1, y: 2, width: 3, height: 4 },
    jumped: true,
    hintsCount: 6,
  });
  assert.equal(result.ok, true);
});

test("intent contracts reject SEARCH_RUNTIME_UPDATE bad activeRect", () => {
  const result = validateIntentPayload(INTENTS.SEARCH_RUNTIME_UPDATE, {
    type: INTENTS.SEARCH_RUNTIME_UPDATE,
    requestId: "search-13",
    total: 18,
    activeIndex: 2,
    activeRect: { x: 1, y: 2, width: 3 },
  });
  assert.equal(result.ok, false);
});

test("intent contracts accept valid payload", () => {
  const result = validateIntentPayload(INTENTS.SCROLL, {
    type: INTENTS.SCROLL,
    direction: "down",
    amount: 80,
  });
  assert.equal(result.ok, true);
});

test("intent contracts reject missing required field", () => {
  const result = validateIntentPayload(INTENTS.OPEN_URL, {
    type: INTENTS.OPEN_URL,
  });
  assert.equal(result.ok, false);
});

test("intent contracts reject wrong type", () => {
  const result = validateIntentPayload(INTENTS.SWITCH_BUFFER, {
    type: INTENTS.SWITCH_BUFFER,
    id: "12",
  });
  assert.equal(result.ok, false);
});

test("intent contracts reject unknown extra key", () => {
  const result = validateIntentPayload(INTENTS.NEW_BUFFER, {
    type: INTENTS.NEW_BUFFER,
    debug: true,
  });
  assert.equal(result.ok, false);
  assert.equal(result.details.reason, "unknown_keys");
});

test("intent contracts reject malformed intent.next", () => {
  const result = validateIntentPayload(INTENTS.NOOP, {
    type: INTENTS.NOOP,
    next: 42,
  });
  assert.equal(result.ok, false);
});

test("intent contracts accept CLOSE_LEFT_BUFFERS with optional index", () => {
  const result = validateIntentPayload(INTENTS.CLOSE_LEFT_BUFFERS, {
    type: INTENTS.CLOSE_LEFT_BUFFERS,
    index: 2,
  });
  assert.equal(result.ok, true);
});

test("intent contracts accept CLOSE_LEFT_BUFFERS without index", () => {
  const result = validateIntentPayload(INTENTS.CLOSE_LEFT_BUFFERS, {
    type: INTENTS.CLOSE_LEFT_BUFFERS,
  });
  assert.equal(result.ok, true);
});

test("intent contracts accept DUPLICATE_BUFFER payload", () => {
  const result = validateIntentPayload(INTENTS.DUPLICATE_BUFFER, {
    type: INTENTS.DUPLICATE_BUFFER,
    bufferId: 5,
  });
  assert.equal(result.ok, true);
});

test("intent contracts accept OPEN_URL_IN_SPLIT payload", () => {
  const result = validateIntentPayload(INTENTS.OPEN_URL_IN_SPLIT, {
    type: INTENTS.OPEN_URL_IN_SPLIT,
    url: "https://example.com",
  });
  assert.equal(result.ok, true);
});

test("intent contracts accept NEW_BUFFERS payload", () => {
  const result = validateIntentPayload(INTENTS.NEW_BUFFERS, {
    type: INTENTS.NEW_BUFFERS,
    urls: ["https://a.test", "https://b.test"],
  });
  assert.equal(result.ok, true);
});

test("intent contracts reject NEW_BUFFERS with non-string array", () => {
  const result = validateIntentPayload(INTENTS.NEW_BUFFERS, {
    type: INTENTS.NEW_BUFFERS,
    urls: ["https://a.test", 42],
  });
  assert.equal(result.ok, false);
});

test("intent contracts accept DELETE_HISTORY_ENTRY payload", () => {
  const result = validateIntentPayload(INTENTS.DELETE_HISTORY_ENTRY, {
    type: INTENTS.DELETE_HISTORY_ENTRY,
    dateKey: "2024-01-01",
    entryId: "e1",
  });
  assert.equal(result.ok, true);
});

test("intent contracts accept DELETE_HISTORY_DATE payload", () => {
  const result = validateIntentPayload(INTENTS.DELETE_HISTORY_DATE, {
    type: INTENTS.DELETE_HISTORY_DATE,
    dateKey: "2024-01-01",
  });
  assert.equal(result.ok, true);
});

test("intent contracts accept DELETE_BOOKMARK_NODE payload", () => {
  const result = validateIntentPayload(INTENTS.DELETE_BOOKMARK_NODE, {
    type: INTENTS.DELETE_BOOKMARK_NODE,
    nodeId: "node-1",
  });
  assert.equal(result.ok, true);
});

test("intent contracts accept DOWNLOADS_CLEAR_COMPLETED payload", () => {
  const result = validateIntentPayload(INTENTS.DOWNLOADS_CLEAR_COMPLETED, {
    type: INTENTS.DOWNLOADS_CLEAR_COMPLETED,
  });
  assert.equal(result.ok, true);
});

test("intent contracts accept SHOW_DOWNLOAD_IN_FOLDER payload", () => {
  const result = validateIntentPayload(INTENTS.SHOW_DOWNLOAD_IN_FOLDER, {
    type: INTENTS.SHOW_DOWNLOAD_IN_FOLDER,
    downloadId: "dl-1",
  });
  assert.equal(result.ok, true);
});

test("intent contracts accept OPEN_DOWNLOAD_FILE payload", () => {
  const result = validateIntentPayload(INTENTS.OPEN_DOWNLOAD_FILE, {
    type: INTENTS.OPEN_DOWNLOAD_FILE,
    downloadId: "dl-2",
  });
  assert.equal(result.ok, true);
});

test("unknown intent rejection shape is stable", () => {
  const error = createUnknownIntentError("NOT_REAL", { sample: true });
  assert.equal(error.code, "contract_unknown_intent");
  assert.equal(error.boundary, "dispatcher");
  assert.equal(error.subject, "NOT_REAL");
  assert.equal(typeof error.message, "string");
  assert.deepEqual(error.details, { sample: true });
});
