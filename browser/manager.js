const { nativeTheme } = require("electron");
const { getConfigValue } = require("../core/config/service");
const notificationsService = require("../core/notifications/service");
const { buildOpeningBufferSpec } = require("../core/opening/buffer");
const { resolveTheme, resolveThemeMode } = require("../ui/theme");
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
const {
  ensureRightPaneBuffer,
  resolveBufferMirrorUrl,
  assignRightPaneSource,
  destroyRightPaneBuffer,
} = require("./services/rightPaneBufferService");
const {
  resolvePaneForBuffer,
  handlePaneInteraction,
} = require("./services/paneInteractionService");
const {
  isSessionRestorableBuffer,
  exportSessionSnapshot,
  restoreSessionSnapshot,
} = require("./services/sessionSnapshotService");
const {
  createBuffer,
  closeBuffer,
  rememberClosedBuffer,
  reopenLastClosed,
  closeLeftOfActive,
  closeRightOfActive,
} = require("./services/bufferLifecycleService");
const {
  getLeftBuffer,
  getFocusedMainBuffer,
  getActive,
  getActiveWebContents,
  getRightPaneBuffer,
  getPaneBuffer,
  getAllWebContents,
  getBufferByWebContents,
  isEditableWebContents,
} = require("./services/bufferQueryService");

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
    return createBuffer(this, url, options);
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
        (buffer.virtualUrl === "noctra://dashboard" ||
          buffer.url === "noctra://dashboard"),
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

    if (
      !dashboardSpec ||
      dashboardSpec.kind !== "virtual" ||
      !dashboardSpec.document
    ) {
      return;
    }

    for (const buffer of dashboardBuffers) {
      buffer.loadVirtualDocument(dashboardSpec.document);
    }
  }

  getLeftBuffer() {
    return getLeftBuffer(this);
  }

  getFocusedMainBuffer() {
    return getFocusedMainBuffer(this);
  }

  getActive() {
    return getActive(this);
  }

  getActiveWebContents() {
    return getActiveWebContents(this);
  }

  switchTo(id) {
    const index = this.buffers.findIndex((buffer) => buffer.id === id);
    if (index === -1) return null;

    const target = this.buffers[index];

    if (
      this.split.enabled &&
      this.split.mode === "regular" &&
      this.focusedPane === "right"
    ) {
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
    const currentIndex = this.buffers.findIndex(
      (buffer) => buffer === currentMain,
    );
    if (currentIndex === -1) return this.getActive();

    const length = this.buffers.length;
    const nextIndex = (((currentIndex + offset) % length) + length) % length;
    const nextBuffer = this.buffers[nextIndex];

    if (
      this.split.enabled &&
      this.split.mode === "regular" &&
      this.focusedPane === "right"
    ) {
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
    return closeBuffer(this, id);
  }

  rememberClosedBuffer(buffer, index) {
    return rememberClosedBuffer(this, buffer, index);
  }

  reopenLastClosed() {
    return reopenLastClosed(this);
  }

  closeLeftOfActive() {
    return closeLeftOfActive(this);
  }

  closeRightOfActive() {
    return closeRightOfActive(this);
  }

  getClosedBufferCount() {
    return this.closedBuffers.length;
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
    return getRightPaneBuffer(this);
  }

  getPaneBuffer(pane = "left") {
    return getPaneBuffer(this, pane);
  }

  getSnapshot() {
    const leftBuffer = this.getLeftBuffer();
    const rightSource =
      this.split.enabled && this.split.mode === "regular"
        ? this.split.rightPaneSourceBuffer
        : null;

    const focusedSource =
      this.focusedPane === "right" && rightSource ? rightSource : leftBuffer;
    const otherSource = this.focusedPane === "right" ? leftBuffer : rightSource;
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
    return isSessionRestorableBuffer(this, buffer);
  }

  exportSessionSnapshot() {
    return exportSessionSnapshot(this);
  }

  restoreSessionSnapshot(snapshot) {
    return restoreSessionSnapshot(this, snapshot);
  }

  getAllWebContents() {
    return getAllWebContents(this);
  }

  getBufferByWebContents(webContents) {
    return getBufferByWebContents(this, webContents);
  }

  isEditableWebContents(webContents) {
    return isEditableWebContents(this, webContents);
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
    return ensureRightPaneBuffer(this);
  }

  resolveBufferMirrorUrl(buffer) {
    return resolveBufferMirrorUrl(this, buffer);
  }

  assignRightPaneSource(sourceBuffer) {
    return assignRightPaneSource(this, sourceBuffer);
  }

  destroyRightPaneBuffer() {
    return destroyRightPaneBuffer(this);
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
    return resolvePaneForBuffer(this, buffer);
  }

  handlePaneInteraction(pane) {
    return handlePaneInteraction(this, pane);
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

function createBufferManager() {
  return new BufferManager();
}

const defaultBufferManager = createBufferManager();

module.exports = defaultBufferManager;
module.exports.BufferManager = BufferManager;
module.exports.createBufferManager = createBufferManager;
