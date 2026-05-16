const fs = require("fs");
const path = require("path");
const bookmarksService = require("./service");

function decodeHtmlEntities(input) {
  return String(input || "")
    .replaceAll(/&quot;/gi, '"')
    .replaceAll(/&#39;/gi, "'")
    .replaceAll(/&apos;/gi, "'")
    .replaceAll(/&amp;/gi, "&")
    .replaceAll(/&lt;/gi, "<")
    .replaceAll(/&gt;/gi, ">");
}

function stripTags(input) {
  return String(input || "").replaceAll(/<[^>]+>/g, " ").trim();
}

function normalizeImportUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== "http:" && protocol !== "https:") {
      return null;
    }
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

function parseAttribute(tag, attrName) {
  const source = String(tag || "");
  const escapedName = attrName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(
    new RegExp(`${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"),
  );
  if (!match) return "";
  return decodeHtmlEntities(match[1] || match[2] || match[3] || "").trim();
}

function createFolder(name) {
  return {
    type: "folder",
    id: bookmarksService.makeFolderId(),
    name: String(name || "").trim() || "folder",
    children: [],
  };
}

function createEntry(title, url) {
  return {
    type: "entry",
    id: bookmarksService.makeEntryId(),
    title: String(title || "").trim() || url,
    url,
  };
}

function parseNetscapeHtml(content) {
  const root = [];
  const rootHolder = { children: root };
  const stack = [rootHolder];
  const folderQueue = [];
  let skippedInvalid = 0;

  const tagRegex = /<[^>]+>/g;
  let match;
  while ((match = tagRegex.exec(content))) {
    const tag = match[0];
    const lower = tag.toLowerCase();

    if (lower.startsWith("<h3")) {
      const closeIdx = content.toLowerCase().indexOf("</h3>", tagRegex.lastIndex);
      if (closeIdx !== -1) {
        const folderText = content.slice(tagRegex.lastIndex, closeIdx);
        const folderName = decodeHtmlEntities(stripTags(folderText));
        const folder = createFolder(folderName);
        const parent = stack[stack.length - 1];
        parent.children.push(folder);
        folderQueue.push(folder);
        tagRegex.lastIndex = closeIdx + 5;
      }
      continue;
    }

    if (lower.startsWith("<a ") || lower.startsWith("<a>")) {
      const url = normalizeImportUrl(parseAttribute(tag, "href"));
      const closeIdx = content.toLowerCase().indexOf("</a>", tagRegex.lastIndex);
      if (closeIdx === -1) continue;
      const titleText = content.slice(tagRegex.lastIndex, closeIdx);
      const title = decodeHtmlEntities(stripTags(titleText));
      if (url) {
        const parent = stack[stack.length - 1];
        parent.children.push(createEntry(title, url));
      } else {
        skippedInvalid += 1;
      }
      tagRegex.lastIndex = closeIdx + 4;
      continue;
    }

    if (lower.startsWith("<dl")) {
      if (folderQueue.length > 0) {
        const nextFolder = folderQueue.shift();
        stack.push(nextFolder);
      }
      continue;
    }

    if (lower.startsWith("</dl")) {
      if (stack.length > 1) {
        stack.pop();
      }
    }
  }

  return { root, skippedInvalid };
}

function collectUrls(nodes, set) {
  for (const node of Array.isArray(nodes) ? nodes : []) {
    if (!node || typeof node !== "object") continue;
    if (node.type === "entry") {
      const normalized = normalizeImportUrl(node.url);
      if (normalized) set.add(normalized);
      continue;
    }
    if (node.type === "folder") {
      collectUrls(node.children, set);
    }
  }
}

function mergeImportedNodes(existingRoot, importedRoot) {
  const seenUrls = new Set();
  collectUrls(existingRoot, seenUrls);

  const summary = {
    imported: 0,
    skippedDuplicate: 0,
    skippedInvalid: 0,
    foldersCreated: 0,
  };

  function cloneNode(node) {
    if (!node || typeof node !== "object") return null;
    if (node.type === "entry") {
      const normalizedUrl = normalizeImportUrl(node.url);
      if (!normalizedUrl) {
        summary.skippedInvalid += 1;
        return null;
      }
      if (seenUrls.has(normalizedUrl)) {
        summary.skippedDuplicate += 1;
        return null;
      }
      seenUrls.add(normalizedUrl);
      summary.imported += 1;
      return createEntry(node.title, normalizedUrl);
    }
    if (node.type === "folder") {
      const children = [];
      for (const child of Array.isArray(node.children) ? node.children : []) {
        const cloned = cloneNode(child);
        if (cloned) children.push(cloned);
      }
      if (!children.length) return null;
      summary.foldersCreated += 1;
      return {
        type: "folder",
        id: bookmarksService.makeFolderId(),
        name: String(node.name || "").trim() || "folder",
        children,
      };
    }
    return null;
  }

  const toAppend = [];
  for (const node of Array.isArray(importedRoot) ? importedRoot : []) {
    const cloned = cloneNode(node);
    if (cloned) toAppend.push(cloned);
  }

  return { toAppend, summary };
}

function importFromNetscapeFile(filePath) {
  const extension = path.extname(String(filePath || "")).toLowerCase();
  if (extension !== ".html" && extension !== ".htm") {
    return {
      ok: false,
      code: "unsupported_extension",
      stage: "validate",
      reason: "Unsupported file extension",
    };
  }

  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    return {
      ok: false,
      code: "read_failed",
      stage: "read",
      reason: error instanceof Error ? error.message : "Unable to read file",
    };
  }

  const parsed = parseNetscapeHtml(raw);
  const importedRoot = Array.isArray(parsed?.root) ? parsed.root : [];
  const parseSkippedInvalid = Number.isFinite(parsed?.skippedInvalid)
    ? parsed.skippedInvalid
    : 0;
  if (!Array.isArray(importedRoot) || importedRoot.length === 0) {
    return {
      ok: true,
      code: "bookmarks_import_empty",
      summary: {
        imported: 0,
        skippedDuplicate: 0,
        skippedInvalid: parseSkippedInvalid,
        foldersCreated: 0,
      },
    };
  }

  const tree = bookmarksService.readBookmarksTree();
  const existingRoot = Array.isArray(tree.root) ? tree.root : [];
  const { toAppend, summary } = mergeImportedNodes(existingRoot, importedRoot);

  if (toAppend.length > 0) {
    bookmarksService.writeBookmarksTree({ root: [...existingRoot, ...toAppend] });
  }

  summary.skippedInvalid += parseSkippedInvalid;

  return {
    ok: true,
    code: summary.imported > 0 ? "bookmarks_import_success" : "bookmarks_import_empty",
    summary,
  };
}

module.exports = {
  importFromNetscapeFile,
  parseNetscapeHtml,
};
