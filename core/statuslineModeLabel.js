const buffers = require("../browser/manager");
const sidepanelController = require("./sidepanel/controller");
const telescopeService = require("./telescope/service");
const { resolveSemanticContext } = require("./semanticContextResolver");

function createStatuslineModeLabelResolver(deps = {}) {
  const localBuffers = deps.buffers || buffers;
  const localSidepanelController = deps.sidepanelController || sidepanelController;
  const localTelescopeService = deps.telescopeService || telescopeService;

  return function computeStatuslineModeLabel(state) {
    if (localTelescopeService.isActive()) {
      return localTelescopeService.getMode();
    }

    if (state.mode === "COMMAND") {
      return "COMMAND";
    }

    if (
      localSidepanelController.isVisible() &&
      localSidepanelController.isFocused()
    ) {
      return "TREE:NORMAL";
    }

    const active = localBuffers.getActive();
    if (!active || !active.isEditable) {
      return state.mode;
    }

    if (
      resolveSemanticContext({
        state,
        buffers: localBuffers,
        sidepanelController: localSidepanelController,
      }) === "editor"
    ) {
      return `EDITOR:${state.editorMode || "NORMAL"}`;
    }

    return `SHELL:${state.mode}`;
  };
}

const computeStatuslineModeLabel = createStatuslineModeLabelResolver();

module.exports = {
  computeStatuslineModeLabel,
  createStatuslineModeLabelResolver,
};
