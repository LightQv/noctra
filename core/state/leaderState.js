function resetLeaderSession(state) {
  state.leaderActive = false;
  state.leaderPath = [];
  state.leaderNumericBuffer = "";
  state.leaderLastKeyTime = 0;
}

function startLeaderSession(state, now) {
  state.leaderActive = true;
  state.leaderPath = [];
  state.leaderNumericBuffer = "";
  state.leaderLastKeyTime = now;
}

function pushLeaderPath(state, key, now) {
  state.leaderPath = [...state.leaderPath, key];
  state.leaderLastKeyTime = now;
}

function popLeaderPath(state, now) {
  state.leaderPath = state.leaderPath.slice(0, -1);
  state.leaderLastKeyTime = now;
}

function appendLeaderNumeric(state, digit, now) {
  state.leaderNumericBuffer += digit;
  state.leaderLastKeyTime = now;
}

function popLeaderNumeric(state, now) {
  state.leaderNumericBuffer = state.leaderNumericBuffer.slice(0, -1);
  state.leaderLastKeyTime = now;
}

function touchLeaderSession(state, now) {
  state.leaderLastKeyTime = now;
}

function resetSequenceBuffers(state) {
  state.keyBuffer = "";
  state.countBuffer = "";
}

function appendCountDigit(state, digit) {
  state.countBuffer += digit;
}

function appendKeyBuffer(state, key) {
  state.keyBuffer += key;
}

function clearKeyBuffer(state) {
  state.keyBuffer = "";
}

module.exports = {
  resetLeaderSession,
  startLeaderSession,
  pushLeaderPath,
  popLeaderPath,
  appendLeaderNumeric,
  popLeaderNumeric,
  touchLeaderSession,
  resetSequenceBuffers,
  appendCountDigit,
  appendKeyBuffer,
  clearKeyBuffer,
};
