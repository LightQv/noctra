const { shell } = require("electron");

function createWebContextMenuActions({
  clipboard,
  dialog,
  buffers,
  dispatch,
  state,
  INTENTS,
  configService,
  validateNavigableUrl,
  isBookmarkableBuffer,
  win,
}) {
  return function forWebContents(webContents, _params) {
    function getTargetBuffer() {
      if (!webContents || webContents.isDestroyed()) return null;
      return buffers.getBufferByWebContents(webContents);
    }

    function validateAndCreate(url) {
      const validation = validateNavigableUrl(url);
      if (validation.ok) {
        dispatch(win, { type: INTENTS.NEW_BUFFER, url: validation.url }, state);
      }
    }

    function validateAndOpenInSplit(url) {
      const validation = validateNavigableUrl(url);
      if (validation.ok) {
        buffers.openUrlInRightSplit(validation.url);
      }
    }

    return {
      inspectElement(x, y) {
        if (webContents && !webContents.isDestroyed()) {
          webContents.inspectElement(x, y);
        }
      },

      cut() {
        if (webContents && !webContents.isDestroyed()) {
          webContents.cut();
        }
      },

      copy() {
        if (webContents && !webContents.isDestroyed()) {
          webContents.copy();
        }
      },

      paste() {
        if (webContents && !webContents.isDestroyed()) {
          webContents.paste();
        }
      },

      deleteItem() {
        if (webContents && !webContents.isDestroyed()) {
          webContents.delete();
        }
      },

      selectAll() {
        if (webContents && !webContents.isDestroyed()) {
          webContents.selectAll();
        }
      },

      searchSelection(selectionText) {
        const defaultSearchEngine = configService.getConfigValue(
          "browser.default_search_engine",
          "duckduckgo",
        );
        dispatch(
          win,
          {
            type: INTENTS.SEARCH_WEB,
            engine: defaultSearchEngine,
            query: selectionText,
          },
          state,
        );
      },

      openLinkInNewTab(url) {
        validateAndCreate(url);
      },

      openLinkInSplit(url) {
        validateAndOpenInSplit(url);
      },

      copyLinkAddress(url) {
        clipboard.writeText(url);
      },

      openImageInNewTab(url) {
        validateAndCreate(url);
      },

      saveImageAs(url) {
        if (webContents && !webContents.isDestroyed()) {
          webContents.downloadURL(url);
        }
      },

      copyImage(x, y) {
        if (
          webContents &&
          !webContents.isDestroyed() &&
          typeof webContents.copyImageAt === "function"
        ) {
          webContents.copyImageAt(Math.round(x), Math.round(y));
        }
      },

      copyImageAddress(url) {
        clipboard.writeText(url);
      },

      sendByEmail(url) {
        const mailto = `mailto:?subject=Image&body=${encodeURIComponent(url)}`;
        shell.openExternal(mailto);
      },

      goBack() {
        const buf = getTargetBuffer();
        dispatch(
          win,
          { type: INTENTS.NAV_BACK, bufferId: buf ? buf.id : undefined },
          state,
        );
      },

      goForward() {
        const buf = getTargetBuffer();
        dispatch(
          win,
          { type: INTENTS.NAV_FORWARD, bufferId: buf ? buf.id : undefined },
          state,
        );
      },

      reload() {
        const buf = getTargetBuffer();
        dispatch(
          win,
          { type: INTENTS.RELOAD_PAGE, bufferId: buf ? buf.id : undefined },
          state,
        );
      },

      bookmarkPage() {
        const buf = getTargetBuffer();
        if (!buf || !isBookmarkableBuffer(buf)) return;
        dispatch(
          win,
          {
            type: INTENTS.BOOKMARKS_ADD_SCOPED_PROMPT,
            url: buf.url,
            title: buf.title,
          },
          state,
        );
      },

      savePageAs() {
        if (!webContents || webContents.isDestroyed()) return;
        dialog
          .showSaveDialog(win, {
            defaultPath: "page.html",
            filters: [{ name: "HTML", extensions: ["html", "htm"] }],
          })
          .then((result) => {
            if (!result.canceled && result.filePath) {
              webContents
                .savePage(result.filePath, "HTMLComplete")
                .catch(() => {});
            }
          });
      },

      toggleDevTools() {
        dispatch(win, { type: INTENTS.SPLIT_DEVTOOLS }, state);
      },

      closeSplit() {
        dispatch(win, { type: INTENTS.SPLIT_CLOSE_RIGHT }, state);
      },
    };
  };
}

module.exports = {
  createWebContextMenuActions,
};
