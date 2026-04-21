function parseCommand(raw) {
  const [cmd, ...args] = raw.trim().split(" ");
  const arg = args.join(" ");

  switch (cmd) {
    case "open":
      return { type: "OPEN_URL", url: arg };

    case "tabnew":
      return { type: "NEW_BUFFER" };

    case "quit":
      return { type: "QUIT" };

    default:
      return { type: "UNKNOWN_COMMAND", raw };
  }
}

module.exports = { parseCommand };
