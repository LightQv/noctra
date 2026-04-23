const path = require("path");
const { pathToFileURL } = require("url");
const { mixHex } = require("./color");

const UI_SHELL_CHROME_HEIGHT = 34;
const UI_SHELL_TABLINE_HEIGHT = UI_SHELL_CHROME_HEIGHT;
const UI_SHELL_STATUSLINE_HEIGHT = 30;

const UI_MAIN_COLOR = "#89dceb";
const UI_MUTED_TEXT_COLOR = "#7d8aa3";
const UI_BORDER_COLOR = "#2f3440";
const UI_SURFACE_COLOR = "#171b22";
const UI_PANEL_BG_COLOR = "#161b24";
const UI_ACCENT_PILL_BG = mixHex(UI_MAIN_COLOR, UI_SURFACE_COLOR, 0.18);
const UI_ACCENT_PILL_BORDER = mixHex(UI_MAIN_COLOR, UI_BORDER_COLOR, 0.42);
const UI_FONT_FAMILY =
  '"JetBrainsMono Nerd Font Mono", "JetBrainsMono Nerd Font", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

const UI_FONT_REGULAR_URL = pathToFileURL(
  path.resolve(__dirname, "..", "assets", "fonts", "JetBrainsMonoNerdFontMono-Regular.ttf"),
).href;
const UI_FONT_BOLD_URL = pathToFileURL(
  path.resolve(__dirname, "..", "assets", "fonts", "JetBrainsMonoNerdFontMono-Bold.ttf"),
).href;

const UI_FONT_FACE_CSS = `
@font-face {
  font-family: "JetBrainsMono Nerd Font Mono";
  src: url("${UI_FONT_REGULAR_URL}") format("truetype");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: "JetBrainsMono Nerd Font Mono";
  src: url("${UI_FONT_BOLD_URL}") format("truetype");
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
`;

const UI_SCROLLBAR_THUMB_COLOR = "rgba(137, 220, 235, 0.58)";
const UI_SCROLLBAR_THUMB_ACTIVE_COLOR = "rgba(137, 220, 235, 0.92)";

module.exports = {
  UI_SHELL_TABLINE_HEIGHT,
  UI_SHELL_STATUSLINE_HEIGHT,
  UI_SHELL_CHROME_HEIGHT,
  UI_MAIN_COLOR,
  UI_MUTED_TEXT_COLOR,
  UI_BORDER_COLOR,
  UI_SURFACE_COLOR,
  UI_PANEL_BG_COLOR,
  UI_ACCENT_PILL_BG,
  UI_ACCENT_PILL_BORDER,
  UI_FONT_FAMILY,
  UI_FONT_FACE_CSS,
  UI_SCROLLBAR_THUMB_COLOR,
  UI_SCROLLBAR_THUMB_ACTIVE_COLOR,
};
