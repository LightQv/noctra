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
} = require("./services/shellTemplates");
const {
  createPanelViewHost,
} = require("../../core/adapters/platform/panelViewHost");

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

module.exports = new UiShellManager();
