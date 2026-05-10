const {
  createOverlayBrowserView,
  attachOverlayBrowserView,
} = require("../../../core/adapters/platform/overlayViewHost");
const {
  applyOverlayLayout,
  applyOverlayStack,
} = require("../../../core/adapters/platform/overlayLayoutHost");
const {
  UI_SHELL_TABLINE_HEIGHT,
  UI_SHELL_STATUSLINE_HEIGHT,
} = require("../../constants");

function initializeOverlayView({
  viewKey,
  readyKey,
  html,
  autoResize,
  onReady,
}) {
  if (!this.window) return;
  this[viewKey] = createOverlayBrowserView(html);
  this[viewKey].setAutoResize(autoResize);
  this[viewKey].webContents.on("did-finish-load", () => {
    this[readyKey] = true;
    this.applyThemeToWebContents(this[viewKey].webContents);
    onReady.call(this);
  });

  attachOverlayBrowserView(this.window, this[viewKey]);
  this.relayout();
}

function relayout() {
  applyOverlayLayout({
    windowRef: this.window,
    overlays: {
      commandOverlayView: this.commandOverlayView,
      whichKeyOverlayView: this.whichKeyOverlayView,
      selectionModalView: this.selectionModalView,
      telescopeView: this.telescopeView,
      statuslineView: this.statuslineView,
      toastOverlayView: this.toastOverlayView,
    },
    visibility: {
      commandVisible: this.commandVisible,
      whichKeyVisible: this.whichKeyVisible,
      selectionModalVisible: this.selectionModalVisible,
      telescopeVisible: this.telescopeVisible,
    },
    chrome: {
      UI_SHELL_TABLINE_HEIGHT,
      UI_SHELL_STATUSLINE_HEIGHT,
    },
    computeSelectionModalHeight: () => this.computeSelectionModalHeight(this.selectionModalModel),
  });
}

function hasCommandOverlayAttached() {
  if (!this.window || !this.commandOverlayView) return false;
  return this.window.getBrowserViews().includes(this.commandOverlayView);
}

function keepCommandOverlayAboveContentViews() {
  this.syncOverlayStack();
}

function syncOverlayStack() {
  applyOverlayStack(this.window, {
    statuslineView: this.statuslineView,
    whichKeyVisible: this.whichKeyVisible,
    whichKeyOverlayView: this.whichKeyOverlayView,
    selectionModalVisible: this.selectionModalVisible,
    selectionModalView: this.selectionModalView,
    telescopeVisible: this.telescopeVisible,
    telescopeView: this.telescopeView,
    commandVisible: this.commandVisible,
    commandOverlayView: this.commandOverlayView,
    toastOverlayView: this.toastOverlayView,
  });

  this.relayout();
}

module.exports = {
  initializeOverlayView,
  relayout,
  hasCommandOverlayAttached,
  keepCommandOverlayAboveContentViews,
  syncOverlayStack,
};
