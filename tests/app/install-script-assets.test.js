const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const installScriptPath = path.join(__dirname, "../../scripts/install.sh");

function runInstallerFunctionCheck(script) {
  return execFileSync("bash", ["-lc", script], {
    cwd: path.join(__dirname, "../.."),
    encoding: "utf8",
  }).trim();
}

test("install script asset patterns match release URLs", () => {
  const source = fs.readFileSync(installScriptPath, "utf8");
  const functionsOnly = source.replace(/\nmain "\$@"\s*$/, "\n");
  const fixture = JSON.stringify({
    assets: [
      {
        browser_download_url:
          "https://github.com/LightQv/noctra/releases/download/v0.1.1/checksums.txt",
      },
      {
        browser_download_url:
          "https://github.com/LightQv/noctra/releases/download/v0.1.1/Noctra.dmg",
      },
      {
        browser_download_url:
          "https://github.com/LightQv/noctra/releases/download/v0.1.1/noctra_0.1.1_amd64.deb",
      },
      {
        browser_download_url:
          "https://github.com/LightQv/noctra/releases/download/v0.1.1/noctra-0.1.1-1.x86_64.rpm",
      },
      {
        browser_download_url:
          "https://github.com/LightQv/noctra/releases/download/v0.1.1/Noctra-0.1.1-x64.AppImage",
      },
    ],
  });

  const output = runInstallerFunctionCheck(`
    set -euo pipefail
    ${functionsOnly}
    json=${JSON.stringify(fixture)}
    METHOD=auto
    pick_asset "$json" darwin
    printf '\n'
    pick_asset "$json" linux
    printf '\n'
    asset_url_for "$json" 'checksums\\.txt$'
  `);

  const lines = output.split("\n");
  assert.equal(lines[0], "https://github.com/LightQv/noctra/releases/download/v0.1.1/Noctra.dmg");
  assert.equal(lines[1], "https://github.com/LightQv/noctra/releases/download/v0.1.1/noctra_0.1.1_amd64.deb");
  assert.equal(lines[2], "https://github.com/LightQv/noctra/releases/download/v0.1.1/checksums.txt");
});
