const path = require("node:path");
const { spawn } = require("node:child_process");

function runSmoke({ scenario, timeoutMs = 20000 }) {
  return new Promise((resolve, reject) => {
    const electronBin = path.join(
      __dirname,
      "..",
      "..",
      "node_modules",
      ".bin",
      "electron",
    );
    const projectRoot = path.resolve(__dirname, "..", "..");

    const args = ["."];
    if (process.env.CI_NO_SANDBOX === "1") {
      args.unshift("--no-sandbox");
    }

    const child = spawn(electronBin, args, {
      cwd: projectRoot,
      env: {
        ...process.env,
        NOCTRA_SMOKE_TEST: "1",
        NOCTRA_SMOKE_SCENARIO: scenario,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(
        new Error(`${scenario} smoke timeout: app did not exit in time`),
      );
    }, timeoutMs);

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on("exit", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${scenario} smoke failed with exit code ${code}\n${stderr}`,
        ),
      );
    });
  });
}

module.exports = { runSmoke };
