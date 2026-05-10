const { nativeTheme } = require("electron");
const Buffer = require("./buffers");
const { getConfigValue } = require("../core/config/service");
const notificationsService = require("../core/notifications/service");
const { buildOpeningBufferSpec } = require("../core/opening/buffer");
const { resolveTheme, resolveThemeMode } = require("../ui/theme");
const {
  attachView,
  detachView,
} = require("../core/adapters/platform/contentViewHost");
const {
  openDevtoolsSplit,
  closeDevtoolsSplit,
  syncDevtoolsTargetToLeftBuffer,
} = require("./services/devtoolsController");
const {
  openVerticalSplit,
  closeRightSplit,
  focusSplitLeft,
  focusSplitRight,
  focusPane,
  reconcileSplitSources,
} = require("./services/splitController");
const { attachPaneTracking } = require("./services/selectionClipboardObserver");
const {
  canShowUrllineForBuffer,
  getUrllineRenderModel,
  layoutViews,
} = require("./services/paneLayoutController");

class BufferManager {
  constructor() {
    this.buffers = [];
    this.activeIndex = -1;
    this.window = null;
    this.subscribers = new Set();
    this.split = {
      enabled: false,
      mode: "regular",
      ratio: 0.5,
      rightPaneBuffer: null,
      rightPaneSourceBuffer: null,
    };
    this.focusedPane = "left";
    this.devtoolsView = null;
    this.devtoolsTarget = null;
    this.contentUiOptions = {};
    this.splitDivider = {
      visible: false,
      offsetPx: 0,
    };
    this.urllineVisible = false;
    this.leftInsetPx = 0;
    this.closedBuffers = [];
    this.maxClosedBuffers = 50;
    this.lastSelectionCopyByWebContentsId = new Map();
  }

  init(windowRef) {
    this.window = windowRef;
    if (this.window) {
      this.window.on("resize", () => this.layoutViews());
      this.window.on("maximize", () => this.layoutViews());
      this.window.on("unmaximize", () => this.layoutViews());
      this.window.on("focus", () => this.focusActive());
      this.window.on("closed", () => {
        this.window = null;
      });
    }
  }

  isWindowAlive() {
    return Boolean(this.window && !this.window.isDestroyed());
  }

  create(url = "about:blank", options = {}) {
    if (!this.window) {
      throw new Error("BufferManager must be initialized with a window before create().");
    }

    const activate = options.activate !== false;
    const buffer = new Buffer(0, options);
    buffer.setContentUiOptions(this.contentUiOptions);
    buffer.on("updated", (event = {}) => {
      this.notify({ kind: event.kind || "metadata", activeChanged: false });
    });
    buffer.on("visit", (event = {}) => {
      this.notify({
        kind: "visit",
        activeChanged: false,
        sourceBufferId: buffer.id,
        url: event.url,
        title: event.title,
        timestampMs: event.timestampMs,
      });
    });
    buffer.on("title-updated", (event = {}) => {
      this.notify({
        kind: "title-updated",
        activeChanged: false,
        sourceBufferId: buffer.id,
        url: event.url,
        title: event.title,
        timestampMs: event.timestampMs,
      });
    });
    this.attachPaneTracking(buffer, () => this.resolvePaneForBuffer(buffer));

    this.buffers.push(buffer);
    attachView(this.window, buffer.view);
    this.reindexBuffers();

    if (activate || this.activeIndex < 0) {
      this.activeIndex = this.buffers.length - 1;
      this.focusedPane = "left";
    }

    this.layoutViews();

    if (url) {
      buffer.load(url);
    }

    this.notify({ kind: "structure", activeChanged: activate });
    return buffer;
  }

  openConfiguredBuffer(options = {}) {
    const openingBufferConfig = getConfigValue("global.opening_buffer", {});
    const openingBufferSpec = buildOpeningBufferSpec(
      openingBufferConfig,
      this.resolveOpeningBufferThemeContext(),
    );

    if (openingBufferSpec.warning) {
      notificationsService.notify({
        severity: "warning",
        code: "opening_buffer_warning",
        message: String(openingBufferSpec.warning),
        source: "browser.manager",
        persist: false,
      });
    }

    if (openingBufferSpec.kind === "virtual") {
      const buffer = this.create(null, options);
      buffer.loadVirtualDocument(openingBufferSpec.document);
      return buffer;
    }

    return this.create(openingBufferSpec.url, options);
  }

