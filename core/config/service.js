const fs = require("fs");
const os = require("os");
const path = require("path");
const { parse, stringify } = require("yaml");
const { defaultConfig } = require("./defaults");
const { normalizeConfig } = require("./schema");

const CONFIG_DIR_PATH = path.join(os.homedir(), ".config", "noctra");
const LEGACY_CONFIG_DIR_PATH = path.join(
  os.homedir(),
  ".config",
  ["vim", "browser"].join("-"),
);
const CONFIG_FILE_PATH = path.join(CONFIG_DIR_PATH, "config.yml");

let cachedConfig = normalizeConfig(defaultConfig);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mergeWithDefaults(defaultsNode, inputNode) {
  if (!isPlainObject(defaultsNode)) {
    return inputNode === undefined ? defaultsNode : inputNode;
  }

  const merged = {};
  const inputObject = isPlainObject(inputNode) ? inputNode : {};
  const keys = new Set([...Object.keys(defaultsNode), ...Object.keys(inputObject)]);

  for (const key of keys) {
    merged[key] = mergeWithDefaults(defaultsNode[key], inputObject[key]);
  }

  return merged;
}

function mergeMissingIntoTarget(targetNode, sourceNode) {
  if (!isPlainObject(targetNode)) {
    return isPlainObject(sourceNode) ? { ...sourceNode } : {};
  }

  if (!isPlainObject(sourceNode)) {
    return targetNode;
  }

  for (const [key, value] of Object.entries(sourceNode)) {
    if (!(key in targetNode)) {
      targetNode[key] = value;
      continue;
    }

    if (isPlainObject(targetNode[key]) && isPlainObject(value)) {
      mergeMissingIntoTarget(targetNode[key], value);
    }
  }

  return targetNode;
}

function migrateLegacyConfig(rawConfig) {
  if (!isPlainObject(rawConfig)) {
    return {};
  }

  const migrated = JSON.parse(JSON.stringify(rawConfig));
  const legacyGlobalKeys = [
    "input",
    "whichkey",
    "ui",
    "editor",
    "theme",
    "split",
    "storage",
    "window",
    "opening_buffer",
  ];

  const globalSection = isPlainObject(migrated.global) ? migrated.global : {};

  for (const legacyKey of legacyGlobalKeys) {
    if (!isPlainObject(migrated[legacyKey])) {
      continue;
    }

    const currentSection = isPlainObject(globalSection[legacyKey]) ? globalSection[legacyKey] : {};
    globalSection[legacyKey] = mergeMissingIntoTarget(currentSection, migrated[legacyKey]);
    delete migrated[legacyKey];
  }

  if (Object.keys(globalSection).length > 0 || isPlainObject(migrated.global)) {
    migrated.global = globalSection;
  }

  const themeNode =
    migrated.global && isPlainObject(migrated.global.theme) ? migrated.global.theme : null;
  if (themeNode) {
    if (typeof themeNode.mode !== "string" && typeof themeNode.name === "string") {
      themeNode.mode = themeNode.name;
    }
    if (Object.prototype.hasOwnProperty.call(themeNode, "name")) {
      delete themeNode.name;
    }
  }

  return migrated;
}

function readRawConfig() {
  ensureConfigFile();
  const raw = fs.readFileSync(CONFIG_FILE_PATH, "utf8");
  const parsed = raw.trim() ? parse(raw) : {};
  return migrateLegacyConfig(parsed);
}

function addThemeComments(yamlText) {
  const lines = String(yamlText || "").split("\n");
  const output = [];

  for (const line of lines) {
    if (/^  theme:\s*$/.test(line)) {
      output.push("  # Theme controls for Noctra shell and surfaces");
    }

    if (/^    mode:\s*/.test(line)) {
      output.push("    # App theme mode: dark | light | auto | custom");
      output.push("    # custom uses global.theme.overrides");
    }

    if (/^    content_mode:\s*/.test(line)) {
      output.push("    # Browser content mode: dark | light | auto | match");
      output.push("    # match follows app theme, but custom falls back to auto(system)");
    }

    if (/^    overrides:\s*$/.test(line)) {
      output.push("    # Overrides are applied only when mode is custom");
    }

    if (/^browser:\s*$/.test(line)) {
      output.push("# Browser behavior");
    }

    if (/^  language:\s*/.test(line)) {
      output.push("  # Preferred website language: en | fr");
      output.push("  # Mapped to Accept-Language and known locale hints for requests");
    }

    output.push(line);
  }

  return output.join("\n");
}

