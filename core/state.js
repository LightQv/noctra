function createState() {
  const nextState = {
    mode: "NORMAL",
    editorFocus: false,
    editorMode: "NORMAL",
    keyBuffer: "",
    countBuffer: "",
    commandBuffer: "",
    commandCursorIndex: 0,
    commandTarget: "SHELL",
    searchQuery: "",
    searchPromptVisible: false,
    searchActive: false,
    searchMatchIndex: 0,
    searchMatchTotal: 0,
    searchRequestId: null,
    searchHintMode: false,
    searchHintInput: "",
    searchVisibleHintCount: 0,
    searchLastActiveRect: null,
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

  nextState.applyConfig = function applyConfig(config) {
    if (!config || typeof config !== "object") {
      return;
    }

    const globalConfig =
      config.global && typeof config.global === "object" ? config.global : {};
    const inputConfig = globalConfig.input;
    const whichKeyConfig = globalConfig.whichkey;

    if (inputConfig && typeof inputConfig.leader_key === "string") {
      this.leaderKey = inputConfig.leader_key;
    }

    if (inputConfig && Number.isFinite(inputConfig.sequence_timeout_ms)) {
      this.sequenceTimeout = inputConfig.sequence_timeout_ms;
    }

    if (whichKeyConfig) {
      if (typeof whichKeyConfig.enabled === "boolean") {
        this.whichKeyEnabled = whichKeyConfig.enabled;
      }

      if (Number.isFinite(whichKeyConfig.display_delay_ms)) {
        this.whichKeyDisplayDelay = whichKeyConfig.display_delay_ms;
      }

      const timeout = whichKeyConfig.timeout_ms;
      if (timeout === null || Number.isFinite(timeout)) {
        this.whichKeyTimeout = timeout;
      }
    }
  };

  return nextState;
}

const state = createState();

module.exports = state;
module.exports.createState = createState;
