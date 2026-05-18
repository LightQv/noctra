const { BrowserView } = require("electron");
const { EventEmitter } = require("events");
const {
  applyScrollableUi,
  releaseChromiumPreferredColorScheme,
  resetChromiumPreferredColorSchemeState,
} = require("./contentUi");
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
    this.isEditable = this.kind === "editable";
    this.contentUiOptions = {
      widthPx: 6,
      hideDelayMs: 700,
      trackColor: "transparent",
      contentColorScheme: "dark",
    };

    this.webContents.on("did-finish-load", () => {
      this.applyContentUi();
    });

    this.webContents.on("dom-ready", () => {
      this.applyContentUi();
    });

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
      this.emit("updated", { kind: "metadata" });
    });

    this.webContents.on("did-stop-loading", () => {
      this.emit("updated", { kind: "metadata" });
    });

    this.webContents.on("devtools-opened", () => {
      this.applyContentUi();
    });

    this.webContents.on("devtools-closed", () => {
      resetChromiumPreferredColorSchemeState(this.webContents);
      this.applyContentUi();
    });
  }

  load(url) {
    this.url = url;
    this.virtualUrl = "";
    this.virtualDocument = null;
    this.title = getUrlDisplayTitle(url);
    this.faviconUrl = "";
    this.webContents.loadURL(url);
    this.emit("updated", { kind: "metadata" });
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
      faviconUrl: this.faviconUrl,
      isActive,
      kind: this.kind,
      isEditable: this.isEditable,
      isFocusedPaneBuffer: Boolean(meta.isFocusedPaneBuffer),
      isOtherPaneBuffer: Boolean(meta.isOtherPaneBuffer),
    };
  }

  destroy() {
    this.removeAllListeners();
    releaseChromiumPreferredColorScheme(this.webContents);
    if (!this.webContents.isDestroyed()) {
      this.webContents.destroy();
    }
  }
}

module.exports = Buffer;
