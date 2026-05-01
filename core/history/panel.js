const { BrowserView, clipboard } = require("electron");
const historyService = require("./service");
const favoritesService = require("../favorites/service");
const { getNormalKeymap, getModAction } = require("../../motions/keymap");
const { isModPressed } = require("../../motions/modifiers");
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

const TREE_LINE_JUMP_STEP = 10;

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
    this.treeCountBuffer = "";
    this.treeKeyBuffer = "";
    this.treeDeletePending = false;
    this.treeDeleteCountBuffer = "";
    this.treeDeletePendingG = false;
    this.treeDeletePendingTimer = null;
    this.treeDeleteTimeoutMs = 900;
    this.treeLastKeyTime = 0;
    this.treeScrollContextLines = 3;
    this.lastSelectedTreeIndex = -1;
    this.treeFirstVisibleIndex = 0;
    this.view = null;
    this.onFocusChange = null;
    this.renderTimer = null;
    this.lastRenderedHtml = "";
  }

  clearFavoriteEdit() {
    this.favoriteEditState = null;
  }

  clearTreeNormalState() {
    this.treeCountBuffer = "";
    this.treeKeyBuffer = "";
    this.clearTreeDeletePending();
    this.treeLastKeyTime = 0;
  }

  clearTreeDeletePendingTimer() {
    if (!this.treeDeletePendingTimer) return;
    clearTimeout(this.treeDeletePendingTimer);
    this.treeDeletePendingTimer = null;
  }

  armTreeDeletePendingTimeout() {
    this.clearTreeDeletePendingTimer();
    const timeout = Number.isFinite(this.treeDeleteTimeoutMs)
      ? Math.max(0, Math.floor(this.treeDeleteTimeoutMs))
      : 900;
    this.treeDeletePendingTimer = setTimeout(() => {
      this.treeDeletePendingTimer = null;
      if (!this.treeDeletePending) return;
      this.clearTreeDeletePending();
      this.render();
    }, timeout);
  }

  clearTreeDeletePending() {
    this.clearTreeDeletePendingTimer();
    this.treeDeletePending = false;
    this.treeDeleteCountBuffer = "";
    this.treeDeletePendingG = false;
  }

  resetTreeScrollState() {
    this.treeFirstVisibleIndex = 0;
    this.lastSelectedTreeIndex = -1;
  }

  computeNextFirstVisibleIndex({
    selectedIndex,
    direction,
    totalRows,
    viewportRows,
  }) {
    const safeTotalRows = Math.max(0, Number(totalRows) || 0);
    const safeViewportRows = Math.max(1, Number(viewportRows) || 1);
    const maxFirstIndex = Math.max(0, safeTotalRows - safeViewportRows);
    let firstVisibleIndex = Math.max(
      0,
      Math.min(maxFirstIndex, Number(this.treeFirstVisibleIndex) || 0),
    );

    if (!Number.isFinite(selectedIndex) || selectedIndex < 0 || safeTotalRows === 0) {
      this.treeFirstVisibleIndex = firstVisibleIndex;
      return firstVisibleIndex;
    }

    const maxContext = Math.max(0, Math.floor((safeViewportRows - 1) / 2));
    const contextLines = Math.min(
      maxContext,
      Math.max(0, Math.floor(this.treeScrollContextLines || 0)),
    );
    const lastVisibleIndex = firstVisibleIndex + safeViewportRows - 1;
    const topThreshold = firstVisibleIndex + contextLines;
    const bottomThreshold = lastVisibleIndex - contextLines;

    if (direction === "down" && selectedIndex > bottomThreshold) {
      firstVisibleIndex = selectedIndex - (safeViewportRows - 1 - contextLines);
    } else if (direction === "up" && selectedIndex < topThreshold) {
      firstVisibleIndex = selectedIndex - contextLines;
    } else if (selectedIndex < firstVisibleIndex) {
      firstVisibleIndex = selectedIndex;
    } else if (selectedIndex > lastVisibleIndex) {
      firstVisibleIndex = selectedIndex - safeViewportRows + 1;
    }

    firstVisibleIndex = Math.max(0, Math.min(maxFirstIndex, firstVisibleIndex));
    this.treeFirstVisibleIndex = firstVisibleIndex;
    return firstVisibleIndex;
  }

  getSelectedTreeIndex() {
    const nodes = this.getTreeFlatNodes();
    if (!nodes.length) return -1;
    if (this.treeKind === "favorites") {
      return nodes.findIndex((node) => node.id === this.favoriteCursor.nodeId);
    }
    return nodes.findIndex(
      (node) =>
        node.type === this.cursor.type &&
        node.dateKey === this.cursor.dateKey &&
        String(node.entry?.id || "") === String(this.cursor.entryId || ""),
    );
  }

  consumeTreeCount(defaultCount = 1) {
    const count = Number.parseInt(this.treeCountBuffer || String(defaultCount), 10);
    this.treeCountBuffer = "";
    return Number.isFinite(count) && count > 0 ? count : defaultCount;
  }

  executeSharedTreeAction(actionId, count = 1) {
    if (!actionId || typeof actionId !== "string") return false;
    if (actionId === "scroll_down") {
      this.moveCursor(Math.max(1, count));
      return true;
    }
    if (actionId === "scroll_up") {
      this.moveCursor(-Math.max(1, count));
      return true;
    }
    if (actionId === "scroll_top") {
      this.jumpToLine(Math.max(1, count));
      return true;
    }
    if (actionId === "scroll_bottom") {
      this.jumpToLine(this.getTreeFlatNodes().length);
      return true;
    }
    if (actionId === "scroll_half_down") {
      this.moveCursor(TREE_LINE_JUMP_STEP);
      return true;
    }
    if (actionId === "scroll_half_up") {
      this.moveCursor(-TREE_LINE_JUMP_STEP);
      return true;
    }
    return false;
  }

  resolveSharedTreeNormalAction(input) {
    const key = String(input?.key || "");
    const mod = isModPressed(input);
    if (!key) return null;

    if (!mod && /^[0-9]$/.test(key)) {
      this.treeCountBuffer += key;
      return { consumed: true, shouldRender: false };
    }

    if (mod) {
      const builder = getModAction(key);
      if (!builder) {
        this.treeCountBuffer = "";
        this.treeKeyBuffer = "";
        return null;
      }
      this.treeCountBuffer = "";
      this.treeKeyBuffer = "";
      const handled = this.executeSharedTreeAction(builder.actionId, 1);
      if (!handled) return null;
      return { consumed: true, shouldRender: true };
    }

    this.treeKeyBuffer += key;
    const keymap = getNormalKeymap();
    const exactBuilder = keymap[this.treeKeyBuffer];
    if (exactBuilder) {
      const count = this.consumeTreeCount(1);
      this.treeKeyBuffer = "";
      const handled = this.executeSharedTreeAction(exactBuilder.actionId, count);
      if (!handled) return null;
      return { consumed: true, shouldRender: true };
    }

    const hasPrefix = Object.keys(keymap).some((mapped) => mapped.startsWith(this.treeKeyBuffer));
    if (hasPrefix) {
      return { consumed: true, shouldRender: false };
    }

    this.treeKeyBuffer = "";
    this.treeCountBuffer = "";
    return null;
  }

  getTreeFlatNodes() {
    return this.treeKind === "favorites" ? this.getFavoriteFlatNodes() : this.getFlatNodes();
  }

  jumpToLine(lineNumber) {
    const nodes = this.getTreeFlatNodes();
    if (!nodes.length) return;
    const targetIndex = Math.max(0, Math.min(nodes.length - 1, Number(lineNumber) - 1));
    const node = nodes[targetIndex];
    if (!node) return;
    if (this.treeKind === "favorites") {
      this.favoriteCursor = { nodeId: node.id };
      return;
    }
    this.cursor = {
      type: node.type,
      dateKey: node.dateKey,
      entryId: node.entry ? node.entry.id : null,
    };
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
      label: "Type f: folder, e: entry",
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
    const defaultText =
      this.treeKind === "favorites"
        ? "a: add, y/m: yank/move, p: paste, r: rename, dd: delete, d{motion}: range, u: undo, n: count, gg/G, <n>j/<n>k, <n>gg, Ctrl+d/u"
        : "dd: delete, d{motion}: range, D: delete-all, t: timestamp, gg/G, <n>j/<n>k, <n>gg, Ctrl+d/u";

    if (this.treeDeletePending) {
      return {
        tone: "info",
        text: "",
        hint: "d pending: d, G, gg, <n>j/<n>k, Esc: Cancel",
        value: this.treeDeleteCountBuffer,
      };
    }

    if (this.deleteAllArmed) {
      return {
        tone: "danger",
        text: "",
        hint: "y/n + Enter, Esc: Cancel",
        value: "",
      };
    }

    const edit = this.favoriteEditState;
    if (this.treeKind === "favorites" && edit) {
      if (edit.mode === "add-kind") {
        return {
          tone: "info",
          text: "",
          hint: "f/e: Choose, Esc: Cancel",
          value: "",
        };
      }
      return {
        tone: edit.tone || "info",
        text: "",
        hint: "Enter: Confirm, Esc: Cancel",
        value: "",
      };
    }

    return {
      tone: "muted",
      text: defaultText,
      hint: "",
      value: "",
    };
  }

  renderPromptOverlay() {
    let label = "";
    let rawValue = "";
    let cursor = 0;

    if (this.deleteAllArmed) {
      label =
        this.treeKind === "favorites"
          ? "Delete all favorites"
          : "Delete all history";
      rawValue = String(this.confirmDeleteAll || "");
      cursor = rawValue.length;
    } else {
      if (this.treeKind !== "favorites") return "";
      const edit = this.favoriteEditState;
      if (!edit) return "";
      label = String(edit.label || "Input");
      if (edit.mode === "add-kind") {
        rawValue = "";
        cursor = 0;
      } else {
        this.clampFavoriteEditCursor(edit);
        rawValue = String(edit.value || "");
        cursor = edit.cursor;
      }
    }

    const before = escapeHtml(rawValue.slice(0, cursor));
    const atEnd = cursor >= rawValue.length;
    const after = escapeHtml(rawValue.slice(cursor));
    const labelHtml = escapeHtml(label);
    const cursorHtml = atEnd
      ? '<span class="floating-input-cursor"></span>'
      : '<span class="floating-input-caret" aria-hidden="true"></span>';
    return `<div class="floating-input"><div class="floating-input-label">${labelHtml}</div><div class="floating-input-value">${before}${cursorHtml}${after}</div></div>`;
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

  setTreeScrollContextLines(lines) {
    if (!Number.isFinite(lines)) return;
    this.treeScrollContextLines = Math.max(0, Math.floor(lines));
  }

  setTreeDeleteOperatorTimeoutMs(timeoutMs) {
    if (!Number.isFinite(timeoutMs)) return;
    this.treeDeleteTimeoutMs = Math.max(0, Math.floor(timeoutMs));
  }

  setTreeKind(kind) {
    if (kind !== "history" && kind !== "favorites") return;
    if (this.treeKind === kind) return;
    this.treeKind = kind;
    this.clearFavoriteEdit();
    this.confirmDeleteAll = "";
    this.deleteAllArmed = false;
    this.clearTreeNormalState();
    this.resetTreeScrollState();
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
    this.clearTreeNormalState();
    this.clearTreeDeletePendingTimer();
    this.resetTreeScrollState();
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

  resolveFavoriteScopeBottomIndex(flatNodes, startIndex) {
    const current = flatNodes[startIndex];
    if (!current) return startIndex;
    const parentId = current.parentId || null;
    let idx = startIndex;
    while (idx + 1 < flatNodes.length && (flatNodes[idx + 1].parentId || null) === parentId) {
      idx += 1;
    }
    return idx;
  }

  resolveFavoriteScopeTopIndex(flatNodes, startIndex) {
    const current = flatNodes[startIndex];
    if (!current) return startIndex;
    const parentId = current.parentId || null;
    let idx = startIndex;
    while (idx - 1 >= 0 && (flatNodes[idx - 1].parentId || null) === parentId) {
      idx -= 1;
    }
    return idx;
  }

  deleteRangeInTree(startIndex, endIndex) {
    const low = Math.min(startIndex, endIndex);
    const high = Math.max(startIndex, endIndex);
    if (this.treeKind === "favorites") {
      const flat = this.getFavoriteFlatNodes();
      if (!flat.length) return;
      const from = Math.max(0, low);
      const to = Math.min(flat.length - 1, high);
      const selectedIds = new Set(flat.slice(from, to + 1).map((n) => n.id));
      if (!selectedIds.size) return;
      this.recordFavoriteMutationSnapshot();
      const prune = (children) => {
        if (!Array.isArray(children)) return [];
        return children.filter((node) => {
          if (selectedIds.has(node.id)) return false;
          if (node.type === "folder" && Array.isArray(node.children)) {
            node.children = prune(node.children);
          }
          return true;
        });
      };
      this.favoriteRoot = prune(this.favoriteRoot);
      this.saveFavorites();
      this.restoreFavoriteCursorByIndex(from);
      return;
    }

    const flat = this.getFlatNodes();
    if (!flat.length) return;
    const from = Math.max(0, low);
    const to = Math.min(flat.length - 1, high);
    const slice = flat.slice(from, to + 1);
    const days = new Set();
    const entries = [];
    for (const node of slice) {
      if (node.type === "day") days.add(node.dateKey);
      else if (node.type === "entry") entries.push({ dateKey: node.dateKey, entryId: node.entry.id });
    }
    for (const { dateKey, entryId } of entries) {
      if (!days.has(dateKey)) historyService.deleteEntry(dateKey, entryId);
    }
    for (const dateKey of days) {
      historyService.deleteDate(dateKey);
    }
    this.reloadData();
    const next = this.getFlatNodes();
    const idx = Math.max(0, Math.min(next.length - 1, from));
    const node = next[idx];
    this.cursor = node
      ? { type: node.type, dateKey: node.dateKey, entryId: node.entry ? node.entry.id : null }
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

    const inputOverlayHtml = this.renderPromptOverlay();
    const footerBadgeLabel =
      footerTone === "muted"
        ? "HINT"
        : footerTone === "danger"
          ? "DANGER"
          : "INFO";

    const footerSegments = [];
    if (footerText) {
      footerSegments.push(`<span class="foot-text" title="${footerText}">${footerText}</span>`);
    }
    if (footerHint) {
      footerSegments.push(`<span class="foot-hint" title="${footerHint}">${footerHint}</span>`);
    }
    if (footerValue) {
      footerSegments.push(`<span class="foot-input" title="${footerValue}">${footerValue}</span>`);
    }

    const selectedTreeIndex = this.getSelectedTreeIndex();
    const scrollDirection =
      this.lastSelectedTreeIndex >= 0 && selectedTreeIndex >= 0
        ? selectedTreeIndex > this.lastSelectedTreeIndex
          ? "down"
          : selectedTreeIndex < this.lastSelectedTreeIndex
            ? "up"
            : "none"
        : "none";
    this.lastSelectedTreeIndex = selectedTreeIndex;

    const panelHeight = this.visible && this.window
      ? Math.max(1, this.window.getContentBounds().height - UI_SHELL_TABLINE_HEIGHT - UI_SHELL_STATUSLINE_HEIGHT)
      : 1;
    const estimatedHeaderHeight = 34;
    const estimatedFooterHeight = 30;
    const estimatedListHeight = Math.max(1, panelHeight - estimatedHeaderHeight - estimatedFooterHeight);
    const viewportRows = Math.max(1, Math.floor(estimatedListHeight / TREE_LAYOUT.rowMinHeight));
    const nextFirstVisibleIndex = this.computeNextFirstVisibleIndex({
      selectedIndex: selectedTreeIndex,
      direction: scrollDirection,
      totalRows: rows.length,
      viewportRows,
    });

    const html = `<!doctype html><html><body><style>
      html,body{height:100%}
      body{margin:0;background:var(--ui-bg-panel,#161b24);color:var(--ui-text,#c9d1df);font:12px "JetBrainsMono Nerd Font Mono", monospace;border-right:1px solid var(--ui-border-strong,#2a3140);box-sizing:border-box}
      .wrap{display:flex;flex-direction:column;height:100%;position:relative}
      .head{padding:8px 10px;border-bottom:1px solid var(--ui-border,#2f3440);display:flex;gap:8px;align-items:center}
      .tree-head-item{color:var(--ui-text-muted,#7f8aa3)}
      .tree-head-item.active{color:var(--ui-accent,#89dceb);font-weight:600}
      .list{padding:6px 0;overflow-x:hidden;overflow-y:auto;flex:1}
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
      .foot-main{display:flex;gap:8px;align-items:center;min-width:0;flex:1;overflow:hidden}
      .foot-text{color:var(--ui-text,#c9d1df);min-width:0;flex:1 1 auto;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
      .foot-hint{color:var(--ui-text-muted,#7f8aa3);min-width:0;flex:1 1 auto;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
      .foot-input{color:var(--ui-accent,#89dceb);min-width:0;flex:1 1 auto;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
      .foot-cursor{display:inline-block;width:7px;height:12px;margin-left:2px;vertical-align:-2px;background:var(--ui-editor-cursor,#89dceb);opacity:.9}
      .unfocused .foot-cursor{opacity:.45}
      .floating-input{position:absolute;left:50%;transform:translateX(-50%);bottom:34px;width:97%;z-index:5;border:1px solid var(--ui-border,#2f3440);background:var(--ui-bg-subtle,#1f2735);border-radius:4px;padding:6px 8px;box-sizing:border-box;box-shadow:0 8px 20px rgba(0,0,0,.28)}
      .floating-input-label{color:var(--ui-text-muted,#7f8aa3);font-size:11px;margin-bottom:4px}
      .floating-input-value{color:var(--ui-text,#c9d1df);min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
      .floating-input-cursor{display:inline-block;width:7px;height:12px;margin-left:2px;vertical-align:-2px;background:var(--ui-editor-cursor,#89dceb);opacity:.9}
      .floating-input-caret{display:inline-block;width:1px;height:18px;vertical-align:-3px;background:var(--ui-accent,#89dceb)}
      .unfocused .floating-input-cursor{opacity:.45}
      .unfocused .floating-input-caret{opacity:.55}
    </style><div class="wrap ${this.focused ? "focused" : "unfocused"}"><div class="head"><span class="${historyHeadClass}">History</span><span class="${favoriteHeadClass}">Favorite</span></div><div class="list">${rows.join("")}</div>${inputOverlayHtml}<div class="foot"><span class="foot-badge ${footerTone}">${footerBadgeLabel}</span><div class="foot-main">${footerSegments.join("")}</div></div></div><script>(function(){const list=document.querySelector('.list');if(!list)return;const row=${TREE_LAYOUT.rowMinHeight};const nextFirst=${nextFirstVisibleIndex};list.scrollTop=Math.max(0,nextFirst*row);})();</script></body></html>`;

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

    const now = Date.now();
    const timeout = this.state?.sequenceTimeout;
    if (Number.isFinite(timeout) && this.treeLastKeyTime && now - this.treeLastKeyTime > timeout) {
      this.treeCountBuffer = "";
      this.treeKeyBuffer = "";
    }
    this.treeLastKeyTime = now;

    if (isFavorites && this.isFavoriteRedoShortcut(input)) {
      this.clearTreeNormalState();
      this.redoLastFavoriteAction();
      this.render();
      return true;
    }

    if (isFavorites && key === "Escape" && this.favoriteClipboard) {
      this.clearTreeNormalState();
      this.clearFavoriteClipboard();
      this.render();
      return true;
    }

    if (isFavorites && this.favoriteEditState) {
      this.clearTreeNormalState();
      const consumed = this.handleFavoriteEditInput(input);
      if (consumed) {
        this.render();
        return true;
      }
    }

    if (this.deleteAllArmed) {
      this.clearTreeNormalState();
      if (key === "Enter") {
        const answer = this.confirmDeleteAll.trim().toLowerCase();
        if (answer === "y") {
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

    if (this.treeDeletePending) {
      if (key === "Shift" || key === "Control" || key === "Alt" || key === "Meta") {
        return true;
      }
      if (key === "Escape") {
        this.clearTreeDeletePending();
        this.render();
        return true;
      }
      if (!input.ctrl && !input.meta && !input.alt && /^[0-9]$/.test(String(key))) {
        if (this.treeDeletePendingG) {
          this.clearTreeDeletePending();
          this.render();
          return true;
        }
        this.treeDeleteCountBuffer += String(key);
        this.armTreeDeletePendingTimeout();
        this.render();
        return true;
      }
      const flat = this.getTreeFlatNodes();
      const currentIndex = this.getSelectedTreeIndex();
      if (!this.treeDeletePendingG && key === "g") {
        this.treeDeletePendingG = true;
        this.armTreeDeletePendingTimeout();
        this.render();
        return true;
      }
      if (this.treeDeletePendingG && key === "g" && currentIndex >= 0) {
        let top = 0;
        if (this.treeKind === "favorites") {
          top = this.resolveFavoriteScopeTopIndex(flat, currentIndex);
        }
        this.deleteRangeInTree(currentIndex, top);
        this.clearTreeDeletePending();
        this.render();
        return true;
      }
      if (this.treeDeletePendingG) {
        this.clearTreeDeletePending();
        this.render();
        return true;
      }

      const count = Math.max(1, Number.parseInt(this.treeDeleteCountBuffer || "1", 10));
      const hasExplicitCount = this.treeDeleteCountBuffer.length > 0;
      if ((key === "j" || key === "ArrowDown") && currentIndex >= 0 && hasExplicitCount) {
        const target = Math.min(flat.length - 1, currentIndex + count);
        this.deleteRangeInTree(currentIndex, target);
        this.clearTreeDeletePending();
        this.render();
        return true;
      }
      if ((key === "k" || key === "ArrowUp") && currentIndex >= 0 && hasExplicitCount) {
        const target = Math.max(0, currentIndex - count);
        this.deleteRangeInTree(currentIndex, target);
        this.clearTreeDeletePending();
        this.render();
        return true;
      }
      const normalizedKey = String(key || "");
      const isShiftG =
        normalizedKey === "G" ||
        (normalizedKey === "g" && Boolean(input.shift)) ||
        (normalizedKey === "KeyG" && Boolean(input.shift));
      if (isShiftG && currentIndex >= 0) {
        let bottom = flat.length - 1;
        if (this.treeKind === "favorites") {
          bottom = this.resolveFavoriteScopeBottomIndex(flat, currentIndex);
        }
        this.deleteRangeInTree(currentIndex, bottom);
        this.clearTreeDeletePending();
        this.render();
        return true;
      }
      if (key === "d" && currentIndex >= 0) {
        this.deleteRangeInTree(currentIndex, currentIndex);
        this.clearTreeDeletePending();
        this.render();
        return true;
      }
      this.clearTreeDeletePending();
      this.render();
      return true;
    }

    const shared = this.resolveSharedTreeNormalAction(input);
    if (shared?.consumed) {
      if (shared.shouldRender) this.render();
      return true;
    }

    if (key === "H") this.switchTreeByOffset(-1);
    else if (key === "L") this.switchTreeByOffset(1);
    else if (key === "ArrowDown") this.moveCursor(1);
    else if (key === "ArrowUp") this.moveCursor(-1);
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
    else if (key === "d") {
      this.treeCountBuffer = "";
      this.treeKeyBuffer = "";
      this.treeDeletePending = true;
      this.treeDeleteCountBuffer = "";
      this.armTreeDeletePendingTimeout();
    }
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
