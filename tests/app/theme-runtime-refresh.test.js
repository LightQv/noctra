const test = require("node:test");
const assert = require("node:assert/strict");

const { createThemeRuntime } = require("../../runtime/themeRuntime");

test("theme runtime refreshes dashboard and cat buffers", () => {
  let dashboardRefreshes = 0;
  let catRefreshes = 0;

  const runtime = createThemeRuntime({
    configService: {
      getConfigValue() {
        return {};
      },
    },
    nativeTheme: { shouldUseDarkColors: true, themeSource: "system" },
    resolveTheme: () => ({ scrollbarThumbColor: "#111111", scrollbarThumbActiveColor: "#222222" }),
    resolveThemeMode: () => "dark",
    resolveContentColorScheme: () => "dark",
    normalizeThemeMode: () => "dark",
    normalizeContentThemeMode: () => "dark",
    normalizeCustomBase: () => "dark",
    toCssVars: () => ({}),
    buffers: {
      setContentUiOptions() {},
      refreshDashboardBuffers() {
        dashboardRefreshes += 1;
      },
      refreshCatBuffers() {
        catRefreshes += 1;
      },
    },
    uiShell: { setTheme() {} },
    sidepanelController: { setThemeVars() {} },
    broadcastThemeUpdate() {},
  });

  runtime.applyTheme({
    theme: {
      scrollbarThumbColor: "#111111",
      scrollbarThumbActiveColor: "#222222",
    },
    configuredMode: "dark",
    resolvedMode: "dark",
    contentColorScheme: "dark",
    customBase: "dark",
  });

  assert.equal(dashboardRefreshes, 1);
  assert.equal(catRefreshes, 1);
});
