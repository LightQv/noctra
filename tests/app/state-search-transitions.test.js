const test = require("node:test");
const assert = require("node:assert/strict");
const { createState } = require("../../core/state");
const {
  setSearchQuery,
  setSearchActive,
  setSearchPromptVisible,
  setSearchCounters,
  setSearchRequestId,
  resetSearchSession,
} = require("../../core/state/searchState");

test("search state helpers normalize and reset values", () => {
  const state = createState();

  setSearchQuery(state, "find\nme");
  setSearchPromptVisible(state, true);
  setSearchActive(state, true);
  setSearchCounters(state, 3, 8);
  setSearchRequestId(state, 42);

  assert.equal(state.searchQuery, "find me");
  assert.equal(state.searchPromptVisible, true);
  assert.equal(state.searchActive, true);
  assert.equal(state.searchMatchIndex, 3);
  assert.equal(state.searchMatchTotal, 8);
  assert.equal(state.searchRequestId, 42);

  resetSearchSession(state);
  assert.equal(state.searchQuery, "");
  assert.equal(state.searchPromptVisible, false);
  assert.equal(state.searchActive, false);
  assert.equal(state.searchMatchIndex, 0);
  assert.equal(state.searchMatchTotal, 0);
  assert.equal(state.searchRequestId, null);
});
