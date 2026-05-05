const { getNormalKeymap } = require("./keymap");
const { handleMod, isModPressed } = require("./modifiers");
const { INTENTS } = require("../core/intents");
const { getLeaderNode, getWhichKeyModel } = require("./leaderMap");
const { rememberRepeatableIntent } = require("./repeat");
const buffers = require("../browser/manager");

function buildLeaderContext() {
  return {
    activeBuffer: buffers.getActive(),
  };
}

function isLeaderKey(key, leaderKey) {
  if (leaderKey === "Space") {
    return key === "Space" || key === " ";
  }

  return key === leaderKey;
}

function resetLeaderSession(state) {
  state.leaderActive = false;
  state.leaderPath = [];
  state.leaderNumericBuffer = "";
  state.leaderLastKeyTime = 0;
}

function hideWhichKeyAndReset(state) {
  resetLeaderSession(state);

  if (!state.whichKeyEnabled) {
    return null;
  }

  return { type: INTENTS.HIDE_WHICHKEY };
}

function showWhichKey(state) {
  if (!state.whichKeyEnabled) {
    return null;
  }

  return {
    type: INTENTS.SHOW_WHICHKEY,
    model: getWhichKeyModel(state.leaderPath, state.leaderNumericBuffer, buildLeaderContext()),
    delayMs: state.whichKeyDisplayDelay,
    timeoutMs: state.whichKeyTimeout,
  };
}

function updateWhichKey(state) {
  if (!state.whichKeyEnabled) {
    return null;
  }

  return {
    type: INTENTS.UPDATE_WHICHKEY,
    model: getWhichKeyModel(state.leaderPath, state.leaderNumericBuffer, buildLeaderContext()),
    delayMs: state.whichKeyDisplayDelay,
    timeoutMs: state.whichKeyTimeout,
  };
}

function handleLeaderSequence(state, input, now) {
  const { key } = input;

  if (key === "Shift" || key === "Control" || key === "Alt" || key === "Meta") {
    return updateWhichKey(state);
  }

  if (key === "Escape") {
    return hideWhichKeyAndReset(state);
  }

  if (key === "Backspace") {
    if (state.leaderNumericBuffer.length > 0) {
      state.leaderNumericBuffer = state.leaderNumericBuffer.slice(0, -1);
      state.leaderLastKeyTime = now;

      if (!state.leaderNumericBuffer) {
        return updateWhichKey(state);
      }

      return {
        type: INTENTS.SWITCH_BUFFER,
        id: Number.parseInt(state.leaderNumericBuffer, 10),
        next: updateWhichKey(state),
      };
    }

    if (state.leaderPath.length > 0) {
      state.leaderPath = state.leaderPath.slice(0, -1);
      state.leaderLastKeyTime = now;
      return updateWhichKey(state);
    }

    return hideWhichKeyAndReset(state);
  }

  if (key === "Enter" && state.leaderPath.length === 0) {
    return hideWhichKeyAndReset(state);
  }

  if (typeof key !== "string") {
    return hideWhichKeyAndReset(state);
  }

  const loweredKey = key.toLowerCase();

  if (state.leaderNumericBuffer.length > 0 || /[0-9]/.test(loweredKey)) {
    if (!/[0-9]/.test(loweredKey)) {
      return hideWhichKeyAndReset(state);
    }

    state.leaderNumericBuffer += loweredKey;
    state.leaderLastKeyTime = now;

    return {
      type: INTENTS.SWITCH_BUFFER,
      id: Number.parseInt(state.leaderNumericBuffer, 10),
      next: updateWhichKey(state),
    };
  }

  const node = getLeaderNode(state.leaderPath, buildLeaderContext());
  const exactChild = node?.children?.[key];
  const loweredChild = node?.children?.[loweredKey];
  const child = exactChild || loweredChild;

  if (!child) {
    return hideWhichKeyAndReset(state);
  }

  if (child.children) {
    const matchedKey = exactChild ? key : loweredKey;
    state.leaderPath = [...state.leaderPath, matchedKey];
    state.leaderLastKeyTime = now;
    return updateWhichKey(state);
  }

  if (child.action) {
    const intent = child.action(state, 1);
    rememberRepeatableIntent(state, intent, child.action.actionId);
    resetLeaderSession(state);

    return {
      type: INTENTS.HIDE_WHICHKEY,
      next: intent,
    };
  }

  return hideWhichKeyAndReset(state);
}

function handleNormal(state, input) {
  const now = Date.now();

  if (
    state.leaderActive &&
    Number.isFinite(state.whichKeyTimeout) &&
    now - state.leaderLastKeyTime > state.whichKeyTimeout
  ) {
    resetLeaderSession(state);
    if (state.whichKeyEnabled) {
      return { type: INTENTS.HIDE_WHICHKEY };
    }
  }

  if (now - state.lastKeyTime > state.sequenceTimeout) {
    state.keyBuffer = "";
    state.countBuffer = "";
  }

  state.lastKeyTime = now;

  const { key } = input;
  const mod = isModPressed(input);
  const leaderKey = state.leaderKey || "Space";

  if (state.leaderActive) {
    return handleLeaderSequence(state, input, now);
  }

  if (key === ":") {
    state.mode = "COMMAND";
    state.commandBuffer = "";
    state.commandCursorIndex = 0;
    state.commandTarget = "SHELL";
    return { type: INTENTS.SHOW_COMMAND };
  }

  if (isLeaderKey(key, leaderKey)) {
    state.leaderActive = true;
    state.leaderPath = [];
    state.leaderNumericBuffer = "";
    state.leaderLastKeyTime = now;
    state.keyBuffer = "";
    state.countBuffer = "";
    return showWhichKey(state);
  }

  if (!mod && /[0-9]/.test(key)) {
    state.countBuffer += key;
    return null;
  }

  if (mod) {
    return handleMod(state, key);
  }

  state.keyBuffer += key;

  const keymap = getNormalKeymap();
  const match = keymap[state.keyBuffer];

  if (match) {
    const count = parseInt(state.countBuffer || "1", 10);
    state.countBuffer = "";
    state.keyBuffer = "";

    const intent = match(state, count);
    rememberRepeatableIntent(state, intent, match.actionId);
    return intent;
  }

  if (state.keyBuffer.length > 3) {
    state.keyBuffer = "";
  }

  return null;
}

module.exports = { handleNormal };
