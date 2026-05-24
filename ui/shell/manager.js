const { UI_SHELL_TABLINE_HEIGHT } = require("../constants");
const { DEFAULT_THEME } = require("../theme");
const shellTemplateHost = require("./services/shellTemplateHost");
const shellRenderBridge = require("./services/shellRenderBridge");
const overlayLifecycle = require("./services/overlayLifecycle");
const commandOverlayController = require("./services/commandOverlayController");
const whichKeyOverlayController = require("./services/whichKeyOverlayController");
const auxOverlayController = require("./services/auxOverlayController");
const {
  SHELL_HTML,
  COMMAND_OVERLAY_HTML,
  WHICHKEY_OVERLAY_HTML,
  SELECTION_MODAL_OVERLAY_HTML,
  TELESCOPE_OVERLAY_HTML,
  STATUSLINE_OVERLAY_HTML,
  TOAST_OVERLAY_HTML,
  DOWNLOADS_MODAL_OVERLAY_HTML,
  BACKDROP_OVERLAY_HTML,
  CONTEXT_MENU_OVERLAY_HTML,
} = require("./services/shellTemplates");
const contextMenuOverlayController = require("./services/contextMenuOverlayController");
const {
  createPanelViewHost,
} = require("../../core/adapters/platform/panelViewHost");
const {
  createOverlayBrowserView,
  attachOverlayBrowserView,
} = require("../../core/adapters/platform/overlayViewHost");

const LOADINGLINE_OVERLAY_HTML = `<!doctype html><html><head><meta charset="UTF-8" /><style>html,body{margin:0;width:100%;height:100%;background:transparent;overflow:hidden;pointer-events:none}#line{position:absolute;inset:0;opacity:0;transition:opacity 180ms ease;overflow:hidden}#bar{position:absolute;left:0;top:0;height:100%;width:0;background:#89dceb;box-shadow:0 0 8px #89dceb;transform:translateX(0%);transition:width 140ms ease,transform 220ms ease}@keyframes ui-shell-loadingline-sweep{from{transform:translateX(-40%)}to{transform:translateX(260%)}}</style></head><body><div id="line"><span id="bar"></span></div></body></html>`;

class UiShellManager {
  constructor() {
    this.window = null;
    this.shellHostReady = false;
    this.commandOverlayView = null;
    this.commandOverlayReady = false;
    this.commandVisible = false;
    this.commandText = "";
    this.commandCursorIndex = 0;
    this.commandContext = "shell";
    this.whichKeyOverlayView = null;
    this.whichKeyOverlayReady = false;
    this.whichKeyVisible = false;
    this.whichKeyModel = { prefix: "<leader>", entries: [] };
    this.whichKeyHideTimer = null;
    this.whichKeyShowTimer = null;
    this.whichKeyPendingTimeoutMs = 1200;
    this.selectionModalView = null;
    this.selectionModalReady = false;
    this.selectionModalVisible = false;
    this.selectionModalModel = null;
    this.telescopeView = null;
    this.telescopeReady = false;
    this.telescopeVisible = false;
    this.telescopeModel = null;
    this.statuslineView = null;
    this.statuslineReady = false;
    this.toastOverlayView = null;
    this.toastOverlayReady = false;
    this.toastOverlayHeight = 1;
    this.nextToastId = 1;
    this.downloadsModalView = null;
    this.downloadsModalReady = false;
    this.downloadsModalVisible = false;
    this.downloadsModalModel = null;
    this.backdropOverlayView = null;
    this.backdropOverlayReady = false;
    this.contextMenuOverlayView = null;
    this.contextMenuOverlayReady = false;
    this.contextMenuVisible = false;
    this.contextMenuItems = [];
    this.contextMenuBounds = null;
    this.sidepanelViewHost = null;
    this.statuslineMode = "NORMAL";
    this.statuslineScroll = 0;
    this.statuslineSplitIndicator = {
      visible: false,
      focusedPane: "left",
    };
    this.pendingTablineSnapshot = [];
    this.tablineRenderTimer = null;
    this.splitDividerState = {
      visible: false,
      offsetPx: 0,
    };
    this.tablineActions = {};
    this.tablineOptions = {
      showFavicon: false,
      dimActiveBuffer: false,
    };
    this.urllineActions = {};
    this.urllineModel = { panes: [] };
    this.loadinglineModel = { panes: [] };
    this.loadinglineLeftView = null;
    this.loadinglineLeftReady = false;
    this.loadinglineLeftVisible = false;
    this.loadinglineRightView = null;
    this.loadinglineRightReady = false;
    this.loadinglineRightVisible = false;
    this.windowChrome = {
      platform: process.platform,
      useNativeControls: process.platform === "darwin",
      isMaximized: false,
      isFullScreen: false,
    };
    this.currentTheme = {
      ...DEFAULT_THEME,
    };
    this.pendingToasts = [];
    this.mouseActions = {};
  }

