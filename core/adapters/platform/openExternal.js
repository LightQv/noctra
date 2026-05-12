const { shell } = require("electron");

const DEFAULT_DOCS_BASE_PATH = "https://github.com/LightQv/noctra/blob/main";

function getDocsBasePath() {
  return process.env.NOCTRA_DOCS_BASE_PATH || DEFAULT_DOCS_BASE_PATH;
}

function openDoc(relativePath) {
  if (typeof relativePath !== "string" || relativePath.length === 0) {
    return {
      success: false,
      error: { code: "INVALID_PATH", message: "Invalid relative path" },
    };
  }

  if (relativePath.includes("..") || relativePath.startsWith("/")) {
    return {
      success: false,
      error: { code: "PATH_TRAVERSAL", message: "Access denied" },
    };
  }

  const basePath = getDocsBasePath().replace(/\/$/, "");
  const url = `${basePath}/${relativePath}`;

  return shell
    .openExternal(url)
    .then(() => {
      return { success: true, data: url };
    })
    .catch((err) => {
      return {
        success: false,
        error: { code: "OPEN_FAILED", message: String(err?.message || err) },
      };
    });
}

module.exports = {
  openDoc,
  getDocsBasePath,
};
