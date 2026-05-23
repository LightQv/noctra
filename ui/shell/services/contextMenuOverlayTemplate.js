const {
  UI_FONT_FAMILY,
  UI_FONT_FACE_CSS,
} = require("../../constants");

const INTERNAL_UI_CSP =
  "default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; worker-src 'none'; media-src 'none'; manifest-src 'none'; frame-ancestors 'none'";

const CONTEXT_MENU_OVERLAY_HTML = `
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${INTERNAL_UI_CSP}" />
    <style>
      html,
      body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        background: transparent;
        overflow: hidden;
      }

      ${UI_FONT_FACE_CSS}

      #menu-root {
        display: none;
        position: absolute;
        background: var(--ui-bg-panel, #161b24);
        border: 1px solid var(--ui-border-strong, #2a3140);
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        padding: 4px 0;
        font-family: var(--ui-font-family, ${UI_FONT_FAMILY});
        font-size: 11px;
        line-height: 15px;
        overflow-y: auto;
        overflow-x: hidden;
        box-sizing: border-box;
        pointer-events: auto;
        min-width: 120px;
        max-width: 420px;
      }

      .menu-row {
        display: flex;
        align-items: center;
        gap: 0;
        min-height: 20px;
        padding: 2px 10px 2px 0;
        color: var(--ui-text, #c9d1df);
        cursor: pointer;
        white-space: nowrap;
        user-select: none;
        box-sizing: border-box;
      }

      .menu-row:hover {
        background: var(--ui-bg-subtle, #1f2735);
        color: var(--ui-text-bright, #f4f7ff);
      }

      .menu-row.disabled {
        opacity: 0.4;
        cursor: default;
        pointer-events: none;
      }

      .menu-row.disabled:hover {
        background: transparent;
      }

      .menu-cursor {
        width: 6px;
        flex: 0 0 6px;
        background: transparent;
        border-radius: 1px;
        margin-left: 2px;
        margin-right: 6px;
        align-self: stretch;
      }

      .menu-row:hover .menu-cursor {
        background: var(--ui-editor-cursor, #89dceb);
      }

      .menu-label {
        display: flex;
        align-items: center;
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .menu-separator {
        height: 1px;
        margin: 4px 8px;
        background: var(--ui-border, #2f3440);
        flex-shrink: 0;
      }
    </style>
  </head>
  <body>
    <div id="menu-root"></div>
  </body>
</html>
`;

module.exports = {
  CONTEXT_MENU_OVERLAY_HTML,
};
