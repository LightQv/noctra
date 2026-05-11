const fs = require("fs");
const path = require("path");

const OWNERS = {
  mode: new Set(["core/modeTransitionService.js"]),
  leaderActive: new Set(["core/state/leaderState.js"]),
  leaderPath: new Set(["core/state/leaderState.js"]),
  leaderNumericBuffer: new Set(["core/state/leaderState.js"]),
  leaderLastKeyTime: new Set(["core/state/leaderState.js"]),
  commandBuffer: new Set(["core/state/commandState.js"]),
  commandCursorIndex: new Set(["core/state/commandState.js"]),
  commandTarget: new Set(["core/state/commandState.js"]),
  urllineEditing: new Set(["core/state/urllineState.js"]),
  urllinePane: new Set(["core/state/urllineState.js"]),
  urllineBuffer: new Set(["core/state/urllineState.js"]),
  urllineCursorIndex: new Set(["core/state/urllineState.js"]),
  editorFocus: new Set(["core/editorFocusState.js"]),
  editorMode: new Set(["core/state/editorModeState.js"]),
};

const ASSIGNMENT_REGEX =
  /\bstate\.(mode|leaderActive|leaderPath|leaderNumericBuffer|leaderLastKeyTime|commandBuffer|commandCursorIndex|commandTarget|urllineEditing|urllinePane|urllineBuffer|urllineCursorIndex|editorFocus|editorMode)\s*=(?!=)/g;

const SCAN_ROOTS = ["main.js", "runtime", "core", "motions", "ui", "browser", "tests"];
const EXCLUDED_DIRS = new Set(["node_modules", "dist", "coverage", ".git"]);

function toPosixPath(filePath) {
  return filePath.split(path.sep).join("/");
}

function collectJsFiles(rootDir) {
  const files = [];

  function walk(absolutePath) {
    const stat = fs.statSync(absolutePath);
    if (stat.isDirectory()) {
      const name = path.basename(absolutePath);
      if (EXCLUDED_DIRS.has(name)) {
        return;
      }

      const entries = fs.readdirSync(absolutePath);
      for (const entry of entries) {
        walk(path.join(absolutePath, entry));
      }
      return;
    }

    if (stat.isFile() && absolutePath.endsWith(".js")) {
      files.push(absolutePath);
    }
  }

  for (const root of SCAN_ROOTS) {
    const absolute = path.join(rootDir, root);
    if (!fs.existsSync(absolute)) {
      continue;
    }

    walk(absolute);
  }

  return files;
}

function scanFile(filePath, repoRoot) {
  const relPath = toPosixPath(path.relative(repoRoot, filePath));
  const text = fs.readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/);
  const violations = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    ASSIGNMENT_REGEX.lastIndex = 0;
    let match = ASSIGNMENT_REGEX.exec(line);

    while (match) {
      const field = match[1];
      const owners = OWNERS[field] || new Set();
      if (!owners.has(relPath)) {
        violations.push({
          path: relPath,
          line: lineIndex + 1,
          field,
          ownerFiles: [...owners].sort(),
        });
      }
      match = ASSIGNMENT_REGEX.exec(line);
    }
  }

  return violations;
}

function scanStateOwnership(repoRoot) {
  const files = collectJsFiles(repoRoot);
  const violations = [];

  for (const file of files) {
    violations.push(...scanFile(file, repoRoot));
  }

  return violations.sort((a, b) => {
    if (a.path !== b.path) return a.path.localeCompare(b.path);
    return a.line - b.line;
  });
}

function main() {
  const repoRoot = path.join(__dirname, "..");
  const strict = process.env.STATE_OWNERSHIP_STRICT !== "0";
  const violations = scanStateOwnership(repoRoot);

  if (violations.length === 0) {
    console.log("State ownership check passed.");
    return;
  }

  console.error("State ownership violations found:");
  for (const item of violations) {
    console.error(
      `${item.path}:${item.line} ${item.field} ${item.ownerFiles.join(",") || "<no-owner-configured>"}`,
    );
  }
  console.error(`Total violations: ${violations.length}`);

  if (strict) {
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  OWNERS,
  ASSIGNMENT_REGEX,
  collectJsFiles,
  scanFile,
  scanStateOwnership,
};
