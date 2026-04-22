const {
  UI_SCROLLBAR_THUMB_COLOR,
  UI_SCROLLBAR_THUMB_ACTIVE_COLOR,
} = require("../ui/constants");

function buildScrollbarScript(options = {}) {
  const width = Number.isFinite(options.widthPx) ? Math.max(2, Math.floor(options.widthPx)) : 6;
  const hideDelayMs = Number.isFinite(options.hideDelayMs)
    ? Math.max(100, Math.floor(options.hideDelayMs))
    : 700;
  const thumb =
    typeof options.thumbColor === "string" ? options.thumbColor : UI_SCROLLBAR_THUMB_COLOR;
  const thumbActive =
    typeof options.thumbActiveColor === "string"
      ? options.thumbActiveColor
      : UI_SCROLLBAR_THUMB_ACTIVE_COLOR;
  const track = typeof options.trackColor === "string" ? options.trackColor : "transparent";

  return `
    (function applyScrollableUiStyle() {
      const STYLE_ID = '__vb_scrollbar_style__';
      let style = document.getElementById(STYLE_ID);
      if (!style) {
        style = document.createElement('style');
        style.id = STYLE_ID;
        document.documentElement.appendChild(style);
      }

      style.textContent = [
        '::-webkit-scrollbar{width:${width}px;height:${width}px}',
        '::-webkit-scrollbar-track{background:${track}}',
        '::-webkit-scrollbar-thumb{background:transparent;border-radius:999px;transition:background .18s ease}',
        'html.vb-scroll-active ::-webkit-scrollbar-thumb{background:${thumb}}',
        'html.vb-scroll-active ::-webkit-scrollbar-thumb:hover{background:${thumbActive}}'
      ].join('');

      const root = document.documentElement;
      if (!root) return;

      let hideTimer = null;
      const activate = () => {
        root.classList.add('vb-scroll-active');
        if (hideTimer) {
          clearTimeout(hideTimer);
        }
        hideTimer = setTimeout(() => {
          root.classList.remove('vb-scroll-active');
        }, ${hideDelayMs});
      };

      if (!window.__vb_scroll_ui_bound__) {
        window.__vb_scroll_ui_bound__ = true;
        window.addEventListener('scroll', activate, { passive: true });
        document.addEventListener('wheel', activate, { passive: true });
        document.addEventListener('touchmove', activate, { passive: true });
      }
    })();
  `;
}

function applyScrollableUi(executor, options = {}) {
  if (!executor || typeof executor.executeJavaScript !== "function") {
    return;
  }

  const script = buildScrollbarScript(options);
  executor.executeJavaScript(script).catch(() => {});
}

module.exports = {
  applyScrollableUi,
};
