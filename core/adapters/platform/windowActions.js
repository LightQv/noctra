function performWindowAction(win, action) {
  if (!win || win.isDestroyed()) {
    return;
  }

  if (action === "minimize") {
    win.minimize();
    return;
  }

  if (action === "toggleMaximize") {
    if (win.isMaximized()) {
      win.unmaximize();
      return;
    }
    win.maximize();
    return;
  }

  if (action === "close") {
    win.close();
  }
}

module.exports = {
  performWindowAction,
};
