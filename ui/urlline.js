const {
  UI_SHELL_URLLINE_HEIGHT,
  UI_FONT_FAMILY,
  UI_CHROME_ICON_BUTTON_SIZE,
  UI_CHROME_BORDER_RADIUS,
  UI_CHROME_HORIZONTAL_PADDING,
  UI_CHROME_ICON_GLYPH_SIZE,
} = require("./constants");
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

function buildActionButtonMarkup(
  actionId,
  pane,
  actionConfig,
  disabled = false,
) {
  const label =
    typeof actionConfig?.label === "string" &&
    actionConfig.label.trim().length > 0
      ? actionConfig.label.trim()
      : actionId;
  const icon =
    typeof actionConfig?.icon === "string" &&
    actionConfig.icon.trim().length > 0
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
  const isLoading = Boolean(paneModel?.isLoading);
  const rawUrl =
    typeof paneModel?.url === "string" && paneModel.url.trim()
      ? paneModel.url
      : "about:blank";
  const escapedUrl = escapeHtml(rawUrl);
  const isEditing = Boolean(editingModel?.active && editingModel.pane === pane);

  const backBtn = buildActionButtonMarkup(
    "back",
    pane,
    actions?.back,
    !canGoBack,
  );
  const forwardBtn = buildActionButtonMarkup(
    "forward",
    pane,
    actions?.forward,
    !canGoForward,
  );
  const reloadBtn = isLoading
    ? buildActionButtonMarkup(
        "stop",
        pane,
        {
          label: "Stop loading",
          icon: "󰅖",
          shortcutLabel: "",
        },
        false,
      )
    : buildActionButtonMarkup("reload", pane, actions?.reload, false);

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

  const x = Number.isFinite(paneModel?.x)
    ? Math.max(0, Math.floor(paneModel.x))
    : 0;
  const width = Number.isFinite(paneModel?.width)
    ? Math.max(1, Math.floor(paneModel.width))
    : 1;
  const top = Number.isFinite(paneModel?.top)
    ? Math.max(0, Math.floor(paneModel.top))
    : 0;

  return `<div class="ui-shell-urlline-pane" data-pane="${escapeHtml(pane)}" style="left:${x}px;top:${top}px;width:${width}px;height:${UI_SHELL_URLLINE_HEIGHT}px;"><div class="urlline-inner">${backBtn}${forwardBtn}${reloadBtn}${urlMarkup}</div></div>`;
}

function buildLoadinglinePaneMarkup(paneModel) {
  const pane = paneModel?.pane === "right" ? "right" : "left";
  const isLoading = Boolean(paneModel?.isLoading);
  const loadingProgress =
    typeof paneModel?.loadingProgress === "number"
      ? Math.max(0, Math.min(1, paneModel.loadingProgress))
      : null;
  const loadingIndeterminate = Boolean(paneModel?.loadingIndeterminate);
  const x = Number.isFinite(paneModel?.x)
    ? Math.max(0, Math.floor(paneModel.x))
    : 0;
  const width = Number.isFinite(paneModel?.width)
    ? Math.max(1, Math.floor(paneModel.width))
    : 1;
  const top = Number.isFinite(paneModel?.top)
    ? Math.max(0, Math.floor(paneModel.top))
    : 0;

  return `<div class="ui-shell-loadingline" data-pane="${escapeHtml(
    pane,
  )}" data-loading="${isLoading ? "true" : "false"}" data-indeterminate="${
    isLoading && (loadingIndeterminate || loadingProgress === null)
      ? "true"
      : "false"
  }" data-progress="${
    loadingProgress === null ? "" : String(Math.round(loadingProgress * 1000) / 1000)
  }" style="left:${x}px;top:${top}px;width:${width}px;height:2px;"><span class="ui-shell-loadingline-bar"></span></div>`;
}

