const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");

const {
  searchRuntimeStart,
  searchRuntimeClear,
  sendSearchRuntimeCommand,
} = require("../../core/adapters/platform/webContentsActions");

function createStyle() {
  return {
    values: {},
    setProperty(name, value) {
      this.values[name] = value;
    },
  };
}

function createElement(tagName) {
  return {
    tagName,
    id: "",
    attributes: {},
    style: createStyle(),
    children: [],
    parentNode: null,
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
    },
    removeChild(child) {
      const index = this.children.indexOf(child);
      if (index >= 0) {
        this.children.splice(index, 1);
        child.parentNode = null;
      }
    },
  };
}

function createDomContext() {
  const body = createElement("body");
  const documentElement = createElement("html");
  const document = {
    body,
    documentElement,
    createElement,
  };
  const context = { window: {}, document };
  return { context, document };
}

function createWebContentsWithContext(context) {
  return {
    isDestroyed() {
      return false;
    },
    on() {},
    executeJavaScript(script) {
      return Promise.resolve(vm.runInNewContext(script, context));
    },
  };
}

test("search runtime start renders overlay and theme-update restyles it", async () => {
  const { context, document } = createDomContext();
  const webContents = createWebContentsWithContext(context);

  await searchRuntimeStart(webContents, "term");
  assert.equal(document.body.children.length, 1);

  const root = document.body.children[0];
  assert.equal(root.id, "noctra-search-overlay-root");
  assert.equal(root.style.values["--search-main"], "#89dceb");
  assert.equal(root.style.values["--search-active-fg"], "#10151d");

  await sendSearchRuntimeCommand(webContents, "theme-update", {
    mainColor: "#2f6f46",
    searchActiveTextColor: "#f7f3e9",
    searchPassiveTextColor: "#efe7d6",
  });
  assert.equal(root.style.values["--search-main"], "#2f6f46");
  assert.equal(root.style.values["--search-active-border"], "#2f6f46");
  assert.equal(root.style.values["--search-active-fg"], "#f7f3e9");
  assert.equal(root.style.values["--search-passive-fg"], "#efe7d6");
});

test("search runtime clear removes overlay artifacts", async () => {
  const { context, document } = createDomContext();
  const webContents = createWebContentsWithContext(context);

  await searchRuntimeStart(webContents, "term");
  assert.equal(document.body.children.length, 1);

  await searchRuntimeClear(webContents);
  assert.equal(document.body.children.length, 0);
});
