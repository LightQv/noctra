const { INTENTS } = require("../../intents");
const { dialog } = require("electron");
const bookmarkImportService = require("../../bookmarks/importService");

function createHistoryBookmarksHandlers(deps) {
  const {
    sidepanelController,
    historyService,
    bookmarksService,
    bookmarkInsertScopeModal,
    getActiveBookmarkCandidate,
    notificationsService,
  } = deps;

  return {
    [INTENTS.HISTORY_SHOW]: () => {
      sidepanelController.setTreeKind("history");
      sidepanelController.show();
      sidepanelController.focus();
    },
    [INTENTS.HISTORY_HIDE]: () => sidepanelController.hide(),
    [INTENTS.HISTORY_TOGGLE]: () => sidepanelController.toggle(),
    [INTENTS.HISTORY_TOGGLE_FOCUS]: () => sidepanelController.toggleFocus(),
    [INTENTS.HISTORY_DELETE_ALL]: () => {
      historyService.deleteAll();
      sidepanelController.reloadData();
      sidepanelController.render();
    },
    [INTENTS.HISTORY_DELETE_TODAY]: () => {
      historyService.deleteToday();
      sidepanelController.reloadData();
      sidepanelController.render();
    },
    [INTENTS.BOOKMARKS_SHOW]: () => sidepanelController.showTree("bookmarks"),
    [INTENTS.BOOKMARKS_HIDE]: () => sidepanelController.hide(),
    [INTENTS.BOOKMARKS_TOGGLE]: () => {
      if (
        sidepanelController.isVisible() &&
        sidepanelController.treeKind === "bookmarks"
      ) {
        sidepanelController.hide();
      } else {
        sidepanelController.showTree("bookmarks");
      }
    },
    [INTENTS.BOOKMARKS_TOGGLE_FOCUS]: () => {
      sidepanelController.setTreeKind("bookmarks");
      sidepanelController.toggleFocus();
    },
    [INTENTS.BOOKMARKS_DELETE_ALL]: () => {
      bookmarksService.deleteAll();
      sidepanelController.reloadData();
      sidepanelController.render();
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
        sidepanelController.reloadData();
        sidepanelController.render();
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
    [INTENTS.BOOKMARKS_ADD_ROOT_ACTIVE]: ({ intent }) => {
      let candidate = null;
      if (intent.url) {
        candidate = {
          url: String(intent.url).trim(),
          title: String(intent.title || intent.url).trim(),
        };
      } else {
        candidate = getActiveBookmarkCandidate();
      }
      if (!candidate) {
        return;
      }
      const result = bookmarksService.appendEntryAtRoot({
        id: bookmarksService.makeEntryId(),
        title: candidate.title,
        url: candidate.url,
      });
      if (result?.status === "inserted" && sidepanelController.isVisible()) {
        sidepanelController.reloadData();
        sidepanelController.render();
      }
    },
    [INTENTS.BOOKMARKS_ADD_SCOPED_PROMPT]: ({ intent }) => {
      let candidate = null;
      if (intent.url) {
        candidate = {
          url: String(intent.url).trim(),
          title: String(intent.title || intent.url).trim(),
        };
      } else {
        candidate = getActiveBookmarkCandidate();
      }
      if (!candidate) {
        return;
      }
      bookmarkInsertScopeModal.open(candidate);
    },
    [INTENTS.DOWNLOADS_SHOW]: () => sidepanelController.showTree("downloads"),
    [INTENTS.DOWNLOADS_HIDE]: () => sidepanelController.hide(),
    [INTENTS.DOWNLOADS_TOGGLE]: () => {
      if (
        sidepanelController.isVisible() &&
        sidepanelController.treeKind === "downloads"
      ) {
        sidepanelController.hide();
      } else {
        sidepanelController.showTree("downloads");
      }
    },
    [INTENTS.DOWNLOADS_TOGGLE_FOCUS]: () => {
      sidepanelController.setTreeKind("downloads");
      sidepanelController.toggleFocus();
    },
    [INTENTS.DOWNLOADS_CLEAR_ALL]: () => {
      const { downloadsService } = require("../../downloads/service");
      downloadsService.clearCompleted();
      if (sidepanelController.isVisible()) {
        sidepanelController.reloadData();
        sidepanelController.render();
      }
    },
    [INTENTS.DOWNLOADS_LIVE_MODAL]: () => {
      const downloadsModal = require("../../downloads/modal");
      downloadsModal.open();
    },
  };
}

module.exports = { createHistoryBookmarksHandlers };
