const { BrowserView } = require("electron");
const Buffer = require("./buffers");
const { UI_SHELL_TABLINE_HEIGHT, UI_SHELL_STATUSLINE_HEIGHT } = require("../ui/constants");

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
      this.create("about:blank");
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

  closeLeftOfActive() {
    const leftBuffer = this.getLeftBuffer();
    if (!leftBuffer) return null;
    if (this.activeIndex <= 0) return leftBuffer;

    const removed = this.buffers.splice(0, this.activeIndex);
    for (const buffer of removed) {
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

    if (!this.split.enabled || this.split.mode !== "regular" || !this.split.rightPaneSourceBuffer) {
      this.assignRightPaneSource(left);
    }

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
      this.devtoolsView = new BrowserView({
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
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

  isSplitEnabled() {
    return this.split.enabled;
  }

  getSplitStatus() {
    return {
      enabled: this.split.enabled,
      mode: this.split.mode,
      focusedPane: this.focusedPane,
    };
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

  findByKind(kind) {
    return this.buffers.find((buffer) => buffer.kind === kind) || null;
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

    const rightPane = new Buffer(0);
    rightPane.setContentUiOptions(this.contentUiOptions);
    rightPane.on("updated", (event = {}) => {
      this.notify({ kind: event.kind || "metadata", activeChanged: false });
    });
    this.attachPaneTracking(rightPane, () => "right");

    this.split.rightPaneBuffer = rightPane;
    this.window.addBrowserView(rightPane.view);
  }

  assignRightPaneSource(sourceBuffer) {
    if (!sourceBuffer || !this.split.rightPaneBuffer) return;

    this.split.rightPaneSourceBuffer = sourceBuffer;

    if (sourceBuffer !== this.getLeftBuffer()) {
      return;
    }

    const sourceUrl = sourceBuffer.url || "about:blank";
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
    const contentTop = UI_SHELL_TABLINE_HEIGHT;
    const contentHeight = Math.max(
      bounds.height - UI_SHELL_TABLINE_HEIGHT - UI_SHELL_STATUSLINE_HEIGHT,
      1,
    );

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

    const rightWidth = showSplit ? Math.max(Math.floor(bounds.width * this.split.ratio), 1) : 0;
    const leftWidth = showSplit ? Math.max(bounds.width - rightWidth, 1) : bounds.width;

    for (const buffer of this.buffers) {
      if (buffer === left || buffer === visibleRightMainBuffer) {
        const isRightBuffer = buffer === visibleRightMainBuffer;
        buffer.view.setBounds({
          x: isRightBuffer ? leftWidth : 0,
          y: contentTop,
          width: isRightBuffer ? rightWidth : leftWidth,
          height: contentHeight,
        });
        buffer.view.setAutoResize({ width: !showSplitWithRegular, height: true });
      } else {
        buffer.view.setAutoResize({ width: false, height: false });
        buffer.view.setBounds({ x: -10000, y: -10000, width: 1, height: 1 });
      }
    }

    if (rightRegular) {
      if (showSplit && this.split.mode === "regular" && useMirroredRight) {
        const sourceUrl = rightSource?.url || "about:blank";
        if (rightRegular.url !== sourceUrl) {
          rightRegular.load(sourceUrl);
        }

        rightRegular.view.setBounds({
          x: leftWidth,
          y: contentTop,
          width: rightWidth,
          height: contentHeight,
        });
        rightRegular.view.setAutoResize({ width: !showSplit, height: true });
      } else {
        rightRegular.view.setAutoResize({ width: false, height: false });
        rightRegular.view.setBounds({ x: -10000, y: -10000, width: 1, height: 1 });
      }
    }

    if (this.devtoolsView) {
      if (showSplit && this.split.mode === "devtools") {
        this.devtoolsView.setBounds({
          x: leftWidth,
          y: contentTop,
          width: rightWidth,
          height: contentHeight,
        });
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
      }
      return;
    }

    if (this.focusedPane === "left") {
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
