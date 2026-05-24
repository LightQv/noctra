function createConfigRuntime({
  state,
  resetLeaderSession,
  resetSequenceBuffers,
  applyBrowserLanguagePreference,
  buffers,
  configService,
  sidepanelController,
  resolveCurrentTheme,
  applyTheme,
  uiShell,
  updateTablineActions,
  updateTablineOptions,
  updateUrllineActions,
  updateUrllineRender,
  updateLoadinglineRender,
}) {
  function applyReloadedConfig(config, { refreshLayout = false } = {}) {
    state.applyConfig(config);
    resetLeaderSession(state);
    resetSequenceBuffers(state);

    applyBrowserLanguagePreference();
    buffers.setUrllineVisible(
      configService.getConfigValue("global.ui.urlline.enabled", false),
    );
    buffers.setLoadinglineVisible(
      configService.getConfigValue("global.ui.loadingline.enabled", true),
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

    if (refreshLayout) {
      sidepanelController.layout();
      buffers.layoutViews();
    }

    const themeContext = resolveCurrentTheme();
    applyTheme(themeContext, { broadcast: true });
    uiShell.updateSplitDivider(buffers.getSplitStatus());
    updateTablineActions();
    updateTablineOptions();
    updateUrllineActions();
    updateUrllineRender();
    updateLoadinglineRender();
  }

  return {
    applyReloadedConfig,
  };
}

module.exports = {
  createConfigRuntime,
};
