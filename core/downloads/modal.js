const uiShell = require("../../ui/shell/manager");
const downloadsService = require("./service");
const buffers = require("../../browser/manager");

const BAR_WIDTH = 28;

function buildProgressBar(progress) {
  const filled = Math.max(0, Math.min(BAR_WIDTH, Math.round(progress * BAR_WIDTH)));
  const empty = BAR_WIDTH - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}

function getStateGlyph(state, isPaused) {
  if (state === "completed") return "✓";
  if (state === "cancelled") return "✗";
  if (state === "interrupted") return "⚠";
  if (isPaused || state === "paused") return "⏸";
  return "▶";
}

function getRightText(entry) {
  const { state, progress, formattedTotal, formattedReceived } = entry;
  if (state === "progressing") {
    const pct = Math.round((Number.isFinite(progress) ? progress : 0) * 100);
    return `${pct}% · ${formattedReceived} / ${formattedTotal}`;
  }
  if (state === "paused") {
    return `${formattedReceived} / ${formattedTotal}`;
  }
  if (state === "completed") {
    return formattedTotal;
  }
  if (state === "cancelled" || state === "interrupted") {
    return state.charAt(0).toUpperCase() + state.slice(1);
  }
  return `${formattedReceived} / ${formattedTotal}`;
}

class DownloadsModal {
  constructor() {
    this.active = false;
    this.items = [];
    this.selectedIndex = 0;
    this.unsubscribe = null;
  }

  isActive() {
    return this.active;
  }

  open() {
    const { active, persisted } = downloadsService.getEntries();

    // Combine active and persisted, deduplicate (active wins)
    const seen = new Set();
    const combined = [];
    for (const a of active) {
      combined.push(a);
      seen.add(a.id);
    }
    for (const p of persisted) {
      if (!seen.has(p.id)) {
        combined.push(p);
      }
    }

    // Sort: unfinished first, then by startTime desc
    const isUnfinished = (e) => e.state === "progressing" || e.state === "paused";
    combined.sort((a, b) => {
      const aUnfinished = isUnfinished(a);
      const bUnfinished = isUnfinished(b);
      if (aUnfinished && !bUnfinished) return -1;
      if (!aUnfinished && bUnfinished) return 1;
      return (b.startTime || 0) - (a.startTime || 0);
    });

    const items = combined.slice(0, 5);

    if (items.length === 0) {
      uiShell.showNotificationToast({
        severity: "info",
        message: "No downloads",
        timeoutMs: 2000,
      });
      return;
    }

    this.items = items.map((entry) => ({ ...entry }));
    this.selectedIndex = 0;
    this.active = true;

    this.unsubscribe = downloadsService.subscribe((snapshot) => {
      if (!this.active) return;
      // Merge updates from both active and persisted; keep stale items
      const mergedMap = new Map();
      for (const a of snapshot.active) mergedMap.set(a.id, a);
      for (const p of snapshot.persisted) {
        if (!mergedMap.has(p.id)) mergedMap.set(p.id, p);
      }
      for (let i = 0; i < this.items.length; i += 1) {
        const updated = mergedMap.get(this.items[i].id);
        if (updated) {
          this.items[i] = {
            ...updated,
            progress: Number.isFinite(updated.progress)
              ? updated.progress
              : updated.totalBytes > 0
                ? updated.receivedBytes / updated.totalBytes
                : 0,
          };
        }
      }
      this.rerender();
    });

    uiShell.showDownloadsModal(this.buildModel());
  }

  close() {
    this.active = false;
    this.items = [];
    this.selectedIndex = 0;
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    uiShell.hideDownloadsModal();
  }

  buildModel() {
    const items = this.items.map((entry, index) => {
      const progress = Number.isFinite(entry.progress)
        ? entry.progress
        : entry.totalBytes > 0
          ? entry.receivedBytes / entry.totalBytes
          : 0;
      return {
        glyph: getStateGlyph(entry.state, entry.isPaused),
        filename: entry.filename,
        bar: buildProgressBar(progress),
        rightText: getRightText({ ...entry, progress }),
        selected: index === this.selectedIndex,
      };
    });

    return {
      title: "Downloads",
      items,
      footerLeft: `${this.items.length} item${this.items.length !== 1 ? "s" : ""}`,
      footerRight: "j/k nav · p pause/resume · c cancel · o open · r retry · d folder · Esc close",
    };
  }

  rerender() {
    if (!this.active) return;
    uiShell.updateDownloadsModal(this.buildModel());
  }

  getSelectedEntry() {
    if (this.items.length === 0) return null;
    const idx = Math.max(0, Math.min(this.selectedIndex, this.items.length - 1));
    return this.items[idx] || null;
  }

  selectIndex(index) {
    if (!this.active || this.items.length === 0) return false;
    const idx = Number.isFinite(index) ? Math.floor(index) : -1;
    if (idx < 0 || idx >= this.items.length) return false;
    this.selectedIndex = idx;
    this.rerender();
    return true;
  }

  clickIndex(index, clickCount = 1) {
    if (!this.active || this.items.length === 0) return false;
    const idx = Number.isFinite(index) ? Math.floor(index) : -1;
    if (idx < 0 || idx >= this.items.length) return false;
    this.selectedIndex = idx;
    const entry = this.items[idx];
    if (!entry) {
      this.rerender();
      return false;
    }

    const isUnfinished = entry.state === "progressing" || entry.state === "paused";
    if (isUnfinished) {
      if (clickCount >= 2) {
        if (entry.isPaused || entry.state === "paused") {
          downloadsService.resume(entry.id);
        } else {
          downloadsService.pause(entry.id);
        }
      } else {
        this.rerender();
      }
      return true;
    }

    if (clickCount >= 2) {
      downloadsService.openFile(entry.id);
      return true;
    }
    downloadsService.showInFolder(entry.id);
    return true;
  }

  handleInput(input) {
    if (!this.active || !input || input.type !== "keyDown") {
      return false;
    }

    const key = String(input.key || "");

    if (key === "Escape") {
      this.close();
      return true;
    }

    if (key === "j" || key === "ArrowDown") {
      if (this.items.length > 0) {
        this.selectedIndex = (this.selectedIndex + 1) % this.items.length;
        this.rerender();
      }
      return true;
    }

    if (key === "k" || key === "ArrowUp") {
      if (this.items.length > 0) {
        this.selectedIndex =
          (this.selectedIndex - 1 + this.items.length) % this.items.length;
        this.rerender();
      }
      return true;
    }

    const entry = this.getSelectedEntry();
    if (!entry) return true;

    if (key === "p") {
      if (entry.isPaused) {
        downloadsService.resume(entry.id);
      } else {
        downloadsService.pause(entry.id);
      }
      return true;
    }

    if (key === "c" || key === "x") {
      downloadsService.cancel(entry.id);
      return true;
    }

    if (key === "o" || key === "Enter") {
      downloadsService.openFile(entry.id);
      return true;
    }

    if (key === "r") {
      const retryInfo = downloadsService.getRetryInfo(entry.id);
      if (retryInfo && retryInfo.url) {
        const active = buffers.getActive();
        if (active && active.webContents && !active.isEditable) {
          active.webContents.downloadURL(retryInfo.url);
        }
      }
      return true;
    }

    if (key === "d") {
      downloadsService.showInFolder(entry.id);
      return true;
    }

    return true;
  }
}

module.exports = new DownloadsModal();