  resolveOpeningBufferThemeContext() {
    const themeConfig = getConfigValue("global.theme", {});
    const resolvedMode = resolveThemeMode(themeConfig, {
      systemPrefersDark: nativeTheme.shouldUseDarkColors,
    });
    return {
      colorScheme: resolvedMode === "light" ? "light" : "dark",
      theme: resolveTheme(themeConfig, {
        systemPrefersDark: nativeTheme.shouldUseDarkColors,
      }),
    };
  }

  refreshDashboardBuffers() {
    const dashboardBuffers = this.buffers.filter(
      (buffer) =>
        buffer &&
        (buffer.virtualUrl === "noctra://dashboard" || buffer.url === "noctra://dashboard"),
    );
    if (dashboardBuffers.length === 0) {
      return;
    }

    const openingBufferConfig = getConfigValue("global.opening_buffer", {});
    const dashboardSpec = buildOpeningBufferSpec(
      {
        ...openingBufferConfig,
        mode: "dashboard",
      },
      this.resolveOpeningBufferThemeContext(),
    );

    if (!dashboardSpec || dashboardSpec.kind !== "virtual" || !dashboardSpec.document) {
      return;
    }

    for (const buffer of dashboardBuffers) {
      buffer.loadVirtualDocument(dashboardSpec.document);
    }
  }

  getLeftBuffer() {
    if (this.activeIndex < 0) return null;
    return this.buffers[this.activeIndex] || null;
  }

  getFocusedMainBuffer() {
    if (
      this.split.enabled &&
      this.split.mode === "regular" &&
      this.focusedPane === "right" &&
      this.split.rightPaneSourceBuffer
    ) {
      return this.split.rightPaneSourceBuffer;
    }

    return this.getLeftBuffer();
  }

  getActive() {
    if (this.split.enabled && this.split.mode === "regular" && this.focusedPane === "right") {
      const left = this.getLeftBuffer();
      if (this.split.rightPaneSourceBuffer && this.split.rightPaneSourceBuffer !== left) {
        return this.split.rightPaneSourceBuffer;
      }

      if (this.split.rightPaneBuffer) {
        return this.split.rightPaneBuffer;
      }

      if (this.split.rightPaneSourceBuffer) {
        return this.split.rightPaneSourceBuffer;
      }
    }

    return this.getLeftBuffer();
  }

  getActiveWebContents() {
    if (this.split.enabled && this.focusedPane === "right") {
      if (this.split.mode === "regular") {
        const left = this.getLeftBuffer();
        if (this.split.rightPaneSourceBuffer && this.split.rightPaneSourceBuffer !== left) {
          return this.split.rightPaneSourceBuffer.webContents;
        }

        if (this.split.rightPaneBuffer) {
          return this.split.rightPaneBuffer.webContents;
        }

        if (this.split.rightPaneSourceBuffer) {
          return this.split.rightPaneSourceBuffer.webContents;
        }
      }

      if (this.split.mode === "devtools" && this.devtoolsView) {
        return this.devtoolsView.webContents;
      }
    }

    const left = this.getLeftBuffer();
    return left ? left.webContents : null;
  }

  switchTo(id) {
    const index = this.buffers.findIndex((buffer) => buffer.id === id);
    if (index === -1) return null;

    const target = this.buffers[index];

    if (this.split.enabled && this.split.mode === "regular" && this.focusedPane === "right") {
      this.assignRightPaneSource(target);
    } else {
      this.activeIndex = index;
    }

    this.syncDevtoolsTargetToLeftBuffer();

    this.layoutViews();
    this.focusActive();
    this.notify({ kind: "structure", activeChanged: true });
    return this.getActive();
  }

  switchByOffset(offset) {
    if (this.buffers.length === 0) return null;

    const currentMain = this.getFocusedMainBuffer();
    const currentIndex = this.buffers.findIndex((buffer) => buffer === currentMain);
    if (currentIndex === -1) return this.getActive();

    const length = this.buffers.length;
    const nextIndex = ((currentIndex + offset) % length + length) % length;
    const nextBuffer = this.buffers[nextIndex];

    if (this.split.enabled && this.split.mode === "regular" && this.focusedPane === "right") {
      this.assignRightPaneSource(nextBuffer);
    } else {
      this.activeIndex = nextIndex;
    }

    this.syncDevtoolsTargetToLeftBuffer();

    this.layoutViews();
    this.focusActive();
    this.notify({ kind: "structure", activeChanged: true });
    return this.getActive();
  }

