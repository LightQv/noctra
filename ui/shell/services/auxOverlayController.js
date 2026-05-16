const {
  pushShellPatch,
} = require("../../../core/adapters/renderer/shellPatchTransport");

function setToastOverlayVisibility(isVisible) {
  const nextCount = isVisible ? Math.max(1, this.activeToastCount || 0) : 0;
  const prevVisible = (this.activeToastCount || 0) > 0;
  const nextVisible = nextCount > 0;
  this.activeToastCount = nextCount;
  if (prevVisible !== nextVisible) {
    this.syncOverlayStack();
  }
}

function normalizeToast(toast = {}) {
  const severity =
    toast.severity === "error" || toast.severity === "warning"
      ? toast.severity
      : "info";
  const message = String(toast.message || "");
  const timeoutMs = Number.isFinite(toast.timeoutMs)
    ? Math.max(800, Math.floor(toast.timeoutMs))
    : 2200;
  const accentColor =
    severity === "error"
      ? this.currentTheme.dangerTextColor
      : severity === "warning"
        ? "#f6c177"
        : this.currentTheme.mainColor;
  return { severity, message, timeoutMs, accentColor };
}

function measureToastOverlayHeight() {
  if (!this.toastOverlayView || !this.toastOverlayReady) return;
  pushShellPatch(
    this.toastOverlayView.webContents,
    `
      (function measureToastOverlayHeight() {
        const root = document.getElementById('toast-root');
        if (!root) return 1;
        const style = window.getComputedStyle(root);
        const padTop = Number.parseFloat(style.paddingTop || '0') || 0;
        const padBottom = Number.parseFloat(style.paddingBottom || '0') || 0;
        const items = Array.from(root.querySelectorAll('.toast-item'));
        if (!items.length) return 1;
        let contentHeight = 0;
        for (const item of items) {
          contentHeight += item.getBoundingClientRect().height;
        }
        const gap = Number.parseFloat(style.gap || '0') || 0;
        contentHeight += Math.max(0, items.length - 1) * gap;
        return Math.max(1, Math.ceil(contentHeight + padTop + padBottom));
      })();
    `,
  ).then((nextHeight) => {
    if (!Number.isFinite(nextHeight)) return;
    const safeHeight = Math.max(1, Math.floor(nextHeight));
    if (safeHeight !== this.toastOverlayHeight) {
      this.toastOverlayHeight = safeHeight;
      this.relayout();
    }
  });
}

function renderToastNode(id, accentColor, message) {
  return pushShellPatch(
    this.toastOverlayView.webContents,
    `
      (function renderToastNode() {
        const root = document.getElementById('toast-root');
        if (!root) return;
        const node = document.createElement('div');
        node.className = 'toast-item';
        node.dataset.toastId = ${JSON.stringify(String(id))};
        node.style.borderLeftColor = ${JSON.stringify(accentColor)};
        node.textContent = ${JSON.stringify(message)};
        root.appendChild(node);
        requestAnimationFrame(() => node.classList.add('show'));
      })();
    `,
    {
      onError(error) {
        console.warn(
          "[noctra:warning] toast_render_failed",
          error && error.message ? error.message : error,
        );
      },
    },
  );
}

function dismissToast(id) {
  const toastId = String(id || "");
  if (!toastId) return;
  const timer = this.toastDismissTimers.get(toastId);
  if (timer) {
    clearTimeout(timer);
    this.toastDismissTimers.delete(toastId);
  }
  const index = this.activeToastIds.indexOf(toastId);
  if (index === -1) return;
  this.activeToastIds.splice(index, 1);
  this.activeToastCount = this.activeToastIds.length;
  setToastOverlayVisibility.call(this, this.activeToastCount > 0);
  pushShellPatch(
    this.toastOverlayView.webContents,
    `
      (function dismissToastNode() {
        const node = document.querySelector('.toast-item[data-toast-id=${JSON.stringify(toastId)}]');
        if (!node) return;
        node.classList.remove('show');
        setTimeout(() => {
          if (node.parentElement) node.parentElement.removeChild(node);
        }, 140);
      })();
    `,
  );
  setTimeout(() => {
    measureToastOverlayHeight.call(this);
    pumpToastQueue.call(this);
  }, 160);
}

