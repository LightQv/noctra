const { pushShellPatch } = require("../../../core/adapters/renderer/shellPatchTransport");

function buildMenuHtml(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return "";
  }

  const rows = items.map((item, index) => {
    if (item.type === "separator") {
      return '<div class="menu-separator"></div>';
    }
    const disabledClass = item.enabled === false ? " disabled" : "";
    const label = String(item.label || "").replace(/[<>&]/g, (c) =>
      c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;",
    );
    return `<div class="menu-row${disabledClass}" data-click-role="menu-item" data-index="${index}"><span class="menu-cursor"></span><span class="menu-label">${label}</span></div>`;
  });

  return rows.join("");
}

function computeMenuDimensions(items) {
  const rowHeight = 20;
  const padding = 8; // 4px top + 4px bottom
  const separatorHeight = 9; // 1px line + 4px margin top + 4px margin bottom
  let height = padding;
  let maxLabelWidth = 0;

  for (const item of items) {
    if (item.type === "separator") {
      height += separatorHeight;
    } else {
      height += rowHeight;
      const labelWidth =
        (String(item.label || "").length || 0) * 7.4 + 42;
      if (labelWidth > maxLabelWidth) {
        maxLabelWidth = labelWidth;
      }
    }
  }

  const width = Math.min(Math.max(Math.ceil(maxLabelWidth), 160), 520);
  return { width, height };
}

function clampMenuPosition(x, y, width, height, bounds, chrome) {
  const tablineHeight = (chrome && chrome.UI_SHELL_TABLINE_HEIGHT) || 32;
  const statuslineHeight =
    (chrome && chrome.UI_SHELL_STATUSLINE_HEIGHT) || 30;

  const minX = 0;
  const minY = tablineHeight;
  const maxX = Math.max(bounds.width - width, 0);
  const maxY = Math.max(bounds.height - statuslineHeight - height, minY);

  return {
    x: Math.max(minX, Math.min(x, maxX)),
    y: Math.max(minY, Math.min(y, maxY)),
  };
}

function showContextMenu(items, x, y) {
  if (!this.window || this.window.isDestroyed()) return;

  this.contextMenuItems = Array.isArray(items) ? items.slice() : [];
  this.contextMenuVisible = true;

  const { width, height } = computeMenuDimensions(this.contextMenuItems);
  const bounds = this.window.getContentBounds();
  const chrome = {
    UI_SHELL_TABLINE_HEIGHT: require("../../constants").UI_SHELL_TABLINE_HEIGHT,
    UI_SHELL_STATUSLINE_HEIGHT:
      require("../../constants").UI_SHELL_STATUSLINE_HEIGHT,
  };
  const pos = clampMenuPosition(x, y, width, height, bounds, chrome);

  this.contextMenuBounds = { x: pos.x, y: pos.y, width, height };

  if (this.contextMenuOverlayView && this.contextMenuOverlayReady) {
    const html = buildMenuHtml(this.contextMenuItems);
    const maxHeight = Math.max(bounds.height - 8, 100);
    const menuStyle = `left:${pos.x}px;top:${pos.y}px;width:${width}px;max-height:${maxHeight}px;`;
    pushShellPatch(
      this.contextMenuOverlayView.webContents,
      `
        (function updateContextMenu() {
          const root = document.getElementById('menu-root');
          if (!root) return;
          root.style.cssText = 'display:block;position:absolute;${menuStyle}';
          root.innerHTML = ${JSON.stringify(html)};
        })();
      `,
    );
  }

  this.syncOverlayStack();
}

function hideContextMenu() {
  if (!this.contextMenuVisible) return;
  this.contextMenuVisible = false;
  this.contextMenuItems = [];
  this.contextMenuBounds = null;

  if (this.contextMenuOverlayView && this.contextMenuOverlayReady) {
    pushShellPatch(
      this.contextMenuOverlayView.webContents,
      `
        (function hideContextMenu() {
          const root = document.getElementById('menu-root');
          if (root) root.style.display = 'none';
        })();
      `,
    );
  }

  this.syncOverlayStack();

  if (typeof this.mouseActions?.dismissContextMenu === "function") {
    this.mouseActions.dismissContextMenu();
  }
}

async function handleContextMenuMouseEvent(input, event) {
  if (!this.contextMenuVisible || !input) return;

  // Right-click anywhere dismisses the menu and lets the event pass
  // through to the underlying view so it can open a new context menu.
  if (input.button === "right") {
    this.hideContextMenu();
    return;
  }

  // Only handle left clicks
  if (input.button !== "left") return;

  // Prevent the click from reaching underlying views
  if (event && typeof event.preventDefault === "function") {
    event.preventDefault();
  }

  if (!this.contextMenuOverlayView || !this.contextMenuOverlayView.webContents)
    return;

  try {
    const target = await this.contextMenuOverlayView.webContents.executeJavaScript(
      `(() => {
        const node = document.elementFromPoint(${JSON.stringify(input.x)}, ${JSON.stringify(input.y)});
        if (!node) return null;
        const target = node.closest('[data-click-role="menu-item"]');
        if (!target) return null;
        return {
          role: String(target.getAttribute('data-click-role') || ''),
          index: Number.parseInt(String(target.getAttribute('data-index') || '-1'), 10),
        };
      })();`,
    );

    if (target && target.role === "menu-item" && target.index >= 0) {
      const item = this.contextMenuItems[target.index];
      if (item && item.enabled !== false && typeof item.click === "function") {
        item.click();
      }
    }
  } catch {
    // ignore
  }

  this.hideContextMenu();
}

module.exports = {
  showContextMenu,
  hideContextMenu,
  handleContextMenuMouseEvent,
};
