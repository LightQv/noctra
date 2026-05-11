function isUsableWebContents(webContents) {
  return Boolean(webContents && !webContents.isDestroyed());
}

function pushShellPatch(webContents, script, options = {}) {
  if (!isUsableWebContents(webContents)) {
    return Promise.resolve(null);
  }

  const userGesture = options.userGesture === true;
  const swallowErrors = options.swallowErrors !== false;
  const onError =
    typeof options.onError === "function" ? options.onError : null;

  const promise = webContents.executeJavaScript(
    String(script || ""),
    userGesture,
  );
  if (!swallowErrors && !onError) {
    return promise;
  }

  return promise.catch((error) => {
    if (onError) {
      onError(error);
    }
    if (!swallowErrors) {
      throw error;
    }
    return null;
  });
}

module.exports = {
  pushShellPatch,
};
