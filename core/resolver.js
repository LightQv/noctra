const {
  looksLikeUrlTarget,
  normalizeUrlCandidate,
  validateNavigableUrl,
} = require("./security/urlPolicy");

function buildSearchUrl(engine, query) {
  const normalizedQuery = query.trim();

  switch (engine) {
    case "duckduckgo":
      if (!normalizedQuery) return "https://duckduckgo.com/";
      return `https://duckduckgo.com/?q=${encodeURIComponent(normalizedQuery)}`;
    case "google":
      if (!normalizedQuery) return "https://www.google.com/";
      return `https://www.google.com/search?q=${encodeURIComponent(normalizedQuery)}`;
    case "ecosia":
      if (!normalizedQuery) return "https://www.ecosia.org/";
      return `https://www.ecosia.org/search?q=${encodeURIComponent(normalizedQuery)}`;
    default:
      return null;
  }
}

function resolveUrlInput(rawInput, policy = {}) {
  const input = (rawInput || "").trim();
  if (!input) return null;
  if (!looksLikeUrlTarget(input)) return null;
  const candidate = normalizeUrlCandidate(input);
  const validation = validateNavigableUrl(candidate, policy);
  if (!validation.ok) return null;
  return validation.url;
}

function resolveInputTarget(rawInput, options = {}) {
  const input = (rawInput || "").trim();
  const defaultSearchEngine = options.defaultSearchEngine || "duckduckgo";
  const policy = options.urlPolicy || {};

  if (!input) {
    return { kind: "invalid", reason: "empty_input" };
  }

  if (looksLikeUrlTarget(input)) {
    const candidate = normalizeUrlCandidate(input);
    const validation = validateNavigableUrl(candidate, policy);
    if (!validation.ok) {
      return { kind: "invalid", reason: validation.reason || "invalid_url" };
    }
    return {
      kind: "url",
      url: validation.url,
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
  resolveUrlInput,
  resolveInputTarget,
};
