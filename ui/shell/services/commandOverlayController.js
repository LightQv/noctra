const {
  pushShellPatch,
} = require("../../../core/adapters/renderer/shellPatchTransport");

function isCommandVisible() {
  return this.commandVisible;
}

function showCommand(text = "", cursorIndex = null, context = "shell") {
  this.commandVisible = true;
  this.commandContext = context === "editor" ? "editor" : "shell";
  this.commandText = text;
  this.commandCursorIndex = Number.isFinite(cursorIndex)
    ? Math.max(0, Math.min(Math.trunc(cursorIndex), String(text).length))
    : String(text).length;
  this.keepCommandOverlayAboveContentViews();
  this.updateCommand(text, this.commandCursorIndex, this.commandContext);
}

function hideCommand() {
  this.commandVisible = false;
  this.commandText = "";
  this.commandCursorIndex = 0;
  this.commandContext = "shell";
  this.updateCommand("", 0);
  this.relayout();
}

function updateCommand(text = "", cursorIndex = null, context = null) {
  const nextText = String(text);
  const maxCursor = nextText.length;
  const nextCursor = Number.isFinite(cursorIndex)
    ? Math.max(0, Math.min(Math.trunc(cursorIndex), maxCursor))
    : maxCursor;

  if (typeof context === "string") {
    this.commandContext = context === "editor" ? "editor" : "shell";
  }

  this.commandText = nextText;
  this.commandCursorIndex = nextCursor;

  if (!this.commandOverlayView || !this.commandOverlayReady) return;

  const beforeText = nextText.slice(0, nextCursor);
  const afterText = nextText.slice(nextCursor);
  const cursorClass =
    nextCursor < nextText.length ? "cursor-bar" : "cursor-block";
  const isEditorContext = this.commandContext === "editor";
  const commandTitle = isEditorContext ? "Ex" : "Cmdline";
  const commandPrefix = "";

  pushShellPatch(
    this.commandOverlayView.webContents,
    `
      (function updateCommandOverlayText() {
        const titleNode = document.getElementById('command-title');
        const prefixNode = document.getElementById('command-prefix');
        const beforeNode = document.getElementById('command-text-before');
        const afterNode = document.getElementById('command-text-after');
        const cursorNode = document.getElementById('command-cursor');
        if (!titleNode || !prefixNode || !beforeNode || !afterNode || !cursorNode) return;
        titleNode.textContent = ${JSON.stringify(commandTitle)};
        prefixNode.textContent = ${JSON.stringify(commandPrefix)};
        beforeNode.textContent = ${JSON.stringify(beforeText)};
        afterNode.textContent = ${JSON.stringify(afterText)};
        cursorNode.className = ${JSON.stringify(cursorClass)};
      })();
    `,
  );
}

module.exports = {
  isCommandVisible,
  showCommand,
  hideCommand,
  updateCommand,
};
