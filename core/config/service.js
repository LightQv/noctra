const fs = require("fs");
const os = require("os");
const path = require("path");
const { parse, stringify } = require("yaml");
const { defaultConfig } = require("./defaults");
const { normalizeConfig } = require("./schema");

const CONFIG_DIR_PATH = path.join(os.homedir(), ".config", "vim-browser");
const CONFIG_FILE_PATH = path.join(CONFIG_DIR_PATH, "config.yml");

let cachedConfig = normalizeConfig(defaultConfig);

function ensureConfigFile() {
  if (!fs.existsSync(CONFIG_DIR_PATH)) {
    fs.mkdirSync(CONFIG_DIR_PATH, { recursive: true });
  }

  if (!fs.existsSync(CONFIG_FILE_PATH)) {
    fs.writeFileSync(CONFIG_FILE_PATH, stringify(defaultConfig), "utf8");
  }
}

function loadConfig() {
  ensureConfigFile();

  try {
    const raw = fs.readFileSync(CONFIG_FILE_PATH, "utf8");
    const parsed = raw.trim() ? parse(raw) : {};
    cachedConfig = normalizeConfig(parsed);
  } catch (error) {
    console.warn("Failed to load config.yml, using defaults:", error.message);
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