  setMouseActions(actions = {}) {
    this.mouseActions = {
      ...actions,
    };
  }

  showNotificationToast(toast = {}) {
    return auxOverlayController.showNotificationToast.call(this, toast);
  }

  flushPendingToasts() {
    return auxOverlayController.flushPendingToasts.call(this);
  }

  init(windowRef) {
    this.window = windowRef;
    this.shellHostReady = false;
    this.toastOverlayHeight = 1;
    this.pendingTablineSnapshot = [];

    this.initializeShellHost();
    this.initializeCommandOverlayView();
    this.initializeWhichKeyOverlayView();
    this.initializeSelectionModalView();
    this.initializeTelescopeView();
    this.initializeStatuslineView();
    this.initializeToastOverlayView();
    this.initializeDownloadsModalView();
    this.initializeBackdropOverlayView();
    this.initializeContextMenuOverlayView();

    this.window.on("resize", () => this.relayout());
    this.window.on("maximize", () => this.relayout());
    this.window.on("unmaximize", () => this.relayout());
  }

  initializeShellHost() {
    return shellTemplateHost.initializeShellHost.call(this, SHELL_HTML);
  }

  initializeSidepanelSurface({ onMouseDown, onMouseEvent, onFocus } = {}) {
    if (!this.window || this.window.isDestroyed()) {
      return null;
    }
    if (this.sidepanelViewHost && this.sidepanelViewHost.destroy) {
      this.sidepanelViewHost.destroy();
    }
    this.sidepanelViewHost = createPanelViewHost({
      windowRef: this.window,
      onMouseDown,
      onMouseEvent,
      onFocus,
    });
    return this.sidepanelViewHost;
  }

  getSidepanelWebContents() {
    if (!this.sidepanelViewHost || !this.sidepanelViewHost.getWebContents) {
      return null;
    }
    return this.sidepanelViewHost.getWebContents();
  }

  initializeCommandOverlayView() {
    return overlayLifecycle.initializeOverlayView.call(this, {
      viewKey: "commandOverlayView",
      readyKey: "commandOverlayReady",
      html: COMMAND_OVERLAY_HTML,
      autoResize: { width: false, height: false },
      onReady() {
        this.updateCommand(this.commandText, this.commandCursorIndex);
      },
    });
  }

  initializeWhichKeyOverlayView() {
    return overlayLifecycle.initializeOverlayView.call(this, {
      viewKey: "whichKeyOverlayView",
      readyKey: "whichKeyOverlayReady",
      html: WHICHKEY_OVERLAY_HTML,
      autoResize: { width: false, height: false },
      onReady() {
        this.updateWhichKey(this.whichKeyModel, null, 0, false, true);
      },
      onMouseEvent: (input) => {
        this.handleWhichKeyMouseEvent(input);
      },
    });
  }

