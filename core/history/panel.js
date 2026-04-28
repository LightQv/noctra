const { BrowserView, clipboard } = require("electron");
const historyService = require("./service");
const {
  UI_SHELL_TABLINE_HEIGHT,
  UI_SHELL_STATUSLINE_HEIGHT,
} = require("../../ui/constants");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

class HistoryPanel {
  constructor() {
    this.window = null;
    this.buffers = null;
    this.state = null;
    this.visible = false;
    this.focused = false;
    this.widthRatio = 0.2;
    this.showTimestamp = true;
    this.days = [];
    this.expanded = new Set();
    this.cursor = { type: "day", dateKey: null, entryId: null };
    this.confirmDeleteAll = "";
    this.deleteAllArmed = false;
    this.previousContext = "SHELL";
    this.view = null;
    this.onFocusChange = null;
    this.renderTimer = null;
    this.lastRenderedHtml = "";
  }

  init({ window, buffers, state }) {
    this.window = window;
    this.buffers = buffers;
    this.state = state;
    this.view = new BrowserView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    this.window.addBrowserView(this.view);
    this.view.webContents.on("before-mouse-event", (_event, input) => {
      if (!input || input.type !== "mouseDown") return;
      this.focus();
    });
    this.view.webContents.on("focus", () => {
      this.focus();
    });
    this.applyHiddenBounds();
    this.render();
  }

  setOnFocusChange(callback) {
    this.onFocusChange = typeof callback === "function" ? callback : null;
  }

  emitFocusChange() {
    if (typeof this.onFocusChange === "function") {
      this.onFocusChange({ visible: this.visible, focused: this.focused });
    }
  }

  getWebContents() {
    if (!this.view || !this.view.webContents || this.view.webContents.isDestroyed()) {
      return null;
    }
    return this.view.webContents;
  }

  setWidthRatio(ratio) {
    if (Number.isFinite(ratio) && ratio >= 0.1 && ratio <= 0.6) {
      this.widthRatio = ratio;
      this.layout();
    }
  }

  reloadData() {
    this.days = historyService.readHistoryTree();
    const known = new Set(this.days.map((d) => d.key));
    this.expanded = new Set([...this.expanded].filter((key) => known.has(key)));
    if (this.days.length > 0 && !this.cursor.dateKey) {
      this.cursor = { type: "day", dateKey: this.days[0].key, entryId: null };
    }
  }

  show() {
    if (this.visible) return;
    this.visible = true;
    this.reloadData();
    this.layout();
    this.render();
  }

  hide() {
    if (!this.visible) return;
    this.visible = false;
    this.focused = false;
    this.confirmDeleteAll = "";
    this.deleteAllArmed = false;
    if (this.state) this.state.interactionContext = this.previousContext || "SHELL";
    this.buffers.setLeftInset(0);
    this.applyHiddenBounds();
    this.clearRenderTimer();
    this.emitFocusChange();
  }

  toggle() {
    if (this.visible) {
      this.hide();
      return;
    }
    this.show();
    this.focus();
  }

  focus() {
    if (!this.visible || this.focused) return;
    this.previousContext = this.state ? this.state.interactionContext : "SHELL";
    this.focused = true;
    if (this.state) {
      this.state.interactionContext = "TREE";
      this.state.mode = "NORMAL";
    }
    if (this.window && this.view && typeof this.window.setTopBrowserView === "function") {
      this.window.setTopBrowserView(this.view);
    }
    this.render();
    this.emitFocusChange();
  }

  unfocus() {
    if (!this.focused) return;
    this.focused = false;
    if (this.state) this.state.interactionContext = this.previousContext || "SHELL";
    this.render();
    this.emitFocusChange();
  }

  toggleFocus() {
    if (!this.visible) {
      this.show();
      this.focus();
      return;
    }
    if (this.focused) this.unfocus();
    else this.focus();
  }

  isVisible() {
    return this.visible;
  }

  isFocused() {
    return this.focused;
  }

  getWidthPx() {
    if (!this.visible || !this.window) return 0;
    return Math.max(220, Math.floor(this.window.getContentBounds().width * this.widthRatio));
  }

