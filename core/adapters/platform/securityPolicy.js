const {
  getSurfaceRole,
  isTrustedInternalRole,
  isAllowedTrustedSurfaceUrl,
} = require("../../security/surfaceTrust");
const {
  normalizeDownloadConfig,
  buildSafeDownloadPath,
  resolveDownloadDecision,
} = require("../../security/downloadPolicy");
const downloadsService = require("../../downloads/service");

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
  defaultSession.setPermissionCheckHandler(() => false);
  defaultSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => {
      callback(false);
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
}) {
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