function serializeConfig(configObject) {
  return addThemeComments(stringify(configObject));
}

function syncConfigFile(rawConfig) {
  const migratedRaw = migrateLegacyConfig(rawConfig);
  const merged = mergeWithDefaults(defaultConfig, migratedRaw);
  const nextText = serializeConfig(merged);

  try {
    const currentText = fs.readFileSync(CONFIG_FILE_PATH, "utf8");
    if (currentText === nextText) {
      return;
    }
  } catch {
    // fall through and write
  }

  fs.writeFileSync(CONFIG_FILE_PATH, nextText, "utf8");
}

function writeDefaultConfig() {
  fs.writeFileSync(CONFIG_FILE_PATH, serializeConfig(defaultConfig), "utf8");
}

function getBackupPath() {
  const preferredPath = `${CONFIG_FILE_PATH}.bak`;
  if (!fs.existsSync(preferredPath)) {
    return preferredPath;
  }

  return `${preferredPath}.${Date.now()}`;
}

function repairInvalidConfig(error) {
  if (!fs.existsSync(CONFIG_FILE_PATH)) {
    return false;
  }

  try {
    const backupPath = getBackupPath();
    fs.renameSync(CONFIG_FILE_PATH, backupPath);
    writeDefaultConfig();
    console.warn(
      "Invalid config.yml detected. Backed up invalid config to",
      backupPath,
      "and recreated default config at",
      CONFIG_FILE_PATH,
    );
    return true;
  } catch (repairError) {
    console.warn(
      "Failed to auto-repair invalid config.yml:",
      repairError.message,
      "(original error:",
      error.message,
      ")",
    );
    return false;
  }
}

function ensureConfigFile() {
  if (!fs.existsSync(CONFIG_DIR_PATH) && fs.existsSync(LEGACY_CONFIG_DIR_PATH)) {
    try {
      fs.renameSync(LEGACY_CONFIG_DIR_PATH, CONFIG_DIR_PATH);
      console.info("Migrated config directory to", CONFIG_DIR_PATH);
    } catch (error) {
      console.warn("Failed to migrate legacy config directory:", error.message);
    }
  }

  if (!fs.existsSync(CONFIG_DIR_PATH)) {
    fs.mkdirSync(CONFIG_DIR_PATH, { recursive: true });
  }

  if (!fs.existsSync(CONFIG_FILE_PATH)) {
    writeDefaultConfig();
    console.info("Created default config at", CONFIG_FILE_PATH);
  }
}

function loadConfig() {
  ensureConfigFile();

  try {
    const raw = fs.readFileSync(CONFIG_FILE_PATH, "utf8");
    const parsed = raw.trim() ? parse(raw) : {};
    const migrated = migrateLegacyConfig(parsed);
    syncConfigFile(migrated);
    cachedConfig = normalizeConfig(migrated);
    console.info("Loaded config from", CONFIG_FILE_PATH);
  } catch (error) {
    const repaired = repairInvalidConfig(error);

    if (repaired) {
      try {
        const raw = fs.readFileSync(CONFIG_FILE_PATH, "utf8");
        const parsed = raw.trim() ? parse(raw) : {};
        const migrated = migrateLegacyConfig(parsed);
        syncConfigFile(migrated);
        cachedConfig = normalizeConfig(migrated);
        console.info("Loaded repaired config from", CONFIG_FILE_PATH);
        return cachedConfig;
      } catch (reloadError) {
        console.warn(
          "Failed to load repaired config.yml, using defaults:",
          reloadError.message,
        );
      }
    } else {
      console.warn("Failed to load config.yml, using defaults:", error.message);
    }

    cachedConfig = normalizeConfig(defaultConfig);
  }

  return cachedConfig;
}

function initConfig() {
  return loadConfig();
}

function reloadConfig() {
  return loadConfig();
}

function getConfig() {
  return cachedConfig;
}

function getConfigPath() {
  return CONFIG_FILE_PATH;
}

