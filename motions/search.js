const { INTENTS } = require("../core/intents");
const { getModAction, getSearchKeymap } = require("./keymap");
const { isModPressed } = require("./modifiers");
const { rememberRepeatableIntent } = require("./repeat");

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

function handleSearch(state, input) {
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

module.exports = { handleSearch };
