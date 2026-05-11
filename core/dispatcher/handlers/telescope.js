const { INTENTS } = require("../../intents");

function createTelescopeHandlers(deps) {
  const { uiShell, telescopeService, configService, notificationsService } =
    deps;

  return {
    [INTENTS.TELESCOPE_OPEN_HISTORY]: () => {
      uiShell.showTelescope(
        telescopeService.open("history", {
          promptPosition: configService.getConfigValue(
            "global.ui.telescope.prompt_position",
            "top",
          ),
        }),
      );
    },
    [INTENTS.TELESCOPE_OPEN_BOOKMARKS]: () => {
      uiShell.showTelescope(
        telescopeService.open("bookmarks", {
          promptPosition: configService.getConfigValue(
            "global.ui.telescope.prompt_position",
            "top",
          ),
        }),
      );
    },
    [INTENTS.TELESCOPE_OPEN_BUFFERS]: () => {
      uiShell.showTelescope(
        telescopeService.open("buffers", {
          promptPosition: configService.getConfigValue(
            "global.ui.telescope.prompt_position",
            "top",
          ),
        }),
      );
    },
    [INTENTS.TELESCOPE_REOPEN_LAST]: () => {
      const model = telescopeService.reopenLast(
        configService.getConfigValue(
          "global.ui.telescope.prompt_position",
          "top",
        ),
      );
      if (!model) {
        notificationsService.notify({
          severity: "info",
          code: "telescope_reopen_empty",
          message: "No previous telescope query",
          source: "core.dispatcher",
          persist: false,
        });
        return;
      }
      uiShell.showTelescope(model);
    },
  };
}

module.exports = { createTelescopeHandlers };