function getConfigValue(pathKey, fallbackValue = undefined) {
  if (!pathKey) {
    return cachedConfig;
  }

  const parts = pathKey.split(".");
  let cursor = cachedConfig;

  for (const part of parts) {
    if (cursor && Object.prototype.hasOwnProperty.call(cursor, part)) {
      cursor = cursor[part];
    } else {
      return fallbackValue;
    }
  }

  return cursor;
}

function updateThemeMode(nextMode) {
  const allowedModes = new Set(["dark", "light", "auto", "custom"]);
  if (typeof nextMode !== "string") {
    return cachedConfig;
  }

  const normalizedMode = nextMode.trim().toLowerCase();
  if (!allowedModes.has(normalizedMode)) {
    return cachedConfig;
  }

  const rawConfig = readRawConfig();
  if (!isPlainObject(rawConfig.global)) {
    rawConfig.global = {};
  }

  if (!isPlainObject(rawConfig.global.theme)) {
    rawConfig.global.theme = {};
  }

  rawConfig.global.theme.mode = normalizedMode;
  if (Object.prototype.hasOwnProperty.call(rawConfig.global.theme, "name")) {
    delete rawConfig.global.theme.name;
  }

  fs.writeFileSync(CONFIG_FILE_PATH, serializeConfig(rawConfig), "utf8");
  return loadConfig();
}

function updateBrowserLanguage(nextLanguage) {
  if (typeof nextLanguage !== "string") {
    return cachedConfig;
  }

  const normalizedLanguage = nextLanguage.trim().toLowerCase();
  if (normalizedLanguage !== "en" && normalizedLanguage !== "fr") {
    return cachedConfig;
  }

  const rawConfig = readRawConfig();
  if (!isPlainObject(rawConfig.browser)) {
    rawConfig.browser = {};
  }

  if (rawConfig.browser.language === normalizedLanguage) {
    return cachedConfig;
  }

  rawConfig.browser.language = normalizedLanguage;
  fs.writeFileSync(CONFIG_FILE_PATH, serializeConfig(rawConfig), "utf8");
  return loadConfig();
}

function updateWindowState(nextWindowState = {}) {
  if (!isPlainObject(nextWindowState)) {
    return cachedConfig;
  }

  const width = Number.isFinite(nextWindowState.width) ? Math.floor(nextWindowState.width) : null;
  const height = Number.isFinite(nextWindowState.height) ? Math.floor(nextWindowState.height) : null;
  const isMaximized =
    typeof nextWindowState.is_maximized === "boolean" ? nextWindowState.is_maximized : null;
  const x = Number.isFinite(nextWindowState.x) ? Math.floor(nextWindowState.x) : null;
  const y = Number.isFinite(nextWindowState.y) ? Math.floor(nextWindowState.y) : null;

  const hasSize = width !== null && height !== null;
  const hasMaximized = isMaximized !== null;
  const hasPosition = x !== null && y !== null;

  if (!hasSize && !hasMaximized && !hasPosition) {
    return cachedConfig;
  }

  const rawConfig = readRawConfig();
  if (!isPlainObject(rawConfig.global)) {
    rawConfig.global = {};
  }

  if (!isPlainObject(rawConfig.global.window)) {
    rawConfig.global.window = {};
  }

  let changed = false;

  if (hasSize) {
    const nextWidth = Math.max(400, width);
    const nextHeight = Math.max(300, height);
    if (rawConfig.global.window.width !== nextWidth) {
      rawConfig.global.window.width = nextWidth;
      changed = true;
    }
    if (rawConfig.global.window.height !== nextHeight) {
      rawConfig.global.window.height = nextHeight;
      changed = true;
    }
  }

  if (hasMaximized && rawConfig.global.window.is_maximized !== isMaximized) {
    rawConfig.global.window.is_maximized = isMaximized;
    changed = true;
  }

  if (hasPosition) {
    if (rawConfig.global.window.x !== x) {
      rawConfig.global.window.x = x;
      changed = true;
    }
    if (rawConfig.global.window.y !== y) {
      rawConfig.global.window.y = y;
      changed = true;
    }
  }

  if (!changed) {
    return cachedConfig;
  }

  fs.writeFileSync(CONFIG_FILE_PATH, serializeConfig(rawConfig), "utf8");
  return loadConfig();
}

module.exports = {
  initConfig,
  reloadConfig,
  getConfig,
  getConfigPath,
  getConfigValue,
  updateThemeMode,
  updateBrowserLanguage,
  updateWindowState,
};
