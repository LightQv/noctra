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
  if (isPaused) return "⏸";
  return "▶";
}

function getRightText(entry) {
  const { state, progress, formattedTotal, formattedReceived } = entry;
  if (state === "progressing") {
    const pct = Math.round(progress * 100);
    return `${pct}% · ${formattedReceived} / ${formattedTotal}`;
  }
  if (state === "paused") {
    return `${formattedReceived} / ${formattedTotal}`;
  }
  if (state === "completed") {
    return formattedTotal;
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
    const { active } = downloadsService.getEntries();
    const liveItems = active.filter(
      (a) => a.state === "progressing" || a.state === "paused",
    );

    if (liveItems.length === 0) {
      uiShell.showNotificationToast({
        severity: "info",
        message: "No active downloads",
        timeoutMs: 2000,
      });
      return;
    }

    this.items = liveItems.map((entry) => ({ ...entry }));
    this.selectedIndex = 0;
    this.active = true;

    this.unsubscribe = downloadsService.subscribe((snapshot) => {
      if (!this.active) return;
      // Merge live updates into our snapshot; keep stale items
      const activeMap = new Map();
      for (const a of snapshot.active) {
        activeMap.set(a.id, a);
      }
      for (let i = 0; i < this.items.length; i += 1) {
        const updated = activeMap.get(this.items[i].id);
        if (updated) {
          this.items[i] = { ...updated };
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
    const items = this.items.map((entry, index) => ({
      glyph: getStateGlyph(entry.state, entry.isPaused),
      filename: entry.filename,
      bar: buildProgressBar(entry.progress),
      rightText: getRightText(entry),
      selected: index === this.selectedIndex,
    }));

    return {
      title: "Live Downloads",
      items,
      footerLeft: `${this.items.length} item${this.items.length !== 1 ? "s" : ""}`,
      footerRight: "j/k nav · p pause/resume · c cancel · o open · Esc close",
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
