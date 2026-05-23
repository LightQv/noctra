function createThemeRuntime({
  configService,
  nativeTheme,
  resolveTheme,
  resolveThemeMode,
  resolveContentColorScheme,
  normalizeThemeMode,
  normalizeContentThemeMode,
  normalizeCustomBase,
  toCssVars,
  buffers,
  uiShell,
  sidepanelController,
  broadcastThemeUpdate,
}) {
  function resolveCurrentTheme() {
    const themeConfig = configService.getConfigValue("global.theme", {});
    const systemPrefersDark = nativeTheme.shouldUseDarkColors;
    const configuredMode = normalizeThemeMode(
      typeof themeConfig?.mode === "string"
        ? themeConfig.mode
        : themeConfig?.name,
      "dark",
    );
    const resolvedMode = resolveThemeMode(themeConfig, { systemPrefersDark });
    const contentMode = normalizeContentThemeMode(
      themeConfig?.content_mode,
      "dark",
    );
    const contentColorScheme = resolveContentColorScheme(themeConfig, {
      systemPrefersDark,
    });
    const customBase = normalizeCustomBase(themeConfig?.custom_base, "dark");
    const theme = resolveTheme(themeConfig, { systemPrefersDark });

    return {
      theme,
      configuredMode,
      resolvedMode,
      contentMode,
      contentColorScheme,
      customBase,
    };
  }

  function buildThemePayload(themeContext) {
    const theme =
      themeContext && themeContext.theme
        ? themeContext.theme
        : themeContext || {};
    const resolvedMode =
      themeContext && typeof themeContext.resolvedMode === "string"
        ? themeContext.resolvedMode
        : "dark";

    return {
      theme,
      themeVars: toCssVars(theme),
      colorScheme: resolvedMode === "light" ? "light" : "dark",
      resolvedMode,
    };
  }

  function syncContentUiTheme(theme) {
    const contentColorScheme =
      theme.contentColorScheme === "light" ? "light" : "dark";
    buffers.setContentUiOptions({
      thumbColor: theme.scrollbarThumbColor,
      thumbActiveColor: theme.scrollbarThumbActiveColor,
      contentColorScheme,
    });
  }

  function applyTheme(themeContext, options = {}) {
    const shouldBroadcast = Boolean(options.broadcast);
    const payload = buildThemePayload(themeContext);
    const uiFollowsSystem =
      themeContext.configuredMode === "auto" ||
      (themeContext.configuredMode === "custom" &&
        themeContext.customBase === "auto");
    nativeTheme.themeSource = uiFollowsSystem
      ? "system"
      : themeContext.resolvedMode;
    uiShell.setTheme(payload.theme);
    if (
      sidepanelController &&
      typeof sidepanelController.setThemeVars === "function"
    ) {
      sidepanelController.setThemeVars(payload.themeVars);
    }
    syncContentUiTheme({
      ...payload.theme,
      contentColorScheme:
        themeContext && themeContext.contentColorScheme === "light"
          ? "light"
          : "dark",
    });
    if (typeof buffers.refreshDashboardBuffers === "function") {
      buffers.refreshDashboardBuffers();
    }
    if (typeof buffers.refreshCatBuffers === "function") {
      buffers.refreshCatBuffers();
    }
    if (shouldBroadcast) {
      broadcastThemeUpdate(payload);
    }
  }

  return {
    resolveCurrentTheme,
    buildThemePayload,
    applyTheme,
  };
}

module.exports = {
  createThemeRuntime,
};
