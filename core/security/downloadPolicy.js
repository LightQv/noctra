const path = require("path");

function normalizeDownloadConfig(config = {}) {
  const policy =
    config && (config.policy === "deny" || config.policy === "allow" || config.policy === "prompt")
      ? config.policy
      : "prompt";
  const allowTrustedSurfaces = Boolean(config && config.allow_trusted_surfaces === true);
  const defaultDirectory =
    config && typeof config.default_directory === "string" && config.default_directory.trim().length > 0
      ? config.default_directory.trim()
      : null;
  const autoOpen = Boolean(config && config.auto_open === true);

  return {
    policy,
    allowTrustedSurfaces,
    defaultDirectory,
    autoOpen,
  };
}

function sanitizeDownloadFilename(name) {
  const source = typeof name === "string" && name.trim().length > 0 ? name.trim() : "download.bin";
  const base = path.basename(source);
  const sanitized = base.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").replace(/\s+/g, " ").trim();
  return sanitized.length > 0 ? sanitized : "download.bin";
}

function buildSafeDownloadPath(directory, filename) {
  const safeFilename = sanitizeDownloadFilename(filename);
  return path.join(directory, safeFilename);
}

function resolveDownloadDecision({
  role,
  isTrustedInternalRole,
  config,
}) {
  const normalized = normalizeDownloadConfig(config);
  if (normalized.policy === "deny") {
    return { action: "deny", reason: "policy_deny" };
  }

  if (isTrustedInternalRole(role) && !normalized.allowTrustedSurfaces) {
    return { action: "deny", reason: "trusted_surface_downloads_disabled" };
  }

  if (normalized.policy === "allow") {
    return { action: "allow", reason: "policy_allow" };
  }

  return { action: "prompt", reason: "policy_prompt" };
}

module.exports = {
  normalizeDownloadConfig,
  sanitizeDownloadFilename,
  buildSafeDownloadPath,
  resolveDownloadDecision,
};
