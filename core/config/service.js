const fs = require("fs");
const os = require("os");
const path = require("path");
const { parse, stringify } = require("yaml");
const { defaultConfig } = require("./defaults");
const { normalizeConfig, normalizeConfigWithDiagnostics } = require("./schema");
const { ACTION_BUILDERS } = require("../../motions/actionBuilders");
const notificationsService = require("../notifications/service");

const CONFIG_DIR_PATH = path.join(os.homedir(), ".config", "noctra");
const CONFIG_FILE_PATH = path.join(CONFIG_DIR_PATH, "config.yml");
const CONFIG_POLICY =
  process.env.NOCTRA_CONFIG_POLICY === "strict" ? "strict" : "customizable";

let cachedConfig = normalizeConfig(defaultConfig);

function emitUnknownKeyWarning(unknownKeys = []) {
  if (!Array.isArray(unknownKeys) || unknownKeys.length === 0) {
    return;
  }

  const dedupedKeys = [...new Set(unknownKeys)];
  notificationsService.notify({
    severity: "warning",
    code: "config_unknown_keys_detected",
    message: "Unsupported config keys were ignored",
    source: "core.config",
    context: {
      path: CONFIG_FILE_PATH,
      unknownKeys: dedupedKeys,
    },
    persist: false,
  });
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mergeWithDefaults(defaultsNode, inputNode) {
  if (!isPlainObject(defaultsNode)) {
    return inputNode === undefined ? defaultsNode : inputNode;
  }

  const merged = {};
  const inputObject = isPlainObject(inputNode) ? inputNode : {};
  const keys = Object.keys(defaultsNode);

  for (const key of keys) {
    merged[key] = mergeWithDefaults(defaultsNode[key], inputObject[key]);
  }

  return merged;
}

function readRawConfig() {
  ensureConfigFile();
  const raw = fs.readFileSync(CONFIG_FILE_PATH, "utf8");
  const parsed = raw.trim() ? parse(raw) : {};
  return isPlainObject(parsed) ? parsed : {};
}

function addThemeComments(yamlText) {
  const lines = String(yamlText || "").split("\n");
  const output = [];
  let keymapCommentAdded = false;
  let inThemeSection = false;
  let inBrowserSection = false;
  let inOpeningBufferSection = false;
  const actionIds = Object.keys(ACTION_BUILDERS).sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: "base" }),
  );
  const actionIdLines = [];
  for (let index = 0; index < actionIds.length; index += 5) {
    actionIdLines.push(actionIds.slice(index, index + 5).join(", "));
  }

  for (const line of lines) {
    if (/^global:\s*$/.test(line) || /^keymap:\s*$/.test(line) || /^browser:\s*$/.test(line)) {
      inThemeSection = false;
      inOpeningBufferSection = false;
    }

    if (/^  [a-zA-Z0-9_]+:\s*$/.test(line)) {
      inThemeSection = false;
      inOpeningBufferSection = false;
      inBrowserSection = false;
    }

    if (!keymapCommentAdded && /^keymap:\s*$/.test(line)) {
      output.push(line);
      output.push("  # Keymap customization scope:");
      output.push("  # - keymap.normal: NORMAL mode sequence mappings (web + shared tree motions)");
      output.push("  # - keymap.mod: Ctrl+<key> mappings (web + shared tree motions)");
      output.push("  # - keymap.leader: leader tree mappings");
      output.push("  # Tree-only domain actions remain internal for now.");
      output.push("  # Mapping shape:");
      output.push("  # normal/mod: <keys>: \"<action_id>\"");
      output.push("  # Leader node shape:");
      output.push("  # - <key>: { label: \"...\", action: \"<action_id>\" }");
      output.push("  # - <key>: { label: \"...\", children: { ... } }");
      output.push("  # Valid action ids for leader actions:");
      for (const actionIdLine of actionIdLines) {
        output.push(`  #   ${actionIdLine}`);
      }
      keymapCommentAdded = true;
      continue;
    }

    if (/^  theme:\s*$/.test(line)) {
      output.push("  # Theme controls for Noctra shell and surfaces");
      inThemeSection = true;
      inOpeningBufferSection = false;
      inBrowserSection = false;
    }

    if (inThemeSection && /^    mode:\s*/.test(line)) {
      output.push("    # App theme mode: dark | light | auto | custom");
      output.push("    # custom uses global.theme.overrides");
    }

    if (inThemeSection && /^    content_mode:\s*/.test(line)) {
      output.push("    # Browser content mode: dark | light | auto | match");
      output.push("    # match follows app theme, but custom falls back to auto(system)");
    }

    if (inThemeSection && /^    overrides:\s*$/.test(line)) {
      output.push("    # Overrides are applied only when mode is custom");
      output.push("    # Supported override keys are prefilled below with dark defaults");
    }

    if (/^    telescope:\s*$/.test(line)) {
      output.push("    # Telescope overlay UI settings");
    }

    if (/^      prompt_position:\s*/.test(line)) {
      output.push("      # Prompt position: top | bottom");
    }

    if (/^browser:\s*$/.test(line)) {
      output.push("# Browser behavior");
      inBrowserSection = true;
      inThemeSection = false;
      inOpeningBufferSection = false;
    }

    if (inBrowserSection && /^  language:\s*/.test(line)) {
      output.push("  # Preferred website language: en | fr");
      output.push("  # Mapped to Accept-Language and known locale hints for requests");
    }

    if (inBrowserSection && /^  copy_selection_to_clipboard:\s*/.test(line)) {
      output.push("  # Auto-copy selected page text to clipboard on mouse selection");
    }

    if (inBrowserSection && /^  downloads:\s*$/.test(line)) {
      output.push("  # Download governance policy: deny | prompt | allow");
      output.push("  # prompt requires explicit user confirmation via native save dialog");
    }

    if (inBrowserSection && /^    allow_trusted_surfaces:\s*/.test(line)) {
      output.push("    # Trusted internal surfaces are blocked from downloads unless explicitly enabled");
    }

    if (inBrowserSection && /^    default_directory:\s*/.test(line)) {
      output.push("    # Optional default directory for prompt/allow policies (null uses OS downloads)");
    }

    if (inBrowserSection && /^    auto_open:\s*/.test(line)) {
      output.push("    # Auto-open downloaded files after completion (not recommended)");
    }

    if (/^  opening_buffer:\s*$/.test(line)) {
      output.push("  # Startup page mode");
      inOpeningBufferSection = true;
      inThemeSection = false;
      inBrowserSection = false;
    }

    if (inOpeningBufferSection && /^    mode:\s*/.test(line)) {
      output.push("    # Opening mode: blank | url | dashboard");
      output.push("    # url uses global.opening_buffer.url");
    }

    output.push(line);
  }

  return output.join("\n");
}

