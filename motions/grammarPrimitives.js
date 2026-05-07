function hasSequenceTimedOut(now, lastKeyTime, timeoutMs) {
  if (!Number.isFinite(timeoutMs) || !lastKeyTime) {
    return false;
  }

  return now - lastKeyTime > timeoutMs;
}

function consumePositiveCount(buffer, defaultCount = 1) {
  const count = Number.parseInt(buffer || String(defaultCount), 10);
  return Number.isFinite(count) && count > 0 ? count : defaultCount;
}

function resolveKeySequenceMatch(keymap, keyBuffer) {
  const exact = keymap[keyBuffer] || null;
  if (exact) {
    return { exact, hasPrefix: true };
  }

  const hasPrefix = Object.keys(keymap).some((mapped) => mapped.startsWith(keyBuffer));
  return { exact: null, hasPrefix };
}

module.exports = {
  hasSequenceTimedOut,
  consumePositiveCount,
  resolveKeySequenceMatch,
};
