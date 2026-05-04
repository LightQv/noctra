const NORMAL_KEY_ACTIONS = Object.freeze({
  j: "scroll_down",
  k: "scroll_up",
  gg: "scroll_top",
  G: "scroll_bottom",
  h: "scroll_left",
  l: "scroll_right",
  gh: "nav_back",
  gl: "nav_forward",
  r: "reload_page",
  ".": "repeat_last_action",
  H: "buffer_prev",
  L: "buffer_next",
  i: "enter_insert",
  o: "open_url_prompt",
  b: "new_buffer",
  "|": "split_vertical",
});

const MOD_KEY_ACTIONS = Object.freeze({
  d: "scroll_half_down",
  u: "scroll_half_up",
  f: "page_down",
  b: "page_up",
  h: "focus_split_left",
  l: "focus_split_right",
  q: "close_focused",
  t: "new_buffer",
  T: "reopen_buffer",
});

module.exports = {
  NORMAL_KEY_ACTIONS,
  MOD_KEY_ACTIONS,
};