function serializeConfig(configObject) {
  return addThemeComments(stringify(configObject));
}

function syncConfigFile(rawConfig) {
  const merged = mergeWithDefaults(defaultConfig, rawConfig);
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
    notificationsService.notify({
      severity: "warning",
      code: "config_invalid_auto_repaired",
      message: "Invalid config.yml detected. Recreated default file and backed up previous file.",
      source: "core.config",
      context: { backupPath, configPath: CONFIG_FILE_PATH },
    });
    return true;
  } catch (repairError) {
    notificationsService.notify({
      severity: "error",
      code: "config_auto_repair_failed",
      message: "Failed to auto-repair invalid config.yml",
      source: "core.config",
      context: { repairError: repairError.message, originalError: error.message },
    });
    return false;
  }
}

function ensureConfigFile() {
  if (!fs.existsSync(CONFIG_DIR_PATH)) {
    fs.mkdirSync(CONFIG_DIR_PATH, { recursive: true });
  }

  if (!fs.existsSync(CONFIG_FILE_PATH)) {
    writeDefaultConfig();
    notificationsService.notify({
      severity: "info",
      code: "config_default_created",
      message: "Created default config file",
      source: "core.config",
      context: { path: CONFIG_FILE_PATH },
      toast: false,
      persist: false,
    });
  }
}

