const { INTENTS } = require("../core/intents");
const { getSearchKeymap } = require("./keymap");
const {
  setSearchQuery,
  setSearchPromptVisible,
} = require("../core/state/searchState");

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
    setSearchQuery(state, `${state.searchQuery}${input.pasteText}`);
    return { type: INTENTS.COMMAND_INPUT };
  }

  if (input.key === "Escape") {
    return { type: INTENTS.SEARCH_CLEAR };
  }

  if (input.key === "Enter") {
    return { type: INTENTS.SEARCH_SUBMIT, query: state.searchQuery };
  }

  if (input.key === "Backspace") {
    setSearchQuery(state, state.searchQuery.slice(0, -1));
    return { type: INTENTS.COMMAND_INPUT };
  }

  const char = toSearchChar(input);
  if (char !== null) {
    setSearchQuery(state, `${state.searchQuery}${char}`);
    return { type: INTENTS.COMMAND_INPUT };
  }

  return null;
}

function handleSearch(state, input) {
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

  if (state.searchPromptVisible) {
    return handlePromptInput(state, input);
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
    setSearchPromptVisible(state, true);
    return { type: INTENTS.SEARCH_OPEN_PROMPT };
  }

  return null;
}

module.exports = { handleSearch };
