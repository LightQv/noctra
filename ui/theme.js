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
  editorCursorColor: "#89dceb",
  editorCursorTextColor: "#10151d",
  editorActiveLineBackground: "rgba(137, 220, 235, 0.08)",
  editorMatchingBracketBackground: "rgba(142, 197, 255, 0.2)",
  editorMatchingBracketColor: "#d8e3f8",
  editorDialogBackground: "#141a23",
  editorDialogBorderColor: "#2a3140",
  editorTokenKeywordColor: "#8ec5ff",
  editorTokenAtomColor: "#ffb4c2",
  editorTokenNumberColor: "#f3b889",
  editorTokenDefColor: "#89dceb",
  editorTokenVariableColor: "#d8e3f8",
  editorTokenVariable2Color: "#9dd7ff",
  editorTokenVariable3Color: "#f8d38e",
  editorTokenPropertyColor: "#b8d3ff",
  editorTokenOperatorColor: "#c8d6f0",
  editorTokenCommentColor: "#7f8ca3",
  editorTokenStringColor: "#a7d9a8",
  editorTokenString2Color: "#8ed8c9",
  editorTokenMetaColor: "#b6c7e8",
  editorTokenQualifierColor: "#f6c177",
  editorTokenBuiltinColor: "#c4b5fd",
  editorTokenTagColor: "#7dc4e4",
  editorTokenAttributeColor: "#f9cb8c",
  editorTokenHeaderColor: "#89dceb",
  editorTokenQuoteColor: "#98d3a5",
  editorTokenLinkColor: "#89b4ff",
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
  editorCursorColor: "#2f6f46",
  editorCursorTextColor: "#f6eddf",
  editorActiveLineBackground: "rgba(47, 111, 70, 0.08)",
  editorMatchingBracketBackground: "rgba(47, 111, 70, 0.16)",
  editorMatchingBracketColor: "#1d2b1f",
  editorDialogBackground: "#f0e4d2",
  editorDialogBorderColor: "#ac9d88",
  editorTokenKeywordColor: "#2f6f46",
  editorTokenAtomColor: "#9b4f45",
  editorTokenNumberColor: "#935f2f",
  editorTokenDefColor: "#1f5c35",
  editorTokenVariableColor: "#1d2b1f",
  editorTokenVariable2Color: "#2f5a3e",
  editorTokenVariable3Color: "#7a5e2f",
  editorTokenPropertyColor: "#355447",
  editorTokenOperatorColor: "#516654",
  editorTokenCommentColor: "#7d8f7f",
  editorTokenStringColor: "#4a6e3f",
  editorTokenString2Color: "#3d7468",
  editorTokenMetaColor: "#55695a",
  editorTokenQualifierColor: "#8f5f2f",
  editorTokenBuiltinColor: "#6f4b8f",
  editorTokenTagColor: "#2c6a57",
  editorTokenAttributeColor: "#8d6433",
  editorTokenHeaderColor: "#1f5c35",
  editorTokenQuoteColor: "#617f55",
  editorTokenLinkColor: "#2f5f8f",
  fontFamily: UI_FONT_FAMILY,
  scrollbarThumbColor: "rgba(47, 111, 70, 0.5)",
  scrollbarThumbActiveColor: "rgba(47, 111, 70, 0.8)",
});

const THEME_MODES = new Set(["dark", "light", "auto", "custom"]);
const CONTENT_THEME_MODES = new Set(["dark", "light", "auto", "match"]);

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

function normalizeContentThemeMode(input, fallback = "dark") {
  if (typeof input !== "string") {
    return CONTENT_THEME_MODES.has(fallback) ? fallback : "dark";
  }

  const normalized = input.trim().toLowerCase();
  if (CONTENT_THEME_MODES.has(normalized)) {
    return normalized;
  }

  return CONTENT_THEME_MODES.has(fallback) ? fallback : "dark";
}

