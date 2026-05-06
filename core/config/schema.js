const { defaultConfig } = require("./defaults");

const ACTION_IDS = new Set([
  "scroll_down",
  "scroll_up",
  "scroll_left",
  "scroll_right",
  "scroll_top",
  "scroll_bottom",
  "nav_back",
  "nav_forward",
  "reload_page",
  "repeat_last_action",
  "buffer_prev",
  "buffer_next",
  "enter_insert",
  "open_url_prompt",
  "new_buffer",
  "split_vertical",
  "scroll_half_down",
  "scroll_half_up",
  "page_down",
  "page_up",
  "focus_split_left",
  "focus_split_right",
  "open_settings",
  "toggle_focus_context",
  "toggle_urlline",
  "toggle_copy_selection_to_clipboard",
  "history_toggle",
  "history_toggle_focus",
  "bookmarks_toggle",
  "bookmarks_toggle_focus",
  "bookmarks_add_root_active",
  "bookmarks_add_scoped_prompt",
  "telescope_open_history",
  "telescope_open_bookmarks",
  "telescope_open_buffers",
  "telescope_reopen_last",
  "session_save",
  "session_restore",
  "close_buffer",
  "reopen_buffer",
  "close_focused",
  "close_left_buffers",
  "close_right_buffers",
  "split_close_right",
  "split_devtools",
  "open_notifications",
]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneDefaults() {
  return JSON.parse(JSON.stringify(defaultConfig));
}

function normalizeTimeout(value, fallback) {
  if (value === null) return null;
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  return fallback;
}

function normalizeNumber(value, fallback, min) {
  if (typeof value === "number" && Number.isFinite(value) && value >= min) {
    return value;
  }
  return fallback;
}

function normalizeStringArray(value, fallback = []) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value.filter((item) => typeof item === "string");
}

function normalizeThemeMode(value, fallback = "dark") {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "default") {
    return "dark";
  }

  if (
    normalized === "dark" ||
    normalized === "light" ||
    normalized === "auto" ||
    normalized === "custom"
  ) {
    return normalized;
  }

  return fallback;
}

function normalizeContentThemeMode(value, fallback = "dark") {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (
    normalized === "dark" ||
    normalized === "light" ||
    normalized === "auto" ||
    normalized === "match"
  ) {
    return normalized;
  }

  return fallback;
}

function normalizeBrowserLanguage(value, fallback = "en") {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "en" || normalized === "fr") {
    return normalized;
  }

  return fallback;
}

function normalizeLeaderNode(node, fallbackLabel = "Leader Group") {
  if (!isPlainObject(node)) {
    return null;
  }

  const normalized = {
    label:
      typeof node.label === "string" && node.label.trim().length > 0
        ? node.label.trim()
        : fallbackLabel,
  };

  if (typeof node.action === "string") {
    const rawActionId = node.action.trim();
    if (ACTION_IDS.has(rawActionId)) {
      normalized.action = rawActionId;
    }
  }

  const sourceChildren = isPlainObject(node.children) ? node.children : null;
  const childKeys = new Set(Object.keys(sourceChildren || {}));

  if (childKeys.size > 0) {
    normalized.children = {};
    for (const key of childKeys) {
      const sourceChild = sourceChildren ? sourceChildren[key] : undefined;
      const nextNode = normalizeLeaderNode(sourceChild, key);
      if (nextNode) {
        normalized.children[key] = nextNode;
      }
    }

    if (Object.keys(normalized.children).length === 0) {
      delete normalized.children;
    }
  }

  if (!normalized.action && !normalized.children) {
    return null;
  }

  return normalized;
}

