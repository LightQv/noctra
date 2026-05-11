const { getNormalKeymap } = require("./keymap");
const { handleMod, isModPressed } = require("./modifiers");
const { INTENTS } = require("../core/intents");
const { enterCommandMode } = require("../core/modeTransitionService");
const { getLeaderNode, getWhichKeyModel } = require("./leaderMap");
const { rememberRepeatableIntent } = require("./repeat");
const {
  hasSequenceTimedOut,
  consumePositiveCount,
} = require("./grammarPrimitives");
const {
  resetLeaderSession,
  startLeaderSession,
  pushLeaderPath,
  popLeaderPath,
  appendLeaderNumeric,
  popLeaderNumeric,
  resetSequenceBuffers,
  appendCountDigit,
  appendKeyBuffer,
  clearKeyBuffer,
} = require("../core/state/leaderState");
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
    model: getWhichKeyModel(
      state.leaderPath,
      state.leaderNumericBuffer,
      buildLeaderContext(),
    ),
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
    model: getWhichKeyModel(
      state.leaderPath,
      state.leaderNumericBuffer,
      buildLeaderContext(),
    ),
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
      popLeaderNumeric(state, now);

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
      popLeaderPath(state, now);
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

    appendLeaderNumeric(state, loweredKey, now);

    return {
      type: INTENTS.SWITCH_BUFFER,
      id: Number.parseInt(state.leaderNumericBuffer, 10),
      next: updateWhichKey(state),
    };
  }

  const node = getLeaderNode(state.leaderPath, buildLeaderContext());
  const exactChild = node?.children?.[key];
  const loweredChild = node?.children?.[loweredKey];
  const matchedKey = exactChild ? key : loweredChild ? loweredKey : null;
  const child = matchedKey ? node?.children?.[matchedKey] : null;

  if (!child) {
    return hideWhichKeyAndReset(state);
  }

  const nextNode = getLeaderNode(
    [...state.leaderPath, matchedKey],
    buildLeaderContext(),
  );
  if (!nextNode) {
    return hideWhichKeyAndReset(state);
  }

  if (child.children) {
    pushLeaderPath(state, matchedKey, now);
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

  if (hasSequenceTimedOut(now, state.lastKeyTime, state.sequenceTimeout)) {
    resetSequenceBuffers(state);
  }

  state.lastKeyTime = now;

  const { key } = input;
  const mod = isModPressed(input);
  const leaderKey = state.leaderKey || "Space";

  if (state.leaderActive) {
    return handleLeaderSequence(state, input, now);
  }

  if (key === ":") {
    enterCommandMode(state, {
      target: "SHELL",
      initialText: "",
      cursorIndex: 0,
      reason: "normal-colon",
    });
    return { type: INTENTS.SHOW_COMMAND };
  }

  if (isLeaderKey(key, leaderKey)) {
    startLeaderSession(state, now);
    resetSequenceBuffers(state);
    return showWhichKey(state);
  }

  if (!mod && /[0-9]/.test(key)) {
    appendCountDigit(state, key);
    return null;
  }

  if (mod) {
    return handleMod(state, key);
  }

  appendKeyBuffer(state, key);

  const keymap = getNormalKeymap();
  const match = keymap[state.keyBuffer];

  if (match) {
    const count = consumePositiveCount(state.countBuffer, 1);
    resetSequenceBuffers(state);

    const intent = match(state, count);
    rememberRepeatableIntent(state, intent, match.actionId);
    return intent;
  }

  if (state.keyBuffer.length > 3) {
    clearKeyBuffer(state);
  }

  return null;
}

module.exports = { handleNormal };