function pumpToastQueue() {
  if (!this.window || !this.toastOverlayView || !this.toastOverlayReady) return;
  while (this.activeToastIds.length < 3 && this.toastQueue.length > 0) {
    const nextToast = this.toastQueue.shift();
    const id = String(nextToast.id);
    this.activeToastIds.push(id);
    this.activeToastCount = this.activeToastIds.length;
    setToastOverlayVisibility.call(this, true);
    renderToastNode.call(this, id, nextToast.accentColor, nextToast.message).then(
      () => measureToastOverlayHeight.call(this),
    );
    const dismissTimer = setTimeout(
      () => dismissToast.call(this, id),
      nextToast.timeoutMs,
    );
    this.toastDismissTimers.set(id, dismissTimer);
  }
}

function showNotificationToast(toast = {}) {
  if (!this.window || !this.toastOverlayView || !this.toastOverlayReady) {
    this.pendingToasts.push(toast);
    if (this.pendingToasts.length > 50) this.pendingToasts.shift();
    return;
  }

  const normalized = normalizeToast.call(this, toast);
  this.toastQueue.push({
    id: this.nextToastId++,
    ...normalized,
  });
  if (this.toastQueue.length > 50) {
    this.toastQueue.splice(0, this.toastQueue.length - 50);
  }
  pumpToastQueue.call(this);
}

function flushPendingToasts() {
  if (!this.window || !this.shellHostReady || this.pendingToasts.length === 0)
    return;
  const queuedToasts = this.pendingToasts.splice(0, this.pendingToasts.length);
  for (const toast of queuedToasts) this.showNotificationToast(toast);
}

function isSelectionModalVisible() {
  return this.selectionModalVisible;
}

function showSelectionModal(model) {
  this.selectionModalVisible = true;
  this.selectionModalModel = model || null;
  this.syncOverlayStack();
  this.updateSelectionModal(this.selectionModalModel);
}

function hideSelectionModal() {
  this.selectionModalVisible = false;
  this.selectionModalModel = null;
  this.relayout();
}

function updateSelectionModal(model) {
  this.selectionModalModel = model || this.selectionModalModel || null;
  if (!this.selectionModalVisible) return;
  if (!this.selectionModalView || !this.selectionModalReady) return;

  const safeModel = {
    title: String(this.selectionModalModel?.title || "Bookmark"),
    promptTitle: String(this.selectionModalModel?.promptTitle || ""),
    urlLine: String(this.selectionModalModel?.urlLine || ""),
    scopeLabel: String(this.selectionModalModel?.scopeLabel || ""),
    items: Array.isArray(this.selectionModalModel?.items)
      ? this.selectionModalModel.items.map((item) => String(item || ""))
      : [],
    indexHints: Array.isArray(this.selectionModalModel?.indexHints)
      ? this.selectionModalModel.indexHints.map((item) => String(item || ""))
      : [],
    selectedIndex: Number.isFinite(this.selectionModalModel?.selectedIndex)
      ? Math.max(0, Math.floor(this.selectionModalModel.selectedIndex))
      : -1,
    footerLeft: String(this.selectionModalModel?.footerLeft || ""),
    footerRight: String(this.selectionModalModel?.footerRight || ""),
  };

  pushShellPatch(
    this.selectionModalView.webContents,
    `
      (function updateSelectionModal() {
        const titleNode = document.getElementById('selection-modal-title');
        const promptNode = document.getElementById('selection-modal-prompt');
        const urlNode = document.getElementById('selection-modal-url');
        const scopeNode = document.getElementById('selection-modal-scope');
        const contentNode = document.getElementById('selection-modal-content');
        const footerNode = document.getElementById('selection-modal-footer');
        if (!titleNode || !promptNode || !urlNode || !scopeNode || !contentNode || !footerNode) return;

        const escapeHtml = (value) => String(value)
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#39;');

        const model = ${JSON.stringify(safeModel)};
        titleNode.textContent = model.title;
        promptNode.textContent = model.promptTitle;
        urlNode.textContent = model.urlLine;
        scopeNode.textContent = model.scopeLabel;
        const items = Array.isArray(model.items) ? model.items : [];
        const indexHints = Array.isArray(model.indexHints) ? model.indexHints : [];

        if (!items.length) {
          contentNode.innerHTML = '<div class="selection-modal-empty">no options</div>';
        } else {
          const maxLen = Math.max(items.length, indexHints.length);
          const columns = [];
          const selectedIndex = Number.isFinite(model.selectedIndex) ? model.selectedIndex : -1;
          for (let i = 0; i < maxLen; i += 1) {
            const item = escapeHtml(items[i] || '');
            const hint = escapeHtml(indexHints[i] || '');
            const selectedClass = i === selectedIndex ? ' selected' : '';
            columns.push('<span class="selection-modal-col"><span class="selection-modal-item' + selectedClass + '" data-click-role="selection-option" data-index="' + i + '">' + item + '</span><span class="selection-modal-index">' + hint + '</span></span>');
          }
          contentNode.innerHTML = '<div class="selection-modal-grid">' + columns.join('') + '</div>';
        }

        footerNode.innerHTML = '<span>' + escapeHtml(model.footerLeft) + '</span><span>' + escapeHtml(model.footerRight) + '</span>';
      })();
    `,
  );

  this.relayout();
}

