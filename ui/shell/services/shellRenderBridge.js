const { renderTabline } = require("../../tabline");
const { renderUrlline: renderShellUrlline } = require("../../urlline");
const {
  pushShellPatch,
} = require("../../../core/adapters/renderer/shellPatchTransport");
const { DEFAULT_THEME, toCssVars } = require("../../theme");

function renderTablineBridge(snapshot) {
  this.pendingTablineSnapshot = snapshot;
  if (!this.window || !this.shellHostReady) return;
  if (this.tablineRenderTimer) return;

  this.tablineRenderTimer = setTimeout(() => {
    this.tablineRenderTimer = null;
    if (!this.window || this.window.isDestroyed()) return;
    renderTabline(
      this.window.webContents,
      this.pendingTablineSnapshot,
      this.windowChrome,
      this.tablineActions,
      this.currentTheme,
      this.tablineOptions,
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
  this.renderTabline(this.pendingTablineSnapshot);
  this.renderUrlline(this.urllineModel);
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

  this.splitDividerState = { visible, offsetPx };
  if (!this.window || !this.shellHostReady) return;

  pushShellPatch(
    this.window.webContents,
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

  renderShellUrlline(
    this.window.webContents,
    this.urllineModel,
    this.urllineActions,
    this.currentTheme,
  );
}

module.exports = {
  renderTablineBridge,
  setThemeBridge,
  updateSplitDividerBridge,
  applyThemeToWebContentsBridge,
  renderUrllineBridge,
};