  close(id = null) {
    if (this.buffers.length === 0) return null;

    let target = null;

    if (id === null) {
      if (
        this.split.enabled &&
        this.split.mode === "regular" &&
        this.focusedPane === "right" &&
        this.split.rightPaneSourceBuffer
      ) {
        target = this.split.rightPaneSourceBuffer;
      } else {
        target = this.getLeftBuffer();
      }
    } else {
      target = this.buffers.find((buffer) => buffer.id === id) || null;
    }

    if (!target) return null;

    const index = this.buffers.findIndex((buffer) => buffer === target);
    if (index === -1) return null;

    this.rememberClosedBuffer(target, index);
    this.buffers.splice(index, 1);

    detachView(this.window, target.view);

    if (this.split.rightPaneSourceBuffer === target) {
      this.split.rightPaneSourceBuffer = null;
    }

    target.destroy();

    if (this.buffers.length === 0) {
      this.activeIndex = -1;
      this.openConfiguredBuffer();
      return this.getActive();
    }

    if (index < this.activeIndex) {
      this.activeIndex -= 1;
    }

    if (this.activeIndex >= this.buffers.length) {
      this.activeIndex = this.buffers.length - 1;
    }

    this.reindexBuffers();
    this.reconcileSplitSources();
    this.syncDevtoolsTargetToLeftBuffer();
    this.layoutViews();
    this.focusActive();
    this.notify({ kind: "structure", activeChanged: true });
    return this.getActive();
  }

  rememberClosedBuffer(buffer, index) {
    if (!buffer) {
      return;
    }

    const snapshot = {
      url: typeof buffer.url === "string" ? buffer.url : "about:blank",
      kind: typeof buffer.kind === "string" ? buffer.kind : "web",
      title: typeof buffer.title === "string" ? buffer.title : "[No title]",
      virtualUrl: typeof buffer.virtualUrl === "string" ? buffer.virtualUrl : "",
      index: Number.isInteger(index) ? index : this.buffers.findIndex((item) => item === buffer),
    };

    if (snapshot.kind !== "web") {
      return;
    }

    this.closedBuffers.push(snapshot);
    if (this.closedBuffers.length > this.maxClosedBuffers) {
      this.closedBuffers.splice(0, this.closedBuffers.length - this.maxClosedBuffers);
    }
  }

  reopenLastClosed() {
    if (this.closedBuffers.length === 0 || !this.window) {
      return null;
    }

    const snapshot = this.closedBuffers.pop();
    if (!snapshot || typeof snapshot.url !== "string" || !snapshot.url.trim()) {
      return null;
    }

    const buffer = new Buffer(0, {
      kind: snapshot.kind || "web",
      activate: false,
    });
    buffer.setContentUiOptions(this.contentUiOptions);
    buffer.on("updated", (event = {}) => {
      this.notify({ kind: event.kind || "metadata", activeChanged: false });
    });
    buffer.on("visit", (event = {}) => {
      this.notify({
        kind: "visit",
        activeChanged: false,
        sourceBufferId: buffer.id,
        url: event.url,
        title: event.title,
        timestampMs: event.timestampMs,
      });
    });
    buffer.on("title-updated", (event = {}) => {
      this.notify({
        kind: "title-updated",
        activeChanged: false,
        sourceBufferId: buffer.id,
        url: event.url,
        title: event.title,
        timestampMs: event.timestampMs,
      });
    });
    this.attachPaneTracking(buffer, () => this.resolvePaneForBuffer(buffer));

    const insertIndex = Number.isInteger(snapshot.index)
      ? Math.max(0, Math.min(snapshot.index, this.buffers.length))
      : this.buffers.length;

    this.buffers.splice(insertIndex, 0, buffer);
    attachView(this.window, buffer.view);
    this.reindexBuffers();
    this.activeIndex = insertIndex;
    this.focusedPane = "left";
    this.reconcileSplitSources();
    this.syncDevtoolsTargetToLeftBuffer();
    this.layoutViews();
    buffer.load(snapshot.url);
    this.focusActive();
    this.notify({ kind: "structure", activeChanged: true });
    return buffer;
  }

