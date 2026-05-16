const buffers = require("../browser/manager");
const sidepanelController = require("./sidepanel/controller");
const telescopeService = require("./telescope/service");
const { resolveSemanticContext } = require("./semanticContextResolver");

function computeStatuslineModeLabel(state) {
  if (telescopeService.isActive()) {
    return telescopeService.getMode();
  }

  if (state.mode === "COMMAND") {
    return "COMMAND";
  }

  if (sidepanelController.isVisible() && sidepanelController.isFocused()) {
    return "TREE:NORMAL";
  }

  const active = buffers.getActive();
  if (!active || !active.isEditable) {
    return state.mode;
  }

  if (resolveSemanticContext({ state, buffers, sidepanelController }) === "editor") {
    return `EDITOR:${state.editorMode || "NORMAL"}`;
  }

  return `SHELL:${state.mode}`;
}

module.exports = {
  computeStatuslineModeLabel,
};
