const {
  UI_SHELL_TABLINE_HEIGHT,
  UI_MAIN_COLOR,
  UI_SECONDARY_ACTIVE_TEXT_COLOR,
  UI_MUTED_TEXT_COLOR,
  UI_BORDER_COLOR,
  UI_SURFACE_COLOR,
  UI_ACCENT_PILL_BG,
  UI_ACCENT_PILL_BORDER,
  UI_FONT_FAMILY,
} = require("./constants");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderTabline(webContents, snapshot, chrome = {}, actions = {}) {
  if (!webContents || webContents.isDestroyed()) return;

  const platform = chrome.platform || process.platform;
  const useNativeControls = Boolean(chrome.useNativeControls);
  const isMaximized = Boolean(chrome.isMaximized);
  const isFullScreen = Boolean(chrome.isFullScreen);

  const tabsMarkup = snapshot
    .map((buffer) => {
      const title = escapeHtml(buffer.title || buffer.url || "[No title]");
      const classes = ["tab"];
      if (buffer.isFocusedPaneBuffer || buffer.isActive) {
        classes.push("is-active");
      }

      if (buffer.isOtherPaneBuffer) {
        classes.push("is-secondary-active");
      }

      return `<span class="${classes.join(" ")}" data-tab-id="${buffer.id}" title="${title}"><span class="tab-label">${buffer.id}: ${title}</span><button class="tab-close" data-tab-id="${buffer.id}" type="button" aria-label="Close buffer ${buffer.id}">󰅖</button></span>`;
    })
    .join("");

  const showCustomControls = !useNativeControls && !isFullScreen;
  const maximizeLabel = isMaximized ? "Restore" : "Maximize";
  const maximizeIcon = isMaximized ? "[]" : "[ ]";
  const settingsLabel =
    typeof actions?.settings?.label === "string" && actions.settings.label.trim().length > 0
      ? actions.settings.label
      : "Settings";
  const settingsIcon =
    typeof actions?.settings?.icon === "string" && actions.settings.icon.trim().length > 0
      ? actions.settings.icon
      : "[S]";
  const settingsShortcut =
    typeof actions?.settings?.shortcutLabel === "string" &&
    actions.settings.shortcutLabel.trim().length > 0
      ? actions.settings.shortcutLabel
      : "Cmd+, | Ctrl+,";

  const controlsMarkup = showCustomControls
    ? `<div class="window-controls"><button class="window-btn" data-window-action="minimize" type="button" aria-label="Minimize">-</button><button class="window-btn" data-window-action="toggleMaximize" type="button" aria-label="${maximizeLabel}">${maximizeIcon}</button><button class="window-btn is-close" data-window-action="close" type="button" aria-label="Close">X</button></div>`
    : `<div class="window-controls native-spacer" aria-hidden="true"></div>`;

  const rightActionsMarkup = `<div class="tabline-actions"><button class="tabline-action-btn" type="button" data-tabline-action="open-settings" title="${escapeHtml(
    `${settingsLabel} (${settingsShortcut})`,
  )}" aria-label="Open settings"><span class="tabline-action-icon">${escapeHtml(
    settingsIcon,
  )}</span><span class="tabline-action-label">${escapeHtml(settingsLabel)}</span></button></div>`;

  webContents.executeJavaScript(`
    (function renderUiShellTabline() {
      let root = document.getElementById('__ui_shell_tabline__');

      if (!root) {
        root = document.createElement('div');
        root.id = '__ui_shell_tabline__';
        document.documentElement.appendChild(root);
      }

      if (!root.dataset.boundClick) {
        root.addEventListener('click', (event) => {
          const target = event.target;
          if (!(target instanceof Element)) return;

          const actionButton = target.closest('[data-window-action]');

          if (actionButton) {
            const action = actionButton.getAttribute('data-window-action');
            if (action && window.uiShell && window.uiShell.emit) {
              window.uiShell.emit('window:action', { action });
            }
            return;
          }

          const tablineActionButton = target.closest('[data-tabline-action]');
          if (tablineActionButton) {
            const tablineAction = tablineActionButton.getAttribute('data-tabline-action');
            if (tablineAction === 'open-settings' && window.uiShell && window.uiShell.emit) {
              window.uiShell.emit('tabline:open-settings');
            }
            return;
          }

          const closeButton = target.closest('.tab-close');

          if (closeButton) {
            const closeId = Number.parseInt(closeButton.dataset.tabId, 10);
            if (Number.isInteger(closeId) && window.uiShell && window.uiShell.emit) {
              window.uiShell.emit('tab:close', { id: closeId });
            }
            return;
          }

          const tab = target.closest('.tab');
          if (!tab) return;

          const tabId = Number.parseInt(tab.dataset.tabId, 10);
          if (Number.isInteger(tabId) && window.uiShell && window.uiShell.emit) {
            window.uiShell.emit('tab:activate', { id: tabId });
          }
        });

        root.dataset.boundClick = 'true';
      }

      root.className = ${JSON.stringify(
        `ui-shell-topbar platform-${platform} ${showCustomControls ? "controls-custom" : "controls-native"}`,
      )};
      root.innerHTML = ${JSON.stringify(
        `${controlsMarkup}<div class="tabs-scroll">${tabsMarkup}</div>${rightActionsMarkup}`,
      )};

      Object.assign(root.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        height: '${UI_SHELL_TABLINE_HEIGHT}px',
        display: 'flex',
        alignItems: 'center',
        gap: '0',
        padding: '0',
        overflow: 'hidden',
        zIndex: '999998',
        background: ${JSON.stringify(UI_SURFACE_COLOR)},
        color: '#c8d1e8',
        borderBottom: ${JSON.stringify(`1px solid ${UI_BORDER_COLOR}`)},
        fontFamily: ${JSON.stringify(UI_FONT_FAMILY)},
        fontSize: '12px',
        lineHeight: '1',
        webkitAppRegion: 'drag',
      });

      const controls = root.querySelector('.window-controls');
      if (controls) {
        Object.assign(controls.style, {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          height: '100%',
          padding: '0 8px',
          flexShrink: '0',
          webkitAppRegion: 'no-drag',
        });
      }

      if (controls && controls.classList.contains('native-spacer')) {
        Object.assign(controls.style, {
          width: ${JSON.stringify(platform === "darwin" ? "84px" : "12px")},
          padding: '0',
          pointerEvents: 'none',
          webkitAppRegion: 'drag',
        });
      }

      const tabsScroll = root.querySelector('.tabs-scroll');
      if (tabsScroll) {
        Object.assign(tabsScroll.style, {
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '0 8px',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          minWidth: '0',
          flex: '1',
          height: '100%',
          webkitAppRegion: 'drag',
        });
      }

      const tablineActions = root.querySelector('.tabline-actions');
      if (tablineActions) {
        Object.assign(tablineActions.style, {
          display: 'inline-flex',
          alignItems: 'center',
          padding: '0 10px',
          height: '100%',
          flexShrink: '0',
          webkitAppRegion: 'no-drag',
        });
      }

      root.querySelectorAll('.tabline-action-btn').forEach((button) => {
        Object.assign(button.style, {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          border: '1px solid #2f3a4d',
          background: '#1a2230',
          color: '#d4def2',
          borderRadius: '6px',
          height: '24px',
          padding: '0 9px',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: '12px',
          lineHeight: '1',
          webkitAppRegion: 'no-drag',
        });
      });

      root.querySelectorAll('.tabline-action-icon').forEach((icon) => {
        Object.assign(icon.style, {
          display: 'inline-flex',
          alignItems: 'center',
          color: '#8ec5ff',
          fontSize: '13px',
          lineHeight: '1',
        });
      });

      root.querySelectorAll('.window-btn').forEach((button) => {
        Object.assign(button.style, {
          border: 'none',
          background: '#212734',
          color: '#d8e3f8',
          borderRadius: '4px',
          width: '28px',
          height: '22px',
          padding: '0',
          margin: '0',
          cursor: 'pointer',
          lineHeight: '1',
          fontSize: '12px',
          webkitAppRegion: 'no-drag',
        });
      });

      root.querySelectorAll('.window-btn.is-close').forEach((button) => {
        button.style.background = '#3a1f27';
        button.style.color = '#ffb4c2';
      });

      root.querySelectorAll('.tab').forEach((tab) => {
        Object.assign(tab.style, {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 8px',
          borderRadius: '4px',
          background: '#202633',
          color: ${JSON.stringify(UI_MUTED_TEXT_COLOR)},
          maxWidth: '320px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          cursor: 'pointer',
          webkitAppRegion: 'no-drag',
        });
      });

      root.querySelectorAll('.tab-label').forEach((label) => {
        Object.assign(label.style, {
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '260px',
        });
      });

      root.querySelectorAll('.tab-close').forEach((button) => {
        Object.assign(button.style, {
          border: 'none',
          background: 'transparent',
          color: ${JSON.stringify(UI_MUTED_TEXT_COLOR)},
          fontFamily: 'inherit',
          fontSize: '12px',
          lineHeight: '1',
          padding: '0',
          margin: '0',
          cursor: 'pointer',
          webkitAppRegion: 'no-drag',
        });
      });

      root.querySelectorAll('.is-active').forEach((tab) => {
        Object.assign(tab.style, {
          background: ${JSON.stringify(UI_ACCENT_PILL_BG)},
          border: ${JSON.stringify(`1px solid ${UI_ACCENT_PILL_BORDER}`)},
          color: ${JSON.stringify(UI_MAIN_COLOR)},
        });
      });

      root.querySelectorAll('.is-secondary-active').forEach((tab) => {
        tab.style.color = ${JSON.stringify(UI_SECONDARY_ACTIVE_TEXT_COLOR)};
      });

      root.querySelectorAll('.is-active .tab-close').forEach((button) => {
        button.style.color = ${JSON.stringify(UI_MAIN_COLOR)};
      });

      root.querySelectorAll('.is-secondary-active .tab-close').forEach((button) => {
        button.style.color = ${JSON.stringify(UI_SECONDARY_ACTIVE_TEXT_COLOR)};
      });

    })();
  `);
}

module.exports = { renderTabline };