  layout() {
    if (!this.window || !this.view) return;
    if (!this.visible) return this.applyHiddenBounds();

    const bounds = this.window.getContentBounds();
    const width = this.getWidthPx();
    const y = UI_SHELL_TABLINE_HEIGHT;
    const height = Math.max(bounds.height - UI_SHELL_TABLINE_HEIGHT - UI_SHELL_STATUSLINE_HEIGHT, 1);

    this.buffers.setLeftInset(width);
    this.view.setBounds({ x: 0, y, width, height });
    this.view.setAutoResize({ width: false, height: true });
    if (this.focused && typeof this.window.setTopBrowserView === "function") {
      this.window.setTopBrowserView(this.view);
    }
  }

  applyHiddenBounds() {
    if (!this.view) return;
    this.view.setBounds({ x: -10000, y: -10000, width: 1, height: 1 });
    this.view.setAutoResize({ width: false, height: false });
  }

  getFlatNodes() {
    const nodes = [];
    for (const day of this.days) {
      nodes.push({ type: "day", dateKey: day.key, entry: null });
      if (this.expanded.has(day.key)) {
        for (const entry of day.entries) {
          nodes.push({ type: "entry", dateKey: day.key, entry });
        }
      }
    }
    return nodes;
  }

  moveCursor(delta) {
    const nodes = this.getFlatNodes();
    if (!nodes.length) return;
    let idx = nodes.findIndex(
      (node) =>
        node.type === this.cursor.type &&
        node.dateKey === this.cursor.dateKey &&
        String(node.entry?.id || "") === String(this.cursor.entryId || ""),
    );
    if (idx === -1) idx = 0;
    idx = Math.max(0, Math.min(nodes.length - 1, idx + delta));
    const node = nodes[idx];
    this.cursor = {
      type: node.type,
      dateKey: node.dateKey,
      entryId: node.entry ? node.entry.id : null,
    };
  }

  getCurrentEntry() {
    if (this.cursor.type !== "entry") return null;
    const day = this.days.find((item) => item.key === this.cursor.dateKey);
    return day ? day.entries.find((item) => item.id === this.cursor.entryId) : null;
  }

  openCurrent(newTab = false) {
    const entry = this.getCurrentEntry();
    if (!entry || !entry.url) return;
    if (newTab) {
      this.buffers.create(entry.url);
      this.unfocus();
      this.buffers.focusActive();
      return;
    }
    const active = this.buffers.getActive();
    if (active && !active.isEditable) {
      active.load(entry.url);
      this.unfocus();
      this.buffers.focusActive();
    }
  }

  deleteCurrent() {
    const beforeNodes = this.getFlatNodes();
    const beforeIndex = beforeNodes.findIndex(
      (node) =>
        node.type === this.cursor.type &&
        node.dateKey === this.cursor.dateKey &&
        String(node.entry?.id || "") === String(this.cursor.entryId || ""),
    );
    const deletedType = this.cursor.type;
    const deletedDateKey = this.cursor.dateKey;

    if (this.cursor.type === "day") {
      historyService.deleteDate(this.cursor.dateKey);
    } else if (this.cursor.type === "entry") {
      historyService.deleteEntry(this.cursor.dateKey, this.cursor.entryId);
    }

    this.reloadData();

    if (deletedType === "entry") {
      const day = this.days.find((item) => item.key === deletedDateKey);
      if (day && Array.isArray(day.entries) && day.entries.length > 0) {
        const nextNodes = this.getFlatNodes();
        const baseIndex = beforeIndex >= 0 ? Math.min(beforeIndex, nextNodes.length - 1) : 0;

        for (let idx = baseIndex; idx >= 0; idx -= 1) {
          const candidate = nextNodes[idx];
          if (candidate && candidate.type === "entry" && candidate.dateKey === deletedDateKey) {
            this.cursor = {
              type: "entry",
              dateKey: candidate.dateKey,
              entryId: candidate.entry ? candidate.entry.id : null,
            };
            return;
          }
        }

        const firstEntry = day.entries[0];
        this.cursor = {
          type: "entry",
          dateKey: day.key,
          entryId: firstEntry ? firstEntry.id : null,
        };
        return;
      }

      if (day) {
        this.cursor = { type: "day", dateKey: day.key, entryId: null };
        return;
      }
    }

    const first = this.getFlatNodes()[0];
    this.cursor = first
      ? { type: first.type, dateKey: first.dateKey, entryId: first.entry ? first.entry.id : null }
      : { type: "day", dateKey: null, entryId: null };
  }

