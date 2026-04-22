function hasScheme(value) {
  return /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value);
}

function isIpLike(value) {
  return /^\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?(?:\/.*)?$/.test(value);
}

function isLocalHostLike(value) {
  return /^(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?(?:\/.*)?$/i.test(value);
}

function looksLikeDomain(value) {
  return /^[a-zA-Z\d-]+(?:\.[a-zA-Z\d-]+)+(?::\d+)?(?:\/.*)?$/.test(value);
}

function looksLikeUrlTarget(value) {
  return hasScheme(value) || isLocalHostLike(value) || isIpLike(value) || looksLikeDomain(value);
}

function buildSearchUrl(engine, query) {
  const normalizedQuery = query.trim();

  switch (engine) {
    case "duckduckgo":
      if (!normalizedQuery) return "https://duckduckgo.com/";
      return `https://duckduckgo.com/?q=${encodeURIComponent(normalizedQuery)}`;
    case "google":
      if (!normalizedQuery) return "https://www.google.com/";
      return `https://www.google.com/search?q=${encodeURIComponent(normalizedQuery)}`;
    default:
      return null;
  }
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

function resolveInputTarget(rawInput, options = {}) {
  const input = (rawInput || "").trim();
  const defaultSearchEngine = options.defaultSearchEngine || "duckduckgo";

  if (!input) {
    return { kind: "invalid", reason: "empty_input" };
  }

  if (looksLikeUrlTarget(input)) {
    return {
      kind: "url",
      url: normalizeUrlCandidate(input),
    };
  }

  const searchUrl = buildSearchUrl(defaultSearchEngine, input);
  if (!searchUrl) {
    return { kind: "invalid", reason: "unknown_search_engine" };
  }

  return {
    kind: "search",
    engine: defaultSearchEngine,
    query: input,
    url: searchUrl,
  };
}

module.exports = {
  buildSearchUrl,
  resolveInputTarget,
};
