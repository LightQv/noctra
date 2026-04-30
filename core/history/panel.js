const { BrowserView, clipboard } = require("electron");
const historyService = require("./service");
const favoritesService = require("../favorites/service");
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

function pathKey(path = []) {
  return path.join("/");
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const TREE_LAYOUT = Object.freeze({
  rowMinHeight: 22,
  cursorWidth: 6,
  rightColWidth: 64,
  namePaddingLeft: 6,
  namePaddingRight: 8,
  treeColWidthEm: 1.2,
  treeColGapPx: 4,
  fileIconWidthEm: 1,
  nestIndentPx: 14,
  guideOpticalOffsetPx: 3,
});

class HistoryPanel {
  constructor() {
    this.window = null;
    this.buffers = null;
    this.state = null;
    this.visible = false;
    this.focused = false;
    this.widthRatio = 0.2;
    this.showTimestamp = true;
    this.showFavoriteCount = true;

    this.days = [];
    this.expanded = new Set();
    this.cursor = { type: "day", dateKey: null, entryId: null };

    this.favoriteRoot = [];
    this.favoriteExpanded = new Set();
    this.favoriteCursor = { nodeId: null };
    this.favoriteClipboard = null;
    this.favoriteEditState = null;
    this.favoriteUndoStack = [];
    this.favoriteRedoStack = [];
    this.maxFavoriteHistory = 50;

    this.treeKind = "history";
    this.confirmDeleteAll = "";
    this.deleteAllArmed = false;
    this.previousContext = "SHELL";
    this.view = null;
    this.onFocusChange = null;
    this.renderTimer = null;
    this.lastRenderedHtml = "";
  }

  clearFavoriteEdit() {
    this.favoriteEditState = null;
  }

  createFavoriteSnapshot() {
    return {
      root: this.deepClone(Array.isArray(this.favoriteRoot) ? this.favoriteRoot : []),
      expanded: Array.from(this.favoriteExpanded || []),
      cursor: this.deepClone(this.favoriteCursor || { nodeId: null }),
      clipboard: this.deepClone(this.favoriteClipboard),
    };
  }

  applyFavoriteSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") {
      return false;
    }

    this.favoriteRoot = this.deepClone(Array.isArray(snapshot.root) ? snapshot.root : []);
    this.favoriteExpanded = new Set(Array.isArray(snapshot.expanded) ? snapshot.expanded : []);
    this.favoriteCursor = this.deepClone(snapshot.cursor || { nodeId: null });
    this.favoriteClipboard = this.deepClone(snapshot.clipboard || null);
    this.favoriteEditState = null;
    this.deleteAllArmed = false;
    this.confirmDeleteAll = "";

    favoritesService.writeFavoritesTree({ root: this.favoriteRoot });
    this.favoriteRoot = favoritesService.readFavoritesTree().root;
    this.reconcileFavoriteState();
    return true;
  }

  recordFavoriteMutationSnapshot() {
    this.favoriteUndoStack.push(this.createFavoriteSnapshot());
    if (this.favoriteUndoStack.length > this.maxFavoriteHistory) {
      this.favoriteUndoStack.splice(0, this.favoriteUndoStack.length - this.maxFavoriteHistory);
    }
    this.favoriteRedoStack = [];
  }

  undoLastFavoriteAction() {
    if (!this.favoriteUndoStack.length) {
      return false;
    }
    const previous = this.favoriteUndoStack.pop();
    this.favoriteRedoStack.push(this.createFavoriteSnapshot());
    if (this.favoriteRedoStack.length > this.maxFavoriteHistory) {
      this.favoriteRedoStack.splice(0, this.favoriteRedoStack.length - this.maxFavoriteHistory);
    }
    return this.applyFavoriteSnapshot(previous);
  }

  redoLastFavoriteAction() {
    if (!this.favoriteRedoStack.length) {
      return false;
    }
    const next = this.favoriteRedoStack.pop();
    this.favoriteUndoStack.push(this.createFavoriteSnapshot());
    if (this.favoriteUndoStack.length > this.maxFavoriteHistory) {
      this.favoriteUndoStack.splice(0, this.favoriteUndoStack.length - this.maxFavoriteHistory);
    }
    return this.applyFavoriteSnapshot(next);
  }

  isFavoriteRedoShortcut(input) {
    if (!input || input.type !== "keyDown") {
      return false;
    }
    return Boolean(input.ctrl && !input.meta && !input.alt && String(input.key).toLowerCase() === "r");
  }

  startFavoriteRename() {
    const location = this.findFavoriteNodeLocation(this.favoriteCursor.nodeId);
    if (!location) return;
    const initialValue =
      location.node.type === "folder"
        ? String(location.node.name || "")
        : String(location.node.title || location.node.url || "");
    this.favoriteEditState = {
      mode: "rename",
      tone: "info",
      label:
        location.node.type === "folder" ? "Rename folder" : "Rename favorite",
      value: initialValue,
      cursor: initialValue.length,
      targetNodeId: location.node.id,
      targetType: location.node.type,
    };
  }

  startFavoriteAdd() {
    this.favoriteEditState = {
      mode: "add-kind",
      tone: "info",
      label: "Add",
      value: "",
      cursor: 0,
    };
  }

  clampFavoriteEditCursor(edit) {
    if (!edit) return;
    const value = String(edit.value || "");
    const len = value.length;
    const cursor = Number.isFinite(edit.cursor) ? edit.cursor : len;
    edit.cursor = Math.max(0, Math.min(len, cursor));
  }

  getActiveBufferUrl() {
    const active =
      this.buffers && typeof this.buffers.getActive === "function"
        ? this.buffers.getActive()
        : null;
    const url =
      active && typeof active.url === "string" ? active.url.trim() : "";
    return url || "https://";
  }

  resolveFavoriteInsertTarget() {
    const selectedId = this.favoriteCursor.nodeId;
    const location = selectedId
      ? this.findFavoriteNodeLocation(selectedId)
      : null;
    if (!location) {
      return {
        children: this.favoriteRoot,
        insertAt: this.favoriteRoot.length,
        expandFolderId: null,
      };
    }

    if (location.node.type === "folder") {
      const children = Array.isArray(location.node.children)
        ? location.node.children
        : [];
      location.node.children = children;
      return {
        children,
        insertAt: children.length,
        expandFolderId: location.node.id,
      };
    }

    return {
      children: location.children,
      insertAt: location.index + 1,
      expandFolderId: null,
    };
  }

  renameCurrentFavorite(nextLabel) {
    const location = this.findFavoriteNodeLocation(this.favoriteCursor.nodeId);
    if (!location) return false;
    const value = String(nextLabel || "").trim();
    if (!value) return false;
    this.recordFavoriteMutationSnapshot();
    if (location.node.type === "folder") {
      location.node.name = value;
    } else {
      location.node.title = value;
    }
    this.saveFavorites();
    this.favoriteCursor = { nodeId: location.node.id };
    return true;
  }

  createFavoriteFolderAtCursor(name) {
    const value = String(name || "").trim();
    if (!value) return false;
    this.recordFavoriteMutationSnapshot();
    const target = this.resolveFavoriteInsertTarget();
    const folder = {
      type: "folder",
      id: favoritesService.makeFolderId(),
      name: this.makeUniqueFolderName(target.children, value),
      children: [],
    };
    target.children.splice(target.insertAt, 0, folder);
    if (target.expandFolderId) this.favoriteExpanded.add(target.expandFolderId);
    this.saveFavorites();
    this.favoriteCursor = { nodeId: folder.id };
    return true;
  }

  createFavoriteEntryAtCursor(title, url) {
    const normalizedUrl = String(url || "").trim();
    if (!normalizedUrl || normalizedUrl === "https://") return false;
    this.recordFavoriteMutationSnapshot();
    const normalizedTitle = String(title || "").trim() || normalizedUrl;
    const target = this.resolveFavoriteInsertTarget();
    const entry = {
      type: "entry",
      id: favoritesService.makeEntryId(),
      title: normalizedTitle,
      url: normalizedUrl,
    };
    target.children.splice(target.insertAt, 0, entry);
    if (target.expandFolderId) this.favoriteExpanded.add(target.expandFolderId);
    this.saveFavorites();
    this.favoriteCursor = { nodeId: entry.id };
    return true;
  }

  confirmFavoriteEdit() {
    const edit = this.favoriteEditState;
    if (!edit) return false;

    if (edit.mode === "add-kind") {
      return true;
    }

    if (edit.mode === "rename") {
      const didRename = this.renameCurrentFavorite(edit.value);
      if (!didRename) return true;
      this.clearFavoriteEdit();
      return true;
    }

    if (edit.mode === "add-folder") {
      const didCreate = this.createFavoriteFolderAtCursor(edit.value);
      if (!didCreate) return true;
      this.clearFavoriteEdit();
      return true;
    }

    if (edit.mode === "add-entry-title") {
      const nextUrl = edit.url || this.getActiveBufferUrl();
      this.favoriteEditState = {
        mode: "add-entry-url",
        tone: "info",
        label: "Favorite URL",
        value: nextUrl,
        cursor: String(nextUrl).length,
        entryTitle: String(edit.value || "").trim(),
      };
      return true;
    }

    if (edit.mode === "add-entry-url") {
      const didCreate = this.createFavoriteEntryAtCursor(
        edit.entryTitle,
        edit.value,
      );
      if (!didCreate) return true;
      this.clearFavoriteEdit();
      return true;
    }

    return false;
  }

  handleFavoriteEditInput(input) {
    const edit = this.favoriteEditState;
    if (!edit) return false;
    const key = input.key;

    if (key === "Escape") {
      this.clearFavoriteEdit();
      return true;
    }

    if (edit.mode === "add-kind") {
      if (key === "f") {
        this.favoriteEditState = {
          mode: "add-folder",
          tone: "info",
          label: "Folder name",
          value: "",
          cursor: 0,
        };
        return true;
      }
      if (key === "e") {
        const seedUrl = this.getActiveBufferUrl();
        this.favoriteEditState = {
          mode: "add-entry-title",
          tone: "info",
          label: "Favorite title",
          value: "",
          cursor: 0,
          url: seedUrl,
        };
        return true;
      }
      return true;
    }

    if (key === "Enter") {
      this.confirmFavoriteEdit();
      return true;
    }

    if (key === "Backspace") {
      this.clampFavoriteEditCursor(edit);
      if (edit.cursor <= 0) return true;
      const before = edit.value.slice(0, edit.cursor - 1);
      const after = edit.value.slice(edit.cursor);
      edit.value = before + after;
      edit.cursor -= 1;
      return true;
    }

    if (key === "ArrowLeft" || (input.ctrl && String(key).toLowerCase() === "h")) {
      this.clampFavoriteEditCursor(edit);
      edit.cursor = Math.max(0, edit.cursor - 1);
      return true;
    }

    if (key === "ArrowRight" || (input.ctrl && String(key).toLowerCase() === "l")) {
      this.clampFavoriteEditCursor(edit);
      edit.cursor = Math.min(String(edit.value || "").length, edit.cursor + 1);
      return true;
    }

    if (key === "Home") {
      edit.cursor = 0;
      return true;
    }

    if (key === "End") {
      edit.cursor = String(edit.value || "").length;
      return true;
    }

    if (
      !input.ctrl &&
      !input.meta &&
      !input.alt &&
      typeof key === "string" &&
      key.length === 1
    ) {
      this.clampFavoriteEditCursor(edit);
      const before = edit.value.slice(0, edit.cursor);
      const after = edit.value.slice(edit.cursor);
      edit.value = before + key + after;
      edit.cursor += 1;
      return true;
    }

    return true;
  }

  renderFooter() {
    if (this.deleteAllArmed) {
      const confirmLabel =
        this.treeKind === "favorites" ? "favorites" : "history";
      return {
        tone: "danger",
        text: `Delete all ${confirmLabel}?`,
        hint: "type yes then Enter",
        value: this.confirmDeleteAll,
      };
    }

    const edit = this.favoriteEditState;
    if (this.treeKind === "favorites" && edit) {
      if (edit.mode === "add-kind") {
        return {
          tone: "info",
          text: "Add favorite",
          hint: "f: folder, e: entry, Esc: cancel",
          value: "",
        };
      }
      return {
        tone: edit.tone || "info",
        text: edit.label || "Edit",
        hint: "Enter: confirm, Esc: cancel",
        value: "",
      };
    }

    return {
      tone: "muted",
      text:
        this.treeKind === "favorites"
          ? "a: add, y/m: yank/move, p: paste, r: rename, d: delete, u: undo"
          : "d: delete, D: delete-all",
      hint: "",
      value: "",
    };
  }

  renderFavoriteInputOverlay() {
    if (this.treeKind !== "favorites") return "";
    const edit = this.favoriteEditState;
    if (!edit) return "";
    if (edit.mode === "add-kind") return "";
    this.clampFavoriteEditCursor(edit);
    const rawValue = String(edit.value || "");
    const cursor = edit.cursor;
    const before = escapeHtml(rawValue.slice(0, cursor));
    const atEnd = cursor >= rawValue.length;
    const after = escapeHtml(rawValue.slice(cursor));
    const label = escapeHtml(edit.label || "Input");
    const cursorHtml = atEnd
      ? '<span class="floating-input-cursor"></span>'
      : '<span class="floating-input-caret" aria-hidden="true"></span>';
    return `<div class="floating-input"><div class="floating-input-label">${label}</div><div class="floating-input-value">${before}${cursorHtml}${after}</div></div>`;
  }

  resolveFavoritePasteTarget(cursorLocation) {
    if (!cursorLocation) return null;
    if (cursorLocation.node.type === "folder") {
      const children = Array.isArray(cursorLocation.node.children)
        ? cursorLocation.node.children
        : [];
      cursorLocation.node.children = children;
      const isOpenFolder = this.favoriteExpanded.has(cursorLocation.node.id);
      if (isOpenFolder) {
        return {
          children,
          insertAt: children.length,
          expandFolderId: cursorLocation.node.id,
        };
      }
    }

    return {
      children: cursorLocation.children,
      insertAt: cursorLocation.index + 1,
      expandFolderId: null,
    };
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
      this.onFocusChange({
        visible: this.visible,
        focused: this.focused,
        treeKind: this.treeKind,
      });
    }
  }

  getWebContents() {
    if (
      !this.view ||
      !this.view.webContents ||
      this.view.webContents.isDestroyed()
    )
      return null;
    return this.view.webContents;
  }

  setWidthRatio(ratio) {
    if (Number.isFinite(ratio) && ratio >= 0.1 && ratio <= 0.6) {
      this.widthRatio = ratio;
      this.layout();
    }
  }

  setTreeKind(kind) {
    if (kind !== "history" && kind !== "favorites") return;
    if (this.treeKind === kind) return;
    this.treeKind = kind;
    this.clearFavoriteEdit();
    this.confirmDeleteAll = "";
    this.deleteAllArmed = false;
    this.reloadData();
    this.render();
    this.emitFocusChange();
  }

  switchTreeByOffset(offset) {
    if (!Number.isFinite(offset) || offset === 0) return;
    const order = ["history", "favorites"];
    const idx = Math.max(0, order.indexOf(this.treeKind));
    const next =
      order[
        (((idx + (offset > 0 ? 1 : -1)) % order.length) + order.length) %
          order.length
      ];
    this.setTreeKind(next);
  }

  reloadData() {
    this.days = historyService.readHistoryTree();
    const known = new Set(this.days.map((d) => d.key));
    this.expanded = new Set([...this.expanded].filter((key) => known.has(key)));
    if (this.days.length > 0 && !this.cursor.dateKey) {
      this.cursor = { type: "day", dateKey: this.days[0].key, entryId: null };
    }

    this.favoriteRoot = favoritesService.readFavoritesTree().root;
    this.reconcileFavoriteState();
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
    this.clearFavoriteEdit();
    this.confirmDeleteAll = "";
    this.deleteAllArmed = false;
    if (this.state)
      this.state.interactionContext = this.previousContext || "SHELL";
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

  showTree(kind) {
    this.show();
    this.setTreeKind(kind);
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
    if (
      this.window &&
      this.view &&
      typeof this.window.setTopBrowserView === "function"
    ) {
      this.window.setTopBrowserView(this.view);
    }
    this.render();
    this.emitFocusChange();
  }

  unfocus() {
    if (!this.focused) return;
    this.focused = false;
    if (this.state)
      this.state.interactionContext = this.previousContext || "SHELL";
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
    return Math.max(
      220,
      Math.floor(this.window.getContentBounds().width * this.widthRatio),
    );
  }

  layout() {
    if (!this.window || !this.view) return;
    if (!this.visible) return this.applyHiddenBounds();

    const bounds = this.window.getContentBounds();
    const width = this.getWidthPx();
    const y = UI_SHELL_TABLINE_HEIGHT;
    const height = Math.max(
      bounds.height - UI_SHELL_TABLINE_HEIGHT - UI_SHELL_STATUSLINE_HEIGHT,
      1,
    );

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
    if (this.treeKind === "favorites") {
      return this.getFavoriteFlatNodes();
    }

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
    if (this.treeKind === "favorites") {
      this.moveFavoriteCursor(delta);
      return;
    }
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
    return day
      ? day.entries.find((item) => item.id === this.cursor.entryId)
      : null;
  }

  openCurrent(newTab = false) {
    if (this.treeKind === "favorites") {
      const entry = this.getCurrentFavoriteEntry();
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
      return;
    }

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
    if (this.treeKind === "favorites") {
      this.deleteCurrentFavorite();
      return;
    }

    if (this.cursor.type === "day") {
      historyService.deleteDate(this.cursor.dateKey);
    } else if (this.cursor.type === "entry") {
      historyService.deleteEntry(this.cursor.dateKey, this.cursor.entryId);
    }

    this.reloadData();
    const first = this.getFlatNodes()[0];
    this.cursor = first
      ? {
          type: first.type,
          dateKey: first.dateKey,
          entryId: first.entry ? first.entry.id : null,
        }
      : { type: "day", dateKey: null, entryId: null };
  }

  formatTime(entry) {
    const ts = Number.isFinite(entry.timestampMs)
      ? entry.timestampMs
      : Date.parse(entry.timestampIso || "");
    if (!Number.isFinite(ts)) return "--:--";
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ts));
  }

  render() {
    if (!this.view || this.view.webContents.isDestroyed()) return;
    const isFavorites = this.treeKind === "favorites";
    const rows = isFavorites
      ? this.renderFavoriteRows()
      : this.renderHistoryRows();
    const footer = this.renderFooter();
    const footerTone = footer.tone || "muted";
    const footerText = escapeHtml(footer.text || "");
    const footerHint = escapeHtml(footer.hint || "");
    const footerValue = escapeHtml(footer.value || "");
    const historyHeadClass =
      this.treeKind === "history" ? "tree-head-item active" : "tree-head-item";
    const favoriteHeadClass =
      this.treeKind === "favorites"
        ? "tree-head-item active"
        : "tree-head-item";

    const inputOverlayHtml = this.renderFavoriteInputOverlay();

    const html = `<!doctype html><html><body><style>
      html,body{height:100%}
      body{margin:0;background:var(--ui-bg-panel,#161b24);color:var(--ui-text,#c9d1df);font:12px "JetBrainsMono Nerd Font Mono", monospace;border-right:1px solid var(--ui-border-strong,#2a3140);box-sizing:border-box}
      .wrap{display:flex;flex-direction:column;height:100%;position:relative}
      .head{padding:8px 10px;border-bottom:1px solid var(--ui-border,#2f3440);display:flex;gap:8px;align-items:center}
      .tree-head-item{color:var(--ui-text-muted,#7f8aa3)}
      .tree-head-item.active{color:var(--ui-accent,#89dceb);font-weight:600}
      .list{padding:6px 0;overflow:auto;flex:1}
      .row{display:flex;align-items:stretch;gap:0;min-height:${TREE_LAYOUT.rowMinHeight}px}
      .cursor{width:${TREE_LAYOUT.cursorWidth}px;flex:0 0 ${TREE_LAYOUT.cursorWidth}px;background:transparent;border-radius:1px}
      .name{display:flex;align-items:center;gap:0;flex:1;min-width:0;padding:0 ${TREE_LAYOUT.namePaddingRight}px 0 ${TREE_LAYOUT.namePaddingLeft}px;overflow:hidden;line-height:18px}
      .time{width:${TREE_LAYOUT.rightColWidth}px;flex:0 0 ${TREE_LAYOUT.rightColWidth}px;padding:0 ${TREE_LAYOUT.namePaddingRight}px 0 0;text-align:right;color:var(--ui-text-muted,#7f8aa3);white-space:nowrap;line-height:18px;display:flex;align-items:center;justify-content:flex-end}
      .time.time-hidden{visibility:hidden}
      .day{color:var(--ui-accent,#89dceb)}
      .selected{background:var(--ui-bg-subtle,#1f2735)}
      .focused .selected .cursor{background:var(--ui-editor-cursor,#89dceb)}
      .unfocused .selected{background:color-mix(in srgb, var(--ui-bg-subtle,#1f2735) 55%, transparent)}
      .unfocused .selected .cursor{background:var(--ui-text-muted,#7f8aa3);opacity:.45}
      .tree-indent{display:inline-flex;flex:0 0 var(--indent)}
      .tree-cols{display:inline-flex;align-items:center;justify-content:center;flex:0 0 ${TREE_LAYOUT.treeColWidthEm}em;margin-right:${TREE_LAYOUT.treeColGapPx}px}
      .icon{display:inline-flex;align-items:center;justify-content:center;width:1.2em;font-size:18px;line-height:1}
      .file-icon{display:inline-flex;align-items:center;justify-content:center;flex:0 0 ${TREE_LAYOUT.fileIconWidthEm}em;margin-right:${TREE_LAYOUT.treeColGapPx}px;color:var(--ui-text-soft,#b6c7e8)}
      .file-glyph{font-size:14px;color:var(--ui-text-soft,#b6c7e8)}
      .guide{color:var(--ui-text-muted,#7f8aa3);font-size:12px}
      .text{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
      .empty-label{font-style:italic;color:var(--ui-text-muted,#7f8aa3)}
      .foot{min-height:18px;padding:5px 8px;border-top:1px solid var(--ui-border,#2f3440);display:flex;gap:8px;align-items:center}
      .foot-badge{font-size:10px;letter-spacing:.04em;text-transform:uppercase;padding:1px 6px;border-radius:4px}
      .foot-badge.info{color:var(--ui-accent,#89dceb);background:color-mix(in srgb, var(--ui-accent,#89dceb) 14%, transparent)}
      .foot-badge.danger{color:#f38ba8;background:color-mix(in srgb, #f38ba8 14%, transparent)}
      .foot-badge.muted{color:var(--ui-text-muted,#7f8aa3);background:color-mix(in srgb, var(--ui-text-muted,#7f8aa3) 10%, transparent)}
      .foot-main{display:flex;gap:8px;align-items:center;min-width:0;flex:1}
      .foot-text{color:var(--ui-text,#c9d1df);white-space:nowrap}
      .foot-hint{color:var(--ui-text-muted,#7f8aa3);white-space:nowrap}
      .foot-input{color:var(--ui-accent,#89dceb);min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
      .foot-cursor{display:inline-block;width:7px;height:12px;margin-left:2px;vertical-align:-2px;background:var(--ui-editor-cursor,#89dceb);opacity:.9}
      .unfocused .foot-cursor{opacity:.45}
      .floating-input{position:absolute;left:50%;transform:translateX(-50%);bottom:34px;width:97%;z-index:5;border:1px solid var(--ui-border,#2f3440);background:var(--ui-bg-subtle,#1f2735);border-radius:4px;padding:6px 8px;box-sizing:border-box;box-shadow:0 8px 20px rgba(0,0,0,.28)}
      .floating-input-label{color:var(--ui-text-muted,#7f8aa3);font-size:11px;margin-bottom:4px}
      .floating-input-value{color:var(--ui-text,#c9d1df);min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
      .floating-input-cursor{display:inline-block;width:7px;height:12px;margin-left:2px;vertical-align:-2px;background:var(--ui-editor-cursor,#89dceb);opacity:.9}
      .floating-input-caret{display:inline-block;width:1px;height:18px;vertical-align:-3px;background:var(--ui-accent,#89dceb)}
      .unfocused .floating-input-cursor{opacity:.45}
      .unfocused .floating-input-caret{opacity:.55}
    </style><div class="wrap ${this.focused ? "focused" : "unfocused"}"><div class="head"><span class="${historyHeadClass}">History</span><span class="${favoriteHeadClass}">Favorite</span></div><div class="list">${rows.join("")}</div>${inputOverlayHtml}<div class="foot"><span class="foot-badge ${footerTone}">${escapeHtml(footerTone)}</span><div class="foot-main"><span class="foot-text">${footerText}</span><span class="foot-hint">${footerHint}</span><span class="foot-input">${footerValue}</span></div></div></div></body></html>`;

    this.scheduleRender(html);
  }

  renderHistoryRows() {
    const rows = [];
    for (const day of this.days) {
      const isDaySelected =
        this.cursor.type === "day" && this.cursor.dateKey === day.key;
      const isOpen = this.expanded.has(day.key);
      rows.push(
        `<div class="row day ${isDaySelected ? "selected" : ""}"><span class="cursor"></span><span class="name"><span class="tree-cols"><span class="icon">${isOpen ? "" : ""}</span></span><span class="text">${escapeHtml(day.key)}</span></span><span class="time time-hidden"></span></div>`,
      );
      if (!isOpen) continue;
      if (!day.entries.length) {
        rows.push(
          `<div class="row entry empty"><span class="cursor"></span><span class="name"><span class="tree-cols"><span class="icon guide">└</span></span><span class="text empty-label">No item yet.</span></span><span class="time time-hidden"></span></div>`,
        );
        continue;
      }
      for (let index = 0; index < day.entries.length; index += 1) {
        const entry = day.entries[index];
        const selected =
          this.cursor.type === "entry" && this.cursor.entryId === entry.id;
        const time = escapeHtml(this.formatTime(entry));
        const branch = index === day.entries.length - 1 ? "└" : "│";
        rows.push(
          `<div class="row entry ${selected ? "selected" : ""}"><span class="cursor"></span><span class="name"><span class="tree-indent" style="--indent:${TREE_LAYOUT.guideOpticalOffsetPx}px"></span><span class="tree-cols"><span class="icon guide">${branch}</span></span><span class="file-icon"></span><span class="text">${escapeHtml(entry.title || entry.url)}</span></span><span class="time ${this.showTimestamp ? "" : "time-hidden"}">${time}</span></div>`,
        );
      }
    }
    return rows;
  }

  reconcileFavoriteState() {
    const visible = this.getFavoriteFlatNodes();
    const folderSet = new Set(
      visible.filter((n) => n.type === "folder").map((n) => n.id),
    );
    this.favoriteExpanded = new Set(
      [...this.favoriteExpanded].filter((key) => folderSet.has(key)),
    );
    const hasCursor = visible.some((n) => n.id === this.favoriteCursor.nodeId);
    if (!hasCursor && visible.length > 0) {
      this.favoriteCursor = { nodeId: visible[0].id };
    }
  }

  getFavoriteFlatNodes() {
    const nodes = [];
    const walk = (children, depth, parentId) => {
      for (let index = 0; index < children.length; index += 1) {
        const node = children[index];
        if (node.type === "folder") {
          nodes.push({
            type: "folder",
            id: node.id,
            name: node.name,
            depth,
            parentId,
            index,
            count: Array.isArray(node.children) ? node.children.length : 0,
          });
          if (this.favoriteExpanded.has(node.id)) {
            walk(
              Array.isArray(node.children) ? node.children : [],
              depth + 1,
              node.id,
            );
          }
        } else if (node.type === "entry") {
          nodes.push({
            type: "entry",
            id: node.id,
            entry: node,
            depth,
            parentId,
            index,
          });
        }
      }
    };
    walk(Array.isArray(this.favoriteRoot) ? this.favoriteRoot : [], 0, null);
    return nodes;
  }

  isFavoriteNodeSelected(node) {
    return Boolean(node && node.id && node.id === this.favoriteCursor.nodeId);
  }

  moveFavoriteCursor(delta) {
    const nodes = this.getFavoriteFlatNodes();
    if (!nodes.length) return;
    let idx = nodes.findIndex((node) => this.isFavoriteNodeSelected(node));
    if (idx === -1) idx = 0;
    idx = Math.max(0, Math.min(nodes.length - 1, idx + delta));
    const node = nodes[idx];
    this.favoriteCursor = { nodeId: node.id };
  }

  getCurrentFavoriteEntry() {
    const nodes = this.getFavoriteFlatNodes();
    const node = nodes.find((item) => item.id === this.favoriteCursor.nodeId);
    return node && node.type === "entry" ? node.entry : null;
  }

  getFavoriteNodeClipboardMarker(nodeId) {
    if (!this.favoriteClipboard || this.favoriteClipboard.sourceNodeId !== nodeId) {
      return "";
    }

    if (this.favoriteClipboard.mode === "copy") {
      return "(copy)";
    }

    if (this.favoriteClipboard.mode === "move") {
      return "(move)";
    }

    return "";
  }

  getFavoriteFolderDisplayName(node) {
    const base = String(node?.name || "");
    const marker = this.getFavoriteNodeClipboardMarker(node?.id);
    return marker ? `${base} ${marker}` : base;
  }

  getFavoriteEntryDisplayName(node) {
    const base = String(node?.entry?.title || node?.entry?.url || "");
    const marker = this.getFavoriteNodeClipboardMarker(node?.id);
    return marker ? `${base} ${marker}` : base;
  }

  renderFavoriteRows() {
    const rows = [];
    const nodes = this.getFavoriteFlatNodes();
    if (!nodes.length) {
      rows.push(
        `<div class="row entry empty"><span class="cursor"></span><span class="name"><span class="tree-cols"><span class="icon guide">└</span></span><span class="text empty-label">No item yet.</span></span><span class="time time-hidden"></span></div>`,
      );
      return rows;
    }

    for (const node of nodes) {
      if (node.type === "folder") {
        const open = this.favoriteExpanded.has(node.id);
        const selected = this.isFavoriteNodeSelected(node);
        const indentPx = node.depth * TREE_LAYOUT.nestIndentPx;
        rows.push(
          `<div class="row day ${selected ? "selected" : ""}"><span class="cursor"></span><span class="name"><span class="tree-indent" style="--indent:${indentPx}px"></span><span class="tree-cols"><span class="icon">${open ? "" : ""}</span></span><span class="text">${escapeHtml(this.getFavoriteFolderDisplayName(node))}</span></span><span class="time ${this.showFavoriteCount ? "" : "time-hidden"}">${node.count}</span></div>`,
        );
      } else {
        const selected = this.isFavoriteNodeSelected(node);
        if (node.depth === 0) {
          rows.push(
            `<div class="row entry ${selected ? "selected" : ""}"><span class="cursor"></span><span class="name"><span class="tree-indent" style="--indent:${TREE_LAYOUT.guideOpticalOffsetPx}px"></span><span class="tree-cols"><span class="icon file-glyph"></span></span><span class="text">${escapeHtml(this.getFavoriteEntryDisplayName(node))}</span></span><span class="time time-hidden"></span></div>`,
          );
        } else {
          const siblingNodes = nodes.filter(
            (item) => item.parentId === node.parentId,
          );
          const branch = node.index === siblingNodes.length - 1 ? "└" : "│";
          const indentPx = Math.max(
            0,
            (node.depth - 1) * TREE_LAYOUT.nestIndentPx +
              TREE_LAYOUT.guideOpticalOffsetPx,
          );
          rows.push(
            `<div class="row entry ${selected ? "selected" : ""}"><span class="cursor"></span><span class="name"><span class="tree-indent" style="--indent:${indentPx}px"></span><span class="tree-cols"><span class="icon guide">${branch}</span></span><span class="file-icon"></span><span class="text">${escapeHtml(this.getFavoriteEntryDisplayName(node))}</span></span><span class="time time-hidden"></span></div>`,
          );
        }
      }
    }
    return rows;
  }

  saveFavorites() {
    favoritesService.writeFavoritesTree({ root: this.favoriteRoot });
    this.favoriteRoot = favoritesService.readFavoritesTree().root;
    this.reconcileFavoriteState();
  }

  setFavoriteCursorFromNode(node) {
    if (!node) return;
    this.favoriteCursor = { nodeId: node.id };
  }

  restoreFavoriteCursorByIndex(previousIndex = 0) {
    const nextNodes = this.getFavoriteFlatNodes();
    if (!nextNodes.length) {
      this.favoriteCursor = { nodeId: null };
      return;
    }
    const idx = Math.max(
      0,
      Math.min(nextNodes.length - 1, Number(previousIndex) || 0),
    );
    this.setFavoriteCursorFromNode(nextNodes[idx]);
  }

  findFavoriteNodeLocation(
    nodeId,
    children = this.favoriteRoot,
    parentChildren = null,
  ) {
    for (let index = 0; index < children.length; index += 1) {
      const node = children[index];
      if (node.id === nodeId) {
        return { node, index, children, parentChildren };
      }
      if (node.type === "folder" && Array.isArray(node.children)) {
        const nested = this.findFavoriteNodeLocation(
          nodeId,
          node.children,
          children,
        );
        if (nested) return nested;
      }
    }
    return null;
  }

  deleteCurrentFavorite() {
    this.recordFavoriteMutationSnapshot();
    const beforeNodes = this.getFavoriteFlatNodes();
    let beforeIndex = beforeNodes.findIndex((node) =>
      this.isFavoriteNodeSelected(node),
    );
    if (beforeIndex < 0) beforeIndex = 0;

    const location = this.findFavoriteNodeLocation(this.favoriteCursor.nodeId);
    if (!location) return;
    location.children.splice(location.index, 1);
    this.saveFavorites();
    this.restoreFavoriteCursorByIndex(beforeIndex);
  }

  deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  copyOrMoveCurrentFavorite(isMove) {
    const location = this.findFavoriteNodeLocation(this.favoriteCursor.nodeId);
    if (!location) return;
    if (location.node.type === "entry") {
      this.favoriteClipboard = {
        mode: isMove ? "move" : "copy",
        nodeType: "entry",
        value: this.deepClone(location.node),
        sourceNodeId: location.node.id,
      };
      return;
    }
    this.favoriteClipboard = {
      mode: isMove ? "move" : "copy",
      nodeType: "folder",
      value: this.deepClone(location.node),
      sourceNodeId: location.node.id,
    };
  }

  clearFavoriteClipboard() {
    this.favoriteClipboard = null;
  }

  cloneFavoriteNodeForCopy(node) {
    if (!node) return null;
    if (node.type === "entry") {
      return {
        type: "entry",
        id: favoritesService.makeEntryId(),
        title: node.title,
        url: node.url,
      };
    }
    const children = Array.isArray(node.children)
      ? node.children
          .map((child) => this.cloneFavoriteNodeForCopy(child))
          .filter(Boolean)
      : [];
    return {
      type: "folder",
      id: favoritesService.makeFolderId(),
      name: node.name,
      children,
    };
  }

  makeUniqueFolderName(siblings, baseName) {
    const name = String(baseName || "folder").trim() || "folder";
    const existing = new Set(
      siblings
        .filter((item) => item && item.type === "folder")
        .map((item) => String(item.name || "").trim()),
    );
    if (!existing.has(name)) return name;
    let index = 1;
    while (existing.has(`${name} (copy${index > 1 ? ` ${index}` : ""})`)) {
      index += 1;
    }
    return `${name} (copy${index > 1 ? ` ${index}` : ""})`;
  }

  pasteFavoriteAtCursor() {
    const clip = this.favoriteClipboard;
    if (!clip) return;
    this.recordFavoriteMutationSnapshot();
    const beforeNodes = this.getFavoriteFlatNodes();
    let beforeIndex = beforeNodes.findIndex((node) =>
      this.isFavoriteNodeSelected(node),
    );
    if (beforeIndex < 0) beforeIndex = 0;
    const cursorLocation = this.findFavoriteNodeLocation(
      this.favoriteCursor.nodeId,
    );
    if (!cursorLocation) return;

    const sourceLocation =
      clip.mode === "move"
        ? this.findFavoriteNodeLocation(clip.sourceNodeId)
        : null;
    const pasteTarget = this.resolveFavoritePasteTarget(cursorLocation);
    if (!pasteTarget) return;
    let targetChildren = pasteTarget.children;
    let insertAt = pasteTarget.insertAt;

    if (
      sourceLocation &&
      sourceLocation.children === targetChildren &&
      sourceLocation.index < insertAt
    ) {
      insertAt -= 1;
    }

    let nodeToInsert = null;
    if (clip.mode === "move" && sourceLocation) {
      nodeToInsert = sourceLocation.node;
      sourceLocation.children.splice(sourceLocation.index, 1);
    } else {
      nodeToInsert = this.cloneFavoriteNodeForCopy(clip.value);
    }
    if (!nodeToInsert) return;

    if (nodeToInsert.type === "folder") {
      nodeToInsert.name = this.makeUniqueFolderName(
        targetChildren,
        nodeToInsert.name,
      );
    }

    targetChildren.splice(insertAt, 0, nodeToInsert);
    if (pasteTarget.expandFolderId) {
      this.favoriteExpanded.add(pasteTarget.expandFolderId);
    }

    this.favoriteClipboard = null;
    this.saveFavorites();
    this.favoriteCursor = { nodeId: nodeToInsert.id };
    this.restoreFavoriteCursorByIndex(beforeIndex + 1);
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
      this.view.webContents.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(this.lastRenderedHtml)}`,
      );
    }, 16);
  }

  handleFocusedInput(input) {
    if (!this.visible || !this.focused || !input || input.type !== "keyDown")
      return false;
    if (this.state && this.state.mode === "COMMAND") return false;
    const key = input.key;
    const isFavorites = this.treeKind === "favorites";
    const favoriteNodes = isFavorites ? this.getFavoriteFlatNodes() : [];
    const currentFavoriteNode = isFavorites
      ? favoriteNodes.find((node) => node.id === this.favoriteCursor.nodeId) ||
        null
      : null;

    if (isFavorites && this.isFavoriteRedoShortcut(input)) {
      this.redoLastFavoriteAction();
      this.render();
      return true;
    }

    if (isFavorites && key === "Escape" && this.favoriteClipboard) {
      this.clearFavoriteClipboard();
      this.render();
      return true;
    }

    if (isFavorites && this.favoriteEditState) {
      const consumed = this.handleFavoriteEditInput(input);
      if (consumed) {
        this.render();
        return true;
      }
    }

    if (this.deleteAllArmed) {
      if (key === "Enter") {
        if (this.confirmDeleteAll.toLowerCase() === "yes") {
          if (isFavorites) {
            this.recordFavoriteMutationSnapshot();
            favoritesService.deleteAll();
          } else historyService.deleteAll();
        }
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
      if (
        !input.ctrl &&
        !input.meta &&
        !input.alt &&
        typeof key === "string" &&
        key.length === 1
      ) {
        this.confirmDeleteAll += key;
        this.render();
        return true;
      }
      return true;
    }

    if (key === "H") this.switchTreeByOffset(-1);
    else if (key === "L") this.switchTreeByOffset(1);
    else if (key === "j" || key === "ArrowDown") this.moveCursor(1);
    else if (key === "k" || key === "ArrowUp") this.moveCursor(-1);
    else if (key === "l" || key === "ArrowRight") {
      if (isFavorites) {
        if (currentFavoriteNode && currentFavoriteNode.type === "folder") {
          this.favoriteExpanded.add(currentFavoriteNode.id);
        }
      } else if (this.cursor.type === "day")
        this.expanded.add(this.cursor.dateKey);
    } else if (key === "h" || key === "ArrowLeft") {
      if (isFavorites) {
        const liveNodes = this.getFavoriteFlatNodes();
        const liveNode =
          liveNodes.find((node) => node.id === this.favoriteCursor.nodeId) ||
          null;
        if (liveNode && liveNode.type === "folder") {
          if (this.favoriteExpanded.has(liveNode.id)) {
            this.favoriteExpanded.delete(liveNode.id);
          } else if (liveNode.parentId) {
            this.favoriteCursor = { nodeId: liveNode.parentId };
          }
        } else {
          this.favoriteCursor = {
            nodeId: liveNode?.parentId || this.favoriteCursor.nodeId,
          };
        }
      } else if (this.cursor.type === "day") {
        this.expanded.delete(this.cursor.dateKey);
      } else {
        this.expanded.delete(this.cursor.dateKey);
        this.cursor = {
          type: "day",
          dateKey: this.cursor.dateKey,
          entryId: null,
        };
      }
    } else if (key === "Enter") this.openCurrent(Boolean(input.shift));
    else if (key === "y") {
      if (isFavorites) {
        this.copyOrMoveCurrentFavorite(false);
      } else {
        const entry = this.getCurrentEntry();
        if (entry && entry.url) clipboard.writeText(String(entry.url));
      }
    } else if (isFavorites && key === "c")
      this.copyOrMoveCurrentFavorite(false);
    else if (isFavorites && key === "m") this.copyOrMoveCurrentFavorite(true);
    else if (isFavorites && key === "p") this.pasteFavoriteAtCursor();
    else if (isFavorites && key === "r") this.startFavoriteRename();
    else if (isFavorites && key === "a") this.startFavoriteAdd();
    else if (isFavorites && key === "u") this.undoLastFavoriteAction();
    else if (isFavorites && key === "Y") {
      const entry = this.getCurrentFavoriteEntry();
      if (entry && entry.url) clipboard.writeText(String(entry.url));
    }
    else if (key === "d") this.deleteCurrent();
    else if (key === "D") {
      this.confirmDeleteAll = "";
      this.deleteAllArmed = true;
    } else if (!isFavorites && key === "t")
      this.showTimestamp = !this.showTimestamp;
    else if (isFavorites && key === "n")
      this.showFavoriteCount = !this.showFavoriteCount;
    else if (key === "Escape") this.unfocus();
    else return false;

    this.render();
    return true;
  }
}

module.exports = new HistoryPanel();
