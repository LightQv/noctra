const {
  buildSearchRuntimeBootstrapScript,
  buildSearchRuntimeCommandScript,
} = require("../../../browser/searchRuntime");
const { SEARCH_RUNTIME_ACTIONS } = require("../../search/runtimeActions");

let searchRuntimeRequestSequence = 0;
const searchRuntimeReadyByWebContents = new WeakMap();
const searchRuntimeLifecycleWired = new WeakSet();

function isUsableWebContents(webContents) {
  return Boolean(webContents && !webContents.isDestroyed());
}

function executeScript(webContents, script, userGesture = false) {
  if (!isUsableWebContents(webContents)) {
    return Promise.resolve(null);
  }
  return webContents.executeJavaScript(script, userGesture);
}

function scrollByIntent(webContents, direction, amount) {
  const safeAmount = Math.max(0, Number(amount) || 0);
  return executeScript(
    webContents,
    `
      (function applyScroll() {
        const amount = ${safeAmount};
        if (${JSON.stringify(direction)} === "left") {
          window.scrollBy(-amount, 0);
          return;
        }
        if (${JSON.stringify(direction)} === "right") {
          window.scrollBy(amount, 0);
          return;
        }
        window.scrollBy(0, ${JSON.stringify(direction)} === "down" ? amount : -amount);
      })();
    `,
  );
}

function scrollTop(webContents) {
  return executeScript(
    webContents,
    `window.scrollTo({top: 0, behavior: "instant"})`,
  );
}

function scrollBottom(webContents) {
  return executeScript(
    webContents,
    `
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: "instant"
      });
    `,
  );
}

function pageDown(webContents) {
  return executeScript(
    webContents,
    `window.scrollBy(0, Math.floor(window.innerHeight * 0.9))`,
  );
}

function pageUp(webContents) {
  return executeScript(
    webContents,
    `window.scrollBy(0, -Math.floor(window.innerHeight * 0.9))`,
  );
}

function goBack(webContents) {
  if (!isUsableWebContents(webContents)) return;
  webContents.navigationHistory.goBack();
}

function goForward(webContents) {
  if (!isUsableWebContents(webContents)) return;
  webContents.navigationHistory.goForward();
}

function reload(webContents) {
  if (!isUsableWebContents(webContents)) return;
  webContents.reload();
}

function stop(webContents) {
  if (!isUsableWebContents(webContents)) return;
  webContents.stop();
}

function detectFocusedEditable(webContents) {
  return executeScript(
    webContents,
    `(function resolveEditableFocus() {
      const element = document.activeElement;
      if (!element || !(element instanceof Element)) return false;
      if (typeof element.matches === "function" && element.matches("input, textarea, select, [contenteditable]")) {
        return true;
      }
      return element.isContentEditable === true;
    })();`,
    true,
  );
}

function readScrollPercent(webContents) {
  return executeScript(
    webContents,
    `
      (function getScrollPercent() {
        const doc = document.documentElement;
        const body = document.body;
        const top = window.scrollY || doc.scrollTop || body.scrollTop || 0;
        const scrollHeight = Math.max(doc.scrollHeight || 0, body.scrollHeight || 0);
        const clientHeight = Math.max(doc.clientHeight || 0, window.innerHeight || 0);
        const range = Math.max(scrollHeight - clientHeight, 1);
        return Math.max(0, Math.min(100, Math.round((top / range) * 100)));
      })();
    `,
  );
}

function findInPage(webContents, text, options = {}) {
  if (!isUsableWebContents(webContents)) return null;
  const query = typeof text === "string" ? text : "";
  return webContents.findInPage(query, options);
}

function stopFindInPage(webContents, action = "clearSelection") {
  if (!isUsableWebContents(webContents)) return;
  webContents.stopFindInPage(action);
}

function nextSearchRuntimeRequestId() {
  searchRuntimeRequestSequence += 1;
  return `search-runtime-${searchRuntimeRequestSequence}`;
}