function isTelescopeVisible() {
  return this.telescopeVisible;
}

function showTelescope(model) {
  this.telescopeVisible = true;
  this.telescopeModel = model || null;
  this.syncOverlayStack();
  this.updateTelescope(this.telescopeModel);
}

function hideTelescope() {
  this.telescopeVisible = false;
  this.telescopeModel = null;
  this.relayout();
}

function updateTelescope(model) {
  this.telescopeModel = model || this.telescopeModel || null;
  if (!this.telescopeVisible) return;
  if (!this.telescopeView || !this.telescopeReady) return;

  const safeModel = {
    title: String(this.telescopeModel?.title || "Find"),
    query: String(this.telescopeModel?.query || ""),
    counter: String(this.telescopeModel?.counter || "0 / 0"),
    promptPosition: String(this.telescopeModel?.promptPosition || "top"),
    items: Array.isArray(this.telescopeModel?.items)
      ? this.telescopeModel.items.map((item) => ({
          primary: String(item?.primary || ""),
          rightText: String(item?.rightText || ""),
          selected: Boolean(item?.selected),
        }))
      : [],
  };

  pushShellPatch(
    this.telescopeView.webContents,
    `
      (function updateTelescope() {
        const titleNode = document.getElementById('telescope-prompt-title');
        const queryNode = document.getElementById('telescope-query');
        const counterNode = document.getElementById('telescope-counter');
        const listNode = document.getElementById('telescope-list');
        if (!titleNode || !queryNode || !counterNode || !listNode) return;
        const escapeHtml = (value) => String(value)
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#39;');
        const model = ${JSON.stringify(safeModel)};
        const root = document.getElementById('telescope-shell');
        titleNode.textContent = model.title;
        queryNode.textContent = model.query;
        counterNode.textContent = model.counter;
        if (root) root.style.flexDirection = model.promptPosition === 'bottom' ? 'column-reverse' : 'column';
        if (!Array.isArray(model.items) || model.items.length === 0) {
          listNode.innerHTML = '<div class="telescope-empty">No match</div>';
          return;
        }
        listNode.innerHTML = model.items.map((item, index) => {
          const selected = item.selected ? ' selected' : '';
          return '<div class="telescope-row' + selected + '" data-click-role="telescope-row" data-index="' + index + '">' +
            '<span class="telescope-cursor"></span>' +
            '<span class="telescope-primary">' + escapeHtml(item.primary) + '</span>' +
            '<span class="telescope-right">' + escapeHtml(item.rightText) + '</span>' +
          '</div>';
        }).join('');
        const active = listNode.querySelector('.telescope-row.selected');
        if (active && typeof active.scrollIntoView === 'function') {
          active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
      })();
    `,
  );

  this.relayout();
}

async function resolveOverlayClickTarget(view, x, y, selector) {
  if (!view || !view.webContents || view.webContents.isDestroyed()) return null;
  try {
    return await view.webContents.executeJavaScript(
      `(() => {
        const node = document.elementFromPoint(${JSON.stringify(x)}, ${JSON.stringify(y)});
        if (!node) return null;
        const target = node.closest(${JSON.stringify(selector)});
        if (!target) return null;
        return {
          role: String(target.getAttribute('data-click-role') || ''),
          index: Number.parseInt(String(target.getAttribute('data-index') || '-1'), 10),
          id: target.id ? String(target.id) : '',
        };
      })();`,
    );
  } catch (_error) {
    return null;
  }
}

async function handleSelectionModalMouseEvent(input) {
  if (!this.selectionModalVisible || !input || input.type !== "mouseDown") return;
  if (input.button !== "left") return;
  const target = await resolveOverlayClickTarget(
    this.selectionModalView,
    input.x,
    input.y,
    '[data-click-role="selection-option"], #selection-modal',
  );
  if (!target) {
    if (typeof this.mouseActions?.dismissSelectionModal === "function") {
      this.mouseActions.dismissSelectionModal();
    } else {
      this.hideSelectionModal();
    }
    return;
  }
  if (!target || target.role !== "selection-option") return;
  if (typeof this.mouseActions?.selectBookmarkModalIndex === "function") {
    this.mouseActions.selectBookmarkModalIndex(target.index);
  }
}

