const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

const ICONS_DIR = path.join(__dirname, "..", "assets", "icons");
const MASTER_SIZE = 1024;
const LIGHT_SOURCE = path.join(ICONS_DIR, "light_icon.png");
const DARK_SOURCE = path.join(ICONS_DIR, "dark_icon.png");

async function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function resizePng(inputPath, outputPath, size) {
  await execFileAsync("magick", [
    "-background", "none",
    inputPath,
    "-resize", `${size}x${size}`,
    outputPath,
  ]);
}

async function generateIcns(pngPath, icnsPath) {
  const iconsetDir = icnsPath.replace(".icns", ".iconset");
  await ensureDir(iconsetDir);

  const sizes = [
    { name: "icon_16x16", size: 16 },
    { name: "icon_16x16@2x", size: 32 },
    { name: "icon_32x32", size: 32 },
    { name: "icon_32x32@2x", size: 64 },
    { name: "icon_128x128", size: 128 },
    { name: "icon_128x128@2x", size: 256 },
    { name: "icon_256x256", size: 256 },
    { name: "icon_256x256@2x", size: 512 },
    { name: "icon_512x512", size: 512 },
    { name: "icon_512x512@2x", size: 1024 },
  ];

  for (const { name, size } of sizes) {
    const outPath = path.join(iconsetDir, `${name}.png`);
    await execFileAsync("magick", [
      "-background", "none",
      pngPath,
      "-resize", `${size}x${size}`,
      outPath,
    ]);
  }

  await execFileAsync("iconutil", ["-c", "icns", iconsetDir, "-o", icnsPath]);

  // Clean up iconset directory
  fs.rmSync(iconsetDir, { recursive: true, force: true });
}

async function main() {
  await ensureDir(ICONS_DIR);

  if (!fs.existsSync(LIGHT_SOURCE)) {
    throw new Error(`Missing icon source: ${LIGHT_SOURCE}`);
  }
  if (!fs.existsSync(DARK_SOURCE)) {
    throw new Error(`Missing icon source: ${DARK_SOURCE}`);
  }

  const masterPngPath = path.join(ICONS_DIR, "icon.png");
  const linuxPngPath = path.join(ICONS_DIR, "icon_512.png");
  const linuxLightPngPath = path.join(ICONS_DIR, "icon-light_512.png");
  const linuxDarkPngPath = path.join(ICONS_DIR, "icon-dark_512.png");
  const icnsPath = path.join(ICONS_DIR, "icon.icns");

  console.log("Generating master PNG (1024x1024) from dark icon...");
  await resizePng(DARK_SOURCE, masterPngPath, MASTER_SIZE);

  console.log("Generating Linux PNGs (512x512)...");
  await Promise.all([
    resizePng(DARK_SOURCE, linuxPngPath, 512),
    resizePng(LIGHT_SOURCE, linuxLightPngPath, 512),
    resizePng(DARK_SOURCE, linuxDarkPngPath, 512),
  ]);

  console.log("Generating macOS ICNS...");
  await generateIcns(masterPngPath, icnsPath);

  console.log("Done! Icons generated in assets/icons/");
  console.log("  - icon.png (1024x1024 master)");
  console.log("  - icon_512.png (Linux app icon)");
  console.log("  - icon-light_512.png (Linux light variant)");
  console.log("  - icon-dark_512.png (Linux dark variant)");
  console.log("  - icon.icns (macOS app icon)");
}

main().catch((err) => {
  console.error("Icon generation failed:", err);
  process.exit(1);
});
