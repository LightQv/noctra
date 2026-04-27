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

function syncConfigFile(rawConfig) {
  const migratedRaw = migrateLegacyConfig(rawConfig);
  const merged = mergeWithDefaults(defaultConfig, migratedRaw);
  const nextText = stringify(merged);

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
  fs.writeFileSync(CONFIG_FILE_PATH, stringify(defaultConfig), "utf8");
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

  fs.writeFileSync(CONFIG_FILE_PATH, stringify(rawConfig), "utf8");
  return loadConfig();
}

module.exports = {
  initConfig,
  reloadConfig,
  getConfig,
  getConfigPath,
  getConfigValue,
  updateThemeMode,
};
