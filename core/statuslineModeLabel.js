const buffers = require("../browser/manager");
const historyPanel = require("./history/panel");
const telescopeService = require("./telescope/service");
const { resolveSemanticContext } = require("./semanticContextResolver");

function computeStatuslineModeLabel(state) {
  if (telescopeService.isActive()) {
    return telescopeService.getMode();
  }

  if (state.mode === "COMMAND") {
    return "COMMAND";
  }

  if (historyPanel.isVisible() && historyPanel.isFocused()) {
    return "TREE:NORMAL";
  }

  const active = buffers.getActive();
  if (!active || !active.isEditable) {
    return state.mode;
  }

  if (resolveSemanticContext({ state, buffers, historyPanel }) === "editor") {
    return `EDITOR:${state.editorMode || "NORMAL"}`;
  }

  return `SHELL:${state.mode}`;
}

module.exports = {
  computeStatuslineModeLabel,
};
