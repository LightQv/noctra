const { BrowserView, session } = require("electron");
const { EventEmitter } = require("events");
const { getConfigValue } = require("../core/config/service");
const { buildOpeningBufferSpec } = require("../core/opening/buffer");
const { resolveTheme, resolveThemeMode } = require("../ui/theme");
const {
  applyScrollableUi,
  releaseChromiumPreferredColorScheme,
  resetChromiumPreferredColorSchemeState,
} = require("./contentUi");
const { buildCatErrorPage } = require("../core/errorbuffer/page");
const {
  normalizeChromiumErrorName,
  shouldShowCatErrorBuffer,
} = require("../core/navigation/loadFailurePolicy");
const {
  markSurfaceRole,
  SURFACE_ROLES,
} = require("../core/security/surfaceTrust");

function getUrlDisplayTitle(rawUrl) {
  if (!rawUrl) return "Loading...";

  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === "about:") {
      return parsed.href;
    }

    const host = parsed.host || parsed.hostname;
    const path =
      parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : "";
    return `${host}${path}` || parsed.href;
  } catch {
    return rawUrl;
  }
}

class Buffer extends EventEmitter {
  constructor(id, options = {}) {
    super();

    this.id = id;
    const webPreferences = {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      session: options.session || session.defaultSession,
    };

    if (
      typeof options.preloadPath === "string" &&
      options.preloadPath.length > 0
    ) {
      webPreferences.preload = options.preloadPath;
    }

    this.view = new BrowserView({
      webPreferences,
    });

    this.webContents = this.view.webContents;
    markSurfaceRole(
      this.webContents,
      options.surfaceRole || SURFACE_ROLES.UNTRUSTED_WEB,
    );
    this.url = "about:blank";
    this.virtualUrl = "";
    this.virtualDocument = null;
    this.title = "[No title]";
    this.faviconUrl = "";
    this.kind = options.kind || "web";
    this.extension = options.extension || null;
    this.displayUrl =
      typeof options.displayUrl === "string" && options.displayUrl.trim()
        ? options.displayUrl.trim()
        : "";
    this.isEditable = this.kind === "editable";
    this.contentUiOptions = {
      widthPx: 6,
      hideDelayMs: 700,
      trackColor: "transparent",
      contentColorScheme: "dark",
    };
    this.lastFailedNavigation = null;
    this.loadingState = {
      isLoading: false,
      progress: null,
      indeterminate: false,
    };
    this.loadingProgressTimer = null;

    const clearLoadingProgressTimer = () => {
      if (this.loadingProgressTimer) {
        clearInterval(this.loadingProgressTimer);
        this.loadingProgressTimer = null;
      }
    };

    const startLoadingProgressTimer = () => {
      clearLoadingProgressTimer();
      this.loadingProgressTimer = setInterval(() => {
        if (!this.loadingState.isLoading) {
          clearLoadingProgressTimer();
          return;
        }
        if (typeof this.loadingState.progress !== "number") {
          return;
        }
        const current = this.loadingState.progress;
        const delta = Math.max(0.005, (0.92 - current) * 0.12);
        const next = Math.min(0.92, current + delta);
        if (next <= current + 0.0001) {
          return;
        }
        this.loadingState.progress = next;
        this.emit("updated", { kind: "metadata" });
      }, 120);
    };

    this.webContents.on("page-title-updated", (event, title) => {
      event.preventDefault();
      const nextTitle = title || this.title;
      if (nextTitle === this.title) return;
      this.title = nextTitle;
      this.emit("updated", { kind: "metadata" });
      this.emit("title-updated", {
        url: this.url,
        title: this.title,
        timestampMs: Date.now(),
      });
    });

    this.webContents.on("did-navigate", (_, url) => {
      this.url = this.virtualUrl || url;
      if (this.loadingState.isLoading) {
        this.loadingState.progress = Math.max(
          typeof this.loadingState.progress === "number"
            ? this.loadingState.progress
            : 0,
          0.35,
        );
        this.loadingState.indeterminate = false;
      }
      this.emit("updated", { kind: "metadata" });
      this.emit("visit", {
        url: this.url,
        title: this.title,
        timestampMs: Date.now(),
      });
    });

    this.webContents.on("page-favicon-updated", (_, favicons) => {
      const nextFavicon =
        Array.isArray(favicons) && typeof favicons[0] === "string"
          ? favicons[0]
          : "";
      if (this.faviconUrl === nextFavicon) {
        return;
      }
      this.faviconUrl = nextFavicon;
      this.emit("updated", { kind: "metadata" });
    });

    this.webContents.on("did-navigate-in-page", (_, url) => {
      this.url = this.virtualUrl || url;
      this.emit("updated", { kind: "metadata" });
    });

    this.webContents.on("did-start-loading", () => {
      this.loadingState.isLoading = true;
      this.loadingState.progress = null;
      this.loadingState.indeterminate = true;
      this.emit("updated", { kind: "metadata" });
    });

    this.webContents.on("dom-ready", () => {
      if (this.loadingState.isLoading) {
        this.loadingState.progress = Math.max(
          typeof this.loadingState.progress === "number"
            ? this.loadingState.progress
            : 0,
          0.62,
        );
        this.loadingState.indeterminate = false;
        startLoadingProgressTimer();
      }
      this.applyContentUi();
    });

    this.webContents.on("did-finish-load", () => {
      this.applyContentUi();
      if (!this.loadingState.isLoading) {
        return;
      }
      this.loadingState.progress = 1;
      this.loadingState.indeterminate = false;
      this.emit("updated", { kind: "metadata" });
    });

    this.webContents.on("did-stop-loading", () => {
      clearLoadingProgressTimer();
      this.loadingState.isLoading = false;
      this.loadingState.progress = null;
      this.loadingState.indeterminate = false;
      this.emit("updated", { kind: "metadata" });
    });

    this.webContents.on("did-fail-load", () => {
      clearLoadingProgressTimer();
      this.loadingState.isLoading = false;
      this.loadingState.progress = null;
      this.loadingState.indeterminate = false;
      this.emit("updated", { kind: "metadata" });
    });

    this.webContents.on(
      "did-fail-load",
      (
        _event,
        errorCode,
        errorDescription,
        validatedURL,
        isMainFrame,
      ) => {
        this.handleLoadFailure({
          errorCode,
          errorDescription,
          validatedURL,
          isMainFrame,
        });
      },
    );

    this.webContents.on(
      "did-fail-provisional-load",
      (
        _event,
        errorCode,
        errorDescription,
        validatedURL,
        isMainFrame,
      ) => {
        this.handleLoadFailure({
          errorCode,
          errorDescription,
          validatedURL,
          isMainFrame,
        });
      },
    );

    this.webContents.on("devtools-opened", () => {
      this.applyContentUi();
    });

    this.webContents.on("devtools-closed", () => {
      resetChromiumPreferredColorSchemeState(this.webContents);
      this.applyContentUi();
    });
  }

