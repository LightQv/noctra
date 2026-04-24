const state = {
  mode: "NORMAL",
  interactionContext: "SHELL",
  editorMode: "NORMAL",
  keyBuffer: "",
  countBuffer: "",
  commandBuffer: "",
  leaderKey: "Space",
  leaderActive: false,
  leaderPath: [],
  leaderNumericBuffer: "",
  leaderLastKeyTime: 0,
  whichKeyEnabled: true,
  whichKeyDisplayDelay: 180,
  whichKeyTimeout: 1200,
  lastKeyTime: 0,
  sequenceTimeout: 500,
  lastRepeatableIntent: null,
};

function applyConfig(config) {
  if (!config || typeof config !== "object") {
    return;
  }

  if (config.input && typeof config.input.leader_key === "string") {
    state.leaderKey = config.input.leader_key;
  }

  if (config.input && Number.isFinite(config.input.sequence_timeout_ms)) {
    state.sequenceTimeout = config.input.sequence_timeout_ms;
  }

  if (config.whichkey) {
    if (typeof config.whichkey.enabled === "boolean") {
      state.whichKeyEnabled = config.whichkey.enabled;
    }

    if (Number.isFinite(config.whichkey.display_delay_ms)) {
      state.whichKeyDisplayDelay = config.whichkey.display_delay_ms;
    }

    const timeout = config.whichkey.timeout_ms;
    if (timeout === null || Number.isFinite(timeout)) {
      state.whichKeyTimeout = timeout;
    }
  }
}

state.applyConfig = applyConfig;

module.exports = state;
