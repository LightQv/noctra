const { shell, BrowserWindow } = require("electron");
const downloadsStore = require("./store");
const { sanitizeDownloadFilename } = require("../security/downloadPolicy");

const activeDownloads = new Map();
let subscribers = [];
let nextId = 1;

function emit() {
  const snapshot = getEntries();
  for (const cb of subscribers) {
    try {
      cb(snapshot);
    } catch {
      // ignore subscriber errors
    }
  }
  updateAppIconProgress();
}

function makeId() {
  const id = nextId;
  nextId += 1;
  return String(id);
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function updateAppIconProgress() {
  let totalProgress = 0;
  let activeCount = 0;
  for (const d of activeDownloads.values()) {
    if (d.state === "progressing") {
      activeCount += 1;
      const total =
        typeof d.item.getTotalBytes === "function"
          ? d.item.getTotalBytes()
          : 0;
      const received =
        typeof d.item.getReceivedBytes === "function"
          ? d.item.getReceivedBytes()
          : 0;
      if (total > 0) {
        totalProgress += received / total;
      }
    }
  }

  const progress = activeCount > 0 ? totalProgress / activeCount : -1;

  if (
    BrowserWindow &&
    typeof BrowserWindow.getAllWindows === "function"
  ) {
    for (const win of BrowserWindow.getAllWindows()) {
      if (win && typeof win.isDestroyed === "function" && !win.isDestroyed()) {
        win.setProgressBar(progress);
      }
    }
  }

  if (process.platform === "darwin") {
    try {
      const { app } = require("electron");
      if (app && app.dock && typeof app.dock.setBadge === "function") {
        app.dock.setBadge(activeCount > 0 ? String(activeCount) : "");
      }
    } catch {
      // ignore
    }
  }
}

function buildEntryFromActive(download) {
  const item = download.item;
  const totalBytes =
    typeof item.getTotalBytes === "function" ? item.getTotalBytes() : 0;
  const receivedBytes =
    typeof item.getReceivedBytes === "function"
      ? item.getReceivedBytes()
      : 0;
  const state = download.state;
  const progress = totalBytes > 0 ? receivedBytes / totalBytes : 0;

  return {
    id: download.id,
    filename: download.filename,
    url: download.url,
    savePath: download.savePath,
    state,
    totalBytes,
    receivedBytes,
    progress,
    formattedTotal: formatBytes(totalBytes),
    formattedReceived: formatBytes(receivedBytes),
    startTime: download.startTime,
    endTime: download.endTime,
    speed: download.speed,
    isPaused:
      typeof item.isPaused === "function" ? item.isPaused() : false,
    canResume: typeof item.canResume === "function" ? item.canResume() : false,
  };
}

function getEntries() {
  const active = [];
  for (const download of activeDownloads.values()) {
    active.push(buildEntryFromActive(download));
  }
  active.sort((a, b) => b.startTime - a.startTime);

  const persisted = downloadsStore.readDownloads();
  return { active, persisted };
}

function subscribe(callback) {
  if (typeof callback === "function") {
    subscribers.push(callback);
  }
  return () => {
    subscribers = subscribers.filter((cb) => cb !== callback);
  };
}

function registerDownload(item, webContents, safePath) {
  if (!item || typeof item.getFilename !== "function") return null;

  const id = makeId();
  const url =
    webContents && typeof webContents.getURL === "function"
      ? webContents.getURL()
      : "";
  const filename = sanitizeDownloadFilename(item.getFilename());
  const startTime = Date.now();

  const download = {
    id,
    item,
    filename,
    url,
    savePath: safePath || "",
    state: "progressing",
    startTime,
    endTime: null,
    speed: 0,
    lastReceived: 0,
    lastUpdate: startTime,
  };

  activeDownloads.set(id, download);

  if (item && typeof item.on === "function") {
    item.on("updated", (_event, state) => {
      download.state = state;
      const now = Date.now();
      const received =
        typeof item.getReceivedBytes === "function"
          ? item.getReceivedBytes()
          : 0;
      const delta = now - download.lastUpdate;
      if (delta > 0) {
        const bytesDelta = received - download.lastReceived;
        download.speed = Math.max(0, (bytesDelta / delta) * 1000);
      }
      download.lastReceived = received;
      download.lastUpdate = now;
      emit();
    });

    item.once("done", (_event, state) => {
      download.state = state;
      download.endTime = Date.now();
      download.speed = 0;

      const doneTotalBytes =
        typeof item.getTotalBytes === "function" ? item.getTotalBytes() : 0;
      const doneReceivedBytes =
        typeof item.getReceivedBytes === "function"
          ? item.getReceivedBytes()
          : 0;

      if (state === "completed" && download.savePath) {
        downloadsStore.appendDownload({
          id: download.id,
          filename: download.filename,
          url: download.url,
          savePath: download.savePath,
          state: "completed",
          totalBytes: doneTotalBytes,
          receivedBytes: doneReceivedBytes,
          startTime: download.startTime,
          endTime: download.endTime,
        });
      } else if (state === "cancelled" || state === "interrupted") {
        downloadsStore.appendDownload({
          id: download.id,
          filename: download.filename,
          url: download.url,
          savePath: download.savePath,
          state,
          totalBytes: doneTotalBytes,
          receivedBytes: doneReceivedBytes,
          startTime: download.startTime,
          endTime: download.endTime,
        });
      }

      // Keep active reference briefly so UI can show final state, then remove
      setTimeout(() => {
        activeDownloads.delete(id);
        emit();
      }, 2000);

      emit();
    });
  }

  emit();
  return id;
}

function findActiveById(id) {
  return activeDownloads.get(String(id)) || null;
}

function pause(id) {
  const download = findActiveById(id);
  if (!download || typeof download.item.pause !== "function") return false;
  download.item.pause();
  return true;
}

function resume(id) {
  const download = findActiveById(id);
  if (!download || typeof download.item.resume !== "function") return false;
  download.item.resume();
  return true;
}

function cancel(id) {
  const download = findActiveById(id);
  if (!download || typeof download.item.cancel !== "function") return false;
  download.item.cancel();
  return true;
}

function getRetryInfo(id) {
  const download = findActiveById(id);
  if (download) {
    return { url: download.url, filename: download.filename };
  }
  const persisted = downloadsStore.readDownloads();
  const entry = persisted.find((e) => String(e.id) === String(id));
  if (entry) {
    return { url: entry.url, filename: entry.filename };
  }
  return null;
}

function openFile(id) {
  const download = findActiveById(id);
  if (download && download.savePath) {
    shell.openPath(download.savePath);
    return true;
  }
  const persisted = downloadsStore.readDownloads();
  const entry = persisted.find((e) => String(e.id) === String(id));
  if (entry && entry.savePath) {
    shell.openPath(entry.savePath);
    return true;
  }
  return false;
}

function showInFolder(id) {
  const download = findActiveById(id);
  if (download && download.savePath) {
    shell.showItemInFolder(download.savePath);
    return true;
  }
  const persisted = downloadsStore.readDownloads();
  const entry = persisted.find((e) => String(e.id) === String(id));
  if (entry && entry.savePath) {
    shell.showItemInFolder(entry.savePath);
    return true;
  }
  return false;
}

function clearCompleted() {
  const persisted = downloadsStore.readDownloads();
  const filtered = persisted.filter(
    (e) => e.state === "progressing" || e.state === "paused",
  );
  downloadsStore.writeDownloads(filtered);
  emit();
  return true;
}

function removePersistedByIds(ids) {
  downloadsStore.removeDownloadsByIds(ids);
  emit();
}

module.exports = {
  getEntries,
  subscribe,
  registerDownload,
  pause,
  resume,
  cancel,
  getRetryInfo,
  openFile,
  showInFolder,
  clearCompleted,
  removePersistedByIds,
  updateAppIconProgress,
};