  load(url) {
    if (url === "noctra://cat") {
      this.loadCatPage();
      return;
    }
    if (url === "noctra://dashboard") {
      this.loadDashboardPage();
      return;
    }

    this.url = url;
    this.virtualUrl = "";
    this.virtualDocument = null;
    this.title = this.displayUrl || getUrlDisplayTitle(url);
    this.faviconUrl = "";
    this.webContents.loadURL(url);
    this.emit("updated", { kind: "metadata" });
  }

  loadDashboardPage() {
    const themeConfig = getConfigValue("global.theme", {});
    const systemPrefersDark = this.contentUiOptions.contentColorScheme !== "light";
    const resolvedMode = resolveThemeMode(themeConfig, {
      systemPrefersDark,
    });
    const openingBufferConfig = getConfigValue("global.opening_buffer", {});
    const dashboardSpec = buildOpeningBufferSpec(
      {
        ...openingBufferConfig,
        mode: "dashboard",
      },
      {
        colorScheme: resolvedMode === "light" ? "light" : "dark",
        theme: resolveTheme(themeConfig, { systemPrefersDark }),
      },
    );

    if (
      dashboardSpec &&
      dashboardSpec.kind === "virtual" &&
      dashboardSpec.document
    ) {
      this.loadVirtualDocument(dashboardSpec.document);
      return;
    }

    this.loadVirtualDocument({
      url: "noctra://dashboard",
      title: "Dashboard",
      html: "<!doctype html><html><head><title>Dashboard</title></head><body></body></html>",
    });
  }

