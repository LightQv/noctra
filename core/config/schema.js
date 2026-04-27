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
  "close_buffer",
  "close_focused",
  "close_left_buffers",
  "close_right_buffers",
  "split_close_right",
  "split_devtools",
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

function mergeWithFallback(primaryNode, fallbackNode) {
  if (!isPlainObject(primaryNode)) {
    return isPlainObject(fallbackNode) ? fallbackNode : {};
  }

  if (!isPlainObject(fallbackNode)) {
    return primaryNode;
  }

  const merged = { ...primaryNode };

  for (const [key, value] of Object.entries(fallbackNode)) {
    if (!(key in merged)) {
      merged[key] = value;
      continue;
    }

    if (isPlainObject(merged[key]) && isPlainObject(value)) {
      merged[key] = mergeWithFallback(merged[key], value);
    }
  }

  return merged;
}

function resolveGlobalSection(input, sectionKey) {
  const globalSection =
    isPlainObject(input.global) && isPlainObject(input.global[sectionKey])
      ? input.global[sectionKey]
      : null;
  const legacySection = isPlainObject(input[sectionKey]) ? input[sectionKey] : null;

  if (globalSection && legacySection) {
    return mergeWithFallback(globalSection, legacySection);
  }

  return globalSection || legacySection || null;
}

function normalizeLeaderNode(node, fallbackNode) {
  if (!isPlainObject(node)) {
    return fallbackNode;
  }

  const normalized = {
    label:
      typeof node.label === "string" && node.label.trim().length > 0
        ? node.label.trim()
        : fallbackNode?.label || "Leader Group",
  };

  if (typeof node.action === "string" && ACTION_IDS.has(node.action)) {
    normalized.action = node.action;
  }

  const sourceChildren = isPlainObject(node.children) ? node.children : null;
  const fallbackChildren = isPlainObject(fallbackNode?.children) ? fallbackNode.children : {};

  const childKeys = new Set([
    ...Object.keys(sourceChildren || {}),
    ...Object.keys(fallbackChildren),
  ]);

  if (childKeys.size > 0) {
    normalized.children = {};
    for (const key of childKeys) {
      const sourceChild = sourceChildren ? sourceChildren[key] : undefined;
      const fallbackChild = fallbackChildren[key];
      const nextNode = normalizeLeaderNode(sourceChild, fallbackChild);
      if (nextNode) {
        normalized.children[key] = nextNode;
      }
    }
  }

  if (!normalized.action && !normalized.children) {
    return fallbackNode || null;
  }

  return normalized;
}

function normalizeKeymapSection(section, fallbackSection = {}) {
  if (!isPlainObject(section)) {
    return fallbackSection;
  }

  const normalized = {};
  const keys = new Set([...Object.keys(fallbackSection), ...Object.keys(section)]);

  for (const key of keys) {
    const sourceNode = section[key];
    const fallbackNode = fallbackSection[key];

    if (!isPlainObject(sourceNode)) {
      if (fallbackNode) {
        normalized[key] = fallbackNode;
      }
      continue;
    }

    const label =
      typeof sourceNode.label === "string" && sourceNode.label.trim().length > 0
        ? sourceNode.label.trim()
        : fallbackNode?.label || key;
    const sourceAction =
      typeof sourceNode.action === "string" && ACTION_IDS.has(sourceNode.action)
        ? sourceNode.action
        : null;
    const fallbackAction =
      typeof fallbackNode?.action === "string" && ACTION_IDS.has(fallbackNode.action)
        ? fallbackNode.action
        : null;
    const action = sourceAction || fallbackAction;

    if (!action) {
      continue;
    }

    normalized[key] = { label, action };
  }

  return normalized;
}

function normalizeConfig(rawConfig) {
  const defaults = cloneDefaults();
  const input = isPlainObject(rawConfig) ? rawConfig : {};
  const normalized = cloneDefaults();
  const normalizedGlobal = normalized.global;

  const inputSection = resolveGlobalSection(input, "input");
  const whichKeySection = resolveGlobalSection(input, "whichkey");
  const uiSection = resolveGlobalSection(input, "ui");
  const themeSection = resolveGlobalSection(input, "theme");
  const splitSection = resolveGlobalSection(input, "split");
  const editorSection = resolveGlobalSection(input, "editor");
  const storageSection = resolveGlobalSection(input, "storage");
  const openingBufferSection = resolveGlobalSection(input, "opening_buffer");

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

  if (isPlainObject(input.keymap) && input.keymap.leader) {
    const leaderNode = normalizeLeaderNode(
      { label: "Leader", children: input.keymap.leader },
      { label: "Leader", children: defaults.keymap.leader },
    );

    if (leaderNode && leaderNode.children) {
      normalized.keymap.leader = leaderNode.children;
    }
  }

  if (isPlainObject(input.keymap)) {
    normalized.keymap.normal = normalizeKeymapSection(input.keymap.normal, defaults.keymap.normal);
    normalized.keymap.ctrl = normalizeKeymapSection(input.keymap.ctrl, defaults.keymap.ctrl);
  }

  if (isPlainObject(uiSection)) {
    if (isPlainObject(uiSection.tabline) && typeof uiSection.tabline.enabled === "boolean") {
      normalizedGlobal.ui.tabline.enabled = uiSection.tabline.enabled;
    }

    if (isPlainObject(uiSection.statusline) && typeof uiSection.statusline.enabled === "boolean") {
      normalizedGlobal.ui.statusline.enabled = uiSection.statusline.enabled;
    }
  }

  if (isPlainObject(themeSection)) {
    if (typeof themeSection.name === "string" && themeSection.name.trim()) {
      normalizedGlobal.theme.name = themeSection.name.trim();
    }

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
    for (const key of ["history_file", "favorites_file", "sessions_file"]) {
      if (typeof storageSection[key] === "string" && storageSection[key].trim()) {
        normalizedGlobal.storage[key] = storageSection[key].trim();
      }
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

  if (isPlainObject(input.browser) && isPlainObject(input.browser.chromium)) {
    const chromiumConfig = input.browser.chromium;

    if (isPlainObject(chromiumConfig.web_preferences)) {
      if (typeof chromiumConfig.web_preferences.context_isolation === "boolean") {
        normalized.browser.chromium.web_preferences.context_isolation =
          chromiumConfig.web_preferences.context_isolation;
      }

      if (typeof chromiumConfig.web_preferences.node_integration === "boolean") {
        normalized.browser.chromium.web_preferences.node_integration =
          chromiumConfig.web_preferences.node_integration;
      }
    }
  }

  return normalized;
}

module.exports = {
  normalizeConfig,
};