function normalizeConfig(rawConfig) {
  const defaults = cloneDefaults();
  const input = isPlainObject(rawConfig) ? rawConfig : {};
  const inputGlobal = isPlainObject(input.global) ? input.global : {};
  const normalized = cloneDefaults();
  const normalizedGlobal = normalized.global;

  const inputSection = isPlainObject(inputGlobal.input) ? inputGlobal.input : null;
  const whichKeySection = isPlainObject(inputGlobal.whichkey) ? inputGlobal.whichkey : null;
  const uiSection = isPlainObject(inputGlobal.ui) ? inputGlobal.ui : null;
  const themeSection = isPlainObject(inputGlobal.theme) ? inputGlobal.theme : null;
  const splitSection = isPlainObject(inputGlobal.split) ? inputGlobal.split : null;
  const editorSection = isPlainObject(inputGlobal.editor) ? inputGlobal.editor : null;
  const storageSection = isPlainObject(inputGlobal.storage) ? inputGlobal.storage : null;
  const notificationsSection = isPlainObject(inputGlobal.notifications)
    ? inputGlobal.notifications
    : null;
  const windowSection = isPlainObject(inputGlobal.window) ? inputGlobal.window : null;
  const openingBufferSection = isPlainObject(inputGlobal.opening_buffer)
    ? inputGlobal.opening_buffer
    : null;

  if (isPlainObject(inputSection)) {
    if (typeof inputSection.leader_key === "string" && inputSection.leader_key.trim()) {
      normalizedGlobal.input.leader_key = inputSection.leader_key.trim();
    }

    normalizedGlobal.input.sequence_timeout_ms = Math.floor(
      normalizeNumber(
        inputSection.sequence_timeout_ms,
        defaults.global.input.sequence_timeout_ms,
        0,
      ),
    );
  }

  if (isPlainObject(whichKeySection)) {
    if (typeof whichKeySection.enabled === "boolean") {
      normalizedGlobal.whichkey.enabled = whichKeySection.enabled;
    }

    normalizedGlobal.whichkey.display_delay_ms = Math.floor(
      normalizeNumber(
        whichKeySection.display_delay_ms,
        defaults.global.whichkey.display_delay_ms,
        0,
      ),
    );

    normalizedGlobal.whichkey.timeout_ms = normalizeTimeout(
      whichKeySection.timeout_ms,
      defaults.global.whichkey.timeout_ms,
    );
  }

  const userLeaderTree = isPlainObject(input.keymap) ? input.keymap.leader : null;
  const normalizedUserLeaderNode = normalizeLeaderNode({ label: "Leader", children: userLeaderTree });
  if (normalizedUserLeaderNode && normalizedUserLeaderNode.children) {
    normalized.keymap.leader = normalizedUserLeaderNode.children;
  } else {
    normalized.keymap.leader = defaults.keymap.leader;
  }

  if (isPlainObject(uiSection)) {
    if (isPlainObject(uiSection.tabline) && typeof uiSection.tabline.enabled === "boolean") {
      normalizedGlobal.ui.tabline.enabled = uiSection.tabline.enabled;
    }

    if (isPlainObject(uiSection.tabline) && typeof uiSection.tabline.show_favicon === "boolean") {
      normalizedGlobal.ui.tabline.show_favicon = uiSection.tabline.show_favicon;
    }

    if (isPlainObject(uiSection.urlline) && typeof uiSection.urlline.enabled === "boolean") {
      normalizedGlobal.ui.urlline.enabled = uiSection.urlline.enabled;
    }

    if (isPlainObject(uiSection.sidepanel)) {
      normalizedGlobal.ui.sidepanel.width_ratio = normalizeNumber(
        uiSection.sidepanel.width_ratio,
        defaults.global.ui.sidepanel.width_ratio,
        0.1,
      );
      normalizedGlobal.ui.sidepanel.tree_scroll_context_lines = Math.floor(
        normalizeNumber(
          uiSection.sidepanel.tree_scroll_context_lines,
          defaults.global.ui.sidepanel.tree_scroll_context_lines,
          0,
        ),
      );
      normalizedGlobal.ui.sidepanel.delete_operator_timeout_ms = Math.floor(
        normalizeNumber(
          uiSection.sidepanel.delete_operator_timeout_ms,
          defaults.global.ui.sidepanel.delete_operator_timeout_ms,
          0,
        ),
      );
    }

    if (isPlainObject(uiSection.statusline) && typeof uiSection.statusline.enabled === "boolean") {
      normalizedGlobal.ui.statusline.enabled = uiSection.statusline.enabled;
    }

    if (isPlainObject(uiSection.telescope)) {
      const promptPosition = String(uiSection.telescope.prompt_position || "").trim().toLowerCase();
      if (promptPosition === "top" || promptPosition === "bottom") {
        normalizedGlobal.ui.telescope.prompt_position = promptPosition;
      }
    }
  }

  if (isPlainObject(themeSection)) {
    const normalizedThemeMode = normalizeThemeMode(
      themeSection.mode,
      defaults.global.theme.mode,
    );
    normalizedGlobal.theme.mode = normalizedThemeMode;

    normalizedGlobal.theme.content_mode = normalizeContentThemeMode(
      themeSection.content_mode,
      defaults.global.theme.content_mode,
    );

    if (isPlainObject(themeSection.overrides)) {
      normalizedGlobal.theme.overrides = themeSection.overrides;
    }
  }

  if (isPlainObject(splitSection)) {
    if (typeof splitSection.enabled === "boolean") {
      normalizedGlobal.split.enabled = splitSection.enabled;
    }

    normalizedGlobal.split.regular_ratio = normalizeNumber(
      splitSection.regular_ratio,
      defaults.global.split.regular_ratio,
      0.1,
    );

    normalizedGlobal.split.devtools_ratio = normalizeNumber(
      splitSection.devtools_ratio,
      defaults.global.split.devtools_ratio,
      0.1,
    );

    if (isPlainObject(splitSection.divider) && typeof splitSection.divider.enabled === "boolean") {
      normalizedGlobal.split.divider.enabled = splitSection.divider.enabled;
    }

    if (isPlainObject(splitSection.focus_keys)) {
      if (
        typeof splitSection.focus_keys.left === "string" &&
        splitSection.focus_keys.left.trim()
      ) {
        normalizedGlobal.split.focus_keys.left = splitSection.focus_keys.left.trim();
      }

      if (
        typeof splitSection.focus_keys.right === "string" &&
        splitSection.focus_keys.right.trim()
      ) {
        normalizedGlobal.split.focus_keys.right = splitSection.focus_keys.right.trim();
      }
    }
  }

  if (isPlainObject(editorSection)) {
    if (typeof editorSection.enabled === "boolean") {
      normalizedGlobal.editor.enabled = editorSection.enabled;
    }

    if (typeof editorSection.start_in_normal_mode === "boolean") {
      normalizedGlobal.editor.start_in_normal_mode = editorSection.start_in_normal_mode;
    }

    if (typeof editorSection.relative_line_numbers === "boolean") {
      normalizedGlobal.editor.relative_line_numbers = editorSection.relative_line_numbers;
    }

    normalizedGlobal.editor.scrolloff_lines = Math.floor(
      normalizeNumber(editorSection.scrolloff_lines, defaults.global.editor.scrolloff_lines, 0),
    );
  }

  if (isPlainObject(storageSection)) {
    for (const key of ["history_file", "bookmarks_file", "sessions_file", "notifications_file"]) {
      if (typeof storageSection[key] === "string" && storageSection[key].trim()) {
        normalizedGlobal.storage[key] = storageSection[key].trim();
      }
    }
  }

  if (isPlainObject(notificationsSection)) {
    if (typeof notificationsSection.enabled === "boolean") {
      normalizedGlobal.notifications.enabled = notificationsSection.enabled;
    }

    if (isPlainObject(notificationsSection.toast)) {
      for (const key of ["info", "warning", "error"]) {
        if (typeof notificationsSection.toast[key] === "boolean") {
          normalizedGlobal.notifications.toast[key] = notificationsSection.toast[key];
        }
      }
    }

    if (isPlainObject(notificationsSection.timeout_ms)) {
      for (const key of ["info", "warning", "error"]) {
        if (Number.isFinite(notificationsSection.timeout_ms[key])) {
          normalizedGlobal.notifications.timeout_ms[key] = Math.floor(
            Math.max(800, notificationsSection.timeout_ms[key]),
          );
        }
      }
    }

    if (typeof notificationsSection.persist_errors === "boolean") {
      normalizedGlobal.notifications.persist_errors = notificationsSection.persist_errors;
    }
  }

  if (isPlainObject(windowSection)) {
    normalizedGlobal.window.width = Math.floor(
      normalizeNumber(windowSection.width, defaults.global.window.width, 400),
    );
    normalizedGlobal.window.height = Math.floor(
      normalizeNumber(windowSection.height, defaults.global.window.height, 300),
    );

    if (typeof windowSection.x === "number" && Number.isFinite(windowSection.x)) {
      normalizedGlobal.window.x = Math.floor(windowSection.x);
    }

    if (typeof windowSection.y === "number" && Number.isFinite(windowSection.y)) {
      normalizedGlobal.window.y = Math.floor(windowSection.y);
    }

    if (typeof windowSection.is_maximized === "boolean") {
      normalizedGlobal.window.is_maximized = windowSection.is_maximized;
    }
  }

  if (isPlainObject(openingBufferSection)) {
    if (
      openingBufferSection.mode === "blank" ||
      openingBufferSection.mode === "url" ||
      openingBufferSection.mode === "dashboard"
    ) {
      normalizedGlobal.opening_buffer.mode = openingBufferSection.mode;
    }

    if (typeof openingBufferSection.url === "string") {
      normalizedGlobal.opening_buffer.url = openingBufferSection.url;
    }

    if (isPlainObject(openingBufferSection.dashboard)) {
      if (typeof openingBufferSection.dashboard.header === "string") {
        normalizedGlobal.opening_buffer.dashboard.header = openingBufferSection.dashboard.header;
      }

      if (typeof openingBufferSection.dashboard.footer === "string") {
        normalizedGlobal.opening_buffer.dashboard.footer = openingBufferSection.dashboard.footer;
      }

      normalizedGlobal.opening_buffer.dashboard.buttons = normalizeStringArray(
        openingBufferSection.dashboard.buttons,
        defaults.global.opening_buffer.dashboard.buttons,
      );
    }
  }

  if (isPlainObject(input.browser)) {
    normalized.browser.language = normalizeBrowserLanguage(
      input.browser.language,
      defaults.browser.language,
    );

    if (typeof input.browser.copy_selection_to_clipboard === "boolean") {
      normalized.browser.copy_selection_to_clipboard = input.browser.copy_selection_to_clipboard;
    }
  }

  return normalized;
}

module.exports = {
  normalizeConfig,
};