function renderUrlline(webContents, model = {}, actions = {}, theme = {}) {
  if (!webContents || webContents.isDestroyed()) return;

  const palette = {
    shellBackground: theme.shellBackground || DEFAULT_THEME.shellBackground,
    borderColor: theme.borderColor || DEFAULT_THEME.borderColor,
    borderStrongColor:
      theme.borderStrongColor || DEFAULT_THEME.borderStrongColor,
    elevatedBackground:
      theme.elevatedBackground || DEFAULT_THEME.elevatedBackground,
    textColor: theme.textColor || DEFAULT_THEME.textColor,
    mutedTextColor: theme.mutedTextColor || DEFAULT_THEME.mutedTextColor,
    mainColor: theme.mainColor || DEFAULT_THEME.mainColor,
    fontFamily: theme.fontFamily || DEFAULT_THEME.fontFamily || UI_FONT_FAMILY,
  };

  const paneModels = Array.isArray(model?.panes) ? model.panes : [];
  const editingModel =
    model?.editing && typeof model.editing === "object" ? model.editing : null;
  const panesMarkup = paneModels
    .map((paneModel) => buildPaneMarkup(paneModel, actions, editingModel))
    .join("");

  webContents
    .executeJavaScript(
      `
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
            if (node) {
              const action = node.getAttribute('data-urlline-action');
              const pane = node.getAttribute('data-pane') || 'left';

              if (!action || !window.uiShell) {
                return;
              }

              if (action === 'start-edit') {
                if (typeof window.uiShell.startUrllineEdit === 'function') {
                  window.uiShell.startUrllineEdit(pane);
                }
                return;
              }

              if (node instanceof HTMLButtonElement && node.disabled) {
                return;
              }

              if (typeof window.uiShell.urllineAction === 'function') {
                window.uiShell.urllineAction(pane, action);
              }
            } else {
              const inner = target.closest('.urlline-inner');
              if (inner && window.uiShell && typeof window.uiShell.stopUrllineEdit === 'function') {
                window.uiShell.stopUrllineEdit();
              }
            }
          });

          root.addEventListener('contextmenu', (event) => {
            const target = event.target;
            if (!(target instanceof Element)) return;
            event.preventDefault();

            const actionNode = target.closest('[data-urlline-action]');
            if (actionNode) {
              const action = actionNode.getAttribute('data-urlline-action');
              const pane = actionNode.getAttribute('data-pane') || 'left';

              if (action === 'start-edit') {
                if (window.uiShell && typeof window.uiShell.contextMenu === 'function') {
                  window.uiShell.contextMenu({
                    zone: 'urlline',
                    target: 'url',
                    pane,
                    x: event.clientX,
                    y: event.clientY,
                  });
                }
                return;
              }

              return;
            }

            const paneNode = target.closest('.ui-shell-urlline-pane');
            if (paneNode) {
              const pane = paneNode.getAttribute('data-pane') || 'left';
              if (window.uiShell && typeof window.uiShell.contextMenu === 'function') {
                window.uiShell.contextMenu({
                  zone: 'urlline',
                  target: 'background',
                  pane,
                  x: event.clientX,
                  y: event.clientY,
                });
              }
            }
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
            padding: '5px ${UI_CHROME_HORIZONTAL_PADDING}px',
            boxSizing: 'border-box',
            borderBottom: ${JSON.stringify(`1px solid ${palette.borderStrongColor}`)},
            background: ${JSON.stringify(palette.shellBackground)},
            pointerEvents: 'auto',
          });
        });

        root.querySelectorAll('.urlline-btn').forEach((button) => {
          Object.assign(button.style, {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '${UI_CHROME_ICON_BUTTON_SIZE}px',
            height: '${UI_CHROME_ICON_BUTTON_SIZE}px',
            borderRadius: '${UI_CHROME_BORDER_RADIUS}px',
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
            fontSize: '${UI_CHROME_ICON_GLYPH_SIZE}px',
            lineHeight: '1',
          });
        });

        root.querySelectorAll('.urlline-url').forEach((node) => {
          Object.assign(node.style, {
            flex: '1',
            minWidth: '0',
            height: '${UI_CHROME_ICON_BUTTON_SIZE}px',
            border: ${JSON.stringify(`1px solid ${palette.borderColor}`)},
            borderRadius: '${UI_CHROME_BORDER_RADIUS}px',
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
    `,
    )
    .catch(() => {});
}

