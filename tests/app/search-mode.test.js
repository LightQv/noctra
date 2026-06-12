const test = require("node:test");
const assert = require("node:assert/strict");

const { INTENTS } = require("../../core/intents");
const {
  handleSearch,
  shouldExitSearchForLeaderAction,
} = require("../../motions/search");
const { createInputHandler } = require("../../core/input");
const { createState } = require("../../core/state");

test("search mode hjkl actions map to scroll intents", () => {
  const state = createState();
  state.mode = "SEARCH";
  state.searchPromptVisible = false;
  state.searchHintMode = false;

  const intentLeft = handleSearch(state, { key: "h" });
  const intentDown = handleSearch(state, { key: "j" });
  const intentUp = handleSearch(state, { key: "k" });
  const intentRight = handleSearch(state, { key: "l" });

  assert.equal(intentLeft?.type, INTENTS.SCROLL);
  assert.equal(intentLeft.direction, "left");
  assert.equal(intentDown?.type, INTENTS.SCROLL);
  assert.equal(intentDown.direction, "down");
  assert.equal(intentUp?.type, INTENTS.SCROLL);
  assert.equal(intentUp.direction, "up");
  assert.equal(intentRight?.type, INTENTS.SCROLL);
  assert.equal(intentRight.direction, "right");
});

test("search mode ctrl+u and ctrl+d map to half-page actions", () => {
  const state = createState();
  state.mode = "SEARCH";
  state.searchPromptVisible = false;
  state.searchHintMode = false;

  const halfUp = handleSearch(state, {
    key: "u",
    ctrl: true,
    alt: false,
    meta: false,
  });

  const halfDown = handleSearch(state, {
    key: "d",
    ctrl: true,
    alt: false,
    meta: false,
  });

  assert.equal(halfUp.type, INTENTS.SCROLL);
  assert.equal(halfUp.amount, 300);
  assert.equal(halfUp.direction, "up");
  assert.equal(halfDown.type, INTENTS.SCROLL);
  assert.equal(halfDown.amount, 300);
  assert.equal(halfDown.direction, "down");
});

test("search mode does not consume arrow keys by default", () => {
  const state = createState();
  state.mode = "SEARCH";
  state.searchPromptVisible = false;
  state.searchHintMode = false;

  assert.equal(handleSearch(state, { key: "ArrowDown" }), null);
  assert.equal(handleSearch(state, { key: "ArrowUp" }), null);
  assert.equal(handleSearch(state, { key: "ArrowLeft" }), null);
  assert.equal(handleSearch(state, { key: "ArrowRight" }), null);
});

test("search mode shouldPreventDefault allows native arrows when app not mapped", () => {
  const state = createState();
  state.mode = "SEARCH";

  const handler = createInputHandler({ state });

  assert.equal(
    handler.shouldPreventDefault({
      type: "keyDown",
      key: "ArrowDown",
      ctrl: false,
      alt: false,
      meta: false,
    }),
    false,
  );

  assert.equal(
    handler.shouldPreventDefault({
      type: "keyDown",
      key: "ArrowUp",
      ctrl: false,
      alt: false,
      meta: false,
    }),
    false,
  );

  assert.equal(
    handler.shouldPreventDefault({
      type: "keyDown",
      key: "j",
      ctrl: false,
      alt: false,
      meta: false,
    }),
    true,
  );
});

test("search prompt and hint keep arrows blocked", () => {
  const state = createState();
  state.mode = "SEARCH";
  state.searchPromptVisible = true;

  const promptHandler = createInputHandler({ state });
  assert.equal(
    promptHandler.shouldPreventDefault({
      type: "keyDown",
      key: "ArrowDown",
      ctrl: false,
      alt: false,
      meta: false,
    }),
    true,
  );

  state.searchPromptVisible = false;
  state.searchHintMode = true;
  const hintHandler = createInputHandler({ state });
  assert.equal(
    hintHandler.shouldPreventDefault({
      type: "keyDown",
      key: "ArrowLeft",
      ctrl: false,
      alt: false,
      meta: false,
    }),
    true,
  );
});

test("search prompt captures input while editor is focused", () => {
  const state = createState();
  state.mode = "SEARCH";
  state.editorFocus = true;
  state.searchPromptVisible = true;

  const dispatched = [];
  const handler = createInputHandler({
    state,
    buffers: {
      getActive: () => ({ isEditable: true }),
    },
    sidepanelController: { isFocused: () => false },
    dispatch: (_win, intent) => dispatched.push(intent),
  });

  const input = {
    type: "keyDown",
    key: "a",
    ctrl: false,
    alt: false,
    meta: false,
  };

  assert.equal(handler.shouldPreventDefault(input), true);
  handler.handleInput(null, input);
  assert.equal(dispatched.length, 1);
  assert.equal(dispatched[0].type, INTENTS.SEARCH_APPEND_TEXT);
  assert.equal(dispatched[0].text, "a");
});

test("search mode leader key opens which-key", () => {
  const state = createState();
  state.mode = "SEARCH";
  state.searchPromptVisible = false;
  state.searchHintMode = false;

  const intent = handleSearch(
    state,
    { key: "Space", ctrl: false, alt: false, meta: false },
    {
      buffers: {
        getActive: () => null,
        isSplitEnabled: () => false,
      },
    },
  );

  assert.equal(state.leaderActive, true);
  assert.equal(intent.type, INTENTS.SHOW_WHICHKEY);
});

