const ABORT_ERROR_CODES = new Set([-3]);

const NETWORK_ERROR_NAMES = new Set([
  "ERR_INTERNET_DISCONNECTED",
  "ERR_NAME_NOT_RESOLVED",
  "ERR_NAME_RESOLUTION_FAILED",
  "ERR_NAME_RESOLUTION_TIMEOUT",
  "ERR_DNS_TIMED_OUT",
  "ERR_DNS_SERVER_FAILED",
  "ERR_DNS_SERVER_REQUIRES_TCP",
  "ERR_DNS_SEARCH_EMPTY",
  "ERR_ADDRESS_UNREACHABLE",
  "ERR_ADDRESS_INVALID",
  "ERR_CONNECTION_CLOSED",
  "ERR_CONNECTION_RESET",
  "ERR_CONNECTION_REFUSED",
  "ERR_CONNECTION_ABORTED",
  "ERR_CONNECTION_FAILED",
  "ERR_CONNECTION_TIMED_OUT",
  "ERR_TIMED_OUT",
  "ERR_NETWORK_CHANGED",
  "ERR_NETWORK_IO_SUSPENDED",
  "ERR_NETWORK_ACCESS_DENIED",
  "ERR_PROXY_CONNECTION_FAILED",
  "ERR_TUNNEL_CONNECTION_FAILED",
  "ERR_SOCKS_CONNECTION_FAILED",
]);

function normalizeChromiumErrorName(rawDescription) {
  const value = typeof rawDescription === "string" ? rawDescription.trim() : "";
  if (!value) {
    return "";
  }

  const withoutPrefix = value.replace(/^net::/i, "").trim();
  return withoutPrefix.toUpperCase();
}

function isTlsOrCertError(name) {
  return name.startsWith("ERR_SSL_") || name.startsWith("ERR_CERT_");
}

function shouldShowCatErrorBuffer(failure = {}) {
  if (failure.isMainFrame !== true) {
    return false;
  }

  const errorCode = Number.isInteger(failure.errorCode) ? failure.errorCode : null;
  if (errorCode !== null && ABORT_ERROR_CODES.has(errorCode)) {
    return false;
  }

  const errorName = normalizeChromiumErrorName(failure.errorDescription);
  if (!errorName) {
    return false;
  }

  if (NETWORK_ERROR_NAMES.has(errorName)) {
    return true;
  }

  return isTlsOrCertError(errorName);
}

module.exports = {
  normalizeChromiumErrorName,
  shouldShowCatErrorBuffer,
};
