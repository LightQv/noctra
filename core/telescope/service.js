const buffers = require("../../browser/manager");
const historyService = require("../history/service");
const bookmarksService = require("../bookmarks/service");
const { INTENTS } = require("../intents");

function normalizeText(value) {
  return String(value || "").toLowerCase();
}

function fuzzyScore(query, candidate) {
  const needle = normalizeText(query).trim();
  const haystack = normalizeText(candidate);
  if (!needle) return 0;

  let score = 0;
  let hIdx = 0;
  let streak = 0;

  for (let qIdx = 0; qIdx < needle.length; qIdx += 1) {
    const qChar = needle[qIdx];
    let found = false;
    while (hIdx < haystack.length) {
      if (haystack[hIdx] === qChar) {
        score += 1 + streak * 2;
        streak += 1;
        hIdx += 1;
        found = true;
        break;
      }
      streak = 0;
      hIdx += 1;
    }
    if (!found) return Number.NEGATIVE_INFINITY;
  }

  return score;
}

function formatDateTime(value) {
  const timestampMs = Number.isFinite(value) ? value : Date.parse(String(value || ""));
  if (!Number.isFinite(timestampMs)) return "--";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestampMs));
}

function flattenBookmarks(nodes = [], output = []) {
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    if (node.type === "entry") {
      const url = String(node.url || "").trim();
      if (!url) continue;
      const title = String(node.title || url).trim() || url;
      output.push({
        key: String(node.id || `${url}-${output.length}`),
        title,
        subtitle: url,
        rightText: "",
        action: { type: "url", url },
      });
    } else if (node.type === "folder" && Array.isArray(node.children)) {
      flattenBookmarks(node.children, output);
    }
  }
  return output;
}

class TelescopeService {
  constructor() {
    this.active = false;
    this.mode = "INSERT";
    this.context = "history";
    this.query = "";
    this.selectedIndex = 0;
    this.items = [];
    this.filteredItems = [];
    this.lastSession = null;
    this.pendingG = false;
    this.promptPosition = "top";
  }

  isActive() {
    return this.active;
  }

  getMode() {
    return this.mode;
  }

  getContextLabel() {
    if (this.context === "bookmarks") return "Bookmarks";
    if (this.context === "buffers") return "Buffers";
    return "History";
  }

  buildItemsForContext(context) {
    if (context === "history") {
      const days = historyService.readHistoryTree();
      const items = [];
      for (const day of days) {
        const entries = Array.isArray(day.entries) ? day.entries : [];
        for (const entry of entries) {
          const url = String(entry.url || "").trim();
          if (!url) continue;
          const title = String(entry.title || url).trim() || url;
          items.push({
            key: String(entry.id || `${url}-${items.length}`),
            title,
            subtitle: url,
            rightText: formatDateTime(entry.timestampMs || entry.timestampIso),
            action: { type: "url", url },
          });
        }
      }
      return items;
    }

    if (context === "bookmarks") {
      const tree = bookmarksService.readBookmarksTree();
      return flattenBookmarks(tree.root || []);
    }

    const all = buffers.getBuffers();
    return all.map((buffer, index) => {
      const id = Number.isFinite(buffer?.id) ? buffer.id : index + 1;
      const title = String(buffer?.title || "[No title]").trim() || "[No title]";
      return {
        key: String(id),
        title,
        subtitle: `${id}:`,
        rightText: "",
        action: { type: "buffer", id },
      };
    });
  }

