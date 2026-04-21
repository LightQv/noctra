const { app, BrowserWindow } = require("electron");
const buffers = require("./browser/manager");
const { handleInput } = require("./core/input");
const { injectCommandUI } = require("./ui/commandPalette");

let win;
let buf;

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  injectCommandUI(win);

  buf = buffers.create(win.webContents);
  buf.load("http://192.168.1.20:3001");

  win.webContents.on("before-input-event", (event, input) => {
    event.preventDefault();

    const normalized = {
      type: input.type,
      key: input.key,
      ctrl: input.control,
      alt: input.alt,
      shift: input.shift,
      meta: input.meta,
    };

    handleInput(win, normalized);
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