  closeLeftOfActive() {
    const leftBuffer = this.getLeftBuffer();
    if (!leftBuffer) return null;
    if (this.activeIndex <= 0) return leftBuffer;

    const removed = this.buffers.splice(0, this.activeIndex);
    for (const buffer of removed) {
      this.rememberClosedBuffer(buffer, 0);
      detachView(this.window, buffer.view);
      if (this.split.rightPaneSourceBuffer === buffer) {
        this.split.rightPaneSourceBuffer = null;
      }
      buffer.destroy();
    }

    this.activeIndex = 0;
    this.reindexBuffers();
    this.reconcileSplitSources();
    this.syncDevtoolsTargetToLeftBuffer();
    this.layoutViews();
    this.focusActive();
    this.notify({ kind: "structure", activeChanged: true });
    return this.getActive();
  }

  closeRightOfActive() {
    if (this.activeIndex < 0 || this.activeIndex >= this.buffers.length - 1) {
      return this.getActive();
    }

    const removed = this.buffers.splice(this.activeIndex + 1);
    for (const buffer of removed) {
      this.rememberClosedBuffer(buffer, this.activeIndex + 1);
      detachView(this.window, buffer.view);
      if (this.split.rightPaneSourceBuffer === buffer) {
        this.split.rightPaneSourceBuffer = null;
      }
      buffer.destroy();
    }

    this.reindexBuffers();
    this.reconcileSplitSources();
    this.syncDevtoolsTargetToLeftBuffer();
    this.layoutViews();
    this.focusActive();
    this.notify({ kind: "structure", activeChanged: true });
    return this.getActive();
  }

  openVerticalSplit(ratio = 0.5) {
    return openVerticalSplit(this, ratio);
  }

  openDevtoolsSplit(ratio = 0.25) {
    return openDevtoolsSplit(this, ratio);
  }

  closeRightSplit() {
    return closeRightSplit(this);
  }

  focusSplitLeft() {
    return focusSplitLeft(this);
  }

  focusSplitRight() {
    return focusSplitRight(this);
  }

  focusPane(pane = "left") {
    return focusPane(this, pane);
  }

  isSplitEnabled() {
    return this.split.enabled;
  }

  getSplitStatus() {
    return {
      enabled: this.split.enabled,
      mode: this.split.mode,
      focusedPane: this.focusedPane,
      divider: {
        visible: this.splitDivider.visible,
        offsetPx: this.splitDivider.offsetPx,
      },
    };
  }

  setUrllineVisible(visible) {
    const next = Boolean(visible);
    if (this.urllineVisible === next) {
      return;
    }

    this.urllineVisible = next;
    this.layoutViews();
    this.notify({ kind: "layout", activeChanged: false });
  }

  isUrllineVisible() {
    return this.urllineVisible;
  }

  setLeftInset(px = 0) {
    const next = Number.isFinite(px) ? Math.max(0, Math.floor(px)) : 0;
    if (this.leftInsetPx === next) return;
    this.leftInsetPx = next;
    this.layoutViews();
    this.notify({ kind: "layout", activeChanged: false });
  }

  getRightPaneBuffer() {
    if (!this.split.enabled || this.split.mode !== "regular") {
      return null;
    }

    const left = this.getLeftBuffer();
    if (this.split.rightPaneSourceBuffer && this.split.rightPaneSourceBuffer !== left) {
      return this.split.rightPaneSourceBuffer;
    }

    if (this.split.rightPaneBuffer) {
      return this.split.rightPaneBuffer;
    }

    return this.split.rightPaneSourceBuffer || null;
  }

  getPaneBuffer(pane = "left") {
    if (pane === "right") {
      return this.getRightPaneBuffer();
    }

    return this.getLeftBuffer();
  }

  getSnapshot() {
    const leftBuffer = this.getLeftBuffer();
    const rightSource =
      this.split.enabled && this.split.mode === "regular" ? this.split.rightPaneSourceBuffer : null;

    const focusedSource =
      this.focusedPane === "right" && rightSource ? rightSource : leftBuffer;
    const otherSource =
      this.focusedPane === "right" ? leftBuffer : rightSource;
    const showSecondary =
      Boolean(leftBuffer && rightSource) && leftBuffer !== rightSource;

    return this.buffers.map((buffer) => {
      const isFocusedPaneBuffer = buffer === focusedSource;
      const isOtherPaneBuffer = showSecondary && buffer === otherSource;
      return buffer.toJSON(isFocusedPaneBuffer, {
        isFocusedPaneBuffer,
        isOtherPaneBuffer,
      });
    });
  }

  canShowUrllineForBuffer(buffer) {
    return canShowUrllineForBuffer(this, buffer);
  }

  getUrllineRenderModel() {
    return getUrllineRenderModel(this);
  }

  findByKind(kind) {
    return this.buffers.find((buffer) => buffer.kind === kind) || null;
  }

