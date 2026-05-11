function isUsableWindow(windowRef) {
  if (!windowRef || typeof windowRef.addBrowserView !== "function") {
    return false;
  }
  if (typeof windowRef.isDestroyed !== "function") {
    return true;
  }
  return !windowRef.isDestroyed();
}

function isViewAttached(windowRef, view) {
  if (!windowRef || !view || typeof windowRef.getBrowserViews !== "function") {
    return false;
  }
  return windowRef.getBrowserViews().includes(view);
}

function attachView(windowRef, view) {
  if (!windowRef || !view || typeof windowRef.addBrowserView !== "function") {
    return;
  }
  windowRef.addBrowserView(view);
}

function detachView(windowRef, view) {
  if (
    !windowRef ||
    !view ||
    typeof windowRef.removeBrowserView !== "function"
  ) {
    return;
  }
  if (!isViewAttached(windowRef, view)) {
    return;
  }
  windowRef.removeBrowserView(view);
}

function setViewBounds(view, bounds) {
  if (!view || typeof view.setBounds !== "function") {
    return;
  }
  view.setBounds(bounds);
}

function setViewAutoResize(view, options) {
  if (!view || typeof view.setAutoResize !== "function") {
    return;
  }
  view.setAutoResize(options);
}

function setTopView(windowRef, view) {
  if (
    !windowRef ||
    !view ||
    typeof windowRef.setTopBrowserView !== "function"
  ) {
    return;
  }
  windowRef.setTopBrowserView(view);
}

module.exports = {
  isUsableWindow,
  isViewAttached,
  attachView,
  detachView,
  setViewBounds,
  setViewAutoResize,
  setTopView,
};