  initializeSelectionModalView() {
    return overlayLifecycle.initializeOverlayView.call(this, {
      viewKey: "selectionModalView",
      readyKey: "selectionModalReady",
      html: SELECTION_MODAL_OVERLAY_HTML,
      autoResize: { width: false, height: false },
      onReady() {
        if (this.selectionModalModel) {
          this.updateSelectionModal(this.selectionModalModel);
        }
      },
      onMouseEvent: (input) => {
        this.handleSelectionModalMouseEvent(input);
      },
    });
  }

  initializeTelescopeView() {
    return overlayLifecycle.initializeOverlayView.call(this, {
      viewKey: "telescopeView",
      readyKey: "telescopeReady",
      html: TELESCOPE_OVERLAY_HTML,
      autoResize: { width: false, height: false },
      onReady() {
        if (this.telescopeModel) {
          this.updateTelescope(this.telescopeModel);
        }
      },
      onMouseEvent: (input) => {
        this.handleTelescopeMouseEvent(input);
      },
    });
  }

  initializeStatuslineView() {
    return overlayLifecycle.initializeOverlayView.call(this, {
      viewKey: "statuslineView",
      readyKey: "statuslineReady",
      html: STATUSLINE_OVERLAY_HTML,
      autoResize: { width: true, height: false },
      onReady() {
        this.updateStatuslineMode(this.statuslineMode);
        this.updateStatuslineScroll(this.statuslineScroll);
        this.updateStatuslineSplitIndicator(this.statuslineSplitIndicator);
      },
    });
  }

  initializeToastOverlayView() {
    return overlayLifecycle.initializeOverlayView.call(this, {
      viewKey: "toastOverlayView",
      readyKey: "toastOverlayReady",
      html: TOAST_OVERLAY_HTML,
      autoResize: { width: false, height: false },
      onReady() {
        this.flushPendingToasts();
      },
      onMouseEvent: (input, event) => {
        this.handleToastOverlayMouseEvent(input, event);
      },
    });
  }

  initializeDownloadsModalView() {
    return overlayLifecycle.initializeOverlayView.call(this, {
      viewKey: "downloadsModalView",
      readyKey: "downloadsModalReady",
      html: DOWNLOADS_MODAL_OVERLAY_HTML,
      autoResize: { width: false, height: false },
      onReady() {
        if (this.downloadsModalModel) {
          this.updateDownloadsModal(this.downloadsModalModel);
        }
      },
      onMouseEvent: (input) => {
        this.handleDownloadsModalMouseEvent(input);
      },
    });
  }

  initializeBackdropOverlayView() {
    return overlayLifecycle.initializeOverlayView.call(this, {
      viewKey: "backdropOverlayView",
      readyKey: "backdropOverlayReady",
      html: BACKDROP_OVERLAY_HTML,
      autoResize: { width: true, height: true },
      onReady() {},
      onMouseEvent: (input) => {
        this.handleBackdropMouseEvent(input);
      },
    });
  }

  initializeContextMenuOverlayView() {
    return overlayLifecycle.initializeOverlayView.call(this, {
      viewKey: "contextMenuOverlayView",
      readyKey: "contextMenuOverlayReady",
      html: CONTEXT_MENU_OVERLAY_HTML,
      autoResize: { width: false, height: false },
      onReady() {},
      onMouseEvent: (input, event) => {
        this.handleContextMenuMouseEvent(input, event);
      },
    });
  }

  renderTabline(snapshot) {
    return shellRenderBridge.renderTablineBridge.call(this, snapshot);
  }

  setTheme(nextTheme = {}) {
    return shellRenderBridge.setThemeBridge.call(this, nextTheme);
  }

  updateSplitDivider(splitStatus = {}) {
    return shellRenderBridge.updateSplitDividerBridge.call(this, splitStatus);
  }

  applyThemeToWebContents(webContents) {
    return shellRenderBridge.applyThemeToWebContentsBridge.call(
      this,
      webContents,
    );
  }

