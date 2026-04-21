module.exports = {
  j: (state, count) => ({
    type: "SCROLL",
    direction: "down",
    amount: 100 * count,
  }),

  k: (state, count) => ({
    type: "SCROLL",
    direction: "up",
    amount: 100 * count,
  }),

  gg: () => ({ type: "SCROLL_TOP" }),

  G: () => ({ type: "SCROLL_BOTTOM" }),

  h: () => ({ type: "NAV_BACK" }),

  l: () => ({ type: "NAV_FORWARD" }),

  i: (state) => {
    state.mode = "INSERT";
    return { type: "ENTER_INSERT" };
  },

  o: () => ({ type: "OPEN_URL_PROMPT" }),

  b: () => ({ type: "NEW_BUFFER" }),
};
