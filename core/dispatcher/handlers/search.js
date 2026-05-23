const { INTENTS } = require("../../intents");
const { enterSearchMode, exitSearchMode } = require("../../modeTransitionService");
const {
  setSearchQuery,
  setSearchPromptVisible,
  setSearchActive,
  setSearchCounters,
  setSearchRequestId,
  setSearchHintMode,
  setSearchHintInput,
  setSearchVisibleHintCount,
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
  let requestSequence = 0;

  function notifyWarning(message, code) {
    notificationsService.notify({
      severity: "warning",
      code,
      message,
      source: "core.dispatcher.search",
      persist: false,
    });
  }

  function nextRuntimeRequestId() {
    requestSequence += 1;
    return `search-dispatch-${requestSequence}`;
  }

  function runRuntimeCommand({
    state,
    win,
    webContents,
    action,
    payload = {},
  }) {
    const requestId = nextRuntimeRequestId();
    setSearchRequestId(state, requestId);

    Promise.resolve(
      webContentsActions.sendSearchRuntimeCommand(webContents, action, payload, {
        requestId,
      }),
    )
      .then((result) => {
        if (!result || result.ok !== true || !result.payload) {
          const message = result?.error?.message || "Search runtime command failed";
          notifyWarning(message, "search_runtime_error");
          return;
        }

        dispatch(
          win,
          {
            type: INTENTS.SEARCH_RUNTIME_UPDATE,
            requestId,
            total: Number.isFinite(result.payload.total)
              ? Math.max(0, Math.floor(result.payload.total))
              : 0,
            activeIndex: Number.isFinite(result.payload.activeIndex)
              ? Math.max(0, Math.floor(result.payload.activeIndex))
              : 0,
            visibleHintCount: Number.isFinite(result.payload.visibleHintCount)
              ? Math.max(0, Math.floor(result.payload.visibleHintCount))
              : 0,
            activeRect: result.payload.activeRect || null,
          },
          state,
        );
      })
      .catch(() => {
        notifyWarning("Search runtime command failed", "search_runtime_error");
      });

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
      runRuntimeCommand({
        state,
        win,
        webContents: buffer.webContents,
        action: "start",
        payload: { query },
      });
      dispatch(win, { type: INTENTS.HIDE_COMMAND }, state);
    },

    [INTENTS.SEARCH_NEXT]: ({ state, win }) => {
      if (!state.searchActive || !state.searchQuery) return;
      const buffer = buffers.getActive();
      if (!isSearchableBuffer(buffer, webContentsActions)) {
        notifyWarning("Search unavailable in current buffer", "search_unavailable");
        return;
      }
      runRuntimeCommand({
        state,
        win,
        webContents: buffer.webContents,
        action: "next",
      });
    },

    [INTENTS.SEARCH_PREV]: ({ state, win }) => {
      if (!state.searchActive || !state.searchQuery) return;
      const buffer = buffers.getActive();
      if (!isSearchableBuffer(buffer, webContentsActions)) {
        notifyWarning("Search unavailable in current buffer", "search_unavailable");
        return;
      }
      runRuntimeCommand({
        state,
        win,
        webContents: buffer.webContents,
        action: "prev",
      });
    },

    [INTENTS.SEARCH_RUNTIME_UPDATE]: ({ state, intent }) => {
      if (!state.searchActive || intent.requestId !== state.searchRequestId) {
        return;
      }

      const total = Number.isFinite(intent.total) ? intent.total : 0;
      const activeIndex = Number.isFinite(intent.activeIndex)
        ? intent.activeIndex
        : 0;
      setSearchCounters(state, activeIndex, total);
      setSearchVisibleHintCount(state, intent.visibleHintCount);
      if (state.searchHintMode && state.searchHintInput && intent.visibleHintCount === 0) {
        setSearchHintMode(state, false);
        setSearchHintInput(state, "");
      }
      if (total === 0) {
        notifyWarning("No result", "search_no_result");
      }
    },

    [INTENTS.SEARCH_HINT_OPEN]: ({ state, win }) => {
      if (!state.searchActive || !state.searchQuery) return;
      const buffer = buffers.getActive();
      if (!isSearchableBuffer(buffer, webContentsActions)) {
        notifyWarning("Search unavailable in current buffer", "search_unavailable");
        return;
      }
      setSearchHintMode(state, true);
      setSearchHintInput(state, "");
      runRuntimeCommand({
        state,
        win,
        webContents: buffer.webContents,
        action: "hint-open",
      });
    },

    [INTENTS.SEARCH_HINT_INPUT]: ({ state, intent, win }) => {
      if (!state.searchActive) return;
      const buffer = buffers.getActive();
      if (!isSearchableBuffer(buffer, webContentsActions)) {
        notifyWarning("Search unavailable in current buffer", "search_unavailable");
        return;
      }

      const input = typeof intent.input === "string" ? intent.input : "";
      setSearchHintInput(state, input);
      if (!input) {
        setSearchHintMode(state, false);
      }

      runRuntimeCommand({
        state,
        win,
        webContents: buffer.webContents,
        action: "hint-input",
        payload: { input },
      });
    },

    [INTENTS.SEARCH_JUMP_TO_INDEX]: ({ state, intent, win }) => {
      if (!state.searchActive) return;
      const buffer = buffers.getActive();
      if (!isSearchableBuffer(buffer, webContentsActions)) {
        notifyWarning("Search unavailable in current buffer", "search_unavailable");
        return;
      }
      const index = Number.isFinite(intent.index) ? intent.index : 1;
      setSearchHintMode(state, false);
      setSearchHintInput(state, "");
      runRuntimeCommand({
        state,
        win,
        webContents: buffer.webContents,
        action: "jump",
        payload: { index },
      });
    },

    [INTENTS.SEARCH_CLEAR]: ({ state, win }) => {
      const buffer = buffers.getActive();
      if (buffer && webContentsActions.isUsableWebContents(buffer.webContents)) {
        runRuntimeCommand({
          state,
          win,
          webContents: buffer.webContents,
          action: "clear",
        });
      }
      resetSearchSession(state);
      exitSearchMode(state, { reason: "search-clear" });
      dispatch(win, { type: INTENTS.HIDE_COMMAND }, state);
    },
  };
}

module.exports = { createSearchHandlers };
