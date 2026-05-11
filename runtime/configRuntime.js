function createConfigRuntime({
  state,
  resetLeaderSession,
  resetSequenceBuffers,
  applyBrowserLanguagePreference,
  buffers,
  configService,
  historyPanel,
  resolveCurrentTheme,
  applyTheme,
  uiShell,
  updateTablineActions,
  updateTablineOptions,
  updateUrllineActions,
  updateUrllineRender,
}) {
  function applyReloadedConfig(config, { refreshLayout = false } = {}) {
    state.applyConfig(config);
    resetLeaderSession(state);
    resetSequenceBuffers(state);

    applyBrowserLanguagePreference();
    buffers.setUrllineVisible(
      configService.getConfigValue("global.ui.urlline.enabled", false),
    );
    historyPanel.setWidthRatio(
      configService.getConfigValue("global.ui.sidepanel.width_ratio", 0.2),
    );
    historyPanel.setTreeScrollContextLines(
      configService.getConfigValue(
        "global.ui.sidepanel.tree_scroll_context_lines",
        3,
      ),
    );
    historyPanel.setTreeDeleteOperatorTimeoutMs(
      configService.getConfigValue(
        "global.ui.sidepanel.delete_operator_timeout_ms",
        900,
      ),
    );

    if (refreshLayout) {
      historyPanel.layout();
      buffers.layoutViews();
    }

    const themeContext = resolveCurrentTheme();
    applyTheme(themeContext, { broadcast: true });
    uiShell.updateSplitDivider(buffers.getSplitStatus());
    updateTablineActions();
    updateTablineOptions();
    updateUrllineActions();
    updateUrllineRender();
  }

  return {
    applyReloadedConfig,
  };
}

module.exports = {
  createConfigRuntime,
};
