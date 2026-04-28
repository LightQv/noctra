const fs = require("fs");
const path = require("path");
const { parse, stringify } = require("yaml");
const { getConfigValue } = require("../config/service");
const { resolveUserPath } = require("../storage/path");

function getHistoryFilePath() {
  return resolveUserPath(
    getConfigValue("global.storage.history_file", "~/.config/noctra/history.yml"),
    "~/.config/noctra/history.yml",
  );
}

function ensureHistoryFile() {
  const filePath = getHistoryFilePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "{}\n", "utf8");
  }
  return filePath;
}

function readHistoryObject() {
  const filePath = ensureHistoryFile();
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = raw.trim() ? parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function sortDateKeysDesc(keys) {
  return keys.slice().sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
}

function writeHistoryObject(nextObject) {
  const filePath = ensureHistoryFile();
  const ordered = {};
  for (const key of sortDateKeysDesc(Object.keys(nextObject || {}))) {
    const value = nextObject[key];
    if (Array.isArray(value)) {
      ordered[key] = value;
    }
  }
  const yaml = stringify(ordered);
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, yaml, "utf8");
  fs.renameSync(tmpPath, filePath);
}

function makeEntryId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getDateKeyFromTimestamp(timestampMs) {
  const d = new Date(timestampMs);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function recordVisit({ url, title, timestampMs = Date.now(), timestampIso = null } = {}) {
  if (typeof url !== "string" || !url.trim()) {
    return;
  }
  const safeUrl = url.trim();
  if (safeUrl.startsWith("about:") || safeUrl.startsWith("data:") || safeUrl.startsWith("noctra://")) {
    return;
  }

  const history = readHistoryObject();
  const dateKey = getDateKeyFromTimestamp(timestampMs);
  const entries = Array.isArray(history[dateKey]) ? history[dateKey] : [];
  const entry = {
    id: makeEntryId(),
    url: safeUrl,
    title: typeof title === "string" && title.trim() ? title.trim() : safeUrl,
    timestamp_iso: timestampIso || new Date(timestampMs).toISOString(),
    timestamp_ms: Number.isFinite(timestampMs) ? Math.floor(timestampMs) : Date.now(),
  };
  entries.unshift(entry);
  history[dateKey] = entries;
  writeHistoryObject(history);
}

function readHistoryTree() {
  const history = readHistoryObject();
  return sortDateKeysDesc(Object.keys(history)).map((dateKey) => ({
    key: dateKey,
    entries: (Array.isArray(history[dateKey]) ? history[dateKey] : []).map((entry) => ({
      id: String(entry.id || ""),
      url: String(entry.url || ""),
      title: String(entry.title || entry.url || ""),
      timestampIso: String(entry.timestamp_iso || ""),
      timestampMs: Number.isFinite(entry.timestamp_ms) ? entry.timestamp_ms : null,
    })),
  }));
}

function deleteEntry(dateKey, entryId) {
  const history = readHistoryObject();
  if (!Array.isArray(history[dateKey])) return;
  history[dateKey] = history[dateKey].filter((entry) => String(entry.id || "") !== String(entryId));
  if (history[dateKey].length === 0) {
    delete history[dateKey];
  }
  writeHistoryObject(history);
}

function deleteDate(dateKey) {
  const history = readHistoryObject();
  delete history[dateKey];
  writeHistoryObject(history);
}

function deleteAll() {
  writeHistoryObject({});
}

function deleteToday() {
  deleteDate(getDateKeyFromTimestamp(Date.now()));
}

module.exports = {
  getHistoryFilePath,
  recordVisit,
  readHistoryTree,
  deleteEntry,
  deleteDate,
  deleteAll,
  deleteToday,
};