  formatTime(entry) {
    const ts = Number.isFinite(entry.timestampMs) ? entry.timestampMs : Date.parse(entry.timestampIso || "");
    if (!Number.isFinite(ts)) return "--:--";
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ts));
  }

  render() {
    if (!this.view || this.view.webContents.isDestroyed()) return;

    const rows = [];
    for (const day of this.days) {
      const isDaySelected = this.cursor.type === "day" && this.cursor.dateKey === day.key;
      const isOpen = this.expanded.has(day.key);
      rows.push(
        `<div class="row day ${isDaySelected ? "selected" : ""}"><span class="cursor"></span><span class="name"><span class="tree-cols"><span class="icon">${isOpen ? "" : ""}</span></span><span class="text">${escapeHtml(day.key)}</span></span><span class="time"></span></div>`,
      );

      if (isOpen) {
        if (!day.entries.length) {
          rows.push(
            `<div class="row entry empty"><span class="cursor"></span><span class="name"><span class="tree-cols"><span class="icon guide">└</span></span><span class="text empty-label">No item yet.</span></span><span class="time"></span></div>`,
          );
        } else {
          for (let index = 0; index < day.entries.length; index += 1) {
            const entry = day.entries[index];
            const selected = this.cursor.type === "entry" && this.cursor.entryId === entry.id;
            const time = escapeHtml(this.formatTime(entry));
            const branch = index === day.entries.length - 1 ? "└" : "│";
            rows.push(
              `<div class="row entry ${selected ? "selected" : ""}"><span class="cursor"></span><span class="name"><span class="tree-cols"><span class="icon guide">${branch}</span></span><span class="file-icon"></span><span class="text">${escapeHtml(entry.title || entry.url)}</span></span><span class="time ${this.showTimestamp ? "visible" : ""}">${time}</span></div>`,
            );
          }
        }
      }
    }

    const confirmText = this.deleteAllArmed
      ? `Delete all history? type yes + Enter: ${escapeHtml(this.confirmDeleteAll)}`
      : "";

    const html = `<!doctype html><html><body><style>
      html,body{height:100%}
      body{margin:0;background:var(--ui-bg-panel,#161b24);color:var(--ui-text,#c9d1df);font:12px "JetBrainsMono Nerd Font Mono", monospace;border-right:1px solid var(--ui-border-strong,#2a3140);box-sizing:border-box}
      .wrap{display:flex;flex-direction:column;height:100%}
      .head{padding:8px 10px;border-bottom:1px solid var(--ui-border,#2f3440);color:var(--ui-accent,#89dceb)}
      .list{padding:6px 0;overflow:auto;flex:1}
      .row{display:flex;align-items:stretch;gap:0;min-height:22px}
      .cursor{width:6px;flex:0 0 6px;background:transparent;border-radius:1px}
      .name{display:flex;align-items:center;gap:0;flex:1;min-width:0;padding:0 8px 0 6px;overflow:hidden;line-height:18px}
      .time{width:64px;flex:0 0 64px;padding:0 8px 0 0;text-align:right;color:var(--ui-text-muted,#7f8aa3);white-space:nowrap;line-height:18px;display:flex;align-items:center;justify-content:flex-end}
      .time:not(.visible){visibility:hidden}
      .day{color:var(--ui-accent,#89dceb)}
      .selected{background:var(--ui-bg-subtle,#1f2735)}
      .focused .selected .cursor{background:var(--ui-editor-cursor,#89dceb)}
      .unfocused .selected{background:color-mix(in srgb, var(--ui-bg-subtle,#1f2735) 55%, transparent)}
      .unfocused .selected .cursor{background:var(--ui-text-muted,#7f8aa3);opacity:.45}
      .tree-cols{display:inline-flex;align-items:center;justify-content:center;flex:0 0 1.2em;margin-right:4px}
      .caret{display:none}
      .icon{display:inline-flex;align-items:center;justify-content:center;width:1.2em;font-size:18px;line-height:1}
      .file-icon{display:inline-flex;align-items:center;justify-content:center;flex:0 0 1em;margin-right:4px;color:var(--ui-text-soft,#b6c7e8)}
      .guide{color:var(--ui-text-muted,#7f8aa3)}
      .text{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
      .empty-label{font-style:italic;color:var(--ui-text-muted,#7f8aa3)}
      .foot{min-height:18px;padding:4px 8px;color:#f9c97b}
    </style><div class="wrap ${this.focused ? "focused" : "unfocused"}"><div class="head">History</div><div class="list">${rows.join("")}</div><div class="foot">${confirmText}</div></div></body></html>`;

    this.scheduleRender(html);
  }

  clearRenderTimer() {
    if (!this.renderTimer) return;
    clearTimeout(this.renderTimer);
    this.renderTimer = null;
  }

  scheduleRender(html) {
    if (!this.view || this.view.webContents.isDestroyed()) return;
    if (html === this.lastRenderedHtml) return;

    this.lastRenderedHtml = html;
    this.clearRenderTimer();
    this.renderTimer = setTimeout(() => {
      this.renderTimer = null;
      if (!this.view || this.view.webContents.isDestroyed()) return;
      this.view.webContents.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(this.lastRenderedHtml)}`);
    }, 16);
  }

  handleFocusedInput(input) {
    if (!this.visible || !this.focused || !input || input.type !== "keyDown") return false;
    if (this.state && this.state.mode === "COMMAND") return false;
    const key = input.key;

    if (this.deleteAllArmed) {
      if (key === "Enter") {
        if (this.confirmDeleteAll.toLowerCase() === "yes") historyService.deleteAll();
        this.confirmDeleteAll = "";
        this.deleteAllArmed = false;
        this.reloadData();
        this.render();
        return true;
      }
      if (key === "Escape") {
        this.confirmDeleteAll = "";
        this.deleteAllArmed = false;
        this.render();
        return true;
      }
      if (key === "Backspace") {
        this.confirmDeleteAll = this.confirmDeleteAll.slice(0, -1);
        this.render();
        return true;
      }
      if (!input.ctrl && !input.meta && !input.alt && typeof key === "string" && key.length === 1) {
        this.confirmDeleteAll += key;
        this.render();
        return true;
      }
      return true;
    }

    if (key === "j" || key === "ArrowDown") this.moveCursor(1);
    else if (key === "k" || key === "ArrowUp") this.moveCursor(-1);
    else if (key === "l" || key === "ArrowRight") {
      if (this.cursor.type === "day") this.expanded.add(this.cursor.dateKey);
    } else if (key === "h" || key === "ArrowLeft") {
      if (this.cursor.type === "day") {
        this.expanded.delete(this.cursor.dateKey);
      } else {
        this.expanded.delete(this.cursor.dateKey);
        this.cursor = { type: "day", dateKey: this.cursor.dateKey, entryId: null };
      }
    } else if (key === "Enter") this.openCurrent(Boolean(input.shift));
    else if (key === "y") {
      const entry = this.getCurrentEntry();
      if (entry && entry.url) {
        clipboard.writeText(String(entry.url));
        console.info("URL yanked.");
      }
    }
    else if (key === "d") this.deleteCurrent();
    else if (key === "D") {
      this.confirmDeleteAll = "";
      this.deleteAllArmed = true;
    } else if (key === "t") this.showTimestamp = !this.showTimestamp;
    else if (key === "Escape") this.unfocus();
    else return false;

    this.render();
    return true;
  }
}

module.exports = new HistoryPanel();