test("search mode leader sequence clears search before context-changing action", () => {
  const state = createState();
  state.mode = "SEARCH";
  state.searchPromptVisible = false;
  state.searchHintMode = false;
  const buffers = {
    getActive: () => null,
    isSplitEnabled: () => false,
  };

  handleSearch(state, { key: "Space", ctrl: false, alt: false, meta: false }, { buffers });
  const intent = handleSearch(
    state,
    { key: ",", ctrl: false, alt: false, meta: false },
    { buffers },
  );

  assert.equal(state.leaderActive, false);
  assert.equal(intent.type, INTENTS.HIDE_WHICHKEY);
  assert.equal(intent.next.type, INTENTS.SEARCH_CLEAR);
  assert.equal(intent.next.next.type, INTENTS.OPEN_SETTINGS_BUFFER);
});

test("search mode prevents native arrows during leader sequence", () => {
  const state = createState();
  state.mode = "SEARCH";
  state.searchPromptVisible = false;
  state.searchHintMode = false;
  state.leaderActive = true;

  const handler = createInputHandler({ state });

  assert.equal(
    handler.shouldPreventDefault({
      type: "keyDown",
      key: "ArrowDown",
      ctrl: false,
      alt: false,
      meta: false,
    }),
    true,
  );
});

test("search leader close-side actions keep current search context", () => {
  const active = { id: 2 };
  const buffers = {
    getActive: () => active,
    getBuffers: () => [{ id: 1 }, active, { id: 3 }],
  };

  assert.equal(
    shouldExitSearchForLeaderAction({ type: INTENTS.CLOSE_LEFT_BUFFERS }, buffers),
    false,
  );
  assert.equal(
    shouldExitSearchForLeaderAction({ type: INTENTS.CLOSE_RIGHT_BUFFERS }, buffers),
    false,
  );
});

test("search leader close-side indexed actions exit only when active is removed", () => {
  const active = { id: 2 };
  const buffers = {
    getActive: () => active,
    getBuffers: () => [{ id: 1 }, active, { id: 3 }],
  };

  assert.equal(
    shouldExitSearchForLeaderAction(
      { type: INTENTS.CLOSE_LEFT_BUFFERS, index: 2 },
      buffers,
    ),
    true,
  );
  assert.equal(
    shouldExitSearchForLeaderAction(
      { type: INTENTS.CLOSE_LEFT_BUFFERS, index: 1 },
      buffers,
    ),
    false,
  );
  assert.equal(
    shouldExitSearchForLeaderAction(
      { type: INTENTS.CLOSE_RIGHT_BUFFERS, index: 0 },
      buffers,
    ),
    true,
  );
  assert.equal(
    shouldExitSearchForLeaderAction(
      { type: INTENTS.CLOSE_RIGHT_BUFFERS, index: 1 },
      buffers,
    ),
    false,
  );
});

test("search leader close and switch actions follow active buffer context", () => {
  const active = { id: 2 };
  const buffers = {
    getActive: () => active,
    getBuffers: () => [{ id: 1 }, active, { id: 3 }],
  };

  assert.equal(
    shouldExitSearchForLeaderAction({ type: INTENTS.CLOSE_BUFFER }, buffers),
    true,
  );
  assert.equal(
    shouldExitSearchForLeaderAction({ type: INTENTS.CLOSE_BUFFER, id: 1 }, buffers),
    false,
  );
  assert.equal(
    shouldExitSearchForLeaderAction({ type: INTENTS.CLOSE_BUFFER, id: 2 }, buffers),
    true,
  );
  assert.equal(
    shouldExitSearchForLeaderAction({ type: INTENTS.SWITCH_BUFFER, id: 2 }, buffers),
    false,
  );
  assert.equal(
    shouldExitSearchForLeaderAction({ type: INTENTS.SWITCH_BUFFER, id: 3 }, buffers),
    true,
  );
});

test("search leader exits for known context-changing actions", () => {
  const buffers = {
    getActive: () => ({ id: 1 }),
    getBuffers: () => [{ id: 1 }],
  };

  assert.equal(
    shouldExitSearchForLeaderAction({ type: INTENTS.NEW_BUFFER }, buffers),
    true,
  );
  assert.equal(
    shouldExitSearchForLeaderAction({ type: INTENTS.OPEN_URL_IN_SPLIT }, buffers),
    true,
  );
  assert.equal(
    shouldExitSearchForLeaderAction({ type: INTENTS.OPEN_SETTINGS_BUFFER }, buffers),
    true,
  );
  assert.equal(
    shouldExitSearchForLeaderAction({ type: INTENTS.TELESCOPE_OPEN_BUFFERS }, buffers),
    true,
  );
});

test("search leader keeps search-native and page-local actions", () => {
  const buffers = {
    getActive: () => ({ id: 1 }),
    getBuffers: () => [{ id: 1 }],
  };

  assert.equal(
    shouldExitSearchForLeaderAction({ type: INTENTS.SEARCH_NEXT }, buffers),
    false,
  );
  assert.equal(
    shouldExitSearchForLeaderAction({ type: INTENTS.SCROLL, direction: "down", amount: 100 }, buffers),
    false,
  );
  assert.equal(
    shouldExitSearchForLeaderAction({ type: INTENTS.RELOAD_PAGE }, buffers),
    false,
  );
});

test("search leader numeric buffer switch clears search when target differs", () => {
  const state = createState();
  state.mode = "SEARCH";
  state.searchPromptVisible = false;
  state.searchHintMode = false;
  const active = { id: 1 };
  const buffers = {
    getActive: () => active,
    getBuffers: () => [active, { id: 2 }],
    isSplitEnabled: () => false,
  };

  handleSearch(state, { key: "Space", ctrl: false, alt: false, meta: false }, { buffers });
  const intent = handleSearch(
    state,
    { key: "2", ctrl: false, alt: false, meta: false },
    { buffers },
  );

  assert.equal(intent.type, INTENTS.SEARCH_CLEAR);
  assert.equal(intent.next.type, INTENTS.SWITCH_BUFFER);
  assert.equal(intent.next.id, 2);
});