  setTablineActions(actions = {}) {
    this.tablineActions = {
      ...actions,
    };
    this.renderTabline(this.pendingTablineSnapshot);
  }

  setTablineOptions(options = {}) {
    this.tablineOptions = {
      ...this.tablineOptions,
      ...(options && typeof options === "object" ? options : {}),
    };
    this.renderTabline(this.pendingTablineSnapshot);
  }

  renderUrlline(model = { panes: [] }) {
    return shellRenderBridge.renderUrllineBridge.call(this, model);
  }

  renderLoadingline(model = { panes: [] }) {
    this.loadinglineModel =
      model && typeof model === "object" ? model : { panes: [] };
    if (!this.window || this.window.isDestroyed()) {
      return;
    }

    const panes = Array.isArray(this.loadinglineModel.panes)
      ? this.loadinglineModel.panes
      : [];
    const leftModel = panes.find((pane) => pane && pane.pane === "left") || null;
    const rightModel =
      panes.find((pane) => pane && pane.pane === "right") || null;

    this.renderLoadinglinePane("left", leftModel);
    this.renderLoadinglinePane("right", rightModel);
    this.syncOverlayStack();
  }

  initializeLoadinglineOverlayViews() {
    this.initializeLoadinglineOverlayView("left");
    this.initializeLoadinglineOverlayView("right");
  }

  initializeLoadinglineOverlayView(pane = "left") {
    if (!this.window || this.window.isDestroyed()) {
      return;
    }

    const isRight = pane === "right";
    const viewKey = isRight ? "loadinglineRightView" : "loadinglineLeftView";
    const readyKey = isRight ? "loadinglineRightReady" : "loadinglineLeftReady";
    if (this[viewKey]) {
      return;
    }

    const view = createOverlayBrowserView(LOADINGLINE_OVERLAY_HTML);
    view.setAutoResize({ width: false, height: false });
    view.setBounds({ x: -10000, y: -10000, width: 1, height: 1 });
    view.webContents.on("did-finish-load", () => {
      this[readyKey] = true;
      this.applyThemeToWebContents(view.webContents);
      this.renderLoadingline(this.loadinglineModel);
    });

    attachOverlayBrowserView(this.window, view);
    this[viewKey] = view;
  }

  renderLoadinglinePane(pane, paneModel) {
    const isRight = pane === "right";
    const view = isRight ? this.loadinglineRightView : this.loadinglineLeftView;
    const ready = isRight ? this.loadinglineRightReady : this.loadinglineLeftReady;
    if (!view || !ready || !view.webContents || view.webContents.isDestroyed()) {
      return;
    }

    const isLoading = Boolean(paneModel?.isLoading);
    const progress =
      typeof paneModel?.loadingProgress === "number"
        ? Math.max(0, Math.min(1, paneModel.loadingProgress))
        : null;
    const indeterminate = Boolean(
      isLoading && (paneModel?.loadingIndeterminate || progress === null),
    );
    const showLine = Boolean(paneModel) && (isLoading || progress === 1);
    if (!showLine) {
      view.setBounds({ x: -10000, y: -10000, width: 1, height: 1 });
      if (isRight) {
        this.loadinglineRightVisible = false;
      } else {
        this.loadinglineLeftVisible = false;
      }
      return;
    }

    const x = Number.isFinite(paneModel?.x) ? Math.max(0, Math.floor(paneModel.x)) : 0;
    const y = Number.isFinite(paneModel?.top)
      ? Math.max(0, Math.floor(paneModel.top))
      : UI_SHELL_TABLINE_HEIGHT;
    const width = Number.isFinite(paneModel?.width)
      ? Math.max(1, Math.floor(paneModel.width))
      : 1;
    const mainColor = this.currentTheme.mainColor || DEFAULT_THEME.mainColor;
    view.setBounds({ x, y, width, height: 2 });
    if (isRight) {
      this.loadinglineRightVisible = true;
    } else {
      this.loadinglineLeftVisible = true;
    }

    view.webContents
      .executeJavaScript(
        `
        (function renderLoadinglinePane() {
          const line = document.getElementById('line');
          const bar = document.getElementById('bar');
          if (!line || !bar) return;
          const isLoading = ${JSON.stringify(isLoading)};
          const indeterminate = ${JSON.stringify(indeterminate)};
          const progress = ${JSON.stringify(progress)};
          const color = ${JSON.stringify(mainColor)};
          line.style.pointerEvents = 'none';
          bar.style.pointerEvents = 'none';
          bar.style.background = color;
          bar.style.boxShadow = '0 0 8px ' + color;
          line.style.opacity = isLoading || progress === 1 ? '1' : '0';
          if (!isLoading && progress !== 1) {
            bar.style.width = '0%';
            bar.style.animation = 'none';
            return;
          }
          if (indeterminate) {
            bar.style.width = '32%';
            bar.style.transform = 'translateX(-40%)';
            bar.style.animation = 'ui-shell-loadingline-sweep 900ms ease-out infinite';
            return;
          }
          const widthPct = progress === null ? 18 : Math.max(2, Math.min(100, Math.round(progress * 100)));
          bar.style.animation = 'none';
          bar.style.width = String(widthPct) + '%';
          bar.style.transform = 'translateX(0%)';
          if (progress === 1) {
            setTimeout(() => {
              if (line.isConnected) line.style.opacity = '0';
            }, 120);
          }
        })();
      `,
      )
      .catch(() => {});
  }

