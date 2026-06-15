const test = require("node:test");
const assert = require("node:assert/strict");

const { isBookmarkableBuffer } = require("../../core/bookmarks/eligibility");

test("bookmark eligibility rejects extension URLs even on web buffers", () => {
  assert.equal(
    isBookmarkableBuffer({
      kind: "web",
      url: "chrome-extension://nngceckbapebfimnlniiiahkandclblb/options.html",
    }),
    false,
  );
  assert.equal(
    isBookmarkableBuffer({ kind: "web", url: "crx://abc/index.html" }),
    false,
  );
});

test("bookmark eligibility allows normal web URLs", () => {
  assert.equal(
    isBookmarkableBuffer({ kind: "web", url: "https://example.test" }),
    true,
  );
});
