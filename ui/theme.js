const { mixHex } = require("./color");
const {
  UI_MAIN_COLOR,
  UI_MUTED_TEXT_COLOR,
  UI_BORDER_COLOR,
  UI_SURFACE_COLOR,
  UI_PANEL_BG_COLOR,
  UI_FONT_FAMILY,
  UI_SCROLLBAR_THUMB_COLOR,
  UI_SCROLLBAR_THUMB_ACTIVE_COLOR,
} = require("./constants");

const DEFAULT_THEME = Object.freeze({
  appBackground: "#0f131a",
  surfaceBackground: UI_SURFACE_COLOR,
  panelBackground: UI_PANEL_BG_COLOR,
  shellBackground: "#151a22",
  elevatedBackground: "#1a2230",
  subtleBackground: "#202633",
  windowControlBackground: "#212734",
  dangerBackground: "#3a1f27",
  borderColor: UI_BORDER_COLOR,
  borderStrongColor: "#2a3140",
  borderMutedColor: "#2f3a4d",
  splitDividerColor: mixHex(UI_BORDER_COLOR, "#0f131a", 0.7),
  textColor: "#d8e3f8",
  brightTextColor: "#f4f7ff",
  softTextColor: "#b6c7e8",
  mutedTextColor: UI_MUTED_TEXT_COLOR,
  secondaryActiveTextColor: mixHex(UI_MAIN_COLOR, UI_MUTED_TEXT_COLOR, 0.55),
  accentIconColor: "#8ec5ff",
  mainColor: UI_MAIN_COLOR,
  accentPillBackground: mixHex(UI_MAIN_COLOR, UI_SURFACE_COLOR, 0.18),
  accentPillBorder: mixHex(UI_MAIN_COLOR, UI_BORDER_COLOR, 0.42),
  dangerTextColor: "#ffb4c2",
  editorBackground: "#10151d",
  editorGutterBackground: "#0f131a",
  editorGutterBorderColor: mixHex(UI_BORDER_COLOR, "#0f131a", 0.6),
  editorLineNumberColor: "#5f6d86",
  editorSelectionBackground: "rgba(137, 220, 235, 0.22)",
  editorDialogBackground: "#141a23",
  editorDialogBorderColor: "#2a3140",
  fontFamily: UI_FONT_FAMILY,
  scrollbarThumbColor: UI_SCROLLBAR_THUMB_COLOR,
  scrollbarThumbActiveColor: UI_SCROLLBAR_THUMB_ACTIVE_COLOR,
});

const LIGHT_THEME = Object.freeze({
  appBackground: "#efe4d2",
  surfaceBackground: "#f5ebdc",
  panelBackground: "#f2e6d5",
  shellBackground: "#e9ddcc",
  elevatedBackground: "#f9f0e3",
  subtleBackground: "#eadfce",
  windowControlBackground: "#e0d3c0",
  dangerBackground: "#f4dcd4",
  borderColor: "#b8aa95",
  borderStrongColor: "#9f8f79",
  borderMutedColor: "#c5b8a4",
  splitDividerColor: "#b7aa95",
  textColor: "#1d2b1f",
  brightTextColor: "#0f1b12",
  softTextColor: "#304736",
  mutedTextColor: "#55695a",
  secondaryActiveTextColor: "#2f5a3e",
  accentIconColor: "#2e6b45",
  mainColor: "#2f6f46",
  accentPillBackground: "#d8e4d8",
  accentPillBorder: "#7d9e83",
  dangerTextColor: "#7f342e",
  editorBackground: "#f6eddf",
  editorGutterBackground: "#efe3d1",
  editorGutterBorderColor: "#c9b9a4",
  editorLineNumberColor: "#6a7a6c",
  editorSelectionBackground: "rgba(47, 111, 70, 0.2)",
  editorDialogBackground: "#f0e4d2",
  editorDialogBorderColor: "#ac9d88",
  fontFamily: UI_FONT_FAMILY,
  scrollbarThumbColor: "rgba(47, 111, 70, 0.5)",
  scrollbarThumbActiveColor: "rgba(47, 111, 70, 0.8)",
});

const THEME_MODES = new Set(["dark", "light", "auto", "custom"]);

function readConfiguredThemeMode(themeConfig = {}) {
  if (typeof themeConfig?.mode === "string") {
    return themeConfig.mode;
  }

  if (typeof themeConfig?.name === "string") {
    return themeConfig.name;
  }

  return "dark";
}

