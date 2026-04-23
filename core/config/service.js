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
    cachedConfig = normalizeConfig(parsed);
    console.info("Loaded config from", CONFIG_FILE_PATH);
  } catch (error) {
    const repaired = repairInvalidConfig(error);

    if (repaired) {
      try {
        const raw = fs.readFileSync(CONFIG_FILE_PATH, "utf8");
        const parsed = raw.trim() ? parse(raw) : {};
        cachedConfig = normalizeConfig(parsed);
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

module.exports = {
  initConfig,
  reloadConfig,
  getConfig,
  getConfigPath,
  getConfigValue,
};
