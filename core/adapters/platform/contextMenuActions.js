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
        const validation = validateNavigableUrl(url);
        if (validation.ok) {
          dispatch(
            win,
            { type: INTENTS.OPEN_URL_IN_SPLIT, url: validation.url },
            state,
          );
        }
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

function createUIShellContextMenuActions({
  clipboard,
  buffers,
  dispatch,
  state,
  INTENTS,
  startUrllineEdit,
  win,
}) {
  function getTabIndex(tabId) {
    return buffers.buffers.findIndex((buffer) => buffer.id === tabId);
  }

  return {
    forTablineTab(tabId) {
      return {
        closeTab() {
          dispatch(win, { type: INTENTS.CLOSE_BUFFER, id: tabId }, state);
        },
        closeAllTabsToLeft() {
          const index = getTabIndex(tabId);
          if (index > 0) {
            dispatch(
              win,
              { type: INTENTS.CLOSE_LEFT_BUFFERS, index },
              state,
            );
          }
        },
        closeAllTabsToRight() {
          const index = getTabIndex(tabId);
          if (index >= 0 && index < buffers.buffers.length - 1) {
            dispatch(
              win,
              { type: INTENTS.CLOSE_RIGHT_BUFFERS, index },
              state,
            );
          }
        },
        closeAllTabs() {
          dispatch(win, { type: INTENTS.CLOSE_ALL_BUFFERS }, state);
        },
        duplicateTab() {
          dispatch(
            win,
            { type: INTENTS.DUPLICATE_BUFFER, bufferId: tabId },
            state,
          );
        },
        splitTab() {
          const target = buffers.buffers.find((buffer) => buffer.id === tabId);
          if (!target) return;
          const { canBufferBeSplit } = require("../../../browser/services/splitEligibility");
          if (!canBufferBeSplit(target)) return;
          const url = target.url || "about:blank";
          dispatch(
            win,
            { type: INTENTS.OPEN_URL_IN_SPLIT, url },
            state,
          );
        },
      };
    },

    forUrllineUrl(pane) {
      return {
        copyUrl() {
          const paneBuffer = buffers.getPaneBuffer(pane);
          if (paneBuffer && paneBuffer.url) {
            clipboard.writeText(paneBuffer.url);
          }
        },
        editUrl() {
          const paneBuffer = buffers.getPaneBuffer(pane);
          if (!paneBuffer || paneBuffer.isEditable) {
            return;
          }
          startUrllineEdit(pane, paneBuffer.url || "about:blank");
        },
        hideUrlline() {
          dispatch(win, { type: INTENTS.TOGGLE_URLLINE }, state);
        },
      };
    },
  };
}

function createSidepanelContextMenuActions({
  dispatch,
  win,
  state,
  INTENTS,
  panel,
  node,
  _buffers,
}) {
  function getNodeUrl() {
    if (!node) return "";
    return node.entry?.url || node.url || "";
  }

  function getNodeId() {
    if (!node) return null;
    return node.id || node.entry?.id || null;
  }

  function getHideIntent() {
    if (panel.treeKind === "history") return INTENTS.HISTORY_HIDE;
    if (panel.treeKind === "bookmarks") return INTENTS.BOOKMARKS_HIDE;
    if (panel.treeKind === "downloads") return INTENTS.DOWNLOADS_HIDE;
    return INTENTS.HISTORY_HIDE;
  }

  function getDeleteAllIntent() {
    if (panel.treeKind === "bookmarks") return INTENTS.BOOKMARKS_DELETE_ALL;
    return INTENTS.HISTORY_DELETE_ALL;
  }

  return {
    openInNewTab() {
      const url = getNodeUrl();
      if (url) {
        dispatch(win, { type: INTENTS.NEW_BUFFER, url }, state);
      }
    },

    openInSplit() {
      const url = getNodeUrl();
      if (url) {
        dispatch(win, { type: INTENTS.OPEN_URL_IN_SPLIT, url }, state);
      }
    },

    deleteEntry() {
      if (!node) return;
      if (panel.treeKind === "history") {
        const dateKey = node.dateKey;
        const entryId = node.entry?.id;
        if (dateKey && entryId) {
          dispatch(
            win,
            { type: INTENTS.DELETE_HISTORY_ENTRY, dateKey, entryId },
            state,
          );
        }
      } else if (panel.treeKind === "bookmarks") {
        const nodeId = getNodeId();
        if (nodeId) {
          dispatch(
            win,
            { type: INTENTS.DELETE_BOOKMARK_NODE, nodeId },
            state,
          );
        }
      }
    },

    deleteFolder() {
      if (!node) return;
      if (panel.treeKind === "history") {
        const dateKey = node.dateKey;
        if (dateKey) {
          dispatch(
            win,
            { type: INTENTS.DELETE_HISTORY_DATE, dateKey },
            state,
          );
        }
      } else if (panel.treeKind === "bookmarks") {
        const nodeId = getNodeId();
        if (nodeId) {
          dispatch(
            win,
            { type: INTENTS.DELETE_BOOKMARK_NODE, nodeId },
            state,
          );
        }
      }
    },

    openFolderLinksInNewTabs() {
      if (!node) return;
      const urls = [];
      if (panel.treeKind === "history") {
        const day = panel.days.find((d) => d.key === node.dateKey);
        if (!day) return;
        for (const entry of day.entries) {
          if (entry.url) {
            urls.push(entry.url);
          }
        }
      } else if (panel.treeKind === "bookmarks") {
        const folderNode =
          node.type === "folder"
            ? node
            : panel.findFavoriteNodeLocation(node.id)?.node;
        if (!folderNode) return;
        const walk = (n) => {
          if (n.type === "entry" && n.url) {
            urls.push(n.url);
          } else if (n.type === "folder" && Array.isArray(n.children)) {
            for (const child of n.children) {
              walk(child);
            }
          }
        };
        walk(folderNode);
      }
      if (urls.length > 0) {
        dispatch(win, { type: INTENTS.NEW_BUFFERS, urls }, state);
      }
    },

    deleteAll() {
      dispatch(win, { type: getDeleteAllIntent() }, state);
    },

    deleteAllComplete() {
      dispatch(win, { type: INTENTS.DOWNLOADS_CLEAR_COMPLETED }, state);
    },

    showInFolder() {
      const id = getNodeId();
      if (id) {
        dispatch(win, { type: INTENTS.SHOW_DOWNLOAD_IN_FOLDER, downloadId: id }, state);
      }
    },

    openFile() {
      const id = getNodeId();
      if (id) {
        dispatch(win, { type: INTENTS.OPEN_DOWNLOAD_FILE, downloadId: id }, state);
      }
    },

    hideSidepanel() {
      dispatch(win, { type: getHideIntent() }, state);
    },
  };
}

module.exports = {
  createWebContextMenuActions,
  createUIShellContextMenuActions,
  createSidepanelContextMenuActions,
};
