const {
  executeScript,
  isUsableWebContents,
} = require("../platform/webContentsActions");

function focus(buffer, options = {}) {
  if (
    !buffer ||
    !buffer.isEditable ||
    !isUsableWebContents(buffer.webContents)
  ) {
    return;
  }

  const forceNormal = Boolean(options.forceNormal);
  executeScript(
    buffer.webContents,
    `
      if (${JSON.stringify(forceNormal)} && typeof window.__settingsEditorSetNormal__ === "function") {
        window.__settingsEditorSetNormal__();
      }
      if (typeof window.__settingsEditorFocus__ === "function") {
        window.__settingsEditorFocus__();
      }
    `,
  ).catch(() => {});

  if (buffer.webContents.isLoadingMainFrame()) {
    buffer.webContents.once("did-finish-load", () => {
      if (!isUsableWebContents(buffer.webContents)) return;
      executeScript(
        buffer.webContents,
        `if (typeof window.__settingsEditorFocus__ === "function") { window.__settingsEditorFocus__(); }`,
      ).catch(() => {});
    });
  }
}

function blur(buffer) {
  if (
    !buffer ||
    !buffer.isEditable ||
    !isUsableWebContents(buffer.webContents)
  ) {
    return;
  }

  executeScript(
    buffer.webContents,
    `if (typeof window.__settingsEditorBlur__ === "function") { window.__settingsEditorBlur__(); }`,
  ).catch(() => {});
}

function runCommand(buffer, commandText) {
  if (
    !buffer ||
    !buffer.isEditable ||
    !isUsableWebContents(buffer.webContents)
  ) {
    return;
  }

  executeScript(
    buffer.webContents,
    `
      if (typeof window.__settingsEditorRunCommand__ === "function") {
        window.__settingsEditorRunCommand__(${JSON.stringify(String(commandText || ""))});
      }
    `,
  ).catch(() => {});
}

function search(buffer, queryText) {
  if (
    !buffer ||
    !buffer.isEditable ||
    !isUsableWebContents(buffer.webContents)
  ) {
    return;
  }

  executeScript(
    buffer.webContents,
    `
      if (typeof window.__settingsEditorSearch__ === "function") {
        window.__settingsEditorSearch__(${JSON.stringify(String(queryText || ""))});
      }
    `,
  ).catch(() => {});
}

module.exports = {
  focus,
  blur,
  runCommand,
  search,
};
