const { INTENTS } = require("./intents");
const { resolveInputTarget } = require("./resolver");

function parseCommand(raw) {
  const normalized = raw.trim();
  if (!normalized) {
    return { type: INTENTS.NOOP };
  }

  const match = normalized.match(/^(\S+)\s*(.*)$/);
  const cmd = match ? match[1] : normalized;
  const arg = match ? match[2].trim() : "";

  switch (cmd) {
    case "open":
      if (!arg) {
        return { type: INTENTS.UNKNOWN_COMMAND, raw };
      }
      {
        const target = resolveInputTarget(arg, {
          defaultSearchEngine: "duckduckgo",
        });
        if (target.kind === "invalid") {
          return { type: INTENTS.UNKNOWN_COMMAND, raw };
        }
        return { type: INTENTS.OPEN_URL, url: target.url };
      }

    case "tabnew":
      if (!arg) {
        return { type: INTENTS.NEW_BUFFER };
      }
      {
        const target = resolveInputTarget(arg, {
          defaultSearchEngine: "duckduckgo",
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

    case "focus-context":
    case "context":
      return { type: INTENTS.TOGGLE_FOCUS_CONTEXT };

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
