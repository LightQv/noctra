const { resolveUrlInput } = require("../resolver");
const { mixHex } = require("../../ui/color");
const { resolveTheme } = require("../../ui/theme");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeMode(mode) {
  if (mode === "blank" || mode === "url" || mode === "dashboard") {
    return mode;
  }

  return "blank";
}

function normalizeDashboardConfig(dashboard) {
  const source = dashboard && typeof dashboard === "object" ? dashboard : {};
  const header = typeof source.header === "string" ? source.header : "";
  const footer = typeof source.footer === "string" ? source.footer : "";

  const buttons = Array.isArray(source.buttons)
    ? source.buttons.filter((item) => typeof item === "string")
    : [];

  return {
    header,
    buttons,
    footer,
  };
}

function renderHeaderSection(header) {
  if (!header || !header.trim()) {
    return "";
  }

  return `<pre class="dashboard-header">${escapeHtml(header)}</pre>`;
}

function renderButtonsSection(buttons) {
  if (!Array.isArray(buttons) || buttons.length === 0) {
    return "";
  }

  const items = buttons
    .map((button) => button.trim())
    .filter((button) => button.length > 0)
    .map((button) => `<li class="dashboard-button">${escapeHtml(button)}</li>`)
    .join("");

  if (!items) {
    return "";
  }

  return `<ul class="dashboard-buttons">${items}</ul>`;
}

function renderFooterSection(footer) {
  if (!footer || !footer.trim()) {
    return "";
  }

  return `<pre class="dashboard-footer">${escapeHtml(footer)}</pre>`;
}

function toRgba(input, alpha, fallback) {
  if (typeof input !== "string") {
    return fallback;
  }

  const raw = input.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) {
    return fallback;
  }

  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  const clamped = Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1;
  return `rgba(${r}, ${g}, ${b}, ${clamped})`;
}

function buildDashboardHtml(dashboard = {}, themeInput = {}) {
  const colorScheme = themeInput && themeInput.colorScheme === "light" ? "light" : "dark";
  const baseTheme =
    themeInput && themeInput.theme && typeof themeInput.theme === "object" ? themeInput.theme : {};
  const theme = resolveTheme({
    mode: colorScheme,
    overrides: baseTheme,
  });

  const gradientTop = mixHex(theme.appBackground, theme.surfaceBackground, 0.72);
  const gradientMid = mixHex(theme.appBackground, theme.surfaceBackground, 0.58);
  const gradientBottom = theme.appBackground;
  const glowTint = toRgba(theme.mainColor, colorScheme === "light" ? 0.18 : 0.16, "transparent");
  const buttonBorder = toRgba(theme.mainColor, colorScheme === "light" ? 0.42 : 0.34, theme.borderColor);
  const buttonBackground = toRgba(
    theme.elevatedBackground,
    colorScheme === "light" ? 0.88 : 0.72,
    theme.elevatedBackground,
  );

  const header = renderHeaderSection(dashboard.header);
  const buttons = renderButtonsSection(dashboard.buttons);
  const footer = renderFooterSection(dashboard.footer);

  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Noctra Dashboard</title>
    <style>
      :root {
        color-scheme: ${colorScheme};
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        width: 100%;
        min-height: 100%;
      }

      body {
        font-family: "JetBrainsMono Nerd Font Mono", "JetBrains Mono", ui-monospace, SFMono-Regular,
          Menlo, Monaco, Consolas, monospace;
        background:
          radial-gradient(120% 70% at 50% -10%, ${glowTint}, transparent 65%),
          linear-gradient(180deg, ${gradientTop} 0%, ${gradientMid} 45%, ${gradientBottom} 100%);
        color: ${theme.textColor};
      }

      .dashboard {
        width: min(960px, 100%);
        min-height: 100vh;
        margin: 0 auto;
        padding: clamp(48px, 10vh, 112px) 24px clamp(28px, 6vh, 72px);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: clamp(24px, 5vh, 56px);
      }

      .dashboard-header,
      .dashboard-footer {
        margin: 0;
        text-align: center;
        white-space: pre;
        overflow-x: auto;
        max-width: 100%;
      }

      .dashboard-header {
        color: ${theme.brightTextColor};
        font-size: clamp(12px, 1.65vw, 17px);
        line-height: 1.35;
      }

      .dashboard-buttons {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        width: min(560px, 100%);
      }

      .dashboard-button {
        width: 100%;
        padding: 10px 14px;
        border: 1px solid ${buttonBorder};
        border-radius: 8px;
        text-align: center;
        white-space: pre-wrap;
        color: ${theme.softTextColor};
        background: ${buttonBackground};
      }

      .dashboard-footer {
        margin-top: auto;
        color: ${theme.mutedTextColor};
        font-size: 12px;
        line-height: 1.5;
      }
    </style>
  </head>
  <body>
    <main class="dashboard">${header}${buttons}${footer}</main>
  </body>
</html>`;
}

function buildOpeningBufferSpec(openingBufferConfig = {}, themeInput = {}) {
  const mode = normalizeMode(openingBufferConfig.mode);

  if (mode === "url") {
    const rawUrl = typeof openingBufferConfig.url === "string" ? openingBufferConfig.url : "";
    const resolvedUrl = resolveUrlInput(rawUrl);

    if (resolvedUrl) {
      return {
        kind: "url",
        url: resolvedUrl,
      };
    }

    return {
      kind: "url",
      url: "about:blank",
      warning: `Invalid opening buffer URL \"${rawUrl}\". Falling back to about:blank.`,
    };
  }

  if (mode === "dashboard") {
    const dashboard = normalizeDashboardConfig(openingBufferConfig.dashboard);
    return {
      kind: "virtual",
      document: {
        url: "noctra://dashboard",
        title: "Dashboard",
        html: buildDashboardHtml(dashboard, themeInput),
      },
    };
  }

  return {
    kind: "url",
    url: "about:blank",
  };
}

module.exports = {
  buildOpeningBufferSpec,
};
