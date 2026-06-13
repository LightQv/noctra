const {
  pushShellPatch,
} = require("../../../core/adapters/renderer/shellPatchTransport");

const WHICHKEY_COLUMN_COUNT = 4;
const WHICHKEY_MAX_ROWS_PER_COLUMN = 5;
const WHICHKEY_PAGE_SIZE = WHICHKEY_COLUMN_COUNT * WHICHKEY_MAX_ROWS_PER_COLUMN;

function normalizeWhichKeyEntries(entries) {
  return (Array.isArray(entries) ? entries : []).filter((entry) => {
    const key = String(entry && entry.key ? entry.key : "").toLowerCase();
    return key !== "backspace";
  });
}

function paginateWhichKeyEntries(entries, page = 0) {
  const normalizedEntries = normalizeWhichKeyEntries(entries);
  const totalPages = Math.max(
    1,
    Math.ceil(normalizedEntries.length / WHICHKEY_PAGE_SIZE),
  );
  const currentPage = Math.min(
    Math.max(Number.isFinite(page) ? Math.floor(page) : 0, 0),
    totalPages - 1,
  );
  const pageEntries = normalizedEntries.slice(
    currentPage * WHICHKEY_PAGE_SIZE,
    (currentPage + 1) * WHICHKEY_PAGE_SIZE,
  );
  const columns = Array.from({ length: WHICHKEY_COLUMN_COUNT }, (_, index) =>
    pageEntries.slice(
      index * WHICHKEY_MAX_ROWS_PER_COLUMN,
      (index + 1) * WHICHKEY_MAX_ROWS_PER_COLUMN,
    ),
  );

  return {
    columns,
    currentPage,
    totalPages,
    pageSize: WHICHKEY_PAGE_SIZE,
  };
}

function showWhichKey(model, timeoutMs = 1200, delayMs = 0) {
  this.whichKeyModel = model || { prefix: "<leader>", entries: [] };

  if (this.whichKeyVisible || !delayMs || delayMs <= 0) {
    this.updateWhichKey(this.whichKeyModel, timeoutMs, 0, true, true);
    return;
  }

  this.whichKeyPendingTimeoutMs = timeoutMs;
  this.whichKeyVisible = false;
  this.clearWhichKeyHideTimer();
  this.resetWhichKeyShowTimer(delayMs);
}

function updateWhichKey(
  model,
  timeoutMs = 1200,
  delayMs = 0,
  ensureVisible = true,
  forceImmediate = false,
) {
  if (ensureVisible) {
    if (!this.whichKeyVisible && !forceImmediate && delayMs && delayMs > 0) {
      this.whichKeyModel = model ||
        this.whichKeyModel || { prefix: "<leader>", entries: [] };
      this.whichKeyPendingTimeoutMs = timeoutMs;
      this.clearWhichKeyHideTimer();
      this.resetWhichKeyShowTimer(delayMs);
      return;
    }

    this.whichKeyVisible = true;
    this.clearWhichKeyShowTimer();
  }

  const previousModel = this.whichKeyModel || { prefix: "<leader>", entries: [] };
  const nextModel = model || previousModel;
  const previousPrefix = previousModel.prefix || "<leader>";
  const nextPrefix = nextModel.prefix || "<leader>";
  const previousEntryKeys = normalizeWhichKeyEntries(previousModel.entries)
    .map((entry) => String(entry.key || ""))
    .join("\u0000");
  const nextEntryKeys = normalizeWhichKeyEntries(nextModel.entries)
    .map((entry) => String(entry.key || ""))
    .join("\u0000");
  if (
    previousPrefix !== nextPrefix ||
    previousEntryKeys !== nextEntryKeys ||
    !Number.isFinite(this.whichKeyPage)
  ) {
    this.whichKeyPage = 0;
  }
  if (Number.isFinite(nextModel.pageDelta)) {
    this.whichKeyPage += Math.floor(nextModel.pageDelta);
  }

  this.whichKeyModel = nextModel;
  if (timeoutMs === null) {
    this.clearWhichKeyHideTimer();
  } else {
    this.resetWhichKeyHideTimer(timeoutMs);
  }

  this.syncOverlayStack();
  if (!this.whichKeyOverlayView || !this.whichKeyOverlayReady) return;

  const pagination = paginateWhichKeyEntries(
    this.whichKeyModel.entries,
    this.whichKeyPage,
  );
  this.whichKeyPage = pagination.currentPage;

  const safeModel = {
    prefix: this.whichKeyModel.prefix || "<leader>",
    columns: pagination.columns,
    currentPage: pagination.currentPage,
    totalPages: pagination.totalPages,
  };

  pushShellPatch(
    this.whichKeyOverlayView.webContents,
    `
      (function updateWhichKeyOverlay() {
        const prefixNode = document.getElementById('whichkey-prefix');
        const gridNode = document.getElementById('whichkey-grid');
        const hintsNode = document.getElementById('whichkey-hints');
        if (!prefixNode || !gridNode || !hintsNode) return;

        const model = ${JSON.stringify(safeModel)};
        prefixNode.textContent = model.prefix || '<leader>';

        const escapeHtml = (value) => String(value)
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#39;');

        const columns = Array.isArray(model.columns) ? model.columns : [];

        gridNode.innerHTML = columns
          .map((columnEntries) => {
            const rows = columnEntries
              .map((entry) => {
                const key = escapeHtml(String(entry.key || ''));
                const label = escapeHtml(String(entry.label || ''));
                return '<div class="whichkey-entry"><span class="whichkey-key">' + key + '</span><span class="whichkey-arrow">-&gt;</span><span class="whichkey-label">' + label + '</span></div>';
              })
              .join('');

            return '<div class="whichkey-column">' + rows + '</div>';
          })
          .join('');

        const baseHints = '<span class="whichkey-hint"><span class="whichkey-hint-icon">󱊷</span><span class="whichkey-hint-label">close</span></span><span class="whichkey-hint"><span class="whichkey-hint-icon">󰁮</span><span class="whichkey-hint-label">back</span></span>';
        const totalPages = Number.isFinite(model.totalPages) ? model.totalPages : 1;
        const currentPage = Number.isFinite(model.currentPage) ? model.currentPage : 0;
        const pageHint = totalPages > 1
          ? '<span class="whichkey-hint"><span class="whichkey-hint-icon">[ / ]</span><span class="whichkey-hint-label">page ' + (currentPage + 1) + '/' + totalPages + '</span></span>'
          : '';
        hintsNode.innerHTML = baseHints + pageHint;
      })();
    `,
  );
}

