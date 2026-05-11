const test = require("node:test");
const assert = require("node:assert/strict");

const { validateIntentPayload } = require("../../core/contracts/intents");
const { INTENTS } = require("../../core/intents");
const { createUnknownIntentError } = require("../../core/contracts/errors");

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

test("unknown intent rejection shape is stable", () => {
  const error = createUnknownIntentError("NOT_REAL", { sample: true });
  assert.equal(error.code, "contract_unknown_intent");
  assert.equal(error.boundary, "dispatcher");
  assert.equal(error.subject, "NOT_REAL");
  assert.equal(typeof error.message, "string");
  assert.deepEqual(error.details, { sample: true });
});
