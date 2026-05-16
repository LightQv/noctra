const test = require("node:test");
const assert = require("node:assert/strict");

const { resolveFocusOwner } = require("../../core/focusResolver");
const {
  resolveSemanticContext,
} = require("../../core/semanticContextResolver");

test("focus owner priority prefers modal and panel surfaces", () => {
  assert.equal(
    resolveFocusOwner({ bookmarkModalActive: true, commandMode: true }),
    "BOOKMARK_MODAL",
  );
  assert.equal(
    resolveFocusOwner({ telescopeActive: true, sidepanelFocused: true }),
    "TELESCOPE",
  );
  assert.equal(
    resolveFocusOwner({ sidepanelFocused: true, urllineEditing: true }),
    "TREE",
  );
  assert.equal(
    resolveFocusOwner({ urllineEditing: true, commandMode: true }),
    "URLLINE",
  );
});

test("semantic context resolves tree kind and editor/web fallback", () => {
  const treeContext = resolveSemanticContext({
    sidepanelController: {
      isFocused: () => true,
      getTreeKind: () => "bookmarks",
    },
  });
  assert.equal(treeContext, "bookmarks");

  const unknownTreeContext = resolveSemanticContext({
    sidepanelController: { isFocused: () => true, getTreeKind: () => "custom" },
  });
  assert.equal(unknownTreeContext, "history");

  const editorContext = resolveSemanticContext({
    state: { mode: "INSERT", editorFocus: true },
    buffers: { getActive: () => ({ isEditable: true }) },
  });
  assert.equal(editorContext, "editor");

  const webContext = resolveSemanticContext({
    state: { mode: "NORMAL", editorFocus: false },
    buffers: { getActive: () => ({ isEditable: false }) },
  });
  assert.equal(webContext, "web");
});
