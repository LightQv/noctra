const { INTENTS } = require("../../intents");
const { dialog } = require("electron");
const bookmarkImportService = require("../../bookmarks/importService");

function createHistoryBookmarksHandlers(deps) {
  const {
    historyPanel,
    historyService,
    bookmarksService,
    bookmarkInsertScopeModal,
    getActiveBookmarkCandidate,
    notificationsService,
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
    [INTENTS.BOOKMARKS_IMPORT]: async ({ win }) => {
      const result = await dialog.showOpenDialog(win, {
        title: "Import Bookmarks",
        properties: ["openFile"],
        filters: [{ name: "Bookmark Export", extensions: ["html", "htm"] }],
      });

      if (result.canceled || !Array.isArray(result.filePaths) || !result.filePaths[0]) {
        return;
      }

      const filePath = result.filePaths[0];
      const importResult = bookmarkImportService.importFromNetscapeFile(filePath);

      if (!importResult.ok) {
        notificationsService.notify({
          severity: "error",
          code: "bookmarks_import_failed",
          message: "Bookmark import failed",
          source: "core.dispatcher",
          context: {
            filePath,
            stage: importResult.stage || "unknown",
            reason: importResult.reason || "unknown",
            code: importResult.code || "unknown",
          },
          persist: true,
        });
        return;
      }

      const summary = importResult.summary || {
        imported: 0,
        skippedDuplicate: 0,
        skippedInvalid: 0,
        foldersCreated: 0,
      };

      if (summary.imported > 0) {
        historyPanel.reloadData();
        historyPanel.render();
        notificationsService.notify({
          severity: "info",
          code: "bookmarks_import_success",
          message: `Imported ${summary.imported} bookmark(s), skipped ${summary.skippedDuplicate} duplicate(s), skipped ${summary.skippedInvalid} invalid URL(s), created ${summary.foldersCreated} folder(s)`,
          source: "core.dispatcher",
          context: { filePath, ...summary },
          persist: false,
        });
        return;
      }

      notificationsService.notify({
        severity: "warning",
        code: "bookmarks_import_empty",
        message:
          "No importable bookmarks found (all entries were invalid or already present)",
        source: "core.dispatcher",
        context: { filePath, ...summary },
        persist: false,
      });
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
    [INTENTS.DOWNLOADS_LIVE_MODAL]: () => {
      const downloadsModal = require("../../downloads/modal");
      downloadsModal.open();
    },
  };
}

module.exports = { createHistoryBookmarksHandlers };
