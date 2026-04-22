const { BrowserView } = require("electron");
const { EventEmitter } = require("events");

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
  constructor(id) {
    super();

    this.id = id;
    this.view = new BrowserView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    this.webContents = this.view.webContents;
    this.url = "about:blank";
    this.title = "[No title]";

    this.webContents.on("page-title-updated", (event, title) => {
      event.preventDefault();
      const nextTitle = title || this.title;
      if (nextTitle === this.title) return;
      this.title = nextTitle;
      this.emit("updated", { kind: "metadata" });
    });

    this.webContents.on("did-navigate", (_, url) => {
      this.url = url;
      this.emit("updated", { kind: "metadata" });
    });

    this.webContents.on("did-navigate-in-page", (_, url) => {
      this.url = url;
      this.emit("updated", { kind: "metadata" });
    });
  }

  load(url) {
    this.url = url;
    this.title = getUrlDisplayTitle(url);
    this.webContents.loadURL(url);
    this.emit("updated", { kind: "metadata" });
  }

  toJSON(isActive) {
    return {
      id: this.id,
      title: this.title,
      url: this.url,
      isActive,
    };
  }

  destroy() {
    this.removeAllListeners();
    if (!this.webContents.isDestroyed()) {
      this.webContents.destroy();
    }
  }
}

module.exports = Buffer;
