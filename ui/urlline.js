const { UI_SHELL_URLLINE_HEIGHT, UI_FONT_FAMILY } = require("./constants");
const { DEFAULT_THEME } = require("./theme");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderShortcut(label) {
  if (typeof label !== "string" || !label.trim()) {
    return "";
  }
  return ` (${label.trim()})`;
}

function buildActionButtonMarkup(actionId, pane, actionConfig, disabled = false) {
  const label =
    typeof actionConfig?.label === "string" && actionConfig.label.trim().length > 0
      ? actionConfig.label.trim()
      : actionId;
  const icon =
    typeof actionConfig?.icon === "string" && actionConfig.icon.trim().length > 0
      ? actionConfig.icon.trim()
      : "?";
  const shortcut = renderShortcut(actionConfig?.shortcutLabel);
  const disabledAttr = disabled ? " disabled" : "";

  return `<button class="urlline-btn" type="button" data-urlline-action="${escapeHtml(actionId)}" data-pane="${escapeHtml(pane)}" title="${escapeHtml(
    `${label}${shortcut}`,
  )}" aria-label="${escapeHtml(label)}"${disabledAttr}><span class="urlline-btn-icon">${escapeHtml(icon)}</span></button>`;
}

function buildPaneMarkup(paneModel, actions, editingModel) {
  const pane = paneModel?.pane === "right" ? "right" : "left";
  const canGoBack = Boolean(paneModel?.canGoBack);
  const canGoForward = Boolean(paneModel?.canGoForward);
  const rawUrl = typeof paneModel?.url === "string" && paneModel.url.trim() ? paneModel.url : "about:blank";
  const escapedUrl = escapeHtml(rawUrl);
  const isEditing = Boolean(editingModel?.active && editingModel.pane === pane);

  const backBtn = buildActionButtonMarkup("back", pane, actions?.back, !canGoBack);
  const forwardBtn = buildActionButtonMarkup("forward", pane, actions?.forward, !canGoForward);
  const reloadBtn = buildActionButtonMarkup("reload", pane, actions?.reload, false);

  let urlMarkup = `<button class="urlline-url" type="button" data-urlline-action="start-edit" data-pane="${escapeHtml(
    pane,
  )}" title="${escapedUrl}" aria-label="Edit URL"><span class="urlline-url-text">${escapedUrl}</span></button>`;

  if (isEditing) {
    const text = String(editingModel.text || "");
    const maxCursor = text.length;
    const cursor = Number.isFinite(editingModel.cursorIndex)
      ? Math.max(0, Math.min(Math.trunc(editingModel.cursorIndex), maxCursor))
      : maxCursor;
    const before = escapeHtml(text.slice(0, cursor));
    const after = escapeHtml(text.slice(cursor));
    const cursorClass = cursor < text.length ? "cursor-bar" : "cursor-block";

    urlMarkup = `<button class="urlline-url is-editing" type="button" data-urlline-action="start-edit" data-pane="${escapeHtml(
      pane,
    )}" title="${escapedUrl}" aria-label="Editing URL"><span class="urlline-edit-content"><span class="urlline-text-before">${before}</span><span class="urlline-cursor ${cursorClass}" aria-hidden="true"></span><span class="urlline-text-after">${after}</span></span></button>`;
  }

  const x = Number.isFinite(paneModel?.x) ? Math.max(0, Math.floor(paneModel.x)) : 0;
  const width = Number.isFinite(paneModel?.width) ? Math.max(1, Math.floor(paneModel.width)) : 1;
  const top = Number.isFinite(paneModel?.top) ? Math.max(0, Math.floor(paneModel.top)) : 0;

  return `<div class="ui-shell-urlline-pane" data-pane="${escapeHtml(pane)}" style="left:${x}px;top:${top}px;width:${width}px;height:${UI_SHELL_URLLINE_HEIGHT}px;"><div class="urlline-inner">${backBtn}${forwardBtn}${reloadBtn}${urlMarkup}</div></div>`;
}

