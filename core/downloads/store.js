const fs = require("fs");
const path = require("path");
const { parse, stringify } = require("yaml");
const { resolveUserPath } = require("../storage/path");

const DEFAULT_DOWNLOADS_FILE = "~/.config/noctra/downloads.yml";

function getDownloadsFilePath() {
  let configuredPath = DEFAULT_DOWNLOADS_FILE;
  try {
    const { getConfigValue } = require("../config/service");
    configuredPath = getConfigValue(
      "global.storage.downloads_file",
      DEFAULT_DOWNLOADS_FILE,
    );
  } catch {
    configuredPath = DEFAULT_DOWNLOADS_FILE;
  }
  return resolveUserPath(configuredPath, DEFAULT_DOWNLOADS_FILE);
}

function ensureDownloadsFile() {
  const filePath = getDownloadsFilePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "[]\n", "utf8");
  }
  return filePath;
}

function readDownloads() {
  const filePath = ensureDownloadsFile();
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = raw.trim() ? parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeDownloads(entries) {
  const filePath = ensureDownloadsFile();
  const payload = Array.isArray(entries) ? entries : [];
  const yaml = stringify(payload);
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, yaml, "utf8");
  fs.renameSync(tmpPath, filePath);
}

function appendDownload(entry, limit = 200) {
  const entries = readDownloads();
  entries.unshift(entry);
  if (entries.length > limit) {
    entries.length = limit;
  }
  writeDownloads(entries);
}

function removeDownloadsByIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return;
  const entries = readDownloads();
  const idSet = new Set(ids);
  const filtered = entries.filter((e) => !idSet.has(e.id));
  writeDownloads(filtered);
}

module.exports = {
  getDownloadsFilePath,
  ensureDownloadsFile,
  readDownloads,
  writeDownloads,
  appendDownload,
  removeDownloadsByIds,
};
