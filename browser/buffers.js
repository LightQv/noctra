class Buffer {
  constructor(id, webContents) {
    this.id = id;
    this.webContents = webContents;
    this.url = null;
  }

  load(url) {
    this.url = url;
    this.webContents.loadURL(url);
  }
}

module.exports = Buffer;
