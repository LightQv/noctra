const buffers = require("../browser/manager");

function dispatch(win, intent, state) {
  const buf = buffers.getActive();

  if (!buf) return;

  switch (intent.type) {
    case "SCROLL":
      buf.webContents.executeJavaScript(
        `window.scrollBy(0, ${intent.direction === "down" ? intent.amount : -intent.amount})`,
      );
      break;

    case "SCROLL_TOP":
      buf.webContents.executeJavaScript(
        `window.scrollTo({top: 0, behavior: "instant"})`,
      );
      break;

    case "SCROLL_BOTTOM":
      buf.webContents.executeJavaScript(`
				window.scrollTo({
					top: document.documentElement.scrollHeight,
					behavior: "instant"
				});
			`);
      break;

    case "NAV_BACK":
      buf.webContents.navigationHistory.goBack();
      break;

    case "NAV_FORWARD":
      buf.webContents.navigationHistory.goForward();
      break;

    case "ENTER_INSERT":
      // state already changed in motion layer
      break;

    case "SHOW_COMMAND":
      buf.webContents.executeJavaScript(`
				window.__cmd_ui__.el.style.display = 'block';
				window.__cmd_ui__.input.focus();
			`);
      break;

    case "HIDE_COMMAND":
      buf.webContents.executeJavaScript(`
				window.__cmd_ui__.el.style.display = 'none';
				window.__cmd_ui__.input.value = '';
			`);
      break;

    case "COMMAND_INPUT":
      buf.webContents.executeJavaScript(`
				window.__cmd_ui__.input.value = ${JSON.stringify(state.commandBuffer)};
			`);
      break;

    case "NEW_BUFFER":
      buffers.create(win.webContents);
      break;
  }
}

module.exports = { dispatch };
