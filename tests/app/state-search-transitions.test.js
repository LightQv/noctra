const test = require("node:test");
const assert = require("node:assert/strict");
const { createState } = require("../../core/state");
const {
  setSearchQuery,
  setSearchActive,
  setSearchPromptVisible,
  setSearchCounters,
  setSearchRequestId,
  setSearchHintMode,
  setSearchHintInput,
  setSearchVisibleHintCount,
  setSearchLastActiveRect,
  resetSearchSession,
} = require("../../core/state/searchState");

test("search state helpers normalize and reset values", () => {
  const state = createState();

  setSearchQuery(state, "find\nme");
  setSearchPromptVisible(state, true);
  setSearchActive(state, true);
  setSearchCounters(state, 3, 8);
  setSearchRequestId(state, 42);
  setSearchHintMode(state, true);
  setSearchHintInput(state, "as\nd");
  setSearchVisibleHintCount(state, 12);
  setSearchLastActiveRect(state, { x: 10, y: 20, width: 30, height: 40 });

  assert.equal(state.searchQuery, "find me");
  assert.equal(state.searchPromptVisible, true);
  assert.equal(state.searchActive, true);
  assert.equal(state.searchMatchIndex, 3);
  assert.equal(state.searchMatchTotal, 8);
  assert.equal(state.searchRequestId, 42);
  assert.equal(state.searchHintMode, true);
  assert.equal(state.searchHintInput, "as d");
  assert.equal(state.searchVisibleHintCount, 12);
  assert.deepEqual(state.searchLastActiveRect, {
    x: 10,
    y: 20,
    width: 30,
    height: 40,
  });

  resetSearchSession(state);
  assert.equal(state.searchQuery, "");
  assert.equal(state.searchPromptVisible, false);
  assert.equal(state.searchActive, false);
  assert.equal(state.searchMatchIndex, 0);
  assert.equal(state.searchMatchTotal, 0);
  assert.equal(state.searchRequestId, null);
  assert.equal(state.searchHintMode, false);
  assert.equal(state.searchHintInput, "");
  assert.equal(state.searchVisibleHintCount, 0);
  assert.equal(state.searchLastActiveRect, null);
});

test("search state helper normalizes invalid hint payload values", () => {
  const state = createState();

  setSearchVisibleHintCount(state, -3.7);
  setSearchLastActiveRect(state, { x: 0, y: 0, width: 20 });

  assert.equal(state.searchVisibleHintCount, 0);
  assert.equal(state.searchLastActiveRect, null);
});
