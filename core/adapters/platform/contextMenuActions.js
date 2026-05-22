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
          buffers.close(tabId);
        },
        closeAllTabsToLeft() {
          const index = getTabIndex(tabId);
          if (index > 0) {
            buffers.closeAllLeftOf(index);
          }
        },
        closeAllTabsToRight() {
          const index = getTabIndex(tabId);
          buffers.closeAllRightOf(index);
        },
        closeAllTabs() {
          buffers.closeAllBuffers();
        },
        duplicateTab() {
          buffers.duplicateBuffer(tabId);
        },
        splitTab() {
          const target = buffers.buffers.find((buffer) => buffer.id === tabId);
          if (!target) return;
          if (target.isEditable) return;
          const isDashboard =
            target.virtualUrl === "noctra://dashboard" ||
            target.url === "noctra://dashboard";
          if (
            !isDashboard &&
            target.virtualDocument &&
            typeof target.virtualDocument.html === "string" &&
            target.virtualDocument.html.trim()
          ) {
            return;
          }
          if (!buffers.isSplitEnabled()) {
            buffers.openVerticalSplit();
          }
          if (isDashboard) {
            buffers.openBufferInRightSplit(target);
          } else {
            buffers.openUrlInRightSplit(target.url || "about:blank");
          }
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
  panel,
  node,
  buffers,
  historyService,
  bookmarksService,
  downloadsService,
}) {
  return {
    openInNewTab() {
      if (!node) return;
      const url = node.entry?.url || node.url || "";
      if (url) {
        buffers.create(url);
      }
    },

    openInSplit() {
      if (!node) return;
      const url = node.entry?.url || node.url || "";
      if (url && typeof buffers.openUrlInRightSplit === "function") {
        buffers.openUrlInRightSplit(url);
      }
    },

    deleteEntry() {
      if (!node) return;
      if (panel.treeKind === "history") {
        if (node.dateKey && node.entry?.id) {
          historyService.deleteEntry(node.dateKey, node.entry.id);
          panel.reloadData();
          panel.render();
        }
      } else if (panel.treeKind === "bookmarks") {
        panel.deleteFavoriteNodeById(node.id);
        panel.render();
      }
    },

    deleteFolder() {
      if (!node) return;
      if (panel.treeKind === "history") {
        if (node.dateKey) {
          historyService.deleteDate(node.dateKey);
          panel.reloadData();
          panel.render();
        }
      } else if (panel.treeKind === "bookmarks") {
        panel.deleteFavoriteNodeById(node.id);
        panel.render();
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
      if (urls.length > 0 && typeof buffers.createMany === "function") {
        buffers.createMany(urls);
      }
    },

    deleteAll() {
      if (panel.treeKind === "bookmarks") {
        bookmarksService.deleteAll();
        panel.reloadData();
        panel.render();
      } else {
        historyService.deleteAll();
        panel.reloadData();
        panel.render();
      }
    },

    deleteAllComplete() {
      downloadsService.clearCompleted();
      panel.reloadData();
      panel.render();
    },

    showInFolder() {
      if (!node) return;
      const id = node.id || node.entry?.id;
      if (id) {
        downloadsService.showInFolder(id);
      }
    },

    openFile() {
      if (!node) return;
      const id = node.id || node.entry?.id;
      if (id) {
        downloadsService.openFile(id);
      }
    },

    hideSidepanel() {
      panel.hide();
    },
  };
}

module.exports = {
  createWebContextMenuActions,
  createUIShellContextMenuActions,
  createSidepanelContextMenuActions,
};
