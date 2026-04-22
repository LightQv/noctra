function injectCommandUI(webContents) {
  webContents.executeJavaScript(`
    if (!window.__cmd_ui__) {
      const el = document.createElement('div');
      el.id = '__cmd_palette__';

      Object.assign(el.style, {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: '#1e1e1e',
        color: 'white',
        padding: '10px',
        fontSize: '14px',
        zIndex: 999999,
        display: 'none',
        width: '400px',
        borderRadius: '6px'
      });

      const input = document.createElement('input');
      input.style.width = '100%';
      input.style.background = 'transparent';
      input.style.border = 'none';
      input.style.outline = 'none';
      input.style.color = 'white';
			input.disabled = true;
			input.style.caretColor = 'transparent';

      el.appendChild(input);
      document.body.appendChild(el);

      window.__cmd_ui__ = {
        el,
        input
      };
    }
  `);
}

module.exports = { injectCommandUI };