  setUrllineActions(actions = {}) {
    this.urllineActions = {
      ...actions,
    };
    this.renderUrlline(this.urllineModel);
  }

  setWindowChrome(chrome = {}) {
    this.windowChrome = {
      ...this.windowChrome,
      ...chrome,
    };
    this.renderTabline(this.pendingTablineSnapshot);
  }

  getContentTopInset() {
    return UI_SHELL_TABLINE_HEIGHT;
  }

  relayout() {
    return overlayLifecycle.relayout.call(this);
  }

  hasCommandOverlayAttached() {
    return overlayLifecycle.hasCommandOverlayAttached.call(this);
  }

  keepCommandOverlayAboveContentViews() {
    return overlayLifecycle.keepCommandOverlayAboveContentViews.call(this);
  }

  syncOverlayStack() {
    return overlayLifecycle.syncOverlayStack.call(this);
  }

  showContextMenu(items, x, y) {
    return contextMenuOverlayController.showContextMenu.call(this, items, x, y);
  }

  hideContextMenu() {
    return contextMenuOverlayController.hideContextMenu.call(this);
  }

  handleContextMenuMouseEvent(input, event) {
    return contextMenuOverlayController.handleContextMenuMouseEvent.call(
      this,
      input,
      event,
    );
  }

  isCommandVisible() {
    return commandOverlayController.isCommandVisible.call(this);
  }

  showCommand(text = "", cursorIndex = null, context = "shell") {
    return commandOverlayController.showCommand.call(
      this,
      text,
      cursorIndex,
      context,
    );
  }

  hideCommand() {
    return commandOverlayController.hideCommand.call(this);
  }

  showWhichKey(model, timeoutMs = 1200, delayMs = 0) {
    return whichKeyOverlayController.showWhichKey.call(
      this,
      model,
      timeoutMs,
      delayMs,
    );
  }

  updateWhichKey(
    model,
    timeoutMs = 1200,
    delayMs = 0,
    ensureVisible = true,
    forceImmediate = false,
  ) {
    return whichKeyOverlayController.updateWhichKey.call(
      this,
      model,
      timeoutMs,
      delayMs,
      ensureVisible,
      forceImmediate,
    );
  }

  hideWhichKey() {
    return whichKeyOverlayController.hideWhichKey.call(this);
  }

  isSelectionModalVisible() {
    return auxOverlayController.isSelectionModalVisible.call(this);
  }

