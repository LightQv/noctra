const test = require("node:test");
const assert = require("node:assert/strict");

const { INTENTS } = require("../../core/intents");
const configService = require("../../core/config/service");
const { defaultConfig } = require("../../core/config/defaults");
const { getWhichKeyModel } = require("../../motions/leaderMap");
const { handleLeaderInput } = require("../../motions/normal");
const {
  paginateWhichKeyEntries,
  WHICHKEY_COLUMN_COUNT,
  WHICHKEY_PAGE_SIZE,
} = require("../../ui/shell/services/whichKeyOverlayController");

const fakeBuffers = {
  getActive: () => null,
  isSplitEnabled: () => false,
};

function createLeaderState() {
  return {
    leaderActive: true,
    leaderPath: [],
    leaderNumericBuffer: "",
    leaderLastKeyTime: 100,
    leaderKey: "Space",
    whichKeyEnabled: true,
    whichKeyTimeout: 1200,
    whichKeyDisplayDelay: 0,
  };
}

test("which-key first page uses four columns and includes password manager", () => {
  const config = configService.getConfig();
  const previousLeader = config.keymap.leader;
  config.keymap.leader = defaultConfig.keymap.leader;

  try {
    const model = getWhichKeyModel([], "", {});
    const page = paginateWhichKeyEntries(model.entries, 0);
    const pageOneKeys = page.columns.flat().map((entry) => entry.key);

    assert.equal(page.columns.length, WHICHKEY_COLUMN_COUNT);
    assert.equal(page.currentPage, 0);
    assert.equal(pageOneKeys.includes("p"), true);
  } finally {
    config.keymap.leader = previousLeader;
  }
});

test("which-key pagination splits entries into pages", () => {
  const entries = Array.from({ length: WHICHKEY_PAGE_SIZE + 1 }, (_, index) => ({
    key: String(index),
    label: `Entry ${index}`,
  }));

  const firstPage = paginateWhichKeyEntries(entries, 0);
  const secondPage = paginateWhichKeyEntries(entries, 1);

  assert.equal(firstPage.totalPages, 2);
  assert.equal(firstPage.columns.flat().length, WHICHKEY_PAGE_SIZE);
  assert.equal(secondPage.currentPage, 1);
  assert.equal(secondPage.columns.flat().length, 1);
});

test("leader page keys are consumed before action dispatch when pagination exists", () => {
  const config = configService.getConfig();
  const previousLeader = config.keymap.leader;
  config.keymap.leader = Object.fromEntries(
    Array.from({ length: WHICHKEY_PAGE_SIZE + 1 }, (_, index) => [
      `x${index}`,
      { label: `Entry ${index}`, action: "open_settings" },
    ]),
  );
  config.keymap.leader["["] = { label: "Would dispatch", action: "open_settings" };

  try {
    const state = createLeaderState();
    const intent = handleLeaderInput(state, { key: "]" }, 150, fakeBuffers);

    assert.equal(intent.type, INTENTS.PAGE_WHICHKEY);
    assert.equal(intent.delta, 1);
    assert.equal(state.leaderActive, true);
  } finally {
    config.keymap.leader = previousLeader;
  }
});
