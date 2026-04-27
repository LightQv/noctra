const {
  UI_SCROLLBAR_THUMB_COLOR,
  UI_SCROLLBAR_THUMB_ACTIVE_COLOR,
} = require("../ui/constants");

const DEBUGGER_STATE_BY_ID = new Map();

function isInternalVirtualUrl(url) {
  if (typeof url !== "string" || url.length === 0) {
    return false;
  }

  return url.startsWith("data:") || url.startsWith("noctra:");
}

function isExpectedDebuggerError(error) {
  const message = String(error && error.message ? error.message : "").toLowerCase();
  return (
    message.includes("target closed") ||
    message.includes("session closed") ||
    message.includes("not attached") ||
    message.includes("inspected target navigated or closed") ||
    message.includes("webcontents was destroyed")
  );
}

function readDebuggerState(executor) {
  const id = typeof executor?.id === "number" ? executor.id : -1;
  if (id < 0) {
    return null;
  }

  if (!DEBUGGER_STATE_BY_ID.has(id)) {
    DEBUGGER_STATE_BY_ID.set(id, {
      attachedByUs: false,
      cdpUnavailable: false,
    });
  }

  return DEBUGGER_STATE_BY_ID.get(id);
}

function applyChromiumPreferredColorScheme(executor, scheme) {
  if (!executor || !executor.debugger) {
    return false;
  }

  if (typeof executor.isDestroyed === "function" && executor.isDestroyed()) {
    return false;
  }

  const state = readDebuggerState(executor);
  if (!state) {
    return false;
  }

  if (state.cdpUnavailable) {
    return false;
  }

  const debuggerApi = executor.debugger;

  try {
    if (!debuggerApi.isAttached()) {
      debuggerApi.attach("1.3");
      state.attachedByUs = true;
    }

    const command = debuggerApi.sendCommand("Emulation.setEmulatedMedia", {
      features:
        scheme === "light" || scheme === "dark"
          ? [{ name: "prefers-color-scheme", value: scheme }]
          : [],
    });

    Promise.resolve(command)
      .catch((error) => {
        if (isExpectedDebuggerError(error)) {
          state.attachedByUs = false;
          return;
        }

        if (!isExpectedDebuggerError(error)) {
          console.warn("Failed to apply emulated color scheme:", error.message);
        }
      });

    return true;
  } catch (error) {
    if (isExpectedDebuggerError(error)) {
      state.attachedByUs = false;
      return true;
    }

    const message = String(error && error.message ? error.message : "").toLowerCase();
    if (message.includes("another debugger is already attached")) {
      state.cdpUnavailable = true;
      return false;
    }

    console.warn("Failed to setup debugger for color scheme emulation:", error.message);
    return true;
  }
}

function releaseChromiumPreferredColorScheme(executor) {
  if (!executor || !executor.debugger) {
    return;
  }

  const id = typeof executor?.id === "number" ? executor.id : -1;
  const state = id >= 0 ? DEBUGGER_STATE_BY_ID.get(id) : null;
  if (!state) {
    return;
  }

  try {
    if (state.attachedByUs && executor.debugger.isAttached()) {
      executor.debugger.detach();
    }
  } catch (error) {
    if (!isExpectedDebuggerError(error)) {
      console.warn("Failed to detach debugger while releasing color scheme control:", error.message);
    }
  }

  DEBUGGER_STATE_BY_ID.delete(id);
}

function buildScrollbarScript(options = {}, useThemeFallback = false) {
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
  const contentColorScheme = options.contentColorScheme === "light" ? "light" : "dark";

  const fallbackThemeScript = useThemeFallback
    ? `
      const isInternalVirtualDocument =
        window.location &&
        (window.location.protocol === 'data:' || window.location.protocol === 'noctra:');
      if (!isInternalVirtualDocument) {
        const scheme = '${contentColorScheme}';
        if (document.documentElement && document.documentElement.style) {
          document.documentElement.style.colorScheme = scheme;
        }

        const THEME_STYLE_ID = '__vb_color_scheme_style__';
        let themeStyle = document.getElementById(THEME_STYLE_ID);
        if (!themeStyle) {
          themeStyle = document.createElement('style');
          themeStyle.id = THEME_STYLE_ID;
          document.documentElement.appendChild(themeStyle);
        }
        themeStyle.textContent = ':root{color-scheme:' + scheme + '}';

        window.__vb_forced_color_scheme__ = scheme;
        if (!window.__vb_match_media_patched__) {
          window.__vb_match_media_patched__ = true;
          window.__vb_match_media_original__ = window.matchMedia.bind(window);
          window.matchMedia = function patchedMatchMedia(query) {
            const rawQuery = typeof query === 'string' ? query : String(query || '');
            const normalized = rawQuery.toLowerCase();
            const checksDark = /\(\s*prefers-color-scheme\s*:\s*dark\s*\)/i.test(normalized);
            const checksLight = /\(\s*prefers-color-scheme\s*:\s*light\s*\)/i.test(normalized);

            if (!checksDark && !checksLight) {
              return window.__vb_match_media_original__(query);
            }

            const forced = window.__vb_forced_color_scheme__ === 'light' ? 'light' : 'dark';
            const matches = checksDark ? forced === 'dark' : forced === 'light';
            return {
              matches,
              media: rawQuery,
              onchange: null,
              addListener() {},
              removeListener() {},
              addEventListener() {},
              removeEventListener() {},
              dispatchEvent() { return false; },
            };
          };
        }
      }
    `
    : "";

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

      ${fallbackThemeScript}

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

  const url = typeof executor.getURL === "function" ? String(executor.getURL() || "") : "";
  const contentColorScheme = options.contentColorScheme === "light" ? "light" : "dark";
  const canUseCdpThemeControl = applyChromiumPreferredColorScheme(
    executor,
    isInternalVirtualUrl(url) ? null : contentColorScheme,
  );
  const useThemeFallback = !canUseCdpThemeControl;

  const script = buildScrollbarScript(options, useThemeFallback);
  executor.executeJavaScript(script).catch(() => {});
}

module.exports = {
  applyScrollableUi,
  releaseChromiumPreferredColorScheme,
};
