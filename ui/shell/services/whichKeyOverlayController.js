const {
  pushShellPatch,
} = require("../../../core/adapters/renderer/shellPatchTransport");

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

  this.whichKeyModel = model ||
    this.whichKeyModel || { prefix: "<leader>", entries: [] };
  if (timeoutMs === null) {
    this.clearWhichKeyHideTimer();
  } else {
    this.resetWhichKeyHideTimer(timeoutMs);
  }

  this.syncOverlayStack();
  if (!this.whichKeyOverlayView || !this.whichKeyOverlayReady) return;

  const safeModel = {
    prefix: this.whichKeyModel.prefix || "<leader>",
    entries: Array.isArray(this.whichKeyModel.entries)
      ? this.whichKeyModel.entries
      : [],
  };

  pushShellPatch(
    this.whichKeyOverlayView.webContents,
    `
      (function updateWhichKeyOverlay() {
        const prefixNode = document.getElementById('whichkey-prefix');
        const gridNode = document.getElementById('whichkey-grid');
        if (!prefixNode || !gridNode) return;

        const model = ${JSON.stringify(safeModel)};
        prefixNode.textContent = model.prefix || '<leader>';

        const escapeHtml = (value) => String(value)
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#39;');

        const entries = (Array.isArray(model.entries) ? model.entries : []).filter((entry) => {
          const key = String(entry && entry.key ? entry.key : '').toLowerCase();
          return key !== 'backspace';
        });

        const columnCount = 3;
        const maxRowsPerColumn = 5;
        const columns = Array.from({ length: columnCount }, (_, index) =>
          entries.slice(index * maxRowsPerColumn, (index + 1) * maxRowsPerColumn),
        );

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
      })();
    `,
  );
}

function hideWhichKey() {
  this.whichKeyVisible = false;
  this.clearWhichKeyShowTimer();
  this.clearWhichKeyHideTimer();
  this.relayout();
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
};
