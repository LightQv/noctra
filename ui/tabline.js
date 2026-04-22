const { UI_SHELL_TABLINE_HEIGHT } = require("./constants");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderTabline(webContents, snapshot) {
  if (!webContents || webContents.isDestroyed()) return;

  const tabsMarkup = snapshot
    .map((buffer) => {
      const title = escapeHtml(buffer.title || buffer.url || "[No title]");
      const classes = buffer.isActive ? "tab is-active" : "tab";
      return `<span class="${classes}" data-tab-id="${buffer.id}" title="${title}"><span class="tab-label">${buffer.id}: ${title}</span><button class="tab-close" data-tab-id="${buffer.id}" type="button" aria-label="Close buffer ${buffer.id}">x</button></span>`;
    })
    .join("");

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

      root.innerHTML = ${JSON.stringify(tabsMarkup)};

      Object.assign(root.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        height: '${UI_SHELL_TABLINE_HEIGHT}px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '0 8px',
        overflowX: 'auto',
        whiteSpace: 'nowrap',
        zIndex: '999998',
        background: '#171b22',
        color: '#c8d1e8',
        borderBottom: '1px solid #2f3440',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: '12px',
        lineHeight: '1',
      });

      root.querySelectorAll('.tab').forEach((tab) => {
        Object.assign(tab.style, {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '4px 8px',
          borderRadius: '4px',
          background: '#202633',
          color: '#9eb1d9',
          maxWidth: '320px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          cursor: 'pointer',
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
          color: '#9eb1d9',
          fontFamily: 'inherit',
          fontSize: '12px',
          lineHeight: '1',
          padding: '0',
          margin: '0',
          cursor: 'pointer',
        });
      });

      root.querySelectorAll('.is-active').forEach((tab) => {
        Object.assign(tab.style, {
          background: '#35518a',
          color: '#f3f7ff',
        });
      });

      root.querySelectorAll('.is-active .tab-close').forEach((button) => {
        button.style.color = '#f3f7ff';
      });

    })();
  `);
}

module.exports = { renderTabline };
