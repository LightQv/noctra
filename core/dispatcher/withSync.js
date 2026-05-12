function createDispatchWithSync(dispatch, getAppMenu) {
  return function dispatchWithSync(win, intent, state) {
    dispatch(win, intent, state);
    const appMenu = getAppMenu();
    if (appMenu) appMenu.sync();
  };
}

module.exports = { createDispatchWithSync };
