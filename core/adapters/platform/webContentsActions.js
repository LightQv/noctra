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
};
