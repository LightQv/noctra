const fs = require("fs");
const path = require("path");
const { parse, stringify } = require("yaml");
const { getConfigValue } = require("../config/service");
const { resolveUserPath } = require("../storage/path");

function getSessionsFilePath() {
  return resolveUserPath(
    getConfigValue("global.storage.sessions_file", "~/.config/noctra/sessions.yml"),
    "~/.config/noctra/sessions.yml",
  );
}

function ensureSessionsFile() {
  const filePath = getSessionsFilePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "{}\n", "utf8");
  }
  return filePath;
}

function readSessionSnapshot() {
  const filePath = ensureSessionsFile();
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = raw.trim() ? parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writeSessionSnapshot(snapshot) {
  const filePath = ensureSessionsFile();
  const payload = snapshot && typeof snapshot === "object" ? snapshot : {};
  const yaml = stringify(payload);
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, yaml, "utf8");
  fs.renameSync(tmpPath, filePath);
}

module.exports = {
  getSessionsFilePath,
  readSessionSnapshot,
  writeSessionSnapshot,
};
