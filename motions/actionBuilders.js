const { INTENTS } = require("../core/intents");

const ACTION_BUILDERS = {
  scroll_down: (_state, count = 1) => ({
    type: INTENTS.SCROLL,
    direction: "down",
    amount: 100 * count,
  }),
  scroll_up: (_state, count = 1) => ({
    type: INTENTS.SCROLL,
    direction: "up",
    amount: 100 * count,
  }),
  scroll_top: () => ({ type: INTENTS.SCROLL_TOP }),
  scroll_bottom: () => ({ type: INTENTS.SCROLL_BOTTOM }),
  nav_back: () => ({ type: INTENTS.NAV_BACK }),
  nav_forward: () => ({ type: INTENTS.NAV_FORWARD }),
  buffer_prev: () => ({ type: INTENTS.BUFFER_PREV }),
  buffer_next: () => ({ type: INTENTS.BUFFER_NEXT }),
  enter_insert: (state) => {
    state.mode = "INSERT";
    return { type: INTENTS.ENTER_INSERT };
  },
  open_url_prompt: () => ({ type: INTENTS.OPEN_URL_PROMPT }),
  new_buffer: () => ({ type: INTENTS.NEW_BUFFER }),
  split_vertical: () => ({ type: INTENTS.SPLIT_VERTICAL }),
  scroll_half_down: () => ({
    type: INTENTS.SCROLL,
    amount: 300,
    direction: "down",
  }),
  scroll_half_up: () => ({
    type: INTENTS.SCROLL,
    amount: 300,
    direction: "up",
  }),
  page_down: () => ({ type: INTENTS.PAGE_DOWN }),
  page_up: () => ({ type: INTENTS.PAGE_UP }),
  focus_split_left: () => ({ type: INTENTS.FOCUS_SPLIT_LEFT }),
  focus_split_right: () => ({ type: INTENTS.FOCUS_SPLIT_RIGHT }),
  open_settings: () => ({ type: INTENTS.OPEN_SETTINGS_BUFFER }),
  toggle_focus_context: () => ({ type: INTENTS.TOGGLE_FOCUS_CONTEXT }),
  close_buffer: () => ({ type: INTENTS.CLOSE_BUFFER }),
  close_left_buffers: () => ({ type: INTENTS.CLOSE_LEFT_BUFFERS }),
  close_right_buffers: () => ({ type: INTENTS.CLOSE_RIGHT_BUFFERS }),
  split_close_right: () => ({ type: INTENTS.SPLIT_CLOSE_RIGHT }),
  split_devtools: () => ({ type: INTENTS.SPLIT_DEVTOOLS }),
};

module.exports = {
  ACTION_BUILDERS,
};
