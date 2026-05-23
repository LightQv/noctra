const test = require("node:test");
const assert = require("node:assert/strict");

const { createBufferManager } = require("../../browser/manager");
const { resolveTheme } = require("../../ui/theme");

test("refreshCatBuffers updates cat buffer in split right pane", () => {
  const manager = createBufferManager();
  let loadCalls = 0;
  const rightPaneBuffer = {
    url: "noctra://cat",
    virtualUrl: "noctra://cat",
    lastFailedNavigation: null,
    loadVirtualDocument(document) {
      loadCalls += 1;
      assert.equal(document.url, "noctra://cat");
      assert.equal(document.title, "Cat");
      assert.match(document.html, /<h1>Standby<\/h1>/);
    },
  };

  manager.split.rightPaneBuffer = rightPaneBuffer;
  manager.resolveOpeningBufferThemeContext = () => ({
    colorScheme: "dark",
    theme: resolveTheme({ mode: "dark" }),
  });
  manager.refreshCatBuffers();

  assert.equal(loadCalls, 1);
});