function normalizeThemeMode(input, fallback = "dark") {
  if (typeof input !== "string") {
    return THEME_MODES.has(fallback) ? fallback : "dark";
  }

  const normalized = input.trim().toLowerCase();
  if (normalized === "default") {
    return "dark";
  }

  if (THEME_MODES.has(normalized)) {
    return normalized;
  }

  return THEME_MODES.has(fallback) ? fallback : "dark";
}

function resolveThemeMode(themeConfig = {}, options = {}) {
  const rawMode = readConfiguredThemeMode(themeConfig);
  const configuredMode = normalizeThemeMode(rawMode, "dark");

  if (configuredMode === "custom") {
    return "custom";
  }

  if (configuredMode !== "auto") {
    return configuredMode;
  }

  return options.systemPrefersDark === false ? "light" : "dark";
}

function pickOverrides(overrides = {}) {
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) {
    return {};
  }

  const next = {};
  for (const key of Object.keys(DEFAULT_THEME)) {
    const value = overrides[key];
    if (typeof value === "string" && value.trim().length > 0) {
      next[key] = value.trim();
    }
  }

  if (
    !Object.prototype.hasOwnProperty.call(next, "shellBackground") &&
    typeof overrides.statuslineBackground === "string" &&
    overrides.statuslineBackground.trim().length > 0
  ) {
    next.shellBackground = overrides.statuslineBackground.trim();
  }

  return next;
}

function resolveTheme(themeConfig = {}, options = {}) {
  const configuredMode = normalizeThemeMode(readConfiguredThemeMode(themeConfig), "dark");
  const effectiveMode = resolveThemeMode(themeConfig, options);
  const baseTheme = effectiveMode === "light" ? LIGHT_THEME : DEFAULT_THEME;
  const overrides = configuredMode === "custom" ? pickOverrides(themeConfig.overrides) : {};
  const theme = {
    ...baseTheme,
    ...overrides,
  };

  if (!Object.prototype.hasOwnProperty.call(overrides, "secondaryActiveTextColor")) {
    theme.secondaryActiveTextColor = mixHex(theme.mainColor, theme.mutedTextColor, 0.55);
  }

  if (!Object.prototype.hasOwnProperty.call(overrides, "accentPillBackground")) {
    theme.accentPillBackground = mixHex(theme.mainColor, theme.surfaceBackground, 0.18);
  }

  if (!Object.prototype.hasOwnProperty.call(overrides, "accentPillBorder")) {
    theme.accentPillBorder = mixHex(theme.mainColor, theme.borderColor, 0.42);
  }

  if (!Object.prototype.hasOwnProperty.call(overrides, "editorGutterBorderColor")) {
    theme.editorGutterBorderColor = mixHex(theme.borderColor, theme.appBackground, 0.6);
  }

  if (!Object.prototype.hasOwnProperty.call(overrides, "editorDialogBorderColor")) {
    theme.editorDialogBorderColor = theme.borderStrongColor;
  }

  return theme;
}

function toCssVars(theme = {}) {
  const shellBackground = theme.shellBackground || DEFAULT_THEME.shellBackground;
  return {
    "--ui-bg-app": theme.appBackground,
    "--ui-bg-surface": theme.surfaceBackground,
    "--ui-bg-panel": theme.panelBackground,
    "--ui-bg-shell": shellBackground,
    "--ui-bg-statusline": shellBackground,
    "--ui-bg-elevated": theme.elevatedBackground,
    "--ui-bg-subtle": theme.subtleBackground,
    "--ui-border": theme.borderColor,
    "--ui-border-strong": theme.borderStrongColor,
    "--ui-split-divider": theme.splitDividerColor,
    "--ui-text": theme.textColor,
    "--ui-text-bright": theme.brightTextColor,
    "--ui-text-soft": theme.softTextColor,
    "--ui-text-muted": theme.mutedTextColor,
    "--ui-accent": theme.mainColor,
    "--ui-accent-pill-bg": theme.accentPillBackground,
    "--ui-accent-pill-border": theme.accentPillBorder,
    "--ui-editor-bg": theme.editorBackground,
    "--ui-editor-gutter-bg": theme.editorGutterBackground,
    "--ui-editor-gutter-border": theme.editorGutterBorderColor,
    "--ui-editor-line-number": theme.editorLineNumberColor,
    "--ui-editor-selection": theme.editorSelectionBackground,
    "--ui-editor-dialog-bg": theme.editorDialogBackground,
    "--ui-editor-dialog-border": theme.editorDialogBorderColor,
  };
}

module.exports = {
  DEFAULT_THEME,
  LIGHT_THEME,
  normalizeThemeMode,
  resolveThemeMode,
  resolveTheme,
  toCssVars,
};
