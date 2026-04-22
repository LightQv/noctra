const { INTENTS } = require("../core/intents");

function handleInsert(state, key) {
  if (key === "Escape") {
    state.mode = "NORMAL";
    return { type: INTENTS.ENTER_NORMAL };
  }

  // INSERT mode does not generate motions
  return null;
}

module.exports = { handleInsert };