async function handleTelescopeMouseEvent(input) {
  if (!this.telescopeVisible || !input) return;
  if (input.type === "mouseDown" && input.button === "left") {
    const target = await resolveOverlayClickTarget(
      this.telescopeView,
      input.x,
      input.y,
      '[data-click-role="telescope-row"], #telescope-prompt, #telescope-shell',
    );
    if (!target) {
      if (typeof this.mouseActions?.dismissTelescope === "function") {
        this.mouseActions.dismissTelescope();
      } else {
        this.hideTelescope();
      }
      return;
    }
    if (target.role === "telescope-row") {
      if (typeof this.mouseActions?.openTelescopeIndex === "function") {
        this.mouseActions.openTelescopeIndex(target.index);
      }
      return;
    }
    if (target.id === "telescope-prompt") {
      if (typeof this.mouseActions?.focusTelescopePrompt === "function") {
        this.mouseActions.focusTelescopePrompt();
      }
    }
  }
}

function computeSelectionModalHeight(model = null) {
  const activeModel = model || this.selectionModalModel || {};
  const hasPrompt = Boolean(String(activeModel.promptTitle || "").trim());
  const hasUrl = Boolean(String(activeModel.urlLine || "").trim());
  const hasScope = Boolean(String(activeModel.scopeLabel || "").trim());
  const hasFooter = Boolean(
    String(activeModel.footerLeft || "").trim() ||
    String(activeModel.footerRight || "").trim(),
  );
  const itemCount = Array.isArray(activeModel.items)
    ? activeModel.items.length
    : 0;
  const base = 38;
  const prompt = hasPrompt ? 16 : 0;
  const url = hasUrl ? 14 : 0;
  const scope = hasScope ? 14 : 0;
  const content = itemCount > 0 ? 38 : 22;
  const footer = hasFooter ? 14 : 0;
  const total = base + prompt + url + scope + content + footer;
  return Math.max(108, Math.min(210, total));
}

function updateStatuslineMode(mode) {
  this.statuslineMode = String(mode || "NORMAL");
  if (!this.statuslineView || !this.statuslineReady) return;
  pushShellPatch(
    this.statuslineView.webContents,
    `
      (function updateStatuslineMode() {
        const node = document.getElementById('statusline-mode-label');
        if (!node) return;
        node.textContent = ${JSON.stringify(this.statuslineMode)};
      })();
    `,
  );
}

function updateStatuslineScroll(percent) {
  const normalized = Number.isFinite(percent)
    ? Math.max(0, Math.min(100, percent))
    : 0;
  this.statuslineScroll = Math.round(normalized);
  if (!this.statuslineView || !this.statuslineReady) return;
  pushShellPatch(
    this.statuslineView.webContents,
    `
      (function updateStatuslineScroll() {
        const node = document.getElementById('statusline-scroll');
        if (!node) return;
        node.textContent = ${JSON.stringify(`${this.statuslineScroll}%`)};
      })();
    `,
  );
}

function isDownloadsModalVisible() {
  return this.downloadsModalVisible;
}

function showDownloadsModal(model) {
  this.downloadsModalVisible = true;
  this.downloadsModalModel = model || null;
  this.syncOverlayStack();
  this.updateDownloadsModal(this.downloadsModalModel);
}

function hideDownloadsModal() {
  this.downloadsModalVisible = false;
  this.downloadsModalModel = null;
  this.relayout();
}

