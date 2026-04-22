const { defaultConfig } = require("./defaults");

const ACTION_IDS = new Set([
  "close_buffer",
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

function normalizeConfig(rawConfig) {
  const defaults = cloneDefaults();
  const input = isPlainObject(rawConfig) ? rawConfig : {};
  const normalized = cloneDefaults();

  if (isPlainObject(input.input)) {
    if (typeof input.input.leader_key === "string" && input.input.leader_key.trim()) {
      normalized.input.leader_key = input.input.leader_key.trim();
    }

    normalized.input.sequence_timeout_ms = Math.floor(
      normalizeNumber(input.input.sequence_timeout_ms, defaults.input.sequence_timeout_ms, 0),
    );
  }

  if (isPlainObject(input.whichkey)) {
    if (typeof input.whichkey.enabled === "boolean") {
      normalized.whichkey.enabled = input.whichkey.enabled;
    }

    normalized.whichkey.display_delay_ms = Math.floor(
      normalizeNumber(input.whichkey.display_delay_ms, defaults.whichkey.display_delay_ms, 0),
    );

    normalized.whichkey.timeout_ms = normalizeTimeout(
      input.whichkey.timeout_ms,
      defaults.whichkey.timeout_ms,
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

  if (isPlainObject(input.ui)) {
    if (isPlainObject(input.ui.tabline) && typeof input.ui.tabline.enabled === "boolean") {
      normalized.ui.tabline.enabled = input.ui.tabline.enabled;
    }

    if (isPlainObject(input.ui.statusline) && typeof input.ui.statusline.enabled === "boolean") {
      normalized.ui.statusline.enabled = input.ui.statusline.enabled;
    }
  }

  if (isPlainObject(input.theme)) {
    if (typeof input.theme.name === "string" && input.theme.name.trim()) {
      normalized.theme.name = input.theme.name.trim();
    }

    if (isPlainObject(input.theme.overrides)) {
      normalized.theme.overrides = input.theme.overrides;
    }
  }

  if (isPlainObject(input.split)) {
    if (typeof input.split.enabled === "boolean") {
      normalized.split.enabled = input.split.enabled;
    }

    normalized.split.regular_ratio = normalizeNumber(
      input.split.regular_ratio,
      defaults.split.regular_ratio,
      0.1,
    );

    normalized.split.devtools_ratio = normalizeNumber(
      input.split.devtools_ratio,
      defaults.split.devtools_ratio,
      0.1,
    );

    if (isPlainObject(input.split.focus_keys)) {
      if (typeof input.split.focus_keys.left === "string" && input.split.focus_keys.left.trim()) {
        normalized.split.focus_keys.left = input.split.focus_keys.left.trim();
      }

      if (
        typeof input.split.focus_keys.right === "string" &&
        input.split.focus_keys.right.trim()
      ) {
        normalized.split.focus_keys.right = input.split.focus_keys.right.trim();
      }
    }
  }

  if (isPlainObject(input.storage)) {
    for (const key of ["history_file", "favorites_file", "sessions_file"]) {
      if (typeof input.storage[key] === "string" && input.storage[key].trim()) {
        normalized.storage[key] = input.storage[key].trim();
      }
    }
  }

  return normalized;
}

module.exports = {
  normalizeConfig,
};
