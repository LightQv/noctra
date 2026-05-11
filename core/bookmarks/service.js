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

function getSeedBookmarksTree() {
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

function getBookmarksFilePath() {
  return resolveUserPath(
    getConfigValue(
      "global.storage.bookmarks_file",
      "~/.config/noctra/bookmarks.yml",
    ),
    "~/.config/noctra/bookmarks.yml",
  );
}

function writeYamlObject(filePath, payload) {
  const yaml = stringify(
    payload && typeof payload === "object" ? payload : { root: [] },
  );
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, yaml, "utf8");
  fs.renameSync(tmpPath, filePath);
}

function ensureBookmarksFile() {
  const filePath = getBookmarksFilePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    writeYamlObject(filePath, getSeedBookmarksTree());
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

function readBookmarksTree() {
  const filePath = ensureBookmarksFile();
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = raw.trim() ? parse(raw) : null;
    const normalized = normalizeTree(parsed);
    if (!normalized.root.length) {
      const seeded = getSeedBookmarksTree();
      writeYamlObject(filePath, seeded);
      return normalizeTree(seeded);
    }
    return normalized;
  } catch {
    const seeded = getSeedBookmarksTree();
    writeYamlObject(filePath, seeded);
    return normalizeTree(seeded);
  }
}

function writeBookmarksTree(nextTree) {
  const filePath = ensureBookmarksFile();
  writeYamlObject(filePath, normalizeTree(nextTree));
}

function appendEntryAtRoot(entry = {}) {
  const tree = readBookmarksTree();
  const nextRoot = Array.isArray(tree.root) ? tree.root : [];
  const normalized = normalizeEntry(entry);
  if (!normalized) return null;
  const existing = nextRoot.find(
    (node) =>
      node &&
      node.type === "entry" &&
      String(node.url || "").trim() === normalized.url,
  );
  if (existing) {
    return { status: "duplicate", existing };
  }
  nextRoot.push(normalized);
  writeBookmarksTree({ root: nextRoot });
  return { status: "inserted", entry: normalized };
}

function getFolderChildrenByPath(rootNodes, folderIdPath = []) {
  let cursor = Array.isArray(rootNodes) ? rootNodes : [];
  for (const folderId of folderIdPath) {
    const next = cursor.find(
      (node) =>
        node && node.type === "folder" && String(node.id) === String(folderId),
    );
    if (!next) return null;
    if (!Array.isArray(next.children)) {
      next.children = [];
    }
    cursor = next.children;
  }
  return cursor;
}

function appendEntryAtFolderPath(folderIdPath = [], entry = {}) {
  if (!Array.isArray(folderIdPath)) return null;
  const tree = readBookmarksTree();
  const normalized = normalizeEntry(entry);
  if (!normalized) return null;
  const children = getFolderChildrenByPath(tree.root, folderIdPath);
  if (!children) return null;
  const existing = children.find(
    (node) =>
      node &&
      node.type === "entry" &&
      String(node.url || "").trim() === normalized.url,
  );
  if (existing) {
    return { status: "duplicate", existing };
  }
  children.push(normalized);
  writeBookmarksTree({ root: tree.root });
  return { status: "inserted", entry: normalized };
}

function hasEntryUrlAtFolderPath(folderIdPath = [], url = "") {
  if (!Array.isArray(folderIdPath)) return false;
  const normalizedUrl = String(url || "").trim();
  if (!normalizedUrl) return false;
  const tree = readBookmarksTree();
  const children = getFolderChildrenByPath(tree.root, folderIdPath);
  if (!children) return false;
  return children.some(
    (node) =>
      node &&
      node.type === "entry" &&
      String(node.url || "").trim() === normalizedUrl,
  );
}

function listFolderChildrenByPath(folderIdPath = []) {
  if (!Array.isArray(folderIdPath)) return [];
  const tree = readBookmarksTree();
  const children = getFolderChildrenByPath(tree.root, folderIdPath);
  if (!children) return [];
  return children.filter((node) => node && node.type === "folder");
}

function deleteAll() {
  writeBookmarksTree({ root: [] });
}

module.exports = {
  getBookmarksFilePath,
  makeEntryId,
  makeFolderId,
  readBookmarksTree,
  writeBookmarksTree,
  appendEntryAtRoot,
  appendEntryAtFolderPath,
  hasEntryUrlAtFolderPath,
  listFolderChildrenByPath,
  deleteAll,
};
