const { app } = require("electron");
const buffers = require("../browser/manager");
const uiShell = require("../ui/shell/manager");
const configService = require("./config/service");
const { INTENTS, isKnownIntentType } = require("./intents");
const { buildSearchUrl } = require("./resolver");

function normalizeUrl(rawUrl) {
  const value = rawUrl.trim();
  if (!value) return null;

  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value)) {
    return value;
  }

  return `https://${value}`;
}

function dispatch(win, intent, state) {
  if (!intent) return;

  if (!isKnownIntentType(intent.type)) {
    console.warn("Unknown intent type:", intent.type, intent);
    return;
  }

  const buf = buffers.getActive();

  if (!buf) return;

  switch (intent.type) {
    case INTENTS.NOOP:
      break;

    case INTENTS.SCROLL:
      buf.webContents.executeJavaScript(
        `window.scrollBy(0, ${intent.direction === "down" ? intent.amount : -intent.amount})`,
      );
      break;

    case INTENTS.SCROLL_TOP:
      buf.webContents.executeJavaScript(
        `window.scrollTo({top: 0, behavior: "instant"})`,
      );
      break;

    case INTENTS.SCROLL_BOTTOM:
      buf.webContents.executeJavaScript(`
				window.scrollTo({
					top: document.documentElement.scrollHeight,
					behavior: "instant"
				});
			`);
      break;

    case INTENTS.PAGE_DOWN:
      buf.webContents.executeJavaScript(
        `window.scrollBy(0, Math.floor(window.innerHeight * 0.9))`,
      );
      break;

    case INTENTS.PAGE_UP:
      buf.webContents.executeJavaScript(
        `window.scrollBy(0, -Math.floor(window.innerHeight * 0.9))`,
      );
      break;

    case INTENTS.NAV_BACK:
      buf.webContents.navigationHistory.goBack();
      break;

    case INTENTS.NAV_FORWARD:
      buf.webContents.navigationHistory.goForward();
      break;

    case INTENTS.ENTER_INSERT:
    case INTENTS.ENTER_NORMAL:
      // state already changed in motion layer
      break;

    case INTENTS.SHOW_COMMAND:
      uiShell.showCommand(state.commandBuffer);
      buffers.focusActive();
      break;

    case INTENTS.HIDE_COMMAND:
      uiShell.hideCommand();
      buffers.focusActive();
      break;

    case INTENTS.COMMAND_INPUT:
      uiShell.updateCommand(state.commandBuffer);
      break;

    case INTENTS.SHOW_WHICHKEY:
      uiShell.showWhichKey(intent.model || null, intent.timeoutMs, intent.delayMs);
      break;

    case INTENTS.UPDATE_WHICHKEY:
      uiShell.updateWhichKey(intent.model || null, intent.timeoutMs, intent.delayMs);
      break;

    case INTENTS.HIDE_WHICHKEY:
      uiShell.hideWhichKey();
      break;

    case INTENTS.OPEN_URL_PROMPT:
      state.mode = "COMMAND";
      state.commandBuffer = "open ";
      dispatch(win, { type: INTENTS.SHOW_COMMAND }, state);
      dispatch(win, { type: INTENTS.COMMAND_INPUT }, state);
      break;

    case INTENTS.OPEN_URL: {
      const normalized = normalizeUrl(intent.url || "");
      if (!normalized) {
        console.warn("OPEN_URL intent missing URL", intent);
        break;
      }
      buf.load(normalized);
      break;
    }

    case INTENTS.SEARCH_WEB: {
      const searchUrl = buildSearchUrl(intent.engine, intent.query);
      if (!searchUrl) {
        console.warn("SEARCH_WEB intent has unknown engine", intent);
        break;
      }
      buf.load(searchUrl);
      break;
    }

    case INTENTS.NEW_BUFFER: {
      buffers.create(intent.url || "about:blank");
      break;
    }

    case INTENTS.BUFFER_NEXT:
      buffers.switchByOffset(1);
      break;

    case INTENTS.BUFFER_PREV:
      buffers.switchByOffset(-1);
      break;

    case INTENTS.SWITCH_BUFFER:
      buffers.switchTo(intent.id);
      break;

    case INTENTS.CLOSE_BUFFER:
      buffers.close(intent.id ?? null);
      break;

    case INTENTS.CLOSE_LEFT_BUFFERS:
      buffers.closeLeftOfActive();
      break;

    case INTENTS.CLOSE_RIGHT_BUFFERS:
      buffers.closeRightOfActive();
      break;

    case INTENTS.SPLIT_VERTICAL: {
      const ratio = configService.getConfigValue("split.regular_ratio", 0.5);
      buffers.openVerticalSplit(ratio);
      break;
    }

    case INTENTS.SPLIT_CLOSE_RIGHT:
      buffers.closeRightSplit();
      break;

    case INTENTS.SPLIT_DEVTOOLS: {
      const ratio = configService.getConfigValue("split.devtools_ratio", 0.25);
      buffers.openDevtoolsSplit(ratio);
      break;
    }

    case INTENTS.FOCUS_SPLIT_LEFT:
      if (!buffers.focusSplitLeft()) {
        buffers.switchByOffset(-1);
      }
      break;

    case INTENTS.FOCUS_SPLIT_RIGHT:
      if (!buffers.focusSplitRight()) {
        buffers.switchByOffset(1);
      }
      break;

    case INTENTS.CONFIG_RELOAD: {
      const config = configService.reloadConfig();
      if (typeof state.applyConfig === "function") {
        state.applyConfig(config);
      }
      console.info("Configuration reloaded from", configService.getConfigPath());
      break;
    }

    case INTENTS.QUIT:
      app.quit();
      break;

    case INTENTS.UNKNOWN_COMMAND:
      console.warn("Unknown command:", intent.raw);
      break;
  }

  uiShell.updateStatuslineMode(state.mode);

  if (intent.next) {
    dispatch(win, intent.next, state);
  }
}

module.exports = { dispatch };
