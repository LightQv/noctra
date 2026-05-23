const { INTENTS } = require("../../intents");
const { enterSearchMode, exitSearchMode } = require("../../modeTransitionService");
const {
  setSearchQuery,
  setSearchPromptVisible,
  setSearchActive,
  setSearchCounters,
  setSearchRequestId,
  resetSearchSession,
} = require("../../state/searchState");

function isSearchableBuffer(buffer, webContentsActions) {
  if (!buffer || buffer.isEditable) {
    return false;
  }
  const url = typeof buffer.url === "string" ? buffer.url.trim() : "";
  if (!url || url.startsWith("noctra://")) {
    return false;
  }
  return webContentsActions.isUsableWebContents(buffer.webContents);
}

function createSearchHandlers(deps) {
  const { buffers, notificationsService, dispatch, webContentsActions } = deps;
  const wiredWebContents = new WeakSet();

  function notifyWarning(message, code) {
    notificationsService.notify({
      severity: "warning",
      code,
      message,
      source: "core.dispatcher.search",
      persist: false,
    });
  }

  function wireFoundInPage(webContents, state) {
    if (!webContents || wiredWebContents.has(webContents)) {
      return;
    }
    wiredWebContents.add(webContents);
    webContents.on("found-in-page", (_event, result = {}) => {
      const requestId = result.requestId;
      if (!state.searchActive || requestId !== state.searchRequestId) {
        return;
      }
      if (result.finalUpdate !== true) {
        return;
      }

      const total = Number.isFinite(result.matches) ? result.matches : 0;
      const index = Number.isFinite(result.activeMatchOrdinal)
        ? result.activeMatchOrdinal
        : 0;
      setSearchCounters(state, index, total);

      if (total === 0) {
        notifyWarning("No result", "search_no_result");
      }
    });
  }

  function submitFind(state, webContents, query, options = {}) {
    const requestId = webContentsActions.findInPage(webContents, query, options);
    setSearchRequestId(state, requestId);
    return requestId;
  }

  return {
    [INTENTS.SEARCH_OPEN_PROMPT]: ({ state, win }) => {
      enterSearchMode(state, {
        initialQuery: state.searchQuery,
        showPrompt: true,
        reason: "search-open-prompt",
      });
      dispatch(win, { type: INTENTS.SHOW_COMMAND }, state);
      dispatch(win, { type: INTENTS.COMMAND_INPUT }, state);
    },

    [INTENTS.SEARCH_SUBMIT]: ({ state, intent, win }) => {
      const query = typeof intent.query === "string" ? intent.query.trim() : "";
      if (!query) {
        notifyWarning("Search query is empty", "search_empty_query");
        return;
      }

      const buffer = buffers.getActive();
      if (!isSearchableBuffer(buffer, webContentsActions)) {
        notifyWarning("Search unavailable in current buffer", "search_unavailable");
        return;
      }

      enterSearchMode(state, {
        initialQuery: query,
        showPrompt: false,
        reason: "search-submit",
      });
      setSearchQuery(state, query);
      setSearchActive(state, true);
      setSearchCounters(state, 0, 0);
      wireFoundInPage(buffer.webContents, state);
      submitFind(state, buffer.webContents, query, { forward: true, findNext: false });
      dispatch(win, { type: INTENTS.HIDE_COMMAND }, state);
    },

    [INTENTS.SEARCH_NEXT]: ({ state }) => {
      if (!state.searchActive || !state.searchQuery) return;
      const buffer = buffers.getActive();
      if (!isSearchableBuffer(buffer, webContentsActions)) {
        notifyWarning("Search unavailable in current buffer", "search_unavailable");
        return;
      }
      wireFoundInPage(buffer.webContents, state);
      submitFind(state, buffer.webContents, state.searchQuery, {
        findNext: true,
        forward: true,
      });
    },

    [INTENTS.SEARCH_PREV]: ({ state }) => {
      if (!state.searchActive || !state.searchQuery) return;
      const buffer = buffers.getActive();
      if (!isSearchableBuffer(buffer, webContentsActions)) {
        notifyWarning("Search unavailable in current buffer", "search_unavailable");
        return;
      }
      wireFoundInPage(buffer.webContents, state);
      submitFind(state, buffer.webContents, state.searchQuery, {
        findNext: true,
        forward: false,
      });
    },

    [INTENTS.SEARCH_CLEAR]: ({ state, win }) => {
      const buffer = buffers.getActive();
      if (buffer && webContentsActions.isUsableWebContents(buffer.webContents)) {
        webContentsActions.stopFindInPage(buffer.webContents, "clearSelection");
      }
      resetSearchSession(state);
      exitSearchMode(state, { reason: "search-clear" });
      dispatch(win, { type: INTENTS.HIDE_COMMAND }, state);
    },
  };
}

module.exports = { createSearchHandlers };
