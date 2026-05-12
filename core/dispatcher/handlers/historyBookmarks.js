const { INTENTS } = require("../../intents");

function createHistoryBookmarksHandlers(deps) {
  const {
    historyPanel,
    historyService,
    bookmarksService,
    bookmarkInsertScopeModal,
    getActiveBookmarkCandidate,
  } = deps;

  return {
    [INTENTS.HISTORY_SHOW]: () => {
      historyPanel.setTreeKind("history");
      historyPanel.show();
      historyPanel.focus();
    },
    [INTENTS.HISTORY_HIDE]: () => historyPanel.hide(),
    [INTENTS.HISTORY_TOGGLE]: () => historyPanel.toggle(),
    [INTENTS.HISTORY_TOGGLE_FOCUS]: () => historyPanel.toggleFocus(),
    [INTENTS.HISTORY_DELETE_ALL]: () => {
      historyService.deleteAll();
      historyPanel.reloadData();
      historyPanel.render();
    },
    [INTENTS.HISTORY_DELETE_TODAY]: () => {
      historyService.deleteToday();
      historyPanel.reloadData();
      historyPanel.render();
    },
    [INTENTS.BOOKMARKS_SHOW]: () => historyPanel.showTree("bookmarks"),
    [INTENTS.BOOKMARKS_HIDE]: () => historyPanel.hide(),
    [INTENTS.BOOKMARKS_TOGGLE]: () => {
      if (historyPanel.isVisible() && historyPanel.treeKind === "bookmarks") {
        historyPanel.hide();
      } else {
        historyPanel.showTree("bookmarks");
      }
    },
    [INTENTS.BOOKMARKS_TOGGLE_FOCUS]: () => {
      historyPanel.setTreeKind("bookmarks");
      historyPanel.toggleFocus();
    },
    [INTENTS.BOOKMARKS_DELETE_ALL]: () => {
      bookmarksService.deleteAll();
      historyPanel.reloadData();
      historyPanel.render();
    },
    [INTENTS.BOOKMARKS_ADD_ROOT_ACTIVE]: () => {
      const candidate = getActiveBookmarkCandidate();
      if (!candidate) {
        return;
      }
      const result = bookmarksService.appendEntryAtRoot({
        id: bookmarksService.makeEntryId(),
        title: candidate.title,
        url: candidate.url,
      });
      if (result?.status === "inserted" && historyPanel.isVisible()) {
        historyPanel.reloadData();
        historyPanel.render();
      }
    },
    [INTENTS.BOOKMARKS_ADD_SCOPED_PROMPT]: () => {
      const candidate = getActiveBookmarkCandidate();
      if (!candidate) {
        return;
      }
      bookmarkInsertScopeModal.open(candidate);
    },
    [INTENTS.DOWNLOADS_SHOW]: () => historyPanel.showTree("downloads"),
    [INTENTS.DOWNLOADS_HIDE]: () => historyPanel.hide(),
    [INTENTS.DOWNLOADS_TOGGLE]: () => {
      if (historyPanel.isVisible() && historyPanel.treeKind === "downloads") {
        historyPanel.hide();
      } else {
        historyPanel.showTree("downloads");
      }
    },
    [INTENTS.DOWNLOADS_TOGGLE_FOCUS]: () => {
      historyPanel.setTreeKind("downloads");
      historyPanel.toggleFocus();
    },
    [INTENTS.DOWNLOADS_CLEAR_ALL]: () => {
      const { downloadsService } = require("../../downloads/service");
      downloadsService.clearCompleted();
      if (historyPanel.isVisible()) {
        historyPanel.reloadData();
        historyPanel.render();
      }
    },
  };
}

module.exports = { createHistoryBookmarksHandlers };
