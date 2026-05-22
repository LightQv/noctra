const { INTENTS } = require("../../intents");

function createBufferHandlers(deps) {
  const { buffers, configService, notificationsService, normalizeUrl } = deps;

  return {
    [INTENTS.NEW_BUFFER]: ({ intent }) => {
      if (intent.url) {
        const normalized = normalizeUrl(intent.url);
        if (!normalized) {
          notificationsService.notify({
            severity: "warning",
            code: "new_buffer_url_blocked",
            message: "Cannot open buffer: blocked by URL security policy",
            source: "core.dispatcher",
            context: { intent, url: intent.url },
            persist: false,
          });
          return;
        }
        buffers.create(normalized);
        return;
      }
      buffers.openConfiguredBuffer();
    },
    [INTENTS.BUFFER_NEXT]: () => buffers.switchByOffset(1),
    [INTENTS.BUFFER_PREV]: () => buffers.switchByOffset(-1),
    [INTENTS.SWITCH_BUFFER]: ({ intent }) => buffers.switchTo(intent.id),
    [INTENTS.CLOSE_BUFFER]: ({ intent }) => buffers.close(intent.id ?? null),
    [INTENTS.REOPEN_BUFFER]: () => buffers.reopenLastClosed(),
    [INTENTS.CLOSE_FOCUSED]: () => {
      if (buffers.isSplitEnabled()) {
        buffers.closeRightSplit();
      } else {
        buffers.close();
      }
    },
    [INTENTS.CLOSE_LEFT_BUFFERS]: () => buffers.closeLeftOfActive(),
    [INTENTS.CLOSE_RIGHT_BUFFERS]: () => buffers.closeRightOfActive(),
    [INTENTS.SPLIT_VERTICAL]: () => {
      const active = buffers.getActive();
      if (active && active.isEditable) {
        notificationsService.notify({
          severity: "info",
          code: "split_not_available_editor",
          message: "Split is not available for editor buffers",
          source: "core.dispatcher",
          persist: false,
        });
        return;
      }
      if (
        active &&
        active.virtualDocument &&
        typeof active.virtualDocument.html === "string" &&
        active.virtualDocument.html.trim()
      ) {
        const isDashboard =
          active.virtualUrl === "noctra://dashboard" ||
          active.url === "noctra://dashboard";
        if (!isDashboard) {
          notificationsService.notify({
            severity: "info",
            code: "split_not_available_virtual",
            message: "Split is not available for this buffer",
            source: "core.dispatcher",
            persist: false,
          });
          return;
        }
      }
      const ratio = configService.getConfigValue(
        "global.split.regular_ratio",
        0.5,
      );
      buffers.openVerticalSplit(ratio);
    },
    [INTENTS.SPLIT_CLOSE_RIGHT]: () => buffers.closeRightSplit(),
    [INTENTS.SPLIT_DEVTOOLS]: () => {
      const ratio = configService.getConfigValue(
        "global.split.devtools_ratio",
        0.25,
      );
      buffers.openDevtoolsSplit(ratio);
    },
    [INTENTS.FOCUS_SPLIT_LEFT]: () => buffers.focusSplitLeft(),
    [INTENTS.FOCUS_SPLIT_RIGHT]: () => buffers.focusSplitRight(),
    [INTENTS.TOGGLE_URLLINE]: () => {
      const nextVisible = !buffers.isUrllineVisible();
      buffers.setUrllineVisible(nextVisible);
    },
    [INTENTS.SET_URLLINE_VISIBILITY]: ({ intent }) => {
      buffers.setUrllineVisible(Boolean(intent.enabled));
    },
  };
}

module.exports = { createBufferHandlers };
