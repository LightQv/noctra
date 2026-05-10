function initializeShellHost(shellHtml) {
  if (!this.window) return;

  this.window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(shellHtml)}`);

  this.window.webContents.on("did-finish-load", () => {
    this.shellHostReady = true;
    this.applyThemeToWebContents(this.window.webContents);
    this.renderTabline(this.pendingTablineSnapshot);
    this.renderUrlline(this.urllineModel);
    this.updateSplitDivider(this.splitDividerState);
    this.flushPendingToasts();
  });
}

module.exports = {
  initializeShellHost,
};