function resolveContentColorScheme(themeConfig = {}, options = {}) {
  const contentMode = normalizeContentThemeMode(
    themeConfig?.content_mode,
    "dark",
  );
  if (contentMode === "dark" || contentMode === "light") {
    return contentMode;
  }

  if (contentMode === "auto") {
    return options.systemPrefersDark === false ? "light" : "dark";
  }

  const appResolvedMode = resolveThemeMode(themeConfig, options);
  if (appResolvedMode === "dark" || appResolvedMode === "light") {
    return appResolvedMode;
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
  const configuredMode = normalizeThemeMode(
    readConfiguredThemeMode(themeConfig),
    "dark",
  );
  const effectiveMode = resolveThemeMode(themeConfig, options);
  const baseTheme = effectiveMode === "light" ? LIGHT_THEME : DEFAULT_THEME;
  const overrides =
    configuredMode === "custom" ? pickOverrides(themeConfig.overrides) : {};
  const theme = {
    ...baseTheme,
    ...overrides,
  };

  if (
    !Object.prototype.hasOwnProperty.call(overrides, "secondaryActiveTextColor")
  ) {
    theme.secondaryActiveTextColor = mixHex(
      theme.mainColor,
      theme.mutedTextColor,
      0.55,
    );
  }

  if (
    !Object.prototype.hasOwnProperty.call(overrides, "accentPillBackground")
  ) {
    theme.accentPillBackground = mixHex(
      theme.mainColor,
      theme.surfaceBackground,
      0.18,
    );
  }

  if (!Object.prototype.hasOwnProperty.call(overrides, "accentPillBorder")) {
    theme.accentPillBorder = mixHex(theme.mainColor, theme.borderColor, 0.42);
  }

  if (
    !Object.prototype.hasOwnProperty.call(overrides, "editorGutterBorderColor")
  ) {
    theme.editorGutterBorderColor = mixHex(
      theme.borderColor,
      theme.appBackground,
      0.6,
    );
  }

  if (
    !Object.prototype.hasOwnProperty.call(overrides, "editorDialogBorderColor")
  ) {
    theme.editorDialogBorderColor = theme.borderStrongColor;
  }

  return theme;
}

function toCssVars(theme = {}) {
  const shellBackground =
    theme.shellBackground || DEFAULT_THEME.shellBackground;
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
    "--ui-editor-cursor": theme.editorCursorColor,
    "--ui-editor-cursor-text": theme.editorCursorTextColor,
    "--ui-editor-active-line": theme.editorActiveLineBackground,
    "--ui-editor-matching-bracket-bg": theme.editorMatchingBracketBackground,
    "--ui-editor-matching-bracket-color": theme.editorMatchingBracketColor,
    "--ui-editor-dialog-bg": theme.editorDialogBackground,
    "--ui-editor-dialog-border": theme.editorDialogBorderColor,
    "--ui-editor-token-keyword": theme.editorTokenKeywordColor,
    "--ui-editor-token-atom": theme.editorTokenAtomColor,
    "--ui-editor-token-number": theme.editorTokenNumberColor,
    "--ui-editor-token-def": theme.editorTokenDefColor,
    "--ui-editor-token-variable": theme.editorTokenVariableColor,
    "--ui-editor-token-variable2": theme.editorTokenVariable2Color,
    "--ui-editor-token-variable3": theme.editorTokenVariable3Color,
    "--ui-editor-token-property": theme.editorTokenPropertyColor,
    "--ui-editor-token-operator": theme.editorTokenOperatorColor,
    "--ui-editor-token-comment": theme.editorTokenCommentColor,
    "--ui-editor-token-string": theme.editorTokenStringColor,
    "--ui-editor-token-string2": theme.editorTokenString2Color,
    "--ui-editor-token-meta": theme.editorTokenMetaColor,
    "--ui-editor-token-qualifier": theme.editorTokenQualifierColor,
    "--ui-editor-token-builtin": theme.editorTokenBuiltinColor,
    "--ui-editor-token-tag": theme.editorTokenTagColor,
    "--ui-editor-token-attribute": theme.editorTokenAttributeColor,
    "--ui-editor-token-header": theme.editorTokenHeaderColor,
    "--ui-editor-token-quote": theme.editorTokenQuoteColor,
    "--ui-editor-token-link": theme.editorTokenLinkColor,
  };
}

module.exports = {
  DEFAULT_THEME,
  LIGHT_THEME,
  normalizeThemeMode,
  normalizeContentThemeMode,
  resolveThemeMode,
  resolveContentColorScheme,
  resolveTheme,
  toCssVars,
};
