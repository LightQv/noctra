function isPrimaryModifierPressed(normalized, platform) {
  if (!normalized) return false;
  if (platform === "darwin") {
    return Boolean(normalized.meta && !normalized.ctrl);
  }
  return Boolean(normalized.ctrl && !normalized.meta);
}

function isModPasteShortcut(normalized, platform) {
  if (!normalized || normalized.type !== "keyDown") return false;
  if (normalized.key !== "v" && normalized.key !== "V") return false;
  if (platform === "darwin") {
    return Boolean(normalized.meta && !normalized.ctrl);
  }
  return Boolean(normalized.ctrl && !normalized.meta);
}

function shouldPrioritizeLeaderKey(normalized, focusSnapshot, state) {
  const leaderKey = (state && state.leaderKey) || "Space";
  const key = normalized && normalized.key;
  const isLeader =
    leaderKey === "Space" ? key === "Space" || key === " " : key === leaderKey;
  return Boolean(
    normalized &&
    normalized.type === "keyDown" &&
    focusSnapshot &&
    !focusSnapshot.sidepanelTextInputActive &&
    ((state && state.leaderActive) || isLeader),
  );
}

function resolveInputPriority(normalized, focusSnapshot, state, platform) {
  const shouldPrioritizeLeader = shouldPrioritizeLeaderKey(
    normalized,
    focusSnapshot,
    state,
  );
  const primaryMod = isPrimaryModifierPressed(normalized, platform);

  const isOpenSettingsShortcut = Boolean(
    normalized &&
    normalized.type === "keyDown" &&
    (normalized.key === "," || normalized.key === "Comma") &&
    ((platform === "darwin" && normalized.meta) ||
      (platform !== "darwin" && normalized.ctrl)),
  );

  const isBufferShortcut = Boolean(
    normalized &&
    normalized.type === "keyDown" &&
    primaryMod &&
    !normalized.alt &&
    (normalized.key === "t" || normalized.key === "T"),
  );

  const shouldBypassToNativeMenu = Boolean(
    normalized &&
      normalized.type === "keyDown" &&
      platform === "darwin" &&
      normalized.meta &&
      !normalized.ctrl,
  );

  return {
    shouldPrioritizeLeader,
    shouldRouteFocusedTreeInput:
      Boolean(focusSnapshot && focusSnapshot.sidepanelFocused) &&
      !shouldPrioritizeLeader,
    isUrllinePasteShortcut:
      Boolean(focusSnapshot && focusSnapshot.urllineEditing) &&
      isModPasteShortcut(normalized, platform),
    shouldRouteUrllineInput: Boolean(
      focusSnapshot && focusSnapshot.urllineEditing,
    ),
    isCommandPasteShortcut:
      Boolean(focusSnapshot && focusSnapshot.commandMode) &&
      isModPasteShortcut(normalized, platform),
    isOpenSettingsShortcut,
    isBufferShortcut,
    shouldBypassToNativeMenu,
  };
}

module.exports = {
  resolveInputPriority,
};