  showSelectionModal(model) {
    return auxOverlayController.showSelectionModal.call(this, model);
  }

  hideSelectionModal() {
    return auxOverlayController.hideSelectionModal.call(this);
  }

  updateSelectionModal(model) {
    return auxOverlayController.updateSelectionModal.call(this, model);
  }

  isTelescopeVisible() {
    return auxOverlayController.isTelescopeVisible.call(this);
  }

  showTelescope(model) {
    return auxOverlayController.showTelescope.call(this, model);
  }

  hideTelescope() {
    return auxOverlayController.hideTelescope.call(this);
  }

  updateTelescope(model) {
    return auxOverlayController.updateTelescope.call(this, model);
  }

  computeSelectionModalHeight(model = null) {
    return auxOverlayController.computeSelectionModalHeight.call(this, model);
  }

  isDownloadsModalVisible() {
    return auxOverlayController.isDownloadsModalVisible.call(this);
  }

  showDownloadsModal(model) {
    return auxOverlayController.showDownloadsModal.call(this, model);
  }

  hideDownloadsModal() {
    return auxOverlayController.hideDownloadsModal.call(this);
  }

  updateDownloadsModal(model) {
    return auxOverlayController.updateDownloadsModal.call(this, model);
  }

  computeDownloadsModalHeight(model = null) {
    return auxOverlayController.computeDownloadsModalHeight.call(this, model);
  }

  resetWhichKeyShowTimer(delayMs) {
    return whichKeyOverlayController.resetWhichKeyShowTimer.call(this, delayMs);
  }

  clearWhichKeyShowTimer() {
    return whichKeyOverlayController.clearWhichKeyShowTimer.call(this);
  }

  resetWhichKeyHideTimer(timeoutMs) {
    return whichKeyOverlayController.resetWhichKeyHideTimer.call(
      this,
      timeoutMs,
    );
  }

  clearWhichKeyHideTimer() {
    return whichKeyOverlayController.clearWhichKeyHideTimer.call(this);
  }

  updateStatuslineMode(mode) {
    return auxOverlayController.updateStatuslineMode.call(this, mode);
  }

  updateStatuslineScroll(percent) {
    return auxOverlayController.updateStatuslineScroll.call(this, percent);
  }

  updateStatuslineSplitIndicator(splitStatus = {}) {
    return auxOverlayController.updateStatuslineSplitIndicator.call(
      this,
      splitStatus,
    );
  }

  updateStatuslineSearchCount(model = {}) {
    return auxOverlayController.updateStatuslineSearchCount.call(this, model);
  }

  updateCommand(text = "", cursorIndex = null, context = null) {
    return commandOverlayController.updateCommand.call(
      this,
      text,
      cursorIndex,
      context,
    );
  }

  handleSelectionModalMouseEvent(input) {
    return auxOverlayController.handleSelectionModalMouseEvent.call(this, input);
  }

  handleTelescopeMouseEvent(input) {
    return auxOverlayController.handleTelescopeMouseEvent.call(this, input);
  }

  handleToastOverlayMouseEvent(input, event) {
    return auxOverlayController.handleToastOverlayMouseEvent.call(
      this,
      input,
      event,
    );
  }

  handleDownloadsModalMouseEvent(input) {
    return auxOverlayController.handleDownloadsModalMouseEvent.call(this, input);
  }

  handleBackdropMouseEvent(input) {
    if (typeof this.mouseActions?.handleBackdropMouseEvent === "function") {
      this.mouseActions.handleBackdropMouseEvent(input);
    }
  }

  handleWhichKeyMouseEvent(input) {
    return whichKeyOverlayController.handleWhichKeyMouseEvent.call(this, input);
  }
}

function createUiShellManager() {
  return new UiShellManager();
}

const defaultUiShellManager = createUiShellManager();

module.exports = defaultUiShellManager;
module.exports.UiShellManager = UiShellManager;
module.exports.createUiShellManager = createUiShellManager;
