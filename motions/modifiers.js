const { INTENTS } = require("../core/intents");

function handleCtrl(state, key) {
  switch (key) {
    case "d":
      return {
        type: INTENTS.SCROLL,
        amount: 300,
        direction: "down",
      };

    case "u":
      return {
        type: INTENTS.SCROLL,
        amount: 300,
        direction: "up",
      };

    case "f":
      return {
        type: INTENTS.PAGE_DOWN,
      };

    case "b":
      return {
        type: INTENTS.PAGE_UP,
      };

    case "h":
      return {
        type: INTENTS.FOCUS_SPLIT_LEFT,
      };

    case "l":
      return {
        type: INTENTS.FOCUS_SPLIT_RIGHT,
      };

    default:
      return null;
  }
}

module.exports = { handleCtrl };
