const fs = require("fs");
const path = require("path");
const { parse, stringify } = require("yaml");
const { getConfigValue } = require("../config/service");
const { resolveUserPath } = require("../storage/path");

function makeNodeId(prefix = "n") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeEntryId() {
  return makeNodeId("e");
}

function makeFolderId() {
  return makeNodeId("f");
}

function getSeedFavoritesTree() {
  return {
    root: [
      {
        type: "folder",
        id: makeFolderId(),
        name: "default",
        children: [
          {
            type: "entry",
            id: makeEntryId(),
            title: "Noctra - Github",
            url: "https://github.com/LightQv/noctra",
          },
        ],
      },
    ],
  };
}

function getFavoritesFilePath() {
  return resolveUserPath(
    getConfigValue("global.storage.favorites_file", "~/.config/noctra/favorites.yml"),
    "~/.config/noctra/favorites.yml",
  );
}

function writeYamlObject(filePath, payload) {
  const yaml = stringify(payload && typeof payload === "object" ? payload : { root: [] });
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, yaml, "utf8");
  fs.renameSync(tmpPath, filePath);
}

function ensureFavoritesFile() {
  const filePath = getFavoritesFilePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    writeYamlObject(filePath, getSeedFavoritesTree());
  }
  return filePath;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeEntry(node) {
  if (!isPlainObject(node)) return null;
  const url = String(node.url || "").trim();
  if (!url) return null;
  return {
    type: "entry",
    id: String(node.id || makeEntryId()),
    title: String(node.title || url).trim() || url,
    url,
  };
}

function normalizeFolder(node) {
  if (!isPlainObject(node)) return null;
  const name = String(node.name || "").trim();
  if (!name) return null;
  return {
    type: "folder",
    id: String(node.id || makeFolderId()),
    name,
    children: normalizeNodeList(node.children),
  };
}

function normalizeNode(node) {
  if (!isPlainObject(node)) return null;
  if (node.type === "entry") return normalizeEntry(node);
  if (node.type === "folder") return normalizeFolder(node);
  return null;
}

function normalizeNodeList(nodes) {
  if (!Array.isArray(nodes)) return [];
  const normalized = [];
  for (const node of nodes) {
    const item = normalizeNode(node);
    if (item) normalized.push(item);
  }
  return normalized;
}

function normalizeTree(tree) {
  if (!isPlainObject(tree)) return { root: [] };
  return { root: normalizeNodeList(tree.root) };
}

function readFavoritesTree() {
  const filePath = ensureFavoritesFile();
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = raw.trim() ? parse(raw) : null;
    const normalized = normalizeTree(parsed);
    if (!normalized.root.length) {
      const seeded = getSeedFavoritesTree();
      writeYamlObject(filePath, seeded);
      return normalizeTree(seeded);
    }
    return normalized;
  } catch {
    const seeded = getSeedFavoritesTree();
    writeYamlObject(filePath, seeded);
    return normalizeTree(seeded);
  }
}

function writeFavoritesTree(nextTree) {
  const filePath = ensureFavoritesFile();
  writeYamlObject(filePath, normalizeTree(nextTree));
}

function deleteAll() {
  writeFavoritesTree({ root: [] });
}

module.exports = {
  getFavoritesFilePath,
  makeEntryId,
  makeFolderId,
  readFavoritesTree,
  writeFavoritesTree,
  deleteAll,
};