  loadCatPage(failure = null) {
    const fromFailure = Boolean(
      failure && typeof failure === "object" && failure.fromFailure === true,
    );
    const errorName = normalizeChromiumErrorName(failure?.errorDescription);
    if (fromFailure) {
      this.lastFailedNavigation = {
        failedUrl:
          typeof failure.failedUrl === "string" && failure.failedUrl.trim()
            ? failure.failedUrl.trim()
            : "",
        errorCode: Number.isInteger(failure.errorCode) ? failure.errorCode : null,
        errorName,
      };
    }

    const html = buildCatErrorPage({
      fromFailure,
      failedUrl: fromFailure ? this.lastFailedNavigation?.failedUrl : "",
      errorCode: fromFailure ? this.lastFailedNavigation?.errorCode : null,
      errorName: fromFailure ? this.lastFailedNavigation?.errorName : "",
    });
    this.loadVirtualDocument({
      url: "noctra://cat",
      title: "Cat",
      html,
    });
  }

  handleLoadFailure(failure = {}) {
    if (!shouldShowCatErrorBuffer(failure)) {
      return;
    }

    const failedUrl =
      typeof failure.validatedURL === "string" ? failure.validatedURL : "";
    this.loadCatPage({
      fromFailure: true,
      failedUrl,
      errorCode: failure.errorCode,
      errorDescription: failure.errorDescription,
    });
  }

  loadVirtualDocument(options = {}) {
    const virtualUrl = options.url || "about:blank";
    const title = options.title || "[No title]";
    const html = typeof options.html === "string" ? options.html : "";

    this.url = virtualUrl;
    this.virtualUrl = virtualUrl;
    this.virtualDocument = {
      url: virtualUrl,
      title,
      html,
    };
    this.title = title;
    this.faviconUrl = "";

    const encoded = encodeURIComponent(html);
    this.webContents.loadURL(`data:text/html;charset=utf-8,${encoded}`);
    this.emit("updated", { kind: "metadata" });
  }

  setContentUiOptions(nextOptions = {}) {
    this.contentUiOptions = {
      ...this.contentUiOptions,
      ...nextOptions,
    };
    this.applyContentUi();
  }

  applyContentUi() {
    applyScrollableUi(this.webContents, this.contentUiOptions);
  }

  toJSON(isActive, meta = {}) {
    return {
      id: this.id,
      title: this.title,
      url: this.url,
      displayUrl: this.displayUrl || this.url,
      faviconUrl: this.faviconUrl,
      isActive,
      kind: this.kind,
      isEditable: this.isEditable,
      isFocusedPaneBuffer: Boolean(meta.isFocusedPaneBuffer),
      isOtherPaneBuffer: Boolean(meta.isOtherPaneBuffer),
    };
  }

  destroy() {
    if (this.loadingProgressTimer) {
      clearInterval(this.loadingProgressTimer);
      this.loadingProgressTimer = null;
    }
    this.removeAllListeners();
    releaseChromiumPreferredColorScheme(this.webContents);
    if (!this.webContents.isDestroyed()) {
      this.webContents.destroy();
    }
  }
}

module.exports = Buffer;