function loadConfig() {
  ensureConfigFile();

  if (CONFIG_POLICY === "strict") {
    const strictText = serializeConfig(defaultConfig);
    try {
      const currentText = fs.readFileSync(CONFIG_FILE_PATH, "utf8");
      if (currentText !== strictText) {
        fs.writeFileSync(CONFIG_FILE_PATH, strictText, "utf8");
      }
    } catch {
      fs.writeFileSync(CONFIG_FILE_PATH, strictText, "utf8");
    }

    cachedConfig = normalizeConfig(defaultConfig);
    notificationsService.notify({
      severity: "info",
      code: "config_loaded_strict",
      message: "Loaded config in strict policy",
      source: "core.config",
      context: { path: CONFIG_FILE_PATH },
      toast: false,
      persist: false,
    });
    return cachedConfig;
  }

  try {
    const raw = fs.readFileSync(CONFIG_FILE_PATH, "utf8");
    const parsed = raw.trim() ? parse(raw) : {};
    const nextRawConfig = isPlainObject(parsed) ? parsed : {};
    syncConfigFile(nextRawConfig);
    const normalized = normalizeConfigWithDiagnostics(nextRawConfig);
    cachedConfig = normalized.config;
    emitUnknownKeyWarning(normalized.diagnostics.unknownKeys);
    notificationsService.notify({
      severity: "info",
      code: "config_loaded",
      message: "Loaded config",
      source: "core.config",
      context: { path: CONFIG_FILE_PATH },
      toast: false,
      persist: false,
    });
  } catch (error) {
    const repaired = repairInvalidConfig(error);

    if (repaired) {
      try {
        const raw = fs.readFileSync(CONFIG_FILE_PATH, "utf8");
        const parsed = raw.trim() ? parse(raw) : {};
        const nextRawConfig = isPlainObject(parsed) ? parsed : {};
        syncConfigFile(nextRawConfig);
        const normalized = normalizeConfigWithDiagnostics(nextRawConfig);
        cachedConfig = normalized.config;
        emitUnknownKeyWarning(normalized.diagnostics.unknownKeys);
        notificationsService.notify({
          severity: "warning",
          code: "config_loaded_repaired",
          message: "Loaded repaired config from disk",
          source: "core.config",
          context: { path: CONFIG_FILE_PATH },
          persist: false,
        });
        return cachedConfig;
      } catch (reloadError) {
        notificationsService.notify({
          severity: "error",
          code: "config_repaired_load_failed",
          message: "Failed to load repaired config.yml, using defaults",
          source: "core.config",
          context: { error: reloadError.message },
        });
      }
    } else {
      notificationsService.notify({
        severity: "error",
        code: "config_load_failed_defaults",
        message: "Failed to load config.yml, using defaults",
        source: "core.config",
        context: { error: error.message },
      });
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
  if (CONFIG_POLICY === "strict") {
    return cachedConfig;
  }

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

  fs.writeFileSync(CONFIG_FILE_PATH, serializeConfig(rawConfig), "utf8");
  return loadConfig();
}

function updateBrowserLanguage(nextLanguage) {
  if (CONFIG_POLICY === "strict") {
    return cachedConfig;
  }

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

function updateCopySelectionToClipboard(nextEnabled) {
  if (CONFIG_POLICY === "strict") {
    return cachedConfig;
  }

  if (typeof nextEnabled !== "boolean") {
    return cachedConfig;
  }

  const rawConfig = readRawConfig();
  if (!isPlainObject(rawConfig.browser)) {
    rawConfig.browser = {};
  }

  if (rawConfig.browser.copy_selection_to_clipboard === nextEnabled) {
    return cachedConfig;
  }

  rawConfig.browser.copy_selection_to_clipboard = nextEnabled;
  fs.writeFileSync(CONFIG_FILE_PATH, serializeConfig(rawConfig), "utf8");
  return loadConfig();
}

function updateWindowState(nextWindowState = {}) {
  if (CONFIG_POLICY === "strict") {
    return cachedConfig;
  }

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
  updateCopySelectionToClipboard,
  updateWindowState,
};