function wireSearchRuntimeLifecycle(webContents) {
  if (
    !isUsableWebContents(webContents) ||
    searchRuntimeLifecycleWired.has(webContents)
  ) {
    return;
  }

  searchRuntimeLifecycleWired.add(webContents);
  const clear = () => {
    clearSearchRuntimeReady(webContents);
  };

  if (typeof webContents.on === "function") {
    webContents.on("did-start-navigation", clear);
    webContents.on("destroyed", clear);
  }
}

async function ensureSearchRuntime(webContents) {
  if (!isUsableWebContents(webContents)) {
    return false;
  }

  if (searchRuntimeReadyByWebContents.get(webContents) === true) {
    return true;
  }

  wireSearchRuntimeLifecycle(webContents);

  const result = await executeScript(
    webContents,
    buildSearchRuntimeBootstrapScript(),
  );
  const ready = result === true;
  if (ready) {
    searchRuntimeReadyByWebContents.set(webContents, true);
  }
  return ready;
}

function clearSearchRuntimeReady(webContents) {
  if (!webContents || typeof webContents !== "object") {
    return;
  }
  searchRuntimeReadyByWebContents.delete(webContents);
}

async function sendSearchRuntimeCommand(webContents, action, payload = {}, options = {}) {
  if (!isUsableWebContents(webContents)) {
    return {
      ok: false,
      requestId: null,
      error: { code: "search_runtime_unusable_webcontents", message: "WebContents is unusable" },
    };
  }

  const ready = await ensureSearchRuntime(webContents);
  if (!ready) {
    return {
      ok: false,
      requestId: null,
      error: { code: "search_runtime_not_ready", message: "Search runtime not ready" },
    };
  }

  const requestId =
    typeof options.requestId === "string" && options.requestId.length > 0
      ? options.requestId
      : nextSearchRuntimeRequestId();
  const envelope = {
    channel: "noctra:search-runtime:command",
    requestId,
    action,
    payload: payload && typeof payload === "object" ? payload : {},
  };

  const result = await executeScript(
    webContents,
    buildSearchRuntimeCommandScript(envelope),
  );
  if (!result || typeof result !== "object") {
    return {
      ok: false,
      requestId,
      error: { code: "search_runtime_invalid_response", message: "Invalid search runtime response" },
    };
  }
  return result;
}

function searchRuntimeStart(webContents, query, options = {}) {
  const normalizedQuery = typeof query === "string" ? query : "";
  return sendSearchRuntimeCommand(
    webContents,
    SEARCH_RUNTIME_ACTIONS.START,
    { query: normalizedQuery },
    options,
  );
}

function searchRuntimeClear(webContents, options = {}) {
  return sendSearchRuntimeCommand(
    webContents,
    SEARCH_RUNTIME_ACTIONS.CLEAR,
    {},
    options,
  );
}

function searchRuntimeNext(webContents, options = {}) {
  return sendSearchRuntimeCommand(
    webContents,
    SEARCH_RUNTIME_ACTIONS.NEXT,
    {},
    options,
  );
}

function searchRuntimePrev(webContents, options = {}) {
  return sendSearchRuntimeCommand(
    webContents,
    SEARCH_RUNTIME_ACTIONS.PREV,
    {},
    options,
  );
}

module.exports = {
  isUsableWebContents,
  executeScript,
  scrollByIntent,
  scrollTop,
  scrollBottom,
  pageDown,
  pageUp,
  goBack,
  goForward,
  reload,
  stop,
  detectFocusedEditable,
  readScrollPercent,
  findInPage,
  stopFindInPage,
  ensureSearchRuntime,
  clearSearchRuntimeReady,
  sendSearchRuntimeCommand,
  searchRuntimeStart,
  searchRuntimeClear,
  searchRuntimeNext,
  searchRuntimePrev,
};
