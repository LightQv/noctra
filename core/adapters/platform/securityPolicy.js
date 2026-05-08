const {
  getSurfaceRole,
  isTrustedInternalRole,
  isAllowedTrustedSurfaceUrl,
} = require("../../security/surfaceTrust");

function registerSessionSecurityPolicy({ session }) {
  if (!session || !session.defaultSession) {
    return;
  }

  const defaultSession = session.defaultSession;
  defaultSession.setPermissionCheckHandler(() => false);
  defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
}

function registerWebContentsSecurityPolicy({ app, isAllowedNavigationUrl, notificationsService }) {
  if (!app || typeof app.on !== "function") {
    return;
  }

  app.on("web-contents-created", (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      const role = getSurfaceRole(contents);
      if (typeof url === "string" && url.length) {
        notificationsService.notify({
          severity: "info",
          code: "security_window_open_blocked",
          message: "Blocked window.open request",
          source: "security",
          context: { url, role },
          toast: false,
          persist: false,
        });
      }
      return { action: "deny" };
    });

    contents.on("will-navigate", (event, url) => {
      const role = getSurfaceRole(contents);
      if (isTrustedInternalRole(role) && !isAllowedTrustedSurfaceUrl(url)) {
        event.preventDefault();
        notificationsService.notify({
          severity: "warn",
          code: "security_trusted_surface_navigation_blocked",
          message: "Blocked remote navigation from trusted surface",
          source: "security",
          context: { url, role },
          toast: false,
          persist: false,
        });
        return;
      }

      if (isAllowedNavigationUrl(url)) {
        return;
      }

      event.preventDefault();
      notificationsService.notify({
        severity: "info",
        code: "security_navigation_blocked",
        message: "Blocked navigation by security policy",
        source: "security",
        context: { url, role },
        toast: false,
        persist: false,
      });
    });
  });
}

module.exports = {
  registerSessionSecurityPolicy,
  registerWebContentsSecurityPolicy,
};
