function mapBrowserLanguageToAcceptLanguage(languageCode) {
  const normalized =
    typeof languageCode === "string" ? languageCode.trim().toLowerCase() : "en";
  if (normalized === "fr") {
    return "fr-FR,fr;q=0.9,en;q=0.8";
  }
  return "en-US,en;q=0.9";
}

function resolveSystemLanguageTag({ app, intl } = {}) {
  if (
    app &&
    typeof app.getPreferredSystemLanguages === "function"
  ) {
    const preferredLanguages = app.getPreferredSystemLanguages();
    if (Array.isArray(preferredLanguages) && preferredLanguages.length > 0) {
      const firstLanguage = preferredLanguages[0];
      if (typeof firstLanguage === "string" && firstLanguage.trim().length > 0) {
        return firstLanguage.trim();
      }
    }
  }

  if (app && typeof app.getLocale === "function") {
    const locale = app.getLocale();
    if (typeof locale === "string" && locale.trim().length > 0) {
      return locale.trim();
    }
  }

  const intlApi = intl || Intl;
  try {
    const locale = intlApi.DateTimeFormat().resolvedOptions().locale;
    if (typeof locale === "string" && locale.trim().length > 0) {
      return locale.trim();
    }
  } catch {
    // Fall through to default
  }

  return "en-US";
}

function resolveBrowserLanguage(languageCode, deps = {}) {
  const normalized =
    typeof languageCode === "string"
      ? languageCode.trim().toLowerCase()
      : "system";

  if (normalized === "fr") {
    return "fr";
  }

  if (normalized === "en") {
    return "en";
  }

  const systemLanguageTag = resolveSystemLanguageTag(deps).toLowerCase();
  if (systemLanguageTag.startsWith("fr")) {
    return "fr";
  }

  return "en";
}

function isGoogleHost(hostname) {
  if (typeof hostname !== "string") {
    return false;
  }

  const normalized = hostname.trim().toLowerCase();
  return (
    normalized === "google.com" ||
    normalized.endsWith(".google.com") ||
    normalized.includes(".google.")
  );
}

function mapBrowserLanguageToGoogleLocale(languageCode) {
  const normalized =
    typeof languageCode === "string" ? languageCode.trim().toLowerCase() : "en";
  if (normalized === "fr") {
    return { hl: "fr", gl: "FR", lr: "lang_fr" };
  }
  return { hl: "en", gl: "US", lr: "lang_en" };
}

function applyGoogleLocaleHint(rawUrl, preferredLanguage) {
  if (typeof rawUrl !== "string" || !rawUrl.length) {
    return rawUrl;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return rawUrl;
  }

  if (
    (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") ||
    !isGoogleHost(parsedUrl.hostname)
  ) {
    return rawUrl;
  }

  const locale = mapBrowserLanguageToGoogleLocale(preferredLanguage);
  const currentHl = parsedUrl.searchParams.get("hl");
  const currentGl = parsedUrl.searchParams.get("gl");
  const currentLr = parsedUrl.searchParams.get("lr");
  const nextHl = locale.hl;
  const nextGl = locale.gl;
  const nextLr = locale.lr;

  if (currentHl === nextHl && currentGl === nextGl && currentLr === nextLr) {
    return rawUrl;
  }

  parsedUrl.searchParams.set("hl", nextHl);
  parsedUrl.searchParams.set("gl", nextGl);
  parsedUrl.searchParams.set("lr", nextLr);
  return parsedUrl.toString();
}

function createBrowserLanguagePolicy({ session, configService, app, intl }) {
  let browserLanguageHooksRegistered = false;

  function applyBrowserLanguagePreference() {
    if (browserLanguageHooksRegistered) {
      return;
    }

    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ["*://*/*"] },
      (details, callback) => {
        if (details.resourceType !== "mainFrame") {
          callback({});
          return;
        }

        const preferredLanguage = configService.getConfigValue(
          "browser.language",
          "system",
        );
        const resolvedLanguage = resolveBrowserLanguage(preferredLanguage, {
          app,
          intl,
        });
        const redirectURL = applyGoogleLocaleHint(
          details.url,
          resolvedLanguage,
        );
        if (redirectURL && redirectURL !== details.url) {
          callback({ redirectURL });
          return;
        }

        callback({});
      },
    );

    session.defaultSession.webRequest.onBeforeSendHeaders(
      { urls: ["*://*/*"] },
      (details, callback) => {
        const preferredLanguage = configService.getConfigValue(
          "browser.language",
          "system",
        );
        const resolvedLanguage = resolveBrowserLanguage(preferredLanguage, {
          app,
          intl,
        });
        const acceptLanguage =
          mapBrowserLanguageToAcceptLanguage(resolvedLanguage);
        const requestHeaders = {
          ...(details.requestHeaders || {}),
          "Accept-Language": acceptLanguage,
        };
        callback({ requestHeaders });
      },
    );

    browserLanguageHooksRegistered = true;
  }

  return {
    applyBrowserLanguagePreference,
  };
}

module.exports = {
  createBrowserLanguagePolicy,
  mapBrowserLanguageToAcceptLanguage,
  resolveBrowserLanguage,
  resolveSystemLanguageTag,
};
