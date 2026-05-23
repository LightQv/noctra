const state = require("./state");
const buffers = require("../browser/manager");
const { createHandleNormal } = require("../motions/normal");
const { handleInsert } = require("../motions/insert");
const { handleCommand } = require("../motions/command");
const { handleSearch } = require("../motions/search");
const { dispatch } = require("./dispatcher");
const sidepanelController = require("./sidepanel/controller");
const { resolveSemanticContext } = require("./semanticContextResolver");

function createInputHandler(deps = {}) {
  const localState = deps.state || state;
  const localBuffers = deps.buffers || buffers;
  const localSidepanelController = deps.sidepanelController || sidepanelController;
  const localDispatch = deps.dispatch || dispatch;
  const handleNormal =
    deps.handleNormal || createHandleNormal({ buffers: localBuffers });

  function getSemanticContext() {
    return resolveSemanticContext({
      state: localState,
      buffers: localBuffers,
      sidepanelController: localSidepanelController,
    });
  }

  function shouldPreventDefault(input) {
    if (input.type !== "keyDown") return false;

    if (localState.mode === "COMMAND") {
      return true;
    }

    const activeBuffer = localBuffers.getActive();

    if (getSemanticContext() === "editor" && activeBuffer?.isEditable) {
      return false;
    }

    switch (localState.mode) {
      case "NORMAL":
        return true;

      case "COMMAND":
        return true;

      case "INSERT":
        return input.key === "Escape";

      case "SEARCH":
        return true;

      default:
        return false;
    }
  }

  function handleInput(win, input) {
    if (input.type !== "keyDown") return;

    const activeBuffer = localBuffers.getActive();

    if (
      localState.mode !== "COMMAND" &&
      getSemanticContext() === "editor" &&
      activeBuffer?.isEditable
    ) {
      return;
    }

    let intent = null;

    switch (localState.mode) {
      case "NORMAL":
        intent = handleNormal(localState, input);
        break;

      case "INSERT":
        intent = handleInsert(localState, input.key);
        break;

      case "COMMAND":
        intent = handleCommand(localState, input);
        break;

      case "SEARCH":
        intent = handleSearch(localState, input);
        break;
    }

    if (intent) {
      localDispatch(win, intent, localState);
    }
  }

  return { handleInput, shouldPreventDefault };
}

const defaultHandler = createInputHandler();

module.exports = {
  handleInput: defaultHandler.handleInput,
  shouldPreventDefault: defaultHandler.shouldPreventDefault,
  createInputHandler,
};
