const net = require("net");

function hasScheme(value) {
  return /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value);
}

function isIpLike(value) {
  return /^\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?(?:\/.*)?$/.test(value);
}

function isLocalHostLike(value) {
  return /^(?:localhost|127\.0\.0\.1|0\.0\.0\.0|::1)(?::\d+)?(?:\/.*)?$/i.test(value);
}

function looksLikeDomain(value) {
  return /^[a-zA-Z\d-]+(?:\.[a-zA-Z\d-]+)+(?::\d+)?(?:\/.*)?$/.test(value);
}

function looksLikeUrlTarget(value) {
  return hasScheme(value) || isLocalHostLike(value) || isIpLike(value) || looksLikeDomain(value);
}

function normalizeUrlCandidate(value) {
  if (hasScheme(value)) {
    return value;
  }

  if (isLocalHostLike(value) || isIpLike(value)) {
    return `http://${value}`;
  }

  return `https://${value}`;
}

function isLoopbackHost(hostname) {
  if (typeof hostname !== "string") return false;
  const normalized = hostname.trim().toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function isPrivateIpv4(hostname) {
  if (net.isIP(hostname) !== 4) {
    return false;
  }

  const octets = hostname.split(".").map((part) => Number.parseInt(part, 10));
  if (octets.length !== 4 || octets.some((value) => Number.isNaN(value))) {
    return false;
  }

  const [first, second] = octets;
  if (first === 10) return true;
  if (first === 192 && second === 168) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  return false;
}

function normalizeTrustedHosts(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const unique = new Set();
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const normalized = entry.trim().toLowerCase();
    if (!normalized) continue;
    unique.add(normalized);
  }
  return [...unique];
}

function isAllowedHttpHost(hostname, policy = {}) {
  const allowHttpLoopback = policy.allowHttpLoopback !== false;
  const allowHttpPrivateLan = policy.allowHttpPrivateLan !== false;
  const trustedHttpHosts = normalizeTrustedHosts(policy.trustedHttpHosts);

  if (allowHttpLoopback && isLoopbackHost(hostname)) {
    return true;
  }

  if (allowHttpPrivateLan && isPrivateIpv4(hostname)) {
    return true;
  }

  const normalizedHost = typeof hostname === "string" ? hostname.trim().toLowerCase() : "";
  if (!normalizedHost.length) {
    return false;
  }

  return trustedHttpHosts.includes(normalizedHost);
}

function validateNavigableUrl(rawUrl, policy = {}) {
  if (typeof rawUrl !== "string" || !rawUrl.length) {
    return { ok: false, reason: "empty_url" };
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }

  if (parsed.protocol === "https:") {
    return { ok: true, url: parsed.toString() };
  }

  if (parsed.protocol === "http:") {
    if (isAllowedHttpHost(parsed.hostname, policy)) {
      return { ok: true, url: parsed.toString() };
    }
    return { ok: false, reason: "http_host_not_allowed" };
  }

  if (parsed.protocol === "about:" && parsed.href === "about:blank") {
    return { ok: true, url: parsed.href };
  }

  return { ok: false, reason: "scheme_not_allowed" };
}

module.exports = {
  looksLikeUrlTarget,
  normalizeUrlCandidate,
  normalizeTrustedHosts,
  validateNavigableUrl,
};
