const { resolveTheme, resolveThemeMode } = require("../../ui/theme");
const { mixHex } = require("../../ui/color");

const CAT_ART = [
  "                               __",
  "                         _,-;''';`'-,.",
  "                      _/',  `;  `;    `\\",
  "      ,        _..,-''    '   `  `      `\\",
  "     | ;._.,,-' .| |,_        ,,          `\\",
  "     | `;'      ;' ;, `,   ; |    '  '  .   \\",
  "     `; __`  ,'__  ` ,  ` ;  |      ;        \\",
  "     ; (6_);  (6_) ; |   ,    \\        '      |       /",
  "    ;;   _,' ,.    ` `,   '    `-._           |   __//_________",
  "     ,;.=..`_..=.,' -'          ,''        _,--''------''''",
  "",
  "\\_pb**\\,`\"=,,,==\"',\\_**,,,-----'''----'_'_'\\_''-;''",
  "-----------------------''''''\\ \\''''' ) /'",
  "`\\`,,,**\\_/**/'**\\_**,",
  "`--,,,--,-,'''\\",
  "                               __,,-' /'       `",
  "/'\\_,,--''",
  "| (",
  "`'",
].join("\n");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildErrorDetailList(input = {}) {
  const details = [];

  if (typeof input.failedUrl === "string" && input.failedUrl.trim()) {
    details.push(`<li><strong>URL:</strong> ${escapeHtml(input.failedUrl.trim())}</li>`);
  }

  if (typeof input.errorName === "string" && input.errorName.trim()) {
    details.push(`<li><strong>Error:</strong> ${escapeHtml(input.errorName.trim())}</li>`);
  }

  if (typeof input.errorCode === "number" && Number.isFinite(input.errorCode)) {
    details.push(`<li><strong>Code:</strong> ${escapeHtml(String(input.errorCode))}</li>`);
  }

  if (details.length === 0) {
    return "";
  }

  return `<ul class="details">${details.join("")}</ul>`;
}

function buildCatErrorPage(options = {}) {
  const { theme, colorScheme } = resolveCatTheme(options.themeContext);
  const fromFailure = options.fromFailure === true;
  const pageTitle = fromFailure ? "Load Failure" : "Standby";
  const description = fromFailure
    ? "Noctra could not load this page. Press r to retry, or open a different URL."
    : "No failure detected. Noctra is resting until navigation needs backup.";
  const details = fromFailure ? buildErrorDetailList(options) : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${pageTitle}</title>
    <style>
      :root { color-scheme: ${colorScheme}; }
      * { box-sizing: border-box; }
      html, body { margin: 0; width: 100%; min-height: 100%; }
      body {
        font-family: "JetBrainsMono Nerd Font Mono", "JetBrains Mono", ui-monospace, Menlo, Monaco, Consolas, monospace;
        background:
          radial-gradient(130% 70% at 50% -8%, ${theme.mainColor}2a 0%, transparent 65%),
          linear-gradient(180deg, ${mixHex(theme.appBackground, theme.surfaceBackground, 0.7)} 0%, ${theme.appBackground} 100%);
        color: ${theme.textColor};
      }
      .cat-page {
        width: min(960px, 100%);
        min-height: 100vh;
        margin: 0 auto;
        padding: clamp(48px, 10vh, 112px) 24px clamp(28px, 6vh, 72px);
        display: flex;
        flex-direction: column;
        gap: clamp(14px, 3vh, 22px);
      }
      .cat {
        margin: 0;
        text-align: left;
        color: ${theme.mainColor};
        font-size: clamp(10px, 1.05vw, 12px);
        line-height: 1.3;
        overflow-x: auto;
        max-width: 100%;
      }
      .cat-wrap {
        align-self: flex-end;
        max-width: 100%;
      }
      h1 { margin: 2px 0 2px; font-size: clamp(15px, 1.3vw, 18px); color: ${theme.brightTextColor}; }
      p { margin: 0; color: ${theme.softTextColor}; font-size: clamp(12px, 1vw, 13px); line-height: 1.45; max-width: 74ch; }
      .details {
        list-style: none;
        margin: 12px 0 0;
        padding: 0;
        display: grid;
        gap: 7px;
      }
      .details li {
        padding: 10px 12px;
        border-radius: 8px;
        border: 1px solid ${theme.borderColor};
        background: ${theme.elevatedBackground};
        word-break: break-word;
      }
    </style>
  </head>
  <body>
    <main class="cat-page">
<div class="cat-wrap"><pre class="cat">${escapeHtml(CAT_ART)}</pre></div>
      <h1>${pageTitle}</h1>
      <p>${escapeHtml(description)}</p>
      ${details}
    </main>
  </body>
</html>`;
}

function resolveCatTheme(themeContext = null) {
  if (themeContext && typeof themeContext === "object" && themeContext.theme) {
    const colorScheme = themeContext.colorScheme === "light" ? "light" : "dark";
    return {
      theme: themeContext.theme,
      colorScheme,
    };
  }

  let themeConfig = {};
  try {
    const { getConfigValue } = require("../config/service");
    themeConfig = getConfigValue("global.theme", {});
  } catch {
    themeConfig = {};
  }

  const systemPrefersDark = resolveSystemPrefersDark();
  const resolvedMode = resolveThemeMode(themeConfig, {
    systemPrefersDark,
  });

  return {
    theme: resolveTheme(themeConfig, {
      systemPrefersDark,
    }),
    colorScheme: resolvedMode === "light" ? "light" : "dark",
  };
}

function resolveSystemPrefersDark() {
  try {
    const { nativeTheme } = require("electron");
    return Boolean(nativeTheme && nativeTheme.shouldUseDarkColors);
  } catch {
    return true;
  }
}

module.exports = {
  buildCatErrorPage,
};
