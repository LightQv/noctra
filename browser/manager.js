const Buffer = require("./buffers");

class BufferManager {
  constructor() {
    this.buffers = [];
    this.active = null;
    this.nextId = 1;
  }

  create(webContents) {
    const buf = new Buffer(this.nextId++, webContents);
    this.buffers.push(buf);
    this.active = buf;
    return buf;
  }

  getActive() {
    return this.active;
  }

  switchTo(id) {
    const buf = this.buffers.find((b) => b.id === id);
    if (buf) this.active = buf;
  }
}

module.exports = new BufferManager();