  recomputeResults() {
    const scored = [];
    for (let index = 0; index < this.items.length; index += 1) {
      const item = this.items[index];
      const score = fuzzyScore(this.query, `${item.title} ${item.subtitle} ${item.rightText}`);
      if (score === Number.NEGATIVE_INFINITY) continue;
      scored.push({ item, score, index });
    }
    scored.sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.index - right.index;
    });
    this.filteredItems = scored.map((entry) => entry.item);
    this.selectedIndex = this.filteredItems.length
      ? Math.max(0, Math.min(this.selectedIndex, this.filteredItems.length - 1))
      : 0;
  }

  buildModel() {
    const total = this.filteredItems.length;
    return {
      title: this.getContextLabel(),
      query: this.query,
      counter: `${total > 0 ? this.selectedIndex + 1 : 0} / ${total}`,
      mode: this.mode,
      promptPosition: this.promptPosition,
      items: this.filteredItems.map((item, index) => ({
        primary: `${item.title} ~ ${item.subtitle}`,
        rightText: item.rightText,
        selected: index === this.selectedIndex,
      })),
    };
  }

  open(context, options = {}) {
    this.active = true;
    this.mode = "INSERT";
    this.pendingG = false;
    this.context = context === "bookmarks" || context === "buffers" ? context : "history";
    this.promptPosition = options.promptPosition === "bottom" ? "bottom" : "top";
    this.query = typeof options.query === "string" ? options.query : "";
    this.selectedIndex = Number.isFinite(options.selectedIndex)
      ? Math.max(0, Math.floor(options.selectedIndex))
      : 0;
    this.items = this.buildItemsForContext(this.context);
    this.recomputeResults();
    return this.buildModel();
  }

  reopenLast(promptPosition = "top") {
    if (!this.lastSession) return null;
    return this.open(this.lastSession.context, {
      query: this.lastSession.query,
      selectedIndex: this.lastSession.selectedIndex,
      promptPosition,
    });
  }

  rememberLastSession() {
    this.lastSession = {
      context: this.context,
      query: this.query,
      selectedIndex: this.selectedIndex,
    };
  }

  close() {
    this.active = false;
    this.mode = "INSERT";
    this.pendingG = false;
    this.query = "";
    this.selectedIndex = 0;
    this.items = [];
    this.filteredItems = [];
  }

  move(delta) {
    if (!this.filteredItems.length) return;
    const length = this.filteredItems.length;
    this.selectedIndex = (this.selectedIndex + delta + length) % length;
  }

  submit(openInNewBuffer = false) {
    if (!this.filteredItems.length) return null;
    const selected = this.filteredItems[this.selectedIndex];
    if (!selected || !selected.action) return null;
    this.rememberLastSession();
    if (selected.action.type === "buffer") {
      return { type: INTENTS.SWITCH_BUFFER, id: selected.action.id };
    }
    if (openInNewBuffer) {
      return { type: INTENTS.NEW_BUFFER, url: selected.action.url };
    }
    return { type: INTENTS.OPEN_URL, url: selected.action.url };
  }

  handleInput(input) {
    if (!this.active || !input || input.type !== "keyDown") {
      return { consumed: false, close: false, intent: null, modeChanged: false };
    }

    const key = String(input.key || "");
    const lower = key.toLowerCase();
    const isCtrlNav = input.ctrl && !input.meta && !input.alt;

    if (key === "Escape") {
      this.pendingG = false;
      if (this.mode === "INSERT") {
        this.mode = "NORMAL";
        return { consumed: true, close: false, intent: null, modeChanged: true };
      }
      this.rememberLastSession();
      return { consumed: true, close: true, intent: null, modeChanged: false };
    }

    if (key === "Enter") {
      const intent = this.submit(Boolean(input.shift));
      return { consumed: true, close: true, intent, modeChanged: false };
    }

    if (this.mode === "INSERT") {
      if (key === "ArrowUp" || key === "k" || (isCtrlNav && lower === "p")) {
        this.move(-1);
        return { consumed: true, close: false, intent: null, modeChanged: false };
      }
      if (key === "ArrowDown" || key === "j" || (isCtrlNav && lower === "n")) {
        this.move(1);
        return { consumed: true, close: false, intent: null, modeChanged: false };
      }
      if (key === "Backspace") {
        this.pendingG = false;
        if (this.query.length > 0) {
          this.query = this.query.slice(0, -1);
          this.selectedIndex = 0;
          this.recomputeResults();
        }
        return { consumed: true, close: false, intent: null, modeChanged: false };
      }
      if (key.length === 1 && !input.ctrl && !input.meta && !input.alt) {
        this.pendingG = false;
        this.query += key;
        this.selectedIndex = 0;
        this.recomputeResults();
        return { consumed: true, close: false, intent: null, modeChanged: false };
      }
      return { consumed: true, close: false, intent: null, modeChanged: false };
    }

    if (key === "ArrowUp" || key === "k" || (isCtrlNav && lower === "p")) {
      this.pendingG = false;
      this.move(-1);
      return { consumed: true, close: false, intent: null, modeChanged: false };
    }
    if (key === "ArrowDown" || key === "j" || (isCtrlNav && lower === "n")) {
      this.pendingG = false;
      this.move(1);
      return { consumed: true, close: false, intent: null, modeChanged: false };
    }
    if (key === "G") {
      this.pendingG = false;
      if (this.filteredItems.length > 0) this.selectedIndex = this.filteredItems.length - 1;
      return { consumed: true, close: false, intent: null, modeChanged: false };
    }
    if (key === "g") {
      if (this.pendingG) {
        this.pendingG = false;
        this.selectedIndex = 0;
      } else {
        this.pendingG = true;
      }
      return { consumed: true, close: false, intent: null, modeChanged: false };
    }

    this.pendingG = false;
    return { consumed: true, close: false, intent: null, modeChanged: false };
  }
}

module.exports = new TelescopeService();