function renderUrlline(webContents, model = {}, actions = {}, theme = {}) {
  if (!webContents || webContents.isDestroyed()) return;

  const palette = {
    panelBackground: theme.panelBackground || DEFAULT_THEME.panelBackground,
    borderColor: theme.borderColor || DEFAULT_THEME.borderColor,
    borderStrongColor: theme.borderStrongColor || DEFAULT_THEME.borderStrongColor,
    elevatedBackground: theme.elevatedBackground || DEFAULT_THEME.elevatedBackground,
    textColor: theme.textColor || DEFAULT_THEME.textColor,
    mutedTextColor: theme.mutedTextColor || DEFAULT_THEME.mutedTextColor,
    mainColor: theme.mainColor || DEFAULT_THEME.mainColor,
    fontFamily: theme.fontFamily || DEFAULT_THEME.fontFamily || UI_FONT_FAMILY,
  };

  const paneModels = Array.isArray(model?.panes) ? model.panes : [];
  const editingModel = model?.editing && typeof model.editing === "object" ? model.editing : null;
  const panesMarkup = paneModels
    .map((paneModel) => buildPaneMarkup(paneModel, actions, editingModel))
    .join("");

  webContents
    .executeJavaScript(`
      (function renderUiShellUrlline() {
        let root = document.getElementById('__ui_shell_urlline__');

        if (!root) {
          root = document.createElement('div');
          root.id = '__ui_shell_urlline__';
          document.documentElement.appendChild(root);
        }

        if (!root.dataset.boundClick) {
          root.addEventListener('click', (event) => {
            const target = event.target;
            if (!(target instanceof Element)) return;
            const node = target.closest('[data-urlline-action]');
            if (!node) return;

            const action = node.getAttribute('data-urlline-action');
            const pane = node.getAttribute('data-pane') || 'left';

            if (!action || !window.uiShell || typeof window.uiShell.emit !== 'function') {
              return;
            }

            if (action === 'start-edit') {
              window.uiShell.emit('urlline:start-edit', { pane });
              return;
            }

            if (node instanceof HTMLButtonElement && node.disabled) {
              return;
            }

            window.uiShell.emit('urlline:action', { pane, action });
          });
          root.dataset.boundClick = 'true';
        }

        root.innerHTML = ${JSON.stringify(panesMarkup)};

        Object.assign(root.style, {
          position: 'fixed',
          top: '0',
          left: '0',
          right: '0',
          bottom: '0',
          pointerEvents: 'none',
          zIndex: '999997',
          fontFamily: ${JSON.stringify(palette.fontFamily)},
        });

        root.querySelectorAll('.ui-shell-urlline-pane').forEach((pane) => {
          Object.assign(pane.style, {
            position: 'fixed',
            boxSizing: 'border-box',
            pointerEvents: 'none',
          });
        });

        root.querySelectorAll('.urlline-inner').forEach((inner) => {
          Object.assign(inner.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            height: '100%',
            padding: '8px 12px',
            boxSizing: 'border-box',
            borderBottom: ${JSON.stringify(`1px solid ${palette.borderStrongColor}`)},
            background: ${JSON.stringify(palette.panelBackground)},
            pointerEvents: 'auto',
          });
        });

        root.querySelectorAll('.urlline-btn').forEach((button) => {
          Object.assign(button.style, {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            borderRadius: '4px',
            border: ${JSON.stringify(`1px solid ${palette.borderColor}`)},
            background: ${JSON.stringify(palette.elevatedBackground)},
            color: ${JSON.stringify(palette.textColor)},
            cursor: 'pointer',
            padding: '0',
            margin: '0',
            fontFamily: 'inherit',
            lineHeight: '1',
          });

          if (button.disabled) {
            button.style.opacity = '0.45';
            button.style.cursor = 'default';
          }
        });

        root.querySelectorAll('.urlline-btn-icon').forEach((icon) => {
          Object.assign(icon.style, {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '15px',
            lineHeight: '1',
          });
        });

        root.querySelectorAll('.urlline-url').forEach((node) => {
          Object.assign(node.style, {
            flex: '1',
            minWidth: '0',
            height: '24px',
            border: ${JSON.stringify(`1px solid ${palette.borderColor}`)},
            borderRadius: '4px',
            background: ${JSON.stringify(palette.elevatedBackground)},
            color: ${JSON.stringify(palette.textColor)},
            textAlign: 'left',
            padding: '0 8px',
            margin: '0',
            cursor: 'text',
            display: 'inline-flex',
            alignItems: 'center',
            overflow: 'hidden',
            fontFamily: 'inherit',
            fontSize: '12px',
            lineHeight: '1',
          });
        });

        root.querySelectorAll('.urlline-url-text').forEach((textNode) => {
          Object.assign(textNode.style, {
            display: 'inline-block',
            minWidth: '0',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            width: '100%',
            color: ${JSON.stringify(palette.mutedTextColor)},
          });
        });

        root.querySelectorAll('.urlline-url.is-editing').forEach((node) => {
          node.style.border = ${JSON.stringify(`1px solid ${palette.mainColor}`)};
        });

        root.querySelectorAll('.urlline-edit-content').forEach((node) => {
          Object.assign(node.style, {
            display: 'inline-flex',
            alignItems: 'center',
            minWidth: '0',
            overflow: 'hidden',
            whiteSpace: 'pre',
            width: '100%',
            color: ${JSON.stringify(palette.textColor)},
          });
        });

        root.querySelectorAll('.urlline-text-before, .urlline-text-after').forEach((node) => {
          Object.assign(node.style, {
            minWidth: '0',
            overflow: 'hidden',
            whiteSpace: 'pre',
            lineHeight: '1',
          });
        });

        root.querySelectorAll('.urlline-cursor').forEach((cursor) => {
          Object.assign(cursor.style, {
            background: ${JSON.stringify(palette.mainColor)},
            borderRadius: '1px',
            flex: '0 0 auto',
            height: '1.2em',
            transform: 'translateY(-1px)',
          });

          if (cursor.classList.contains('cursor-bar')) {
            cursor.style.width = '1px';
          } else {
            cursor.style.width = '0.56em';
          }
        });
      })();
    `)
    .catch(() => {});
}

module.exports = {
  renderUrlline,
};
