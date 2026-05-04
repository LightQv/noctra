const path = require("path");
const { pathToFileURL } = require("url");

const UI_SHELL_CHROME_HEIGHT = 34;
const UI_SHELL_TABLINE_HEIGHT = UI_SHELL_CHROME_HEIGHT;
const UI_SHELL_URLLINE_HEIGHT = UI_SHELL_CHROME_HEIGHT;
const UI_SHELL_STATUSLINE_HEIGHT = 30;
const UI_CHROME_ICON_BUTTON_SIZE = 24;
const UI_CHROME_TAB_CHIP_HEIGHT = 26;
const UI_CHROME_BORDER_RADIUS = 4;
const UI_CHROME_HORIZONTAL_PADDING = 8;
const UI_CHROME_TAB_GAP = 8;
const UI_CHROME_TABLINE_ACTION_GAP = UI_CHROME_TAB_GAP;
const UI_CHROME_TABLINE_TABS_LEFT_PADDING = 4;
const UI_CHROME_TABLINE_ACTIONS_RIGHT_PADDING = 12;
const UI_CHROME_EDITOR_HEADER_HORIZONTAL_PADDING = UI_CHROME_TABLINE_ACTIONS_RIGHT_PADDING;
const UI_CHROME_ICON_GLYPH_SIZE = 16;

const UI_MAIN_COLOR = "#89dceb";
const UI_MUTED_TEXT_COLOR = "#7d8aa3";
const UI_BORDER_COLOR = "#2f3440";
const UI_SURFACE_COLOR = "#171b22";
const UI_PANEL_BG_COLOR = "#161b24";
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
  UI_SHELL_URLLINE_HEIGHT,
  UI_SHELL_STATUSLINE_HEIGHT,
  UI_SHELL_CHROME_HEIGHT,
  UI_CHROME_ICON_BUTTON_SIZE,
  UI_CHROME_TAB_CHIP_HEIGHT,
  UI_CHROME_BORDER_RADIUS,
  UI_CHROME_HORIZONTAL_PADDING,
  UI_CHROME_TAB_GAP,
  UI_CHROME_TABLINE_ACTION_GAP,
  UI_CHROME_TABLINE_TABS_LEFT_PADDING,
  UI_CHROME_TABLINE_ACTIONS_RIGHT_PADDING,
  UI_CHROME_EDITOR_HEADER_HORIZONTAL_PADDING,
  UI_CHROME_ICON_GLYPH_SIZE,
  UI_MAIN_COLOR,
  UI_MUTED_TEXT_COLOR,
  UI_BORDER_COLOR,
  UI_SURFACE_COLOR,
  UI_PANEL_BG_COLOR,
  UI_FONT_FAMILY,
  UI_FONT_FACE_CSS,
  UI_SCROLLBAR_THUMB_COLOR,
  UI_SCROLLBAR_THUMB_ACTIVE_COLOR,
};
