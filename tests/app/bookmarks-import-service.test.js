const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const bookmarksService = require("../../core/bookmarks/service");
const {
  importFromNetscapeFile,
  parseNetscapeHtml,
} = require("../../core/bookmarks/importService");

function createTempHtmlFile(contents) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "noctra-import-"));
  const filePath = path.join(dir, "bookmarks.html");
  fs.writeFileSync(filePath, contents, "utf8");
  return filePath;
}

test("parseNetscapeHtml keeps folder hierarchy", () => {
  const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><H3>Dev</H3>
  <DL><p>
    <DT><A HREF="https://github.com">GitHub</A>
    <DT><H3>Docs</H3>
    <DL><p>
      <DT><A HREF="https://developer.mozilla.org">MDN</A>
    </DL><p>
  </DL><p>
</DL><p>`;

  const parsed = parseNetscapeHtml(html);
  const nodes = parsed.root;
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].type, "folder");
  assert.equal(nodes[0].name, "Dev");
  assert.equal(nodes[0].children.length, 2);
  assert.equal(nodes[0].children[0].type, "entry");
  assert.equal(nodes[0].children[1].type, "folder");
  assert.equal(parsed.skippedInvalid, 0);
});

test("importFromNetscapeFile appends root-level nodes and dedupes globally", () => {
  const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><A HREF="https://example.com">Example duplicate</A>
  <DT><A HREF="javascript:alert(1)">Bad</A>
  <DT><H3>Imported Folder</H3>
  <DL><p>
    <DT><A HREF="https://newsite.test">New Site</A>
  </DL><p>
</DL><p>`;

  const filePath = createTempHtmlFile(html);
  const original = {
    readBookmarksTree: bookmarksService.readBookmarksTree,
    writeBookmarksTree: bookmarksService.writeBookmarksTree,
    makeFolderId: bookmarksService.makeFolderId,
    makeEntryId: bookmarksService.makeEntryId,
  };

  const writes = [];
  let folderCounter = 0;
  let entryCounter = 0;
  const existingRoot = [
    {
      type: "entry",
      id: "existing-entry",
      title: "Existing",
      url: "https://example.com/",
    },
  ];

  bookmarksService.readBookmarksTree = () => ({ root: existingRoot });
  bookmarksService.writeBookmarksTree = (tree) => writes.push(tree);
  bookmarksService.makeFolderId = () => `folder-${(folderCounter += 1)}`;
  bookmarksService.makeEntryId = () => `entry-${(entryCounter += 1)}`;

  try {
    const result = importFromNetscapeFile(filePath);
    assert.equal(result.ok, true);
    assert.equal(result.code, "bookmarks_import_success");
    assert.equal(result.summary.imported, 1);
    assert.equal(result.summary.skippedDuplicate, 1);
    assert.equal(result.summary.skippedInvalid, 1);
    assert.equal(result.summary.foldersCreated, 1);
    assert.equal(writes.length, 1);

    const writtenRoot = writes[0].root;
    assert.equal(writtenRoot.length, 2);
    assert.equal(writtenRoot[0].id, "existing-entry");
    assert.equal(writtenRoot[1].type, "folder");
    assert.equal(writtenRoot[1].name, "Imported Folder");
    assert.equal(writtenRoot[1].children[0].url, "https://newsite.test/");
  } finally {
    bookmarksService.readBookmarksTree = original.readBookmarksTree;
    bookmarksService.writeBookmarksTree = original.writeBookmarksTree;
    bookmarksService.makeFolderId = original.makeFolderId;
    bookmarksService.makeEntryId = original.makeEntryId;
  }
});

test("importFromNetscapeFile rejects unsupported file extension", () => {
  const result = importFromNetscapeFile("/tmp/bookmarks.json");
  assert.equal(result.ok, false);
  assert.equal(result.code, "unsupported_extension");
});
