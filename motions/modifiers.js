function handleCtrl(state, key) {
  switch (key) {
    case "d":
      return {
        type: "SCROLL",
        amount: 300,
        direction: "down",
      };

    case "u":
      return {
        type: "SCROLL",
        amount: 300,
        direction: "up",
      };

    case "f":
      return {
        type: "PAGE_DOWN",
      };

    case "b":
      return {
        type: "PAGE_UP",
      };

    default:
      return null;
  }
}

module.exports = { handleCtrl };
