const {
  SURFACE_ROLES,
  getSurfaceRole,
  isTrustedInternalRole,
  isAllowedTrustedSurfaceUrl,
} = require("../../security/surfaceTrust");
const {
  normalizeDownloadConfig,
  buildSafeDownloadPath,
  resolveDownloadDecision,
} = require("../../security/downloadPolicy");
const { isExtensionInternalUrl } = require("../../security/urlPolicy");
const {
  isKnownManagedExtensionUrl,
} = require("../../extensions/managedExtensionRegistry");
const downloadsService = require("../../downloads/service");

const KNOWN_EXTENSION_PERMISSION_DECISIONS = Object.freeze({
  clipboardRead: "unsupported",
  clipboardSanitizedWrite: "unsupported",
  media: "unsupported",
  geolocation: "unsupported",
  notifications: "unsupported",
  midiSysex: "unsupported",
  pointerLock: "unsupported",
  fullscreen: "unsupported",
  openExternal: "unsupported",
  hid: "unsupported",
  serial: "unsupported",
  bluetooth: "unsupported",
});

function getWebContentsUrl(webContents) {
  if (!webContents || typeof webContents.getURL !== "function") {
    return "";
  }

  return webContents.getURL() || "";
}

function resolvePermissionDecision({
  webContents,
  permission,
  requestingUrl,
} = {}) {
  const role = getSurfaceRole(webContents);
  const url =
    typeof requestingUrl === "string" && requestingUrl
      ? requestingUrl
      : getWebContentsUrl(webContents);
  const knownManagedExtension =
    role === SURFACE_ROLES.EXTENSION && isKnownManagedExtensionUrl(url);

  if (knownManagedExtension) {
    return {
      allow: false,
      role,
      reason:
        KNOWN_EXTENSION_PERMISSION_DECISIONS[permission] ||
        "known_extension_permission_unsupported",
      knownManagedExtension: true,
    };
  }

  return {
    allow: false,
    role,
    reason:
      role === SURFACE_ROLES.EXTENSION
        ? "unknown_extension_permission_denied"
        : "permission_denied_by_default",
    knownManagedExtension: false,
  };
}

function isExtensionChildWindowNavigation(contents, url) {
  if (!contents || !isExtensionInternalUrl(url)) {
    return false;
  }

  if (
    typeof contents.getType === "function" &&
    contents.getType() !== "window"
  ) {
    return false;
  }

  if (typeof contents.getOwnerBrowserWindow !== "function") {
    return false;
  }

  const ownerWindow = contents.getOwnerBrowserWindow();
  return Boolean(
    ownerWindow &&
    typeof ownerWindow.getParentWindow === "function" &&
    ownerWindow.getParentWindow(),
  );
}

function registerSessionSecurityPolicy({
  session,
  app,
  configService,
  notificationsService,
}) {
  if (!session || !session.defaultSession) {
    return;
  }

  const defaultSession = session.defaultSession;
  defaultSession.setPermissionCheckHandler(
    (webContents, permission, requestingUrl) => {
      const decision = resolvePermissionDecision({
        webContents,
        permission,
        requestingUrl,
      });
      return decision.allow;
    },
  );
  defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback, details = {}) => {
      const decision = resolvePermissionDecision({
        webContents,
        permission,
        requestingUrl: details.requestingUrl || details.securityOrigin,
      });
      if (
        decision.knownManagedExtension &&
        notificationsService &&
        typeof notificationsService.notify === "function"
      ) {
        notificationsService.notify({
          severity: "info",
          code: "security_extension_permission_unsupported",
          message: "Extension permission request denied by policy",
          source: "security",
          context: {
            permission,
            role: decision.role,
            reason: decision.reason,
          },
          toast: false,
          persist: false,
        });
      }
      callback(decision.allow);
    },
  );

  defaultSession.on("will-download", (event, item, webContents) => {
    const notify = (entry) => {
      if (
        !notificationsService ||
        typeof notificationsService.notify !== "function"
      ) {
        return;
      }
      notificationsService.notify(entry);
    };

    const role = getSurfaceRole(webContents);
    const downloadConfig = normalizeDownloadConfig(
      configService && typeof configService.getConfigValue === "function"
        ? configService.getConfigValue("browser.downloads", {})
        : {},
    );
    const decision = resolveDownloadDecision({
      role,
      isTrustedInternalRole,
      config: downloadConfig,
    });
    const suggestedFilename =
      item && typeof item.getFilename === "function" ? item.getFilename() : "";
    const targetDirectory =
      downloadConfig.defaultDirectory ||
      (app && typeof app.getPath === "function"
        ? app.getPath("downloads")
        : "");

    if (decision.action === "deny") {
      event.preventDefault();
      notify({
        severity: "warning",
        code: "security_download_blocked",
        message: "Blocked download by policy",
        source: "security",
        context: {
          role,
          reason: decision.reason,
          filename: suggestedFilename,
        },
        toast: false,
        persist: false,
      });
      return;
    }

    let safePath = null;
    if (targetDirectory) {
      safePath = buildSafeDownloadPath(targetDirectory, suggestedFilename);
    }
    if (safePath && typeof item.setSavePath === "function") {
      if (decision.action === "allow") {
        item.setSavePath(safePath);
      }
    }

    downloadsService.registerDownload(item, webContents, safePath);

    if (decision.action === "prompt") {
      notify({
        severity: "info",
        code: "security_download_prompt_required",
        message: "Download requires explicit confirmation",
        source: "security",
        context: {
          role,
          filename: suggestedFilename,
        },
        toast: false,
        persist: false,
      });
    }

    if (decision.action === "allow") {
      notify({
        severity: "info",
        code: "security_download_allowed",
        message: "Download allowed by policy",
        source: "security",
        context: {
          role,
          filename: suggestedFilename,
        },
        toast: false,
        persist: false,
      });
    }

    if (item && typeof item.setSaveDialogOptions === "function") {
      const dialogOptions = {
        openPath: Boolean(downloadConfig.autoOpen),
      };
      if (decision.action === "prompt" && safePath) {
        dialogOptions.defaultPath = safePath;
      }
      item.setSaveDialogOptions(dialogOptions);
    }

    if (item && typeof item.once === "function") {
      item.once("done", (_doneEvent, state) => {
        if (state === "cancelled") {
          notify({
            severity: "info",
            code: "download_cancelled_by_user",
            message: "Download cancelled",
            source: "security",
            context: {
              role,
              filename: suggestedFilename,
            },
            toast: false,
            persist: false,
          });
        }
      });
    }
  });
}

function registerWebContentsSecurityPolicy({
  app,
  isAllowedNavigationUrl,
  notificationsService,
  openExtensionWindowUrl,
}) {
  if (!app || typeof app.on !== "function") {
    return;
  }

  app.on("web-contents-created", (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      const role = getSurfaceRole(contents);
      if (
        role === SURFACE_ROLES.EXTENSION &&
        typeof url === "string" &&
        url.length &&
        isAllowedNavigationUrl(url) &&
        typeof openExtensionWindowUrl === "function"
      ) {
        openExtensionWindowUrl(url);
        return { action: "deny" };
      }

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

      if (role === SURFACE_ROLES.EXTENSION && isKnownManagedExtensionUrl(url)) {
        return;
      }

      if (isExtensionChildWindowNavigation(contents, url)) {
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
  resolvePermissionDecision,
};
