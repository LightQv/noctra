const { INTENTS } = require("../core/intents");
const { cloneIntent } = require("./repeat");
const { isBookmarkableBuffer } = require("../core/bookmarks/eligibility");
const { enterInsertMode } = require("../core/modeTransitionService");

function createActionBuilder(actionId, buildIntent) {
  const builder = (state, count) => buildIntent(state, count);
  builder.actionId = actionId;
  return builder;
}

function setAvailability(builder, predicate) {
  if (!builder || typeof predicate !== "function") return builder;
  builder.isAvailable = predicate;
  return builder;
}

const ACTION_BUILDERS = {
  scroll_down: createActionBuilder("scroll_down", (_state, count = 1) => ({
    type: INTENTS.SCROLL,
    direction: "down",
    amount: 100 * count,
  })),
  scroll_up: createActionBuilder("scroll_up", (_state, count = 1) => ({
    type: INTENTS.SCROLL,
    direction: "up",
    amount: 100 * count,
  })),
  scroll_left: createActionBuilder("scroll_left", (_state, count = 1) => ({
    type: INTENTS.SCROLL,
    direction: "left",
    amount: 100 * count,
  })),
  scroll_right: createActionBuilder("scroll_right", (_state, count = 1) => ({
    type: INTENTS.SCROLL,
    direction: "right",
    amount: 100 * count,
  })),
  scroll_top: createActionBuilder("scroll_top", () => ({
    type: INTENTS.SCROLL_TOP,
  })),
  scroll_bottom: createActionBuilder("scroll_bottom", () => ({
    type: INTENTS.SCROLL_BOTTOM,
  })),
  nav_back: createActionBuilder("nav_back", () => ({ type: INTENTS.NAV_BACK })),
  nav_forward: createActionBuilder("nav_forward", () => ({
    type: INTENTS.NAV_FORWARD,
  })),
  reload_page: createActionBuilder("reload_page", () => ({
    type: INTENTS.RELOAD_PAGE,
  })),
  repeat_last_action: createActionBuilder("repeat_last_action", (state) => {
    const repeated = cloneIntent(state?.lastRepeatableIntent);
    return repeated || { type: INTENTS.NOOP };
  }),
  buffer_prev: createActionBuilder("buffer_prev", () => ({
    type: INTENTS.BUFFER_PREV,
  })),
  buffer_next: createActionBuilder("buffer_next", () => ({
    type: INTENTS.BUFFER_NEXT,
  })),
  enter_insert: createActionBuilder("enter_insert", (state) => {
    enterInsertMode(state, "action-enter-insert");
    return { type: INTENTS.ENTER_INSERT };
  }),
  open_url_prompt: createActionBuilder("open_url_prompt", () => ({
    type: INTENTS.OPEN_URL_PROMPT,
  })),
  new_buffer: createActionBuilder("new_buffer", () => ({
    type: INTENTS.NEW_BUFFER,
  })),
  split_vertical: createActionBuilder("split_vertical", () => ({
    type: INTENTS.SPLIT_VERTICAL,
  })),
  scroll_half_down: createActionBuilder("scroll_half_down", () => ({
    type: INTENTS.SCROLL,
    amount: 300,
    direction: "down",
  })),
  scroll_half_up: createActionBuilder("scroll_half_up", () => ({
    type: INTENTS.SCROLL,
    amount: 300,
    direction: "up",
  })),
  page_down: createActionBuilder("page_down", () => ({
    type: INTENTS.PAGE_DOWN,
  })),
  page_up: createActionBuilder("page_up", () => ({ type: INTENTS.PAGE_UP })),
  focus_split_left: createActionBuilder("focus_split_left", () => ({
    type: INTENTS.FOCUS_SPLIT_LEFT,
  })),
  focus_split_right: createActionBuilder("focus_split_right", () => ({
    type: INTENTS.FOCUS_SPLIT_RIGHT,
  })),
  open_settings: createActionBuilder("open_settings", () => ({
    type: INTENTS.OPEN_SETTINGS_BUFFER,
  })),
  open_notifications: createActionBuilder("open_notifications", () => ({
    type: INTENTS.OPEN_NOTIFICATIONS_BUFFER,
  })),
  toggle_focus_context: createActionBuilder("toggle_focus_context", () => ({
    type: INTENTS.TOGGLE_FOCUS_CONTEXT,
  })),
  toggle_urlline: createActionBuilder("toggle_urlline", () => ({
    type: INTENTS.TOGGLE_URLLINE,
  })),
  toggle_copy_selection_to_clipboard: createActionBuilder(
    "toggle_copy_selection_to_clipboard",
    () => ({ type: INTENTS.TOGGLE_COPY_SELECTION_TO_CLIPBOARD }),
  ),
  history_toggle: createActionBuilder("history_toggle", () => ({
    type: INTENTS.HISTORY_TOGGLE,
  })),
  history_toggle_focus: createActionBuilder("history_toggle_focus", () => ({
    type: INTENTS.HISTORY_TOGGLE_FOCUS,
  })),
  bookmarks_toggle: createActionBuilder("bookmarks_toggle", () => ({
    type: INTENTS.BOOKMARKS_TOGGLE,
  })),
  bookmarks_toggle_focus: createActionBuilder("bookmarks_toggle_focus", () => ({
    type: INTENTS.BOOKMARKS_TOGGLE_FOCUS,
  })),
  bookmarks_add_root_active: setAvailability(
    createActionBuilder("bookmarks_add_root_active", () => ({
      type: INTENTS.BOOKMARKS_ADD_ROOT_ACTIVE,
    })),
    (context = {}) => isBookmarkableBuffer(context.activeBuffer),
  ),
  bookmarks_add_scoped_prompt: setAvailability(
    createActionBuilder("bookmarks_add_scoped_prompt", () => ({
      type: INTENTS.BOOKMARKS_ADD_SCOPED_PROMPT,
    })),
    (context = {}) => isBookmarkableBuffer(context.activeBuffer),
  ),
  downloads_toggle: createActionBuilder("downloads_toggle", () => ({
    type: INTENTS.DOWNLOADS_TOGGLE,
  })),
  downloads_toggle_focus: createActionBuilder("downloads_toggle_focus", () => ({
    type: INTENTS.DOWNLOADS_TOGGLE_FOCUS,
  })),
  downloads_live_modal: createActionBuilder("downloads_live_modal", () => ({
    type: INTENTS.DOWNLOADS_LIVE_MODAL,
  })),
  telescope_open_history: createActionBuilder("telescope_open_history", () => ({
    type: INTENTS.TELESCOPE_OPEN_HISTORY,
  })),
  telescope_open_bookmarks: createActionBuilder(
    "telescope_open_bookmarks",
    () => ({
      type: INTENTS.TELESCOPE_OPEN_BOOKMARKS,
    }),
  ),
  telescope_open_buffers: createActionBuilder("telescope_open_buffers", () => ({
    type: INTENTS.TELESCOPE_OPEN_BUFFERS,
  })),
  telescope_reopen_last: createActionBuilder("telescope_reopen_last", () => ({
    type: INTENTS.TELESCOPE_REOPEN_LAST,
  })),
  session_save: createActionBuilder("session_save", () => ({
    type: INTENTS.SESSION_SAVE,
  })),
  session_restore: createActionBuilder("session_restore", () => ({
    type: INTENTS.SESSION_RESTORE,
  })),
  close_buffer: createActionBuilder("close_buffer", () => ({
    type: INTENTS.CLOSE_BUFFER,
  })),
  reopen_buffer: createActionBuilder("reopen_buffer", () => ({
    type: INTENTS.REOPEN_BUFFER,
  })),
  close_focused: createActionBuilder("close_focused", () => ({
    type: INTENTS.CLOSE_FOCUSED,
  })),
  close_left_buffers: createActionBuilder("close_left_buffers", () => ({
    type: INTENTS.CLOSE_LEFT_BUFFERS,
  })),
  close_right_buffers: createActionBuilder("close_right_buffers", () => ({
    type: INTENTS.CLOSE_RIGHT_BUFFERS,
  })),
  close_all_buffers: createActionBuilder("close_all_buffers", () => ({
    type: INTENTS.CLOSE_ALL_BUFFERS,
  })),
  duplicate_buffer: setAvailability(
    createActionBuilder("duplicate_buffer", () => ({
      type: INTENTS.DUPLICATE_BUFFER,
    })),
    (context = {}) => {
      const buf = context.activeBuffer;
      return Boolean(buf && !buf.isEditable);
    },
  ),
  open_url_in_split: setAvailability(
    createActionBuilder("open_url_in_split", () => ({
      type: INTENTS.OPEN_URL_IN_SPLIT,
    })),
    (context = {}) => {
      const { canBufferBeSplit } = require("../browser/services/splitEligibility");
      return canBufferBeSplit(context.activeBuffer);
    },
  ),
  new_buffers: createActionBuilder("new_buffers", () => ({
    type: INTENTS.NEW_BUFFERS,
  })),
  split_close_right: createActionBuilder("split_close_right", () => ({
    type: INTENTS.SPLIT_CLOSE_RIGHT,
  })),
  split_devtools: setAvailability(
    createActionBuilder("split_devtools", () => ({
      type: INTENTS.SPLIT_DEVTOOLS,
    })),
    (context = {}) => !context.isSplitEnabled,
  ),
  delete_history_entry: setAvailability(
    createActionBuilder("delete_history_entry", () => ({
      type: INTENTS.DELETE_HISTORY_ENTRY,
    })),
    (context = {}) =>
      context.sidepanelVisible && context.sidepanelTreeKind === "history",
  ),
  delete_history_date: setAvailability(
    createActionBuilder("delete_history_date", () => ({
      type: INTENTS.DELETE_HISTORY_DATE,
    })),
    (context = {}) =>
      context.sidepanelVisible && context.sidepanelTreeKind === "history",
  ),
  delete_bookmark_node: setAvailability(
    createActionBuilder("delete_bookmark_node", () => ({
      type: INTENTS.DELETE_BOOKMARK_NODE,
    })),
    (context = {}) =>
      context.sidepanelVisible && context.sidepanelTreeKind === "bookmarks",
  ),
  downloads_clear_completed: setAvailability(
    createActionBuilder("downloads_clear_completed", () => ({
      type: INTENTS.DOWNLOADS_CLEAR_COMPLETED,
    })),
    (context = {}) =>
      context.sidepanelVisible && context.sidepanelTreeKind === "downloads",
  ),
  show_download_in_folder: setAvailability(
    createActionBuilder("show_download_in_folder", () => ({
      type: INTENTS.SHOW_DOWNLOAD_IN_FOLDER,
    })),
    (context = {}) =>
      context.sidepanelVisible && context.sidepanelTreeKind === "downloads",
  ),
  open_download_file: setAvailability(
    createActionBuilder("open_download_file", () => ({
      type: INTENTS.OPEN_DOWNLOAD_FILE,
    })),
    (context = {}) =>
      context.sidepanelVisible && context.sidepanelTreeKind === "downloads",
  ),
};

module.exports = {
  ACTION_BUILDERS,
};
