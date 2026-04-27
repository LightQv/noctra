const { BrowserView } = require("electron");
const { EventEmitter } = require("events");
const { applyScrollableUi, releaseChromiumPreferredColorScheme } = require("./contentUi");
const {
  UI_SCROLLBAR_THUMB_COLOR,
  UI_SCROLLBAR_THUMB_ACTIVE_COLOR,
} = require("../ui/constants");
const { getConfigValue } = require("../core/config/service");

function getUrlDisplayTitle(rawUrl) {
  if (!rawUrl) return "Loading...";

  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === "about:") {
      return parsed.href;
    }

    const host = parsed.host || parsed.hostname;
    const path = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : "";
    return `${host}${path}` || parsed.href;
  } catch {
    return rawUrl;
  }
}

class Buffer extends EventEmitter {
  constructor(id, options = {}) {
    super();

    this.id = id;
    const chromiumPreferences = getConfigValue("browser.chromium.web_preferences", {});
    const webPreferences = {
      contextIsolation:
        typeof chromiumPreferences.context_isolation === "boolean"
          ? chromiumPreferences.context_isolation
          : true,
      nodeIntegration:
        typeof chromiumPreferences.node_integration === "boolean"
          ? chromiumPreferences.node_integration
          : false,
    };

    if (typeof options.preloadPath === "string" && options.preloadPath.length > 0) {
      webPreferences.preload = options.preloadPath;
    }

    this.view = new BrowserView({
      webPreferences,
    });

    this.webContents = this.view.webContents;
    this.url = "about:blank";
    this.virtualUrl = "";
    this.title = "[No title]";
    this.faviconUrl = "";
    this.kind = options.kind || "web";
    this.isEditable = this.kind === "editable";
    this.contentUiOptions = {
      widthPx: 6,
      hideDelayMs: 700,
      trackColor: "transparent",
      contentColorScheme: "dark",
      thumbColor: UI_SCROLLBAR_THUMB_COLOR,
      thumbActiveColor: UI_SCROLLBAR_THUMB_ACTIVE_COLOR,
    };

    this.webContents.on("did-finish-load", () => {
      this.applyContentUi();
    });

    this.webContents.on("page-title-updated", (event, title) => {
      event.preventDefault();
      const nextTitle = title || this.title;
      if (nextTitle === this.title) return;
      this.title = nextTitle;
      this.emit("updated", { kind: "metadata" });
    });

    this.webContents.on("did-navigate", (_, url) => {
      this.url = this.virtualUrl || url;
      this.emit("updated", { kind: "metadata" });
    });

    this.webContents.on("page-favicon-updated", (_, favicons) => {
      const nextFavicon =
        Array.isArray(favicons) && typeof favicons[0] === "string" ? favicons[0] : "";
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
  }

  load(url) {
    this.url = url;
    this.virtualUrl = "";
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
