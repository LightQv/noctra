const { INTENTS } = require("./intents");
const { resolveInputTarget } = require("./resolver");
const configService = require("./config/service");

function getUrlPolicyConfig() {
  return {
    allowHttpLoopback: configService.getConfigValue(
      "browser.allow_http_loopback",
      true,
    ),
    allowHttpPrivateLan: configService.getConfigValue(
      "browser.allow_http_private_lan",
      true,
    ),
    trustedHttpHosts: configService.getConfigValue(
      "browser.trusted_http_hosts",
      [],
    ),
  };
}

function parseCommand(raw) {
  const normalized = raw.trim();
  if (!normalized) {
    return { type: INTENTS.NOOP };
  }

  const match = normalized.match(/^(\S+)\s*(.*)$/);
  const cmdToken = match ? match[1] : normalized;
  const hasBang = cmdToken.endsWith("!");
  const cmd = hasBang ? cmdToken.slice(0, -1) : cmdToken;
  const arg = match ? match[2].trim() : "";

  switch (cmd) {
    case "open":
      if (!arg) {
        return { type: INTENTS.UNKNOWN_COMMAND, raw };
      }
      {
        const target = resolveInputTarget(arg, {
          defaultSearchEngine: "duckduckgo",
          urlPolicy: getUrlPolicyConfig(),
        });
        if (target.kind === "invalid") {
          return { type: INTENTS.UNKNOWN_COMMAND, raw };
        }
        return { type: INTENTS.OPEN_URL, url: target.url };
      }

    case "tab":
    case "tabe":
    case "tabnew":
      if (!arg) {
        return { type: INTENTS.NEW_BUFFER };
      }
      {
        const target = resolveInputTarget(arg, {
          defaultSearchEngine: "duckduckgo",
          urlPolicy: getUrlPolicyConfig(),
        });
        if (target.kind === "invalid") {
          return { type: INTENTS.UNKNOWN_COMMAND, raw };
        }
        return { type: INTENTS.NEW_BUFFER, url: target.url };
      }

    case "bnext":
      return { type: INTENTS.BUFFER_NEXT };

    case "bprev":
      return { type: INTENTS.BUFFER_PREV };

    case "buffer": {
      const bufferId = Number.parseInt(arg, 10);
      if (!Number.isInteger(bufferId)) {
        return { type: INTENTS.UNKNOWN_COMMAND, raw };
      }
      return { type: INTENTS.SWITCH_BUFFER, id: bufferId };
    }

    case "bdelete": {
      const bufferId = arg ? Number.parseInt(arg, 10) : null;
      if (arg && !Number.isInteger(bufferId)) {
        return { type: INTENTS.UNKNOWN_COMMAND, raw };
      }
      return { type: INTENTS.CLOSE_BUFFER, id: bufferId };
    }

    case "q":
    case "wq":
      return { type: INTENTS.CLOSE_BUFFER };

    case "breopen":
    case "brestore":
    case "reopen":
      return { type: INTENTS.REOPEN_BUFFER };

    case "bcloseleft":
      return { type: INTENTS.CLOSE_LEFT_BUFFERS };

    case "bcloseright":
      return { type: INTENTS.CLOSE_RIGHT_BUFFERS };

    case "split":
      return { type: INTENTS.SPLIT_VERTICAL };

    case "splitq":
      return { type: INTENTS.SPLIT_CLOSE_RIGHT };

    case "splitd":
      return { type: INTENTS.SPLIT_DEVTOOLS };

    case "config-reload":
      return { type: INTENTS.CONFIG_RELOAD };

    case "urlline": {
      const option = arg.toLowerCase();
      if (!option || option === "toggle") {
        return { type: INTENTS.TOGGLE_URLLINE };
      }

      if (["on", "enable", "enabled", "true", "1"].includes(option)) {
        return { type: INTENTS.SET_URLLINE_VISIBILITY, enabled: true };
      }

      if (["off", "disable", "disabled", "false", "0"].includes(option)) {
        return { type: INTENTS.SET_URLLINE_VISIBILITY, enabled: false };
      }

      return { type: INTENTS.UNKNOWN_COMMAND, raw };
    }

    case "settings":
    case "config":
      return { type: INTENTS.OPEN_SETTINGS_BUFFER };

    case "notifications":
    case "notifs":
      return { type: INTENTS.OPEN_NOTIFICATIONS_BUFFER };

    case "theme": {
      const mode = arg.toLowerCase();
      if (!["dark", "light", "auto", "custom"].includes(mode)) {
        return { type: INTENTS.UNKNOWN_COMMAND, raw };
      }
      return { type: INTENTS.SET_THEME_MODE, mode };
    }

    case "lang": {
      const argToken = arg.toLowerCase();
      const argHasBang = argToken.endsWith("!");
      const language = argHasBang ? argToken.slice(0, -1) : argToken;
      const reload = hasBang || argHasBang;
      if (!["en", "fr"].includes(language)) {
        return { type: INTENTS.UNKNOWN_COMMAND, raw };
      }
      return {
        type: INTENTS.SET_BROWSER_LANGUAGE,
        language,
        reload,
      };
    }

    case "copy-selection": {
      const option = arg.toLowerCase();
      if (!option || option === "toggle") {
        return { type: INTENTS.TOGGLE_COPY_SELECTION_TO_CLIPBOARD };
      }

      if (["on", "enable", "enabled", "true", "1"].includes(option)) {
        return {
          type: INTENTS.TOGGLE_COPY_SELECTION_TO_CLIPBOARD,
          enabled: true,
        };
      }

      if (["off", "disable", "disabled", "false", "0"].includes(option)) {
        return {
          type: INTENTS.TOGGLE_COPY_SELECTION_TO_CLIPBOARD,
          enabled: false,
        };
      }

      return { type: INTENTS.UNKNOWN_COMMAND, raw };
    }

    case "focus-context":
    case "context":
      return { type: INTENTS.TOGGLE_FOCUS_CONTEXT };

    case "history": {
      const option = arg.toLowerCase();
      if (!option || option === "show") return { type: INTENTS.HISTORY_SHOW };
      if (option === "hide") return { type: INTENTS.HISTORY_HIDE };
      if (option === "toggle") return { type: INTENTS.HISTORY_TOGGLE };
      if (option === "focus") return { type: INTENTS.HISTORY_TOGGLE_FOCUS };
      if (option === "delete-all") return { type: INTENTS.HISTORY_DELETE_ALL };
      if (option === "delete-today")
        return { type: INTENTS.HISTORY_DELETE_TODAY };
      return { type: INTENTS.UNKNOWN_COMMAND, raw };
    }

    case "bookmarks": {
      const option = arg.toLowerCase();
      if (!option || option === "show") return { type: INTENTS.BOOKMARKS_SHOW };
      if (option === "hide") return { type: INTENTS.BOOKMARKS_HIDE };
      if (option === "toggle") return { type: INTENTS.BOOKMARKS_TOGGLE };
      if (option === "focus") return { type: INTENTS.BOOKMARKS_TOGGLE_FOCUS };
      if (option === "delete-all")
        return { type: INTENTS.BOOKMARKS_DELETE_ALL };
      if (option === "import") return { type: INTENTS.BOOKMARKS_IMPORT };
      return { type: INTENTS.UNKNOWN_COMMAND, raw };
    }

    case "downloads": {
      const option = arg.toLowerCase();
      if (!option || option === "show") return { type: INTENTS.DOWNLOADS_SHOW };
      if (option === "hide") return { type: INTENTS.DOWNLOADS_HIDE };
      if (option === "toggle") return { type: INTENTS.DOWNLOADS_TOGGLE };
      if (option === "focus") return { type: INTENTS.DOWNLOADS_TOGGLE_FOCUS };
      if (option === "clear-all")
        return { type: INTENTS.DOWNLOADS_CLEAR_ALL };
      if (option === "live")
        return { type: INTENTS.DOWNLOADS_LIVE_MODAL };
      return { type: INTENTS.UNKNOWN_COMMAND, raw };
    }

    case "session": {
      const option = arg.toLowerCase();
      if (option === "save") return { type: INTENTS.SESSION_SAVE };
      if (option === "restore") return { type: INTENTS.SESSION_RESTORE };
      return { type: INTENTS.UNKNOWN_COMMAND, raw };
    }

    case "duck":
      return {
        type: INTENTS.SEARCH_WEB,
        engine: "duckduckgo",
        query: arg,
      };

    case "google":
      return {
        type: INTENTS.SEARCH_WEB,
        engine: "google",
        query: arg,
      };

    case "quit":
      return { type: INTENTS.QUIT };

    default:
      return { type: INTENTS.UNKNOWN_COMMAND, raw };
  }
}

module.exports = { parseCommand };