function hideWhichKey() {
  this.whichKeyVisible = false;
  this.whichKeyPage = 0;
  this.clearWhichKeyShowTimer();
  this.clearWhichKeyHideTimer();
  this.relayout();
}

function handleWhichKeyMouseEvent(input) {
  if (!this.whichKeyVisible || !input || input.type !== "mouseDown") return;
  if (input.button !== "left") return;
  const view = this.whichKeyOverlayView;
  if (!view || !view.webContents || view.webContents.isDestroyed()) return;
  view.webContents
    .executeJavaScript(
      `(() => Boolean(document.elementFromPoint(${JSON.stringify(input.x)}, ${JSON.stringify(input.y)})?.closest('#whichkey-overlay')))();`,
    )
    .then((inside) => {
      if (!inside) {
        this.hideWhichKey();
      }
    })
    .catch(() => {});
}

function resetWhichKeyShowTimer(delayMs) {
  this.clearWhichKeyShowTimer();

  if (!delayMs || delayMs <= 0) {
    this.whichKeyVisible = true;
    this.updateWhichKey(
      this.whichKeyModel,
      this.whichKeyPendingTimeoutMs,
      0,
      true,
      true,
    );
    return;
  }

  this.whichKeyShowTimer = setTimeout(() => {
    this.whichKeyShowTimer = null;
    this.whichKeyVisible = true;
    this.updateWhichKey(
      this.whichKeyModel,
      this.whichKeyPendingTimeoutMs,
      0,
      true,
      true,
    );
  }, delayMs);
}

function clearWhichKeyShowTimer() {
  if (!this.whichKeyShowTimer) return;
  clearTimeout(this.whichKeyShowTimer);
  this.whichKeyShowTimer = null;
}

function resetWhichKeyHideTimer(timeoutMs) {
  this.clearWhichKeyHideTimer();
  if (!timeoutMs || timeoutMs <= 0) return;
  this.whichKeyHideTimer = setTimeout(() => {
    this.whichKeyHideTimer = null;
    this.hideWhichKey();
  }, timeoutMs);
}

function clearWhichKeyHideTimer() {
  if (!this.whichKeyHideTimer) return;
  clearTimeout(this.whichKeyHideTimer);
  this.whichKeyHideTimer = null;
}

module.exports = {
  showWhichKey,
  updateWhichKey,
  hideWhichKey,
  resetWhichKeyShowTimer,
  clearWhichKeyShowTimer,
  resetWhichKeyHideTimer,
  clearWhichKeyHideTimer,
  handleWhichKeyMouseEvent,
  paginateWhichKeyEntries,
  normalizeWhichKeyEntries,
  WHICHKEY_COLUMN_COUNT,
  WHICHKEY_MAX_ROWS_PER_COLUMN,
  WHICHKEY_PAGE_SIZE,
};
