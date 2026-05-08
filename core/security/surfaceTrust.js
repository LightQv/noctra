const SURFACE_ROLES = Object.freeze({
  UNTRUSTED_WEB: "untrusted-web",
  TRUSTED_SHELL: "trusted-shell",
  TRUSTED_SETTINGS: "trusted-settings",
  TRUSTED_PANEL: "trusted-panel",
});

const surfaceRoleByWebContents = new WeakMap();

function markSurfaceRole(webContents, role) {
  if (!webContents || typeof role !== "string" || role.length === 0) {
    return;
  }
  surfaceRoleByWebContents.set(webContents, role);
}

function getSurfaceRole(webContents) {
  if (!webContents) {
    return SURFACE_ROLES.UNTRUSTED_WEB;
  }
  return surfaceRoleByWebContents.get(webContents) || SURFACE_ROLES.UNTRUSTED_WEB;
}

function isTrustedInternalRole(role) {
  return (
    role === SURFACE_ROLES.TRUSTED_SHELL ||
    role === SURFACE_ROLES.TRUSTED_SETTINGS ||
    role === SURFACE_ROLES.TRUSTED_PANEL
  );
}

function isAllowedTrustedSurfaceUrl(rawUrl) {
  if (typeof rawUrl !== "string" || rawUrl.length === 0) {
    return false;
  }

  if (rawUrl === "about:blank") {
    return true;
  }

  if (rawUrl.startsWith("data:text/html")) {
    return true;
  }

  return false;
}

module.exports = {
  SURFACE_ROLES,
  markSurfaceRole,
  getSurfaceRole,
  isTrustedInternalRole,
  isAllowedTrustedSurfaceUrl,
};
