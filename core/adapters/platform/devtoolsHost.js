const { BrowserView } = require("electron");

function createDevtoolsView() {
  return new BrowserView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
    },
  });
}

function openSplitDevtools({ targetWebContents, devtoolsView }) {
  if (!targetWebContents || targetWebContents.isDestroyed() || !devtoolsView) {
    return;
  }
  targetWebContents.setDevToolsWebContents(devtoolsView.webContents);
  targetWebContents.openDevTools({ mode: "detach", activate: false });
}

function closeSplitDevtools({ targetWebContents, devtoolsView }) {
  if (
    targetWebContents &&
    !targetWebContents.isDestroyed() &&
    targetWebContents.isDevToolsOpened()
  ) {
    targetWebContents.closeDevTools();
  }

  if (
    devtoolsView &&
    devtoolsView.webContents &&
    !devtoolsView.webContents.isDestroyed()
  ) {
    devtoolsView.webContents.destroy();
  }
}

module.exports = {
  createDevtoolsView,
  openSplitDevtools,
  closeSplitDevtools,
};
