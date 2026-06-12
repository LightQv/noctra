const { INTENTS } = require("../core/intents");
const { getModAction, getSearchKeymap } = require("./keymap");
const { isModPressed } = require("./modifiers");
const { handleLeaderInput } = require("./normal");
const { rememberRepeatableIntent } = require("./repeat");

const SEARCH_CONTEXT_CHANGING_INTENTS = new Set([
  INTENTS.NEW_BUFFER,
  INTENTS.BUFFER_NEXT,
  INTENTS.BUFFER_PREV,
  INTENTS.CLOSE_ALL_BUFFERS,
  INTENTS.REOPEN_BUFFER,
  INTENTS.OPEN_URL_IN_SPLIT,
  INTENTS.OPEN_SETTINGS_BUFFER,
  INTENTS.OPEN_NOTIFICATIONS_BUFFER,
  INTENTS.BOOKMARKS_ADD_SCOPED_PROMPT,
  INTENTS.DOWNLOADS_LIVE_MODAL,
  INTENTS.TELESCOPE_OPEN_HISTORY,
  INTENTS.TELESCOPE_OPEN_BOOKMARKS,
  INTENTS.TELESCOPE_OPEN_BUFFERS,
  INTENTS.TELESCOPE_REOPEN_LAST,
  INTENTS.SESSION_RESTORE,
  INTENTS.SPLIT_VERTICAL,
  INTENTS.SPLIT_CLOSE_RIGHT,
  INTENTS.SPLIT_DEVTOOLS,
  INTENTS.FOCUS_SPLIT_LEFT,
  INTENTS.FOCUS_SPLIT_RIGHT,
]);

function getActiveBufferIndex(buffers, activeBuffer) {
  if (!buffers || typeof buffers.getBuffers !== "function" || !activeBuffer) {
    return -1;
  }

  return buffers.getBuffers().findIndex((buffer) => buffer === activeBuffer);
}

function closesActiveBuffer(intent, activeBuffer) {
  if (!activeBuffer) return true;
  if (intent.id === undefined || intent.id === null) return true;
  return intent.id === activeBuffer.id;
}

function switchesActiveBuffer(intent, activeBuffer) {
  if (!activeBuffer) return true;
  return intent.id !== activeBuffer.id;
}

function closeSideChangesSearchContext(intent, buffers, activeBuffer) {
  if (intent.index === undefined) return false;

  const activeIndex = getActiveBufferIndex(buffers, activeBuffer);
  if (activeIndex === -1) return true;

  if (intent.type === INTENTS.CLOSE_LEFT_BUFFERS) {
    return activeIndex < intent.index;
  }

  if (intent.type === INTENTS.CLOSE_RIGHT_BUFFERS) {
    return activeIndex > intent.index;
  }

  return false;
}

function shouldExitSearchForLeaderAction(intent, buffers) {
  if (!intent || typeof intent !== "object") return false;

  const activeBuffer =
    buffers && typeof buffers.getActive === "function" ? buffers.getActive() : null;

  if (intent.type === INTENTS.CLOSE_BUFFER) {
    return closesActiveBuffer(intent, activeBuffer);
  }

  if (intent.type === INTENTS.SWITCH_BUFFER) {
    return switchesActiveBuffer(intent, activeBuffer);
  }

  if (
    intent.type === INTENTS.CLOSE_LEFT_BUFFERS ||
    intent.type === INTENTS.CLOSE_RIGHT_BUFFERS
  ) {
    return closeSideChangesSearchContext(intent, buffers, activeBuffer);
  }

  return SEARCH_CONTEXT_CHANGING_INTENTS.has(intent.type);
}

function wrapSearchLeaderIntent(intent, buffers) {
  const action = intent?.next;
  if (action && shouldExitSearchForLeaderAction(action, buffers)) {
    return {
      ...intent,
      next: {
        type: INTENTS.SEARCH_CLEAR,
        next: action,
      },
    };
  }

  if (shouldExitSearchForLeaderAction(intent, buffers)) {
    return {
      type: INTENTS.SEARCH_CLEAR,
      next: intent,
    };
  }

  return intent;
}

function toSearchChar(input) {
  if (input.ctrl || input.alt || input.meta) {
    return null;
  }

  if (input.key === "Space") {
    return " ";
  }

  if (typeof input.key === "string" && input.key.length === 1) {
    return input.key;
  }

  return null;
}

function handlePromptInput(state, input) {
  if (typeof input.pasteText === "string" && input.pasteText.length > 0) {
    return {
      type: INTENTS.SEARCH_APPEND_TEXT,
      text: input.pasteText,
    };
  }

  if (input.key === "Escape") {
    return { type: INTENTS.SEARCH_CLEAR };
  }

  if (input.key === "Enter") {
    return { type: INTENTS.SEARCH_SUBMIT, query: state.searchQuery };
  }

  if (input.key === "Backspace") {
    return { type: INTENTS.SEARCH_BACKSPACE };
  }

  const char = toSearchChar(input);
  if (char !== null) {
    return {
      type: INTENTS.SEARCH_APPEND_TEXT,
      text: char,
    };
  }

  return null;
}

function handleSearch(state, input, options = {}) {
  if (state.searchPromptVisible) {
    return handlePromptInput(state, input);
  }

  if (state.searchHintMode) {
    if (input.key === "Escape") {
      return { type: INTENTS.SEARCH_HINT_INPUT, input: "" };
    }
    const char = toSearchChar(input);
    if (char !== null) {
      return {
        type: INTENTS.SEARCH_HINT_INPUT,
        input: `${state.searchHintInput}${char.toLowerCase()}`,
      };
    }
    return null;
  }

  const leaderIntent = handleLeaderInput(state, input, Date.now(), options.buffers);
  if (leaderIntent) {
    return wrapSearchLeaderIntent(leaderIntent, options.buffers);
  }

  if (isModPressed(input)) {
    const action = getModAction(input.key);
    if (action) {
      const intent = action(state, 1);
      rememberRepeatableIntent(state, intent, action.actionId);
      return intent;
    }
  }

  if (input.key === "Escape") {
    return { type: INTENTS.SEARCH_CLEAR };
  }

  const keymap = getSearchKeymap();
  const action = keymap[input.key];
  if (action) {
    return action(state, 1);
  }

  if (input.key === "Enter") {
    return { type: INTENTS.SEARCH_OPEN_PROMPT };
  }

  return null;
}

module.exports = { handleSearch, shouldExitSearchForLeaderAction };
