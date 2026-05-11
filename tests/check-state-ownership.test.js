const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { scanStateOwnership } = require("../scripts/check-state-ownership");

function writeFile(root, relPath, content) {
  const absolute = path.join(root, relPath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content, "utf8");
}

function withTempRepo(run) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "noctra-state-ownership-"));
  try {
    return run(tempRoot);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

test("state ownership passes for authorized writer files", () => {
  withTempRepo((repo) => {
    writeFile(repo, "core/modeTransitionService.js", 'function x(state){ state.mode = "NORMAL"; }\n');
    writeFile(repo, "core/state/leaderState.js", "function x(state){ state.leaderActive = true; }\n");
    writeFile(repo, "core/state/commandState.js", "function x(state){ state.commandBuffer = \"open\"; }\n");
    writeFile(repo, "core/state/urllineState.js", "function x(state){ state.urllineEditing = true; }\n");
    writeFile(repo, "core/editorFocusState.js", "function x(state){ state.editorFocus = true; }\n");
    writeFile(repo, "core/state/editorModeState.js", "function x(state){ state.editorMode = \"INSERT\"; }\n");

    const violations = scanStateOwnership(repo);
    assert.equal(violations.length, 0);
  });
});

test("state ownership flags unauthorized direct writes", () => {
  withTempRepo((repo) => {
    writeFile(repo, "runtime/urllineCoordinator.js", "function x(state){ state.urllineBuffer = \"x\"; }\n");
    writeFile(repo, "main.js", 'function x(state){ state.mode = "COMMAND"; }\n');

    const violations = scanStateOwnership(repo);
    assert.equal(violations.length, 2);
    assert.deepEqual(
      violations.map((item) => `${item.path}:${item.field}`),
      ["main.js:mode", "runtime/urllineCoordinator.js:urllineBuffer"],
    );
  });
});

test("state ownership ignores comparisons and non-assignments", () => {
  withTempRepo((repo) => {
    writeFile(
      repo,
      "main.js",
      [
        'function x(state){ if (state.mode === "COMMAND") return true; }',
        'function y(state){ return state.commandTarget == "EDITOR"; }',
        "",
      ].join("\n"),
    );

    const violations = scanStateOwnership(repo);
    assert.equal(violations.length, 0);
  });
});
