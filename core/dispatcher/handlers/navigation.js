const { INTENTS } = require("../../intents");

function createNavigationHandlers(deps) {
  const { buffers, notificationsService, buildSearchUrl, normalizeUrl } = deps;

  return {
    [INTENTS.SCROLL]: ({ intent }) => {
      const buf = buffers.getActive();
      buf.webContents.executeJavaScript(`
        (function applyScroll() {
          const amount = ${Math.max(0, Number(intent.amount) || 0)};
          if (${JSON.stringify(intent.direction)} === "left") {
            window.scrollBy(-amount, 0);
            return;
          }
          if (${JSON.stringify(intent.direction)} === "right") {
            window.scrollBy(amount, 0);
            return;
          }
          window.scrollBy(0, ${JSON.stringify(intent.direction)} === "down" ? amount : -amount);
        })();
      `);
    },
    [INTENTS.SCROLL_TOP]: () => {
      const buf = buffers.getActive();
      buf.webContents.executeJavaScript(
        `window.scrollTo({top: 0, behavior: "instant"})`,
      );
    },
    [INTENTS.SCROLL_BOTTOM]: () => {
      const buf = buffers.getActive();
      buf.webContents.executeJavaScript(`
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: "instant"
        });
      `);
    },
    [INTENTS.PAGE_DOWN]: () => {
      const buf = buffers.getActive();
      buf.webContents.executeJavaScript(
        `window.scrollBy(0, Math.floor(window.innerHeight * 0.9))`,
      );
    },
    [INTENTS.PAGE_UP]: () => {
      const buf = buffers.getActive();
      buf.webContents.executeJavaScript(
        `window.scrollBy(0, -Math.floor(window.innerHeight * 0.9))`,
      );
    },
    [INTENTS.NAV_BACK]: () => {
      const buf = buffers.getActive();
      buf.webContents.navigationHistory.goBack();
    },
    [INTENTS.NAV_FORWARD]: () => {
      const buf = buffers.getActive();
      buf.webContents.navigationHistory.goForward();
    },
    [INTENTS.RELOAD_PAGE]: () => {
      const buf = buffers.getActive();
      buf.webContents.reload();
    },
    [INTENTS.OPEN_URL]: ({ intent }) => {
      const rawUrl = typeof intent.url === "string" ? intent.url : "";
      const normalized = normalizeUrl(rawUrl);
      if (!normalized) {
        notificationsService.notify({
          severity: "warning",
          code: "open_url_blocked",
          message: "Cannot open URL: blocked by URL security policy",
          source: "core.dispatcher",
          context: { intent, url: rawUrl },
          persist: false,
        });
        return;
      }
      const buf = buffers.getActive();
      buf.load(normalized);
    },
    [INTENTS.SEARCH_WEB]: ({ intent }) => {
      const searchUrl = buildSearchUrl(intent.engine, intent.query);
      if (!searchUrl) {
        notificationsService.notify({
          severity: "warning",
          code: "search_web_unknown_engine",
          message: "Cannot search web: unknown engine",
          source: "core.dispatcher",
          context: { intent },
          persist: false,
        });
        return;
      }
      const buf = buffers.getActive();
      buf.load(searchUrl);
    },
  };
}

module.exports = { createNavigationHandlers };