function renderLoadingline(webContents, model = {}, theme = {}) {
  if (!webContents || webContents.isDestroyed()) return;

  const palette = {
    mainColor: theme.mainColor || DEFAULT_THEME.mainColor,
  };
  const paneModels = Array.isArray(model?.panes) ? model.panes : [];
  const panesMarkup = paneModels.map((paneModel) => buildLoadinglinePaneMarkup(paneModel)).join("");

  webContents
    .executeJavaScript(
      `
      (function renderUiShellLoadingline() {
        let root = document.getElementById('__ui_shell_loadingline__');
        if (!root) {
          root = document.createElement('div');
          root.id = '__ui_shell_loadingline__';
          document.documentElement.appendChild(root);
        }

        if (!document.getElementById('__ui_shell_loadingline_keyframes__')) {
          const keyframes = document.createElement('style');
          keyframes.id = '__ui_shell_loadingline_keyframes__';
          keyframes.textContent = '@keyframes ui-shell-loadingline-sweep {\\n  from { transform: translateX(-40%); }\\n  to { transform: translateX(260%); }\\n}';
          document.head.appendChild(keyframes);
        }

        root.innerHTML = ${JSON.stringify(panesMarkup)};

        Object.assign(root.style, {
          position: 'fixed',
          top: '0',
          left: '0',
          right: '0',
          bottom: '0',
          pointerEvents: 'none',
          zIndex: '999996',
        });

        root.querySelectorAll('.ui-shell-loadingline').forEach((line) => {
          const loading = line.getAttribute('data-loading') === 'true';
          const indeterminate = line.getAttribute('data-indeterminate') === 'true';
          const rawProgress = Number(line.getAttribute('data-progress'));
          const progress = Number.isFinite(rawProgress)
            ? Math.max(0, Math.min(1, rawProgress))
            : null;
          const bar = line.querySelector('.ui-shell-loadingline-bar');
          if (!(bar instanceof HTMLElement)) {
            return;
          }

          Object.assign(line.style, {
            position: 'fixed',
            pointerEvents: 'none',
            overflow: 'hidden',
            opacity: loading || progress === 1 ? '1' : '0',
            transition: 'opacity 180ms ease',
          });

          Object.assign(bar.style, {
            position: 'absolute',
            top: '0',
            left: '0',
            height: '100%',
            background: ${JSON.stringify(palette.mainColor)},
            boxShadow: ${JSON.stringify(`0 0 8px ${palette.mainColor}`)},
            transition: 'width 140ms ease, transform 220ms ease',
            willChange: 'width, transform',
          });

          if (!loading && progress !== 1) {
            bar.style.width = '0%';
            return;
          }

          if (indeterminate) {
            bar.style.width = '32%';
            bar.style.transform = 'translateX(-40%)';
            bar.style.animation = 'ui-shell-loadingline-sweep 900ms ease-out infinite';
            return;
          }

          const widthPct = progress === null ? 18 : Math.max(2, Math.min(100, Math.round(progress * 100)));
          bar.style.width = String(widthPct) + '%';
          bar.style.transform = 'translateX(0%)';
          bar.style.animation = 'none';

          if (progress === 1) {
            setTimeout(() => {
              if (line.isConnected) {
                line.style.opacity = '0';
              }
            }, 120);
          }
        });
      })();
    `,
    )
    .catch(() => {});
}

module.exports = {
  renderUrlline,
  renderLoadingline,
};
