const fs = require("fs");
const path = require("path");
const { parse, stringify } = require("yaml");
const { resolveUserPath } = require("../storage/path");

const DEFAULT_NOTIFICATIONS_FILE = "~/.config/noctra/notifications.yml";

function getNotificationsFilePath() {
  let configuredPath = DEFAULT_NOTIFICATIONS_FILE;
  try {
    const { getConfigValue } = require("../config/service");
    configuredPath = getConfigValue("global.storage.notifications_file", DEFAULT_NOTIFICATIONS_FILE);
  } catch {
    configuredPath = DEFAULT_NOTIFICATIONS_FILE;
  }
  return resolveUserPath(
    configuredPath,
    DEFAULT_NOTIFICATIONS_FILE,
  );
}

function ensureNotificationsFile() {
  const filePath = getNotificationsFilePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "[]\n", "utf8");
  }
  return filePath;
}

function readNotifications() {
  const filePath = ensureNotificationsFile();
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = raw.trim() ? parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeNotifications(entries) {
  const filePath = ensureNotificationsFile();
  const payload = Array.isArray(entries) ? entries : [];
  const yaml = stringify(payload);
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, yaml, "utf8");
  fs.renameSync(tmpPath, filePath);
}

function appendNotification(entry, limit = 200) {
  const entries = readNotifications();
  entries.unshift(entry);
  if (entries.length > limit) {
    entries.length = limit;
  }
  writeNotifications(entries);
}

module.exports = {
  getNotificationsFilePath,
  ensureNotificationsFile,
  readNotifications,
  writeNotifications,
  appendNotification,
};