  getBuffers() {
    return this.buffers.slice();
  }

  isSessionRestorableBuffer(buffer) {
    if (!buffer || buffer.kind !== "web") {
      return false;
    }

    const url = typeof buffer.url === "string" ? buffer.url.trim() : "";
    if (!url || url === "about:blank") {
      return false;
    }

    if (url.startsWith("noctra://") || url.startsWith("data:")) {
      return false;
    }

    return true;
  }

  exportSessionSnapshot() {
    const entries = this.buffers
      .filter((buffer) => this.isSessionRestorableBuffer(buffer))
      .map((buffer) => ({
        url: buffer.url,
      }));

    const active = this.getFocusedMainBuffer() || this.getLeftBuffer();
    const activeRestorableIndex = this.buffers
      .filter((buffer) => this.isSessionRestorableBuffer(buffer))
      .findIndex((buffer) => buffer === active);

    return {
      version: 1,
      savedAtMs: Date.now(),
      activeIndex: activeRestorableIndex >= 0 ? activeRestorableIndex : 0,
      buffers: entries,
    };
  }

  restoreSessionSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") {
      return false;
    }

    const entries = Array.isArray(snapshot.buffers)
      ? snapshot.buffers
          .map((entry) => {
            const url = typeof entry?.url === "string" ? entry.url.trim() : "";
            if (!url || url === "about:blank" || url.startsWith("noctra://") || url.startsWith("data:")) {
              return null;
            }
            return { url };
          })
          .filter(Boolean)
      : [];

    if (entries.length === 0 || !this.window) {
      return false;
    }

    if (this.split.enabled) {
      this.closeRightSplit();
    }

    for (const buffer of this.buffers) {
      detachView(this.window, buffer.view);
      buffer.destroy();
    }

    this.buffers = [];
    this.activeIndex = -1;
    this.closedBuffers = [];
    this.reindexBuffers();

    for (const entry of entries) {
      this.create(entry.url, { activate: false });
    }

    const rawActiveIndex = Number.isInteger(snapshot.activeIndex) ? snapshot.activeIndex : 0;
    const safeActiveIndex = Math.max(0, Math.min(rawActiveIndex, this.buffers.length - 1));
    this.activeIndex = safeActiveIndex;
    this.focusedPane = "left";
    this.layoutViews();
    this.focusActive();
    this.notify({ kind: "structure", activeChanged: true });
    return true;
  }

  getAllWebContents() {
    const items = [];

    for (const buffer of this.buffers) {
      if (buffer && buffer.webContents && !buffer.webContents.isDestroyed()) {
        items.push(buffer.webContents);
      }
    }

    if (
      this.split.rightPaneBuffer &&
      this.split.rightPaneBuffer.webContents &&
      !this.split.rightPaneBuffer.webContents.isDestroyed()
    ) {
      items.push(this.split.rightPaneBuffer.webContents);
    }

    if (this.devtoolsView && this.devtoolsView.webContents && !this.devtoolsView.webContents.isDestroyed()) {
      items.push(this.devtoolsView.webContents);
    }

    return items;
  }

  getBufferByWebContents(webContents) {
    if (!webContents || webContents.isDestroyed()) {
      return null;
    }

    for (const buffer of this.buffers) {
      if (buffer && buffer.webContents === webContents) {
        return buffer;
      }
    }

    if (this.split.rightPaneBuffer && this.split.rightPaneBuffer.webContents === webContents) {
      return this.split.rightPaneBuffer;
    }

    return null;
  }

  isEditableWebContents(webContents) {
    const buffer = this.getBufferByWebContents(webContents);
    return Boolean(buffer && buffer.isEditable);
  }

  subscribe(listener) {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  reindexBuffers() {
    for (let index = 0; index < this.buffers.length; index += 1) {
      this.buffers[index].id = index + 1;
    }
  }

  ensureRightPaneBuffer() {
    if (this.split.rightPaneBuffer || !this.window) return;

    const rightPane = new Buffer(0);
    rightPane.setContentUiOptions(this.contentUiOptions);
    rightPane.on("updated", (event = {}) => {
      this.notify({ kind: event.kind || "metadata", activeChanged: false });
    });
    rightPane.on("visit", (event = {}) => {
      this.notify({
        kind: "visit",
        activeChanged: false,
        sourceBufferId: rightPane.id,
        url: event.url,
        title: event.title,
        timestampMs: event.timestampMs,
      });
    });
    rightPane.on("title-updated", (event = {}) => {
      this.notify({
        kind: "title-updated",
        activeChanged: false,
        sourceBufferId: rightPane.id,
        url: event.url,
        title: event.title,
        timestampMs: event.timestampMs,
      });
    });
    this.attachPaneTracking(rightPane, () => "right");

    this.split.rightPaneBuffer = rightPane;
    attachView(this.window, rightPane.view);
  }

  resolveBufferMirrorUrl(buffer) {
    if (!buffer) {
      return "about:blank";
    }

    const liveUrl =
      buffer.webContents && !buffer.webContents.isDestroyed()
        ? String(buffer.webContents.getURL() || "").trim()
        : "";
    if (liveUrl.length > 0) {
      return liveUrl;
    }

    const trackedUrl = typeof buffer.url === "string" ? buffer.url.trim() : "";
    return trackedUrl.length > 0 ? trackedUrl : "about:blank";
  }

  assignRightPaneSource(sourceBuffer) {
    if (!sourceBuffer || !this.split.rightPaneBuffer) return;

    this.split.rightPaneSourceBuffer = sourceBuffer;
    this.split.rightPaneBuffer.kind = sourceBuffer.kind || "web";
    this.split.rightPaneBuffer.isEditable = Boolean(sourceBuffer.isEditable);

    if (sourceBuffer !== this.getLeftBuffer()) {
      return;
    }

    const sourceUrl = this.resolveBufferMirrorUrl(sourceBuffer);
    const rightPaneUrl = this.split.rightPaneBuffer.url || "";
    if (rightPaneUrl !== sourceUrl) {
      this.split.rightPaneBuffer.load(sourceUrl);
    }
  }

  destroyRightPaneBuffer() {
    const rightPane = this.split.rightPaneBuffer;
    if (!rightPane) return;

    detachView(this.window, rightPane.view);

    rightPane.destroy();
    this.split.rightPaneBuffer = null;
    this.split.rightPaneSourceBuffer = null;
  }

  closeDevtoolsSplit() {
    return closeDevtoolsSplit(this);
  }

  syncDevtoolsTargetToLeftBuffer() {
    return syncDevtoolsTargetToLeftBuffer(this);
  }

  reconcileSplitSources() {
    return reconcileSplitSources(this);
  }

  layoutViews() {
    layoutViews(this);
  }

  attachPaneTracking(buffer, paneResolver) {
    attachPaneTracking(this, buffer, paneResolver);
  }

  resolvePaneForBuffer(buffer) {
    if (
      this.split.enabled &&
      this.split.mode === "regular" &&
      buffer &&
      buffer === this.split.rightPaneSourceBuffer &&
      buffer !== this.getLeftBuffer()
    ) {
      return "right";
    }

    return "left";
  }

  handlePaneInteraction(pane) {
    if (!this.split.enabled) {
      this.notify({ kind: "pane-interaction", activeChanged: false, pane: "left" });
      return;
    }

    if (pane === "right") {
      if (
        this.split.mode === "regular" &&
        (this.split.rightPaneSourceBuffer || this.split.rightPaneBuffer)
      ) {
        if (this.focusedPane === "right") return;
        this.focusedPane = "right";
        this.layoutViews();
        this.notify({ kind: "structure", activeChanged: true });
      } else {
        this.notify({ kind: "pane-interaction", activeChanged: false, pane: "right" });
      }
      return;
    }

    if (this.focusedPane === "left") {
      this.notify({ kind: "pane-interaction", activeChanged: false, pane: "left" });
      return;
    }

    this.focusedPane = "left";
    this.layoutViews();
    this.notify({ kind: "structure", activeChanged: true });
  }

  focusActive() {
    const target = this.getActiveWebContents();
    if (!this.isWindowAlive() || !target) return;
    this.window.focus();
    target.focus();
  }

  setContentUiOptions(options = {}) {
    this.contentUiOptions = {
      ...this.contentUiOptions,
      ...options,
    };

    for (const buffer of this.buffers) {
      buffer.setContentUiOptions(this.contentUiOptions);
    }

    if (this.split.rightPaneBuffer) {
      this.split.rightPaneBuffer.setContentUiOptions(this.contentUiOptions);
    }
  }

  notify(change = { kind: "metadata", activeChanged: false }) {
    const snapshot = this.getSnapshot();
    for (const listener of this.subscribers) {
      listener(snapshot, this.getActive(), change);
    }
  }
}

module.exports = new BufferManager();
