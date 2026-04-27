const state = {
  mode: "NORMAL",
  interactionContext: "SHELL",
  editorMode: "NORMAL",
  keyBuffer: "",
  countBuffer: "",
  commandBuffer: "",
  commandCursorIndex: 0,
  commandTarget: "SHELL",
  leaderKey: "Space",
  leaderActive: false,
  leaderPath: [],
  leaderNumericBuffer: "",
  leaderLastKeyTime: 0,
  whichKeyEnabled: true,
  whichKeyDisplayDelay: 180,
  whichKeyTimeout: 1200,
  urllineEditing: false,
  urllinePane: "left",
  urllineBuffer: "",
  urllineCursorIndex: 0,
  lastKeyTime: 0,
  sequenceTimeout: 500,
  lastRepeatableIntent: null,
};

function applyConfig(config) {
  if (!config || typeof config !== "object") {
    return;
  }

  const globalConfig = config.global && typeof config.global === "object" ? config.global : {};
  const inputConfig = globalConfig.input;
  const whichKeyConfig = globalConfig.whichkey;

  if (inputConfig && typeof inputConfig.leader_key === "string") {
    state.leaderKey = inputConfig.leader_key;
  }

  if (inputConfig && Number.isFinite(inputConfig.sequence_timeout_ms)) {
    state.sequenceTimeout = inputConfig.sequence_timeout_ms;
  }

  if (whichKeyConfig) {
    if (typeof whichKeyConfig.enabled === "boolean") {
      state.whichKeyEnabled = whichKeyConfig.enabled;
    }

    if (Number.isFinite(whichKeyConfig.display_delay_ms)) {
      state.whichKeyDisplayDelay = whichKeyConfig.display_delay_ms;
    }

    const timeout = whichKeyConfig.timeout_ms;
    if (timeout === null || Number.isFinite(timeout)) {
      state.whichKeyTimeout = timeout;
    }
  }
}

state.applyConfig = applyConfig;

module.exports = state;
