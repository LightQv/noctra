const { BrowserView, nativeTheme } = require("electron");
const path = require("path");
const Buffer = require("./buffers");
const {
  UI_SHELL_TABLINE_HEIGHT,
  UI_SHELL_URLLINE_HEIGHT,
  UI_SHELL_STATUSLINE_HEIGHT,
} = require("../ui/constants");
const { getConfigValue } = require("../core/config/service");
const notificationsService = require("../core/notifications/service");
const { buildOpeningBufferSpec } = require("../core/opening/buffer");
const { resolveTheme, resolveThemeMode } = require("../ui/theme");

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
  }

  init(windowRef) {
    this.window = windowRef;
    if (this.window) {
      this.window.on("resize", () => this.layoutViews());
      this.window.on("maximize", () => this.layoutViews());
      this.window.on("unmaximize", () => this.layoutViews());
      this.window.on("focus", () => this.focusActive());
    }
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
    this.window.addBrowserView(buffer.view);
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

    if (this.window && this.window.getBrowserViews().includes(target.view)) {
      this.window.removeBrowserView(target.view);
    }

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
      preloadPath: path.join(__dirname, "..", "ui", "shell", "preload.js"),
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
    this.window.addBrowserView(buffer.view);
    this.reindexBuffers();
    this.activeIndex = insertIndex;
    this.focusedPane = "left";
    this.reconcileSplitSources();
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
      if (this.window && this.window.getBrowserViews().includes(buffer.view)) {
        this.window.removeBrowserView(buffer.view);
      }
      if (this.split.rightPaneSourceBuffer === buffer) {
        this.split.rightPaneSourceBuffer = null;
      }
      buffer.destroy();
    }

    this.activeIndex = 0;
    this.reindexBuffers();
    this.reconcileSplitSources();
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
      if (this.window && this.window.getBrowserViews().includes(buffer.view)) {
        this.window.removeBrowserView(buffer.view);
      }
      if (this.split.rightPaneSourceBuffer === buffer) {
        this.split.rightPaneSourceBuffer = null;
      }
      buffer.destroy();
    }

    this.reindexBuffers();
    this.reconcileSplitSources();
    this.layoutViews();
    this.focusActive();
    this.notify({ kind: "structure", activeChanged: true });
    return this.getActive();
  }

  openVerticalSplit(ratio = 0.5) {
    const left = this.getLeftBuffer();
    if (!left) return null;

    this.closeDevtoolsSplit();
    this.ensureRightPaneBuffer();
    this.assignRightPaneSource(left);

    this.split.enabled = true;
    this.split.mode = "regular";
    this.split.ratio = ratio;
    this.focusedPane = "right";

    this.layoutViews();
    this.focusActive();
    this.notify({ kind: "structure", activeChanged: true });
    return this.split.rightPaneBuffer;
  }

  openDevtoolsSplit(ratio = 0.25) {
    const left = this.getLeftBuffer();
    if (!left || !this.window) return;

    this.destroyRightPaneBuffer();

    this.split.enabled = true;
    this.split.mode = "devtools";
    this.split.ratio = ratio;
    this.focusedPane = "left";

    if (!this.devtoolsView) {
      const chromiumPreferences = getConfigValue("browser.chromium.web_preferences", {});
      this.devtoolsView = new BrowserView({
        webPreferences: {
          contextIsolation:
            typeof chromiumPreferences.context_isolation === "boolean"
              ? chromiumPreferences.context_isolation
              : true,
          nodeIntegration:
            typeof chromiumPreferences.node_integration === "boolean"
              ? chromiumPreferences.node_integration
              : false,
        },
      });
      this.window.addBrowserView(this.devtoolsView);
    }

    this.devtoolsTarget = left.webContents;
    this.devtoolsTarget.setDevToolsWebContents(this.devtoolsView.webContents);
    this.devtoolsTarget.openDevTools({ mode: "detach", activate: false });

    this.layoutViews();
    this.notify({ kind: "structure", activeChanged: false });
  }

  closeRightSplit() {
    if (!this.split.enabled) {
      return;
    }

    if (this.split.mode === "regular") {
      this.destroyRightPaneBuffer();
    }

    if (this.split.mode === "devtools") {
      this.closeDevtoolsSplit();
    }

    this.split.enabled = false;
    this.split.mode = "regular";
    this.split.ratio = 0.5;
    this.focusedPane = "left";
    this.layoutViews();
    this.focusActive();
    this.notify({ kind: "structure", activeChanged: true });
  }

  focusSplitLeft() {
    if (!this.split.enabled) return false;
    this.focusedPane = "left";
    this.layoutViews();
    this.focusActive();
    this.notify({ kind: "structure", activeChanged: true });
    return true;
  }

  focusSplitRight() {
    if (!this.split.enabled) return false;
    this.focusedPane = "right";
    this.layoutViews();
    this.focusActive();
    this.notify({ kind: "structure", activeChanged: true });
    return true;
  }

  focusPane(pane = "left") {
    if (pane === "right") {
      return this.focusSplitRight();
    }

    if (this.split.enabled) {
      return this.focusSplitLeft();
    }

    this.focusedPane = "left";
    this.layoutViews();
    this.focusActive();
    this.notify({ kind: "structure", activeChanged: true });
    return true;
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
    return Boolean(this.urllineVisible && buffer && !buffer.isEditable);
  }

  getUrllineRenderModel() {
    if (!this.window) {
      return { panes: [] };
    }

    const bounds = this.window.getContentBounds();
    const left = this.getLeftBuffer();
    const rightSource = this.split.mode === "regular" ? this.split.rightPaneSourceBuffer : null;
    const rightRegular = this.split.mode === "regular" ? this.split.rightPaneBuffer : null;
    const showSplit = this.split.enabled && (rightSource || rightRegular || this.split.mode === "devtools");
    const dividerWidth = showSplit && getConfigValue("global.split.divider.enabled", true) ? 1 : 0;
    const contentX = Math.max(0, this.leftInsetPx);
    const contentWidth = Math.max(bounds.width - contentX, 2);
    const availableSplitWidth = Math.max(contentWidth - dividerWidth, 2);
    const rightWidth = showSplit
      ? Math.max(Math.floor(availableSplitWidth * this.split.ratio), 1)
      : 0;
    const leftWidth = showSplit
      ? Math.max(availableSplitWidth - rightWidth, 1)
      : contentWidth;
    const rightX = contentX + leftWidth + dividerWidth;

    const useMirroredRight =
      showSplit &&
      this.split.mode === "regular" &&
      Boolean(left && rightSource && left === rightSource);

    const rightPaneBuffer =
      this.split.mode === "regular"
        ? useMirroredRight
          ? rightRegular
          : rightSource
        : null;

    const panes = [];

    if (this.canShowUrllineForBuffer(left)) {
      panes.push({
        pane: "left",
        x: 0,
        top: UI_SHELL_TABLINE_HEIGHT,
        width: leftWidth,
        url: left.url || "about:blank",
        canGoBack: Boolean(left.webContents?.navigationHistory?.canGoBack?.()),
        canGoForward: Boolean(left.webContents?.navigationHistory?.canGoForward?.()),
      });
    }

    if (showSplit && this.canShowUrllineForBuffer(rightPaneBuffer)) {
      panes.push({
        pane: "right",
        x: rightX,
        top: UI_SHELL_TABLINE_HEIGHT,
        width: rightWidth,
        url: rightPaneBuffer.url || "about:blank",
        canGoBack: Boolean(rightPaneBuffer.webContents?.navigationHistory?.canGoBack?.()),
        canGoForward: Boolean(rightPaneBuffer.webContents?.navigationHistory?.canGoForward?.()),
      });
    }

    return { panes };
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
      if (this.window.getBrowserViews().includes(buffer.view)) {
        this.window.removeBrowserView(buffer.view);
      }
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

    const rightPane = new Buffer(0, {
      preloadPath: path.join(__dirname, "..", "ui", "shell", "preload.js"),
    });
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
    this.window.addBrowserView(rightPane.view);
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

    if (this.window && this.window.getBrowserViews().includes(rightPane.view)) {
      this.window.removeBrowserView(rightPane.view);
    }

    rightPane.destroy();
    this.split.rightPaneBuffer = null;
    this.split.rightPaneSourceBuffer = null;
  }

  closeDevtoolsSplit() {
    if (
      this.devtoolsTarget &&
      !this.devtoolsTarget.isDestroyed() &&
      this.devtoolsTarget.isDevToolsOpened()
    ) {
      this.devtoolsTarget.closeDevTools();
    }

    if (this.window && this.devtoolsView && this.window.getBrowserViews().includes(this.devtoolsView)) {
      this.window.removeBrowserView(this.devtoolsView);
    }

    if (this.devtoolsView && !this.devtoolsView.webContents.isDestroyed()) {
      this.devtoolsView.webContents.destroy();
    }

    this.devtoolsView = null;
    this.devtoolsTarget = null;
  }

  reconcileSplitSources() {
    if (!this.split.enabled || this.split.mode !== "regular") {
      return;
    }

    if (!this.split.rightPaneBuffer) {
      this.split.enabled = false;
      this.focusedPane = "left";
      return;
    }

    if (!this.split.rightPaneSourceBuffer || !this.buffers.includes(this.split.rightPaneSourceBuffer)) {
      this.split.rightPaneSourceBuffer = this.getLeftBuffer();
      if (this.split.rightPaneSourceBuffer) {
        this.assignRightPaneSource(this.split.rightPaneSourceBuffer);
      } else {
        this.destroyRightPaneBuffer();
        this.split.enabled = false;
        this.focusedPane = "left";
      }
    }
  }

  layoutViews() {
    if (!this.window) return;

    const bounds = this.window.getContentBounds();
    const shellTop = UI_SHELL_TABLINE_HEIGHT;
    const shellBottomInset = UI_SHELL_STATUSLINE_HEIGHT;

    const left = this.getLeftBuffer();
    const rightSource = this.split.mode === "regular" ? this.split.rightPaneSourceBuffer : null;
    const rightRegular = this.split.mode === "regular" ? this.split.rightPaneBuffer : null;
    const showSplit = this.split.enabled && (rightSource || rightRegular || this.split.mode === "devtools");

    const useMirroredRight =
      showSplit &&
      this.split.mode === "regular" &&
      Boolean(left && rightSource && left === rightSource);

    if (useMirroredRight && !this.split.rightPaneBuffer) {
      this.ensureRightPaneBuffer();
    }

    const showSplitWithRegular =
      this.split.enabled && (Boolean(rightSource) || Boolean(rightRegular));

    const visibleRightMainBuffer =
      this.split.mode === "regular" && rightSource && !useMirroredRight ? rightSource : null;

    const rightVisibleBuffer =
      this.split.mode === "regular" && useMirroredRight
        ? rightRegular
        : visibleRightMainBuffer;

    const leftHasUrlline = this.canShowUrllineForBuffer(left);
    const rightHasUrlline = this.canShowUrllineForBuffer(rightVisibleBuffer);

    const getPaneInset = (isRightPane) => {
      if (!showSplit) {
        return leftHasUrlline ? UI_SHELL_URLLINE_HEIGHT : 0;
      }

      return isRightPane
        ? rightHasUrlline
          ? UI_SHELL_URLLINE_HEIGHT
          : 0
        : leftHasUrlline
          ? UI_SHELL_URLLINE_HEIGHT
          : 0;
    };

    const getPaneBounds = (isRightPane, x, width) => {
      const paneInset = getPaneInset(isRightPane);
      const y = shellTop + paneInset;
      const height = Math.max(bounds.height - shellTop - shellBottomInset - paneInset, 1);
      return {
        x,
        y,
        width,
        height,
      };
    };

    const splitDividerEnabled = getConfigValue("global.split.divider.enabled", true);
    const dividerWidth = showSplit && splitDividerEnabled ? 1 : 0;
    const contentX = Math.max(0, this.leftInsetPx);
    const contentWidth = Math.max(bounds.width - contentX, 2);
    const availableSplitWidth = Math.max(contentWidth - dividerWidth, 2);
    const rightWidth = showSplit
      ? Math.max(Math.floor(availableSplitWidth * this.split.ratio), 1)
      : 0;
    const leftWidth = showSplit
      ? Math.max(availableSplitWidth - rightWidth, 1)
      : contentWidth;
    const rightX = contentX + leftWidth + dividerWidth;

    this.splitDivider.visible = showSplit && dividerWidth > 0;
    this.splitDivider.offsetPx = this.splitDivider.visible ? contentX + leftWidth : 0;

    for (const buffer of this.buffers) {
      if (buffer === left || buffer === visibleRightMainBuffer) {
        const isRightBuffer = buffer === visibleRightMainBuffer;
        buffer.view.setBounds(
          getPaneBounds(
            isRightBuffer,
            isRightBuffer ? rightX : contentX,
            isRightBuffer ? rightWidth : leftWidth,
          ),
        );
        buffer.view.setAutoResize({ width: !showSplitWithRegular, height: true });
      } else {
        buffer.view.setAutoResize({ width: false, height: false });
        buffer.view.setBounds({ x: -10000, y: -10000, width: 1, height: 1 });
      }
    }

    if (rightRegular) {
      if (showSplit && this.split.mode === "regular" && useMirroredRight) {
        const sourceUrl = this.resolveBufferMirrorUrl(rightSource);
        if (rightRegular.url !== sourceUrl) {
          rightRegular.load(sourceUrl);
        }

        rightRegular.view.setBounds(getPaneBounds(true, rightX, rightWidth));
        rightRegular.view.setAutoResize({ width: !showSplit, height: true });
      } else {
        rightRegular.view.setAutoResize({ width: false, height: false });
        rightRegular.view.setBounds({ x: -10000, y: -10000, width: 1, height: 1 });
      }
    }

    if (this.devtoolsView) {
      if (showSplit && this.split.mode === "devtools") {
        this.devtoolsView.setBounds(getPaneBounds(true, rightX, rightWidth));
        this.devtoolsView.setAutoResize({ width: !showSplit, height: true });
      } else {
        this.devtoolsView.setAutoResize({ width: false, height: false });
        this.devtoolsView.setBounds({ x: -10000, y: -10000, width: 1, height: 1 });
      }
    }

    if (typeof this.window.setTopBrowserView === "function") {
      if (showSplit && this.focusedPane === "right") {
        if (this.split.mode === "regular") {
          if (useMirroredRight && rightRegular) {
            this.window.setTopBrowserView(rightRegular.view);
          } else if (visibleRightMainBuffer) {
            this.window.setTopBrowserView(visibleRightMainBuffer.view);
          }
        } else if (this.split.mode === "devtools" && this.devtoolsView) {
          this.window.setTopBrowserView(this.devtoolsView);
        }
      } else if (left) {
        this.window.setTopBrowserView(left.view);
      }
    }
  }

  attachPaneTracking(buffer, paneResolver) {
    if (!buffer || !buffer.webContents) return;

    const onMouseEvent = (event, input) => {
      if (!input || input.type !== "mouseDown") return;
      this.handlePaneInteraction(paneResolver());
    };

    const onFocus = () => {
      this.handlePaneInteraction(paneResolver());
    };

    buffer.webContents.on("before-mouse-event", onMouseEvent);
    buffer.webContents.on("focus", onFocus);
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
    if (!this.window || !target) return;
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
