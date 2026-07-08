const { INTENTS } = require("../../intents");

function createNavigationHandlers(deps) {
  const {
    buffers,
    notificationsService,
    buildSearchUrl,
    normalizeUrl,
    requestScrollStatusUpdate = () => {},
    webContentsActions,
  } = deps;

  const refreshScrollStatusAfterScroll = () => {
    requestScrollStatusUpdate(16);
  };

  return {
    [INTENTS.SCROLL]: ({ intent }) => {
      const buf = buffers.getActive();
      webContentsActions
        .scrollByIntent(buf.webContents, intent.direction, intent.amount)
        .finally(refreshScrollStatusAfterScroll)
        .catch(() => {});
    },
    [INTENTS.SCROLL_TOP]: () => {
      const buf = buffers.getActive();
      webContentsActions
        .scrollTop(buf.webContents)
        .finally(refreshScrollStatusAfterScroll)
        .catch(() => {});
    },
    [INTENTS.SCROLL_BOTTOM]: () => {
      const buf = buffers.getActive();
      webContentsActions
        .scrollBottom(buf.webContents)
        .finally(refreshScrollStatusAfterScroll)
        .catch(() => {});
    },
    [INTENTS.PAGE_DOWN]: () => {
      const buf = buffers.getActive();
      webContentsActions
        .pageDown(buf.webContents)
        .finally(refreshScrollStatusAfterScroll)
        .catch(() => {});
    },
    [INTENTS.PAGE_UP]: () => {
      const buf = buffers.getActive();
      webContentsActions
        .pageUp(buf.webContents)
        .finally(refreshScrollStatusAfterScroll)
        .catch(() => {});
    },
    [INTENTS.NAV_BACK]: ({ intent }) => {
      let buf = buffers.getActive();
      if (Number.isInteger(intent.bufferId)) {
        buf = buffers.getBuffers().find((b) => b.id === intent.bufferId) || buf;
      }
      if (buf && buf.webContents) {
        webContentsActions.goBack(buf.webContents);
      }
    },
    [INTENTS.NAV_FORWARD]: ({ intent }) => {
      let buf = buffers.getActive();
      if (Number.isInteger(intent.bufferId)) {
        buf = buffers.getBuffers().find((b) => b.id === intent.bufferId) || buf;
      }
      if (buf && buf.webContents) {
        webContentsActions.goForward(buf.webContents);
      }
    },
    [INTENTS.RELOAD_PAGE]: ({ intent }) => {
      let buf = buffers.getActive();
      if (Number.isInteger(intent.bufferId)) {
        buf = buffers.getBuffers().find((b) => b.id === intent.bufferId) || buf;
      }
      if (buf && buf.webContents) {
        if (intent.ignoreCache) {
          webContentsActions.reloadIgnoringCache(buf.webContents);
        } else {
          webContentsActions.reload(buf.webContents);
        }
      }
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
