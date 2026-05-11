const { INTENTS } = require("../core/intents");
const { enterNormalMode } = require("../core/modeTransitionService");

function handleInsert(state, key) {
  if (key === "Escape") {
    enterNormalMode(state, "insert-escape");
    return { type: INTENTS.ENTER_NORMAL };
  }

  // INSERT mode does not generate motions
  return null;
}

module.exports = { handleInsert };
