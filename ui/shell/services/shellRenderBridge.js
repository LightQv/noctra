const { renderTabline } = require("../../tabline");
const {
  renderUrlline: renderShellUrlline,
  renderLoadingline: renderShellLoadingline,
} = require("../../urlline");
const {
  pushShellPatch,
} = require("../../../core/adapters/renderer/shellPatchTransport");
const { DEFAULT_THEME, toCssVars } = require("../../theme");

function getLiveWindowWebContents(windowRef) {
  if (!windowRef || typeof windowRef.isDestroyed !== "function") {
    return windowRef && windowRef.webContents ? windowRef.webContents : null;
  }
  if (windowRef.isDestroyed()) {
    return null;
  }
  const webContents = windowRef.webContents;
  if (!webContents || typeof webContents.isDestroyed !== "function") {
    return webContents || null;
  }
  return webContents.isDestroyed() ? null : webContents;
}

function createRenderKey(value) {
  return JSON.stringify(value, (_key, entry) => {
    if (typeof entry === "function") {
      return undefined;
    }
    return entry;
  });
}

function renderTablineBridge(snapshot) {
  this.pendingTablineSnapshot = snapshot;
  if (!this.window || !this.shellHostReady) return;
  if (this.tablineRenderTimer) return;

  this.tablineRenderTimer = setTimeout(() => {
    this.tablineRenderTimer = null;
    if (!this.window || this.window.isDestroyed()) return;
    const renderOptions = {
      ...this.tablineOptions,
      urllineVisible: Boolean(this.urllineModel?.panes?.length),
    };
    const nextRenderKey = createRenderKey({
      snapshot: this.pendingTablineSnapshot,
      chrome: this.windowChrome,
      actions: this.tablineActions,
      theme: this.currentTheme,
      options: renderOptions,
    });
    if (this.tablineRenderKey === nextRenderKey) return;
    this.tablineRenderKey = nextRenderKey;
    renderTabline(
      this.window.webContents,
      this.pendingTablineSnapshot,
      this.windowChrome,
      this.tablineActions,
      this.currentTheme,
      renderOptions,
    );
  }, 16);
}

function setThemeBridge(nextTheme = {}) {
  this.currentTheme = {
    ...DEFAULT_THEME,
    ...(nextTheme && typeof nextTheme === "object" ? nextTheme : {}),
  };

  this.applyThemeToWebContents(this.window && this.window.webContents);
  this.applyThemeToWebContents(
    this.commandOverlayView && this.commandOverlayView.webContents,
  );
  this.applyThemeToWebContents(
    this.whichKeyOverlayView && this.whichKeyOverlayView.webContents,
  );
  this.applyThemeToWebContents(
    this.selectionModalView && this.selectionModalView.webContents,
  );
  this.applyThemeToWebContents(
    this.telescopeView && this.telescopeView.webContents,
  );
  this.applyThemeToWebContents(
    this.statuslineView && this.statuslineView.webContents,
  );
  this.applyThemeToWebContents(
    this.toastOverlayView && this.toastOverlayView.webContents,
  );
  this.applyThemeToWebContents(
    this.downloadsModalView && this.downloadsModalView.webContents,
  );
  this.applyThemeToWebContents(
    this.contextMenuOverlayView && this.contextMenuOverlayView.webContents,
  );
  this.applyThemeToWebContents(this.getSidepanelWebContents());
  this.renderTabline(this.pendingTablineSnapshot);
  this.renderUrlline(this.urllineModel);
  this.renderLoadingline(this.loadinglineModel);
  this.updateStatuslineSplitIndicator(this.statuslineSplitIndicator);
  this.updateSplitDivider(this.splitDividerState);
}

function updateSplitDividerBridge(splitStatus = {}) {
  const divider =
    splitStatus.divider && typeof splitStatus.divider === "object"
      ? splitStatus.divider
      : {};
  const visible = Boolean(divider.visible);
  const offsetPx = Number.isFinite(divider.offsetPx)
    ? Math.max(0, Math.floor(divider.offsetPx))
    : 0;

  const currentState = this.splitDividerState || {};
  if (currentState.visible === visible && currentState.offsetPx === offsetPx) {
    return;
  }

  this.splitDividerState = { visible, offsetPx };
  if (!this.window || !this.shellHostReady) return;
  const webContents = getLiveWindowWebContents(this.window);
  if (!webContents) return;

  pushShellPatch(
    webContents,
    `
      (function updateSplitDivider() {
        const divider = document.getElementById('split-divider');
        if (!divider) return;
        const visible = ${JSON.stringify(visible)};
        const offsetPx = ${JSON.stringify(offsetPx)};
        divider.style.display = visible ? 'block' : 'none';
        divider.style.left = visible ? offsetPx + 'px' : '0px';
      })();
    `,
  );
}

function applyThemeToWebContentsBridge(webContents) {
  if (!webContents || webContents.isDestroyed()) return;
  const cssVars = {
    ...toCssVars(this.currentTheme),
    "--ui-font-family": this.currentTheme.fontFamily,
  };

  pushShellPatch(
    webContents,
    `
      (function applyNoctraThemeVars() {
        const vars = ${JSON.stringify(cssVars)};
        const style = document.documentElement && document.documentElement.style;
        if (!style) return;
        for (const [name, value] of Object.entries(vars)) {
          if (typeof name !== 'string' || typeof value !== 'string') continue;
          style.setProperty(name, value);
        }
      })();
    `,
  );
}

function renderUrllineBridge(model = { panes: [] }) {
  this.urllineModel =
    model && typeof model === "object" ? model : { panes: [] };
  if (!this.window || !this.shellHostReady) return;
  const webContents = getLiveWindowWebContents(this.window);
  if (!webContents) return;

  const nextRenderKey = createRenderKey({
    model: this.urllineModel,
    actions: this.urllineActions,
    theme: this.currentTheme,
  });
  if (this.urllineRenderKey === nextRenderKey) return;
  this.urllineRenderKey = nextRenderKey;

  renderShellUrlline(
    webContents,
    this.urllineModel,
    this.urllineActions,
    this.currentTheme,
  );
}

function renderLoadinglineBridge(model = { panes: [] }) {
  this.loadinglineModel =
    model && typeof model === "object" ? model : { panes: [] };
  if (!this.window || !this.shellHostReady) return;
  const webContents = getLiveWindowWebContents(this.window);
  if (!webContents) return;

  renderShellLoadingline(
    webContents,
    this.loadinglineModel,
    this.currentTheme,
  );
}

module.exports = {
  renderTablineBridge,
  setThemeBridge,
  updateSplitDividerBridge,
  applyThemeToWebContentsBridge,
  getLiveWindowWebContents,
  createRenderKey,
  renderUrllineBridge,
  renderLoadinglineBridge,
};
