const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("module");

const originalLoad = Module._load;

Module._load = function mockElectron(request, parent, isMain) {
  if (request === "electron") {
    return {
      dialog: {
        showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
      },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const { createHistoryBookmarksHandlers } = require("../../core/dispatcher/handlers/historyBookmarks");
const { INTENTS } = require("../../core/intents");

test.after(() => {
  Module._load = originalLoad;
});

function createDeps(overrides = {}) {
  return {
    sidepanelController: {},
    historyService: {},
    bookmarksService: {},
    bookmarkInsertScopeModal: {},
    getActiveBookmarkCandidate: () => null,
    notificationsService: { notify: () => {} },
    ...overrides,
  };
}

test("downloads live modal intent opens injected modal instance", () => {
  let openCount = 0;
  const handlers = createHistoryBookmarksHandlers(
    createDeps({
      downloadsModal: {
        open: () => {
          openCount += 1;
        },
      },
    }),
  );

  handlers[INTENTS.DOWNLOADS_LIVE_MODAL]({
    win: null,
    intent: { type: INTENTS.DOWNLOADS_LIVE_MODAL },
    state: {},
  });

  assert.equal(openCount, 1);
});

test("downloads live modal intent does not require modal module singleton", () => {
  const handlers = createHistoryBookmarksHandlers(createDeps());

  assert.doesNotThrow(() => {
    handlers[INTENTS.DOWNLOADS_LIVE_MODAL]({
      win: null,
      intent: { type: INTENTS.DOWNLOADS_LIVE_MODAL },
      state: {},
    });
  });
});
