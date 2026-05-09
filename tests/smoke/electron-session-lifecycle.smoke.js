const path = require("node:path");
const { spawn } = require("node:child_process");

function runSmoke() {
  return new Promise((resolve, reject) => {
    const electronBin = path.join(__dirname, "..", "..", "node_modules", ".bin", "electron");
    const projectRoot = path.resolve(__dirname, "..", "..");
    const child = spawn(electronBin, ["."], {
      cwd: projectRoot,
      env: {
        ...process.env,
        NOCTRA_SMOKE_TEST: "1",
        NOCTRA_SMOKE_SCENARIO: "session-lifecycle",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Session lifecycle smoke timeout: app did not exit in time"));
    }, 30000);

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

      reject(new Error(`Session lifecycle smoke failed with exit code ${code}\n${stderr}`));
    });
  });
}

runSmoke().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
