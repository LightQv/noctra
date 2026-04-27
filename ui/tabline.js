const {
  UI_SHELL_TABLINE_HEIGHT,
  UI_FONT_FAMILY,
  UI_CHROME_ICON_BUTTON_SIZE,
  UI_CHROME_TAB_CHIP_HEIGHT,
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

function renderTabline(webContents, snapshot, chrome = {}, actions = {}, theme = {}, options = {}) {
  if (!webContents || webContents.isDestroyed()) return;

  const showFavicon = Boolean(options.showFavicon);

  const palette = {
    shellBackground: theme.shellBackground || DEFAULT_THEME.shellBackground,
    borderColor: theme.borderColor || DEFAULT_THEME.borderColor,
    textColor: theme.textColor || DEFAULT_THEME.textColor,
    mutedTextColor: theme.mutedTextColor || DEFAULT_THEME.mutedTextColor,
    elevatedBackground: theme.elevatedBackground || DEFAULT_THEME.elevatedBackground,
    borderMutedColor: theme.borderMutedColor || DEFAULT_THEME.borderMutedColor,
    softTextColor: theme.softTextColor || DEFAULT_THEME.softTextColor,
    accentIconColor: theme.accentIconColor || DEFAULT_THEME.accentIconColor,
    windowControlBackground: theme.windowControlBackground || DEFAULT_THEME.windowControlBackground,
    dangerBackground: theme.dangerBackground || DEFAULT_THEME.dangerBackground,
    dangerTextColor: theme.dangerTextColor || DEFAULT_THEME.dangerTextColor,
    subtleBackground: theme.subtleBackground || DEFAULT_THEME.subtleBackground,
    accentPillBackground: theme.accentPillBackground || DEFAULT_THEME.accentPillBackground,
    accentPillBorder: theme.accentPillBorder || DEFAULT_THEME.accentPillBorder,
    mainColor: theme.mainColor || DEFAULT_THEME.mainColor,
    secondaryActiveTextColor: theme.secondaryActiveTextColor || DEFAULT_THEME.secondaryActiveTextColor,
    fontFamily: theme.fontFamily || DEFAULT_THEME.fontFamily || UI_FONT_FAMILY,
  };

  const platform = chrome.platform || process.platform;
  const useNativeControls = Boolean(chrome.useNativeControls);
  const isMaximized = Boolean(chrome.isMaximized);
  const isFullScreen = Boolean(chrome.isFullScreen);

  const tabsMarkup = snapshot
    .map((buffer) => {
      const title = escapeHtml(buffer.title || buffer.url || "[No title]");
      const faviconUrl =
        typeof buffer.faviconUrl === "string" && buffer.faviconUrl.trim().length > 0
          ? buffer.faviconUrl.trim()
          : "";
      const faviconMarkup =
        showFavicon && faviconUrl
          ? `<span class="tab-favicon"><img class="tab-favicon-img" src="${escapeHtml(faviconUrl)}" alt="" referrerpolicy="no-referrer" onerror="if (this.parentElement) this.parentElement.style.display='none'; this.remove();"></span>`
          : "";
      const classes = ["tab"];
      if (buffer.isFocusedPaneBuffer || buffer.isActive) {
        classes.push("is-active");
      }

      if (buffer.isOtherPaneBuffer) {
        classes.push("is-secondary-active");
      }

      return `<span class="${classes.join(" ")}" data-tab-id="${buffer.id}" title="${title}"><span class="tab-label">${faviconMarkup}<span class="tab-label-text">${buffer.id}: ${title}</span></span><button class="tab-close" data-tab-id="${buffer.id}" type="button" aria-label="Close buffer ${buffer.id}">󰅖</button></span>`;
    })
    .join("");

  const showCustomControls = !useNativeControls && !isFullScreen;
  const maximizeLabel = isMaximized ? "Restore" : "Maximize";
  const maximizeIcon = isMaximized ? "[]" : "[ ]";
  const configLabel =
    typeof actions?.settings?.label === "string" && actions.settings.label.trim().length > 0
      ? actions.settings.label
      : "Config";
  const configIcon =
    typeof actions?.settings?.icon === "string" && actions.settings.icon.trim().length > 0
      ? actions.settings.icon
      : "󱁿";
  const configShortcut =
    typeof actions?.settings?.shortcutLabel === "string" &&
    actions.settings.shortcutLabel.trim().length > 0
      ? actions.settings.shortcutLabel
      : "Cmd+, | Ctrl+,";
  const newTabLabel =
    typeof actions?.newTab?.label === "string" && actions.newTab.label.trim().length > 0
      ? actions.newTab.label
      : "New buffer";
  const newTabIcon =
    typeof actions?.newTab?.icon === "string" && actions.newTab.icon.trim().length > 0
      ? actions.newTab.icon
      : "+";
  const newTabShortcut =
    typeof actions?.newTab?.shortcutLabel === "string" &&
    actions.newTab.shortcutLabel.trim().length > 0
      ? actions.newTab.shortcutLabel
      : "b | :tab | :tabnew";

  const controlsMarkup = showCustomControls
    ? `<div class="window-controls"><button class="window-btn" data-window-action="minimize" type="button" aria-label="Minimize">-</button><button class="window-btn" data-window-action="toggleMaximize" type="button" aria-label="${maximizeLabel}">${maximizeIcon}</button><button class="window-btn is-close" data-window-action="close" type="button" aria-label="Close">X</button></div>`
    : `<div class="window-controls native-spacer" aria-hidden="true"></div>`;

  const newTabMarkup = `<button class="tab tab-new" type="button" data-tabline-action="new-tab" title="${escapeHtml(
    `${newTabLabel} (${newTabShortcut})`,
  )}" aria-label="${escapeHtml(newTabLabel)}"><span class="tab-new-icon">${escapeHtml(newTabIcon)}</span></button>`;

  const rightActionsMarkup = `<div class="tabline-actions"><button class="tabline-action-btn" type="button" data-tabline-action="open-settings" title="${escapeHtml(
    `${configLabel} (${configShortcut})`,
  )}" aria-label="Open config"><span class="tabline-action-icon">${escapeHtml(
    configIcon,
  )}</span></button></div>`;

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
            if (tablineAction === 'new-tab' && window.uiShell && window.uiShell.emit) {
              window.uiShell.emit('tabline:new-tab');
              return;
            }
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
        `${controlsMarkup}<div class="tabs-scroll">${tabsMarkup}${newTabMarkup}</div>${rightActionsMarkup}`,
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
        background: ${JSON.stringify(palette.shellBackground)},
        color: ${JSON.stringify(palette.textColor)},
        borderBottom: ${JSON.stringify(`1px solid ${palette.borderColor}`)},
        fontFamily: ${JSON.stringify(palette.fontFamily)},
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
          padding: '0 ${UI_CHROME_HORIZONTAL_PADDING}px',
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
          padding: '0 ${UI_CHROME_HORIZONTAL_PADDING}px',
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
          padding: '0 ${UI_CHROME_HORIZONTAL_PADDING}px',
          height: '100%',
          flexShrink: '0',
          webkitAppRegion: 'no-drag',
        });
      }

      root.querySelectorAll('.tabline-action-btn').forEach((button) => {
        Object.assign(button.style, {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: ${JSON.stringify(`1px solid ${palette.borderMutedColor}`)},
          background: ${JSON.stringify(palette.elevatedBackground)},
          color: ${JSON.stringify(palette.textColor)},
          borderRadius: '${UI_CHROME_BORDER_RADIUS}px',
          width: '${UI_CHROME_ICON_BUTTON_SIZE}px',
          height: '${UI_CHROME_ICON_BUTTON_SIZE}px',
          padding: '0',
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
          color: 'inherit',
          fontSize: '${UI_CHROME_ICON_GLYPH_SIZE}px',
          lineHeight: '1',
        });
      });

      root.querySelectorAll('.window-btn').forEach((button) => {
        Object.assign(button.style, {
          border: 'none',
          background: ${JSON.stringify(palette.windowControlBackground)},
          color: ${JSON.stringify(palette.textColor)},
          borderRadius: '${UI_CHROME_BORDER_RADIUS}px',
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
        button.style.background = ${JSON.stringify(palette.dangerBackground)};
        button.style.color = ${JSON.stringify(palette.dangerTextColor)};
      });

      root.querySelectorAll('.tab').forEach((tab) => {
        Object.assign(tab.style, {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          boxSizing: 'border-box',
          height: '${UI_CHROME_TAB_CHIP_HEIGHT}px',
          padding: '0 8px',
          border: '1px solid transparent',
          borderRadius: '${UI_CHROME_BORDER_RADIUS}px',
          background: ${JSON.stringify(palette.subtleBackground)},
          color: ${JSON.stringify(palette.mutedTextColor)},
          maxWidth: '320px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          cursor: 'pointer',
          webkitAppRegion: 'no-drag',
        });
      });

      root.querySelectorAll('.tab-new').forEach((tab) => {
        Object.assign(tab.style, {
          border: ${JSON.stringify(`1px dashed ${palette.borderMutedColor}`)},
          justifyContent: 'center',
          width: '${UI_CHROME_TAB_CHIP_HEIGHT}px',
          minWidth: '${UI_CHROME_TAB_CHIP_HEIGHT}px',
          maxWidth: '${UI_CHROME_TAB_CHIP_HEIGHT}px',
          padding: '0',
          color: ${JSON.stringify(palette.softTextColor)},
          fontWeight: '600',
        });
      });

      root.querySelectorAll('.tab-new-icon').forEach((icon) => {
        Object.assign(icon.style, {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '${UI_CHROME_ICON_GLYPH_SIZE}px',
          lineHeight: '1',
        });
      });

      root.querySelectorAll('.tab-label').forEach((label) => {
        Object.assign(label.style, {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          minWidth: '0',
          overflow: 'hidden',
          maxWidth: '260px',
        });
      });

      root.querySelectorAll('.tab-label-text').forEach((text) => {
        Object.assign(text.style, {
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        });
      });

      root.querySelectorAll('.tab-favicon').forEach((icon) => {
        Object.assign(icon.style, {
          width: '14px',
          height: '14px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: '0',
        });
      });

      root.querySelectorAll('.tab-favicon-img').forEach((image) => {
        Object.assign(image.style, {
          width: '14px',
          height: '14px',
          display: 'block',
          borderRadius: '2px',
        });
      });

      root.querySelectorAll('.tab-close').forEach((button) => {
        Object.assign(button.style, {
          border: 'none',
          background: 'transparent',
          color: ${JSON.stringify(palette.mutedTextColor)},
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
          background: ${JSON.stringify(palette.accentPillBackground)},
          border: ${JSON.stringify(`1px solid ${palette.accentPillBorder}`)},
          color: ${JSON.stringify(palette.mainColor)},
        });
      });

      root.querySelectorAll('.is-secondary-active').forEach((tab) => {
        tab.style.color = ${JSON.stringify(palette.secondaryActiveTextColor)};
      });

      root.querySelectorAll('.is-active .tab-close').forEach((button) => {
        button.style.color = ${JSON.stringify(palette.mainColor)};
      });

      root.querySelectorAll('.is-secondary-active .tab-close').forEach((button) => {
        button.style.color = ${JSON.stringify(palette.secondaryActiveTextColor)};
      });

    })();
  `);
}

module.exports = { renderTabline };
