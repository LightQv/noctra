const os = require("os");
const path = require("path");

function resolveUserPath(rawPath, fallbackPath = "") {
  const source =
    typeof rawPath === "string" && rawPath.trim()
      ? rawPath.trim()
      : fallbackPath;
  if (!source) {
    return "";
  }

  if (source === "~") {
    return os.homedir();
  }

  if (source.startsWith("~/")) {
    return path.join(os.homedir(), source.slice(2));
  }

  return source;
}

module.exports = {
  resolveUserPath,
};
