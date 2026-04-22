const { INTENTS } = require("../core/intents");

module.exports = {
  j: (state, count) => ({
    type: INTENTS.SCROLL,
    direction: "down",
    amount: 100 * count,
  }),

  k: (state, count) => ({
    type: INTENTS.SCROLL,
    direction: "up",
    amount: 100 * count,
  }),

  gg: () => ({ type: INTENTS.SCROLL_TOP }),

  G: () => ({ type: INTENTS.SCROLL_BOTTOM }),

  h: () => ({ type: INTENTS.NAV_BACK }),

  l: () => ({ type: INTENTS.NAV_FORWARD }),

  i: (state) => {
    state.mode = "INSERT";
    return { type: INTENTS.ENTER_INSERT };
  },

  o: () => ({ type: INTENTS.OPEN_URL_PROMPT }),

  b: () => ({ type: INTENTS.NEW_BUFFER }),

  "|": () => ({ type: INTENTS.SPLIT_VERTICAL }),
};
