const test = require("node:test");
const assert = require("node:assert/strict");

const configService = require("../../core/config/service");
const { parseCommand } = require("../../core/commandParser");
const { INTENTS } = require("../../core/intents");

test("parseCommand supports :ecosia search command", () => {
  const intent = parseCommand("ecosia privacy search");
  assert.deepEqual(intent, {
    type: INTENTS.SEARCH_WEB,
    engine: "ecosia",
    query: "privacy search",
  });
});

test("parseCommand uses configured fallback engine for :open non-url", () => {
  const originalGetConfigValue = configService.getConfigValue;
  configService.getConfigValue = (pathKey, fallbackValue) => {
    if (pathKey === "browser.default_search_engine") {
      return "google";
    }
    return originalGetConfigValue(pathKey, fallbackValue);
  };

  try {
    const intent = parseCommand("open hello world");
    assert.equal(intent.type, INTENTS.OPEN_URL);
    assert.equal(
      intent.url,
      "https://www.google.com/search?q=hello%20world",
    );
  } finally {
    configService.getConfigValue = originalGetConfigValue;
  }
});

test("parseCommand uses configured fallback engine for :tab non-url", () => {
  const originalGetConfigValue = configService.getConfigValue;
  configService.getConfigValue = (pathKey, fallbackValue) => {
    if (pathKey === "browser.default_search_engine") {
      return "ecosia";
    }
    return originalGetConfigValue(pathKey, fallbackValue);
  };

  try {
    const intent = parseCommand("tab planets");
    assert.deepEqual(intent, {
      type: INTENTS.NEW_BUFFER,
      url: "https://www.ecosia.org/search?q=planets",
    });
  } finally {
    configService.getConfigValue = originalGetConfigValue;
  }
});

test("parseCommand supports :lang system and bang variant", () => {
  assert.deepEqual(parseCommand("lang system"), {
    type: INTENTS.SET_BROWSER_LANGUAGE,
    language: "system",
    reload: false,
  });

  assert.deepEqual(parseCommand("lang system!"), {
    type: INTENTS.SET_BROWSER_LANGUAGE,
    language: "system",
    reload: true,
  });
});