function updateDownloadsModal(model) {
  this.downloadsModalModel = model || this.downloadsModalModel || null;
  if (!this.downloadsModalVisible) return;
  if (!this.downloadsModalView || !this.downloadsModalReady) return;

  const safeModel = {
    title: String(this.downloadsModalModel?.title || "Live Downloads"),
    items: Array.isArray(this.downloadsModalModel?.items)
      ? this.downloadsModalModel.items.map((item) => ({
          glyph: String(item?.glyph || ""),
          filename: String(item?.filename || ""),
          bar: String(item?.bar || ""),
          rightText: String(item?.rightText || ""),
          selected: Boolean(item?.selected),
        }))
      : [],
    footerLeft: String(this.downloadsModalModel?.footerLeft || ""),
    footerRight: String(this.downloadsModalModel?.footerRight || ""),
  };

  pushShellPatch(
    this.downloadsModalView.webContents,
    `
      (function updateDownloadsModal() {
        const titleNode = document.getElementById('downloads-modal-title');
        const listNode = document.getElementById('downloads-modal-list');
        const footerNode = document.getElementById('downloads-modal-footer');
        if (!titleNode || !listNode || !footerNode) return;

        const escapeHtml = (value) => String(value)
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#39;');

        const model = ${JSON.stringify(safeModel)};
        titleNode.textContent = model.title;

        if (!model.items.length) {
          listNode.innerHTML = '<div class="downloads-modal-empty">no downloads</div>';
        } else {
          listNode.innerHTML = model.items.map((item, index) => {
            const selected = item.selected ? ' selected' : '';
            return '<div class="downloads-modal-row' + selected + '" data-click-role="downloads-row" data-index="' + index + '">' +
              '<span class="downloads-modal-glyph">' + escapeHtml(item.glyph) + '</span>' +
              '<span class="downloads-modal-filename">' + escapeHtml(item.filename) + '</span>' +
              '<span class="downloads-modal-bar">' + escapeHtml(item.bar) + '</span>' +
              '<span class="downloads-modal-right">' + escapeHtml(item.rightText) + '</span>' +
            '</div>';
          }).join('');
        }

        footerNode.innerHTML = '<span>' + escapeHtml(model.footerLeft) + '</span><span>' + escapeHtml(model.footerRight) + '</span>';
      })();
    `,
  );

  this.relayout();
}

function computeDownloadsModalHeight(model = null) {
  const activeModel = model || this.downloadsModalModel || {};
  const itemCount = Array.isArray(activeModel.items) ? activeModel.items.length : 0;
  const base = 38;
  const content = itemCount > 0 ? itemCount * 28 + 8 : 22;
  const footer = 14;
  const total = base + content + footer;
  return Math.max(108, Math.min(520, total));
}

async function handleDownloadsModalMouseEvent(input) {
  if (!this.downloadsModalVisible || !input || input.type !== "mouseDown") return;
  if (input.button !== "left") return;
  const target = await resolveOverlayClickTarget(
    this.downloadsModalView,
    input.x,
    input.y,
    '[data-click-role="downloads-row"]',
  );
  if (!target || target.role !== "downloads-row") return;
  const clickCount = Number.isFinite(input.clickCount)
    ? input.clickCount
    : Number.isFinite(input.clicks)
      ? input.clicks
      : 1;
  if (typeof this.mouseActions?.clickDownloadsModalIndex === "function") {
    this.mouseActions.clickDownloadsModalIndex(target.index, clickCount);
  }
}

function updateStatuslineSplitIndicator(splitStatus = {}) {
  const enabledRegularSplit = Boolean(
    splitStatus.enabled && splitStatus.mode === "regular",
  );
  const focusedPane = splitStatus.focusedPane === "right" ? "right" : "left";
  this.statuslineSplitIndicator = { visible: enabledRegularSplit, focusedPane };
  if (!this.statuslineView || !this.statuslineReady) return;

  pushShellPatch(
    this.statuslineView.webContents,
    `
      (function updateStatuslineSplitIndicator() {
        const root = document.getElementById('statusline-split');
        const left = document.getElementById('statusline-split-left');
        const right = document.getElementById('statusline-split-right');
        if (!root || !left || !right) return;
        const visible = ${JSON.stringify(this.statuslineSplitIndicator.visible)};
        const focusedPane = ${JSON.stringify(this.statuslineSplitIndicator.focusedPane)};
        const focusedColor = ${JSON.stringify(this.currentTheme.mainColor)};
        const mutedColor = ${JSON.stringify(this.currentTheme.mutedTextColor)};
        root.style.display = visible ? 'inline-flex' : 'none';
        if (!visible) {
          left.style.color = mutedColor;
          right.style.color = mutedColor;
          return;
        }
        left.style.color = focusedPane === 'left' ? focusedColor : mutedColor;
        right.style.color = focusedPane === 'right' ? focusedColor : mutedColor;
      })();
    `,
  );
}

module.exports = {
  showNotificationToast,
  flushPendingToasts,
  isSelectionModalVisible,
  showSelectionModal,
  hideSelectionModal,
  updateSelectionModal,
  handleSelectionModalMouseEvent,
  isTelescopeVisible,
  showTelescope,
  hideTelescope,
  updateTelescope,
  handleTelescopeMouseEvent,
  computeSelectionModalHeight,
  isDownloadsModalVisible,
  showDownloadsModal,
  hideDownloadsModal,
  updateDownloadsModal,
  computeDownloadsModalHeight,
  handleDownloadsModalMouseEvent,
  updateStatuslineMode,
  updateStatuslineScroll,
  updateStatuslineSplitIndicator,
};
