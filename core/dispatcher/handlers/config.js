const { INTENTS } = require("../../intents");

function createConfigHandlers(deps) {
  const {
    configService,
    buffers,
    uiShell,
    sidepanelController,
    notificationsService,
    reloadReloadableBuffers,
    applyThemeEverywhere,
  } = deps;

  return {
    [INTENTS.CONFIG_RELOAD]: ({ state, win }) => {
      const config = configService.reloadConfig();
      if (typeof state.applyConfig === "function") {
        state.applyConfig(config);
      }
      applyThemeEverywhere(win);
      uiShell.setTablineOptions({
        showFavicon: configService.getConfigValue(
          "global.ui.tabline.show_favicon",
          false,
        ),
      });
      buffers.setUrllineVisible(
        configService.getConfigValue("global.ui.urlline.enabled", false),
      );
      sidepanelController.setWidthRatio(
        configService.getConfigValue("global.ui.sidepanel.width_ratio", 0.2),
      );
      sidepanelController.setTreeScrollContextLines(
        configService.getConfigValue(
          "global.ui.sidepanel.tree_scroll_context_lines",
          3,
        ),
      );
      sidepanelController.setTreeDeleteOperatorTimeoutMs(
        configService.getConfigValue(
          "global.ui.sidepanel.delete_operator_timeout_ms",
          900,
        ),
      );
      sidepanelController.layout();
      buffers.layoutViews();
      uiShell.updateSplitDivider(buffers.getSplitStatus());
      notificationsService.notify({
        severity: "info",
        code: "config_reloaded",
        message: "Configuration reloaded",
        source: "core.dispatcher",
        context: { path: configService.getConfigPath() },
        persist: false,
      });
    },
    [INTENTS.SET_THEME_MODE]: ({ intent, state, win }) => {
      const mode = typeof intent.mode === "string" ? intent.mode : "";
      if (!["dark", "light", "auto", "custom"].includes(mode)) {
        notificationsService.notify({
          severity: "warning",
          code: "unknown_theme_mode",
          message: `Unknown theme mode: ${String(intent.mode || "")}`,
          source: "core.dispatcher",
          persist: false,
        });
        return;
      }

      const config = configService.updateThemeMode(mode);
      if (typeof state.applyConfig === "function") {
        state.applyConfig(config);
      }

      applyThemeEverywhere(win);
      notificationsService.notify({
        severity: "info",
        code: "theme_mode_set",
        message: `Theme mode set to ${mode}`,
        source: "core.dispatcher",
        persist: false,
      });
    },
    [INTENTS.SET_BROWSER_LANGUAGE]: ({ intent, state }) => {
      const language =
        typeof intent.language === "string"
          ? intent.language.trim().toLowerCase()
          : "";
      if (!["en", "fr"].includes(language)) {
        notificationsService.notify({
          severity: "warning",
          code: "unknown_browser_language",
          message: `Unknown browser language: ${String(intent.language || "")}`,
          source: "core.dispatcher",
          persist: false,
        });
        return;
      }

      const config = configService.updateBrowserLanguage(language);
      if (typeof state.applyConfig === "function") {
        state.applyConfig(config);
      }

      if (intent.reload) {
        reloadReloadableBuffers();
      }

      notificationsService.notify({
        severity: "info",
        code: "browser_language_set",
        message: intent.reload
          ? `Browser language set to ${language}. Reloaded web buffers.`
          : `Browser language set to ${language}. Reload with :lang ${language}! to apply on current pages.`,
        source: "core.dispatcher",
        persist: false,
      });
    },
    [INTENTS.TOGGLE_COPY_SELECTION_TO_CLIPBOARD]: ({ intent, state }) => {
      const current = Boolean(
        configService.getConfigValue(
          "browser.copy_selection_to_clipboard",
          false,
        ),
      );
      const nextEnabled =
        typeof intent.enabled === "boolean" ? intent.enabled : !current;
      const config = configService.updateCopySelectionToClipboard(nextEnabled);
      if (typeof state.applyConfig === "function") {
        state.applyConfig(config);
      }

      notificationsService.notify({
        severity: "info",
        code: "copy_selection_toggle",
        message: nextEnabled
          ? "Selection auto-copy enabled"
          : "Selection auto-copy disabled",
        source: "core.dispatcher",
        persist: false,
      });
    },
  };
}

module.exports = { createConfigHandlers };
