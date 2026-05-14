const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

const ICONS_DIR = path.join(__dirname, "..", "assets", "icons");
const MASTER_SIZE = 1024;

const COLORS = {
  background: "#0f131a",
  primary: "#89dceb",
};

async function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function buildSvg() {
  const size = MASTER_SIZE;
  const cornerRadius = size * 0.22;

  // Grid-based blocky N, inspired by dashboard ASCII art (░▒▓ style)
  // We draw on a virtual grid and scale to the canvas
  const gridW = 11;
  const gridH = 13;
  const cell = size / (Math.max(gridW, gridH) + 2); // padding around the grid
  const offsetX = (size - gridW * cell) / 2;
  const offsetY = (size - gridH * cell) / 2;

  // Define the N as a set of filled cells [row, col]
  // 0,0 is top-left. Rows go down, cols go right.
  const nCells = [];

  // Left vertical bar (2 cells wide)
  for (let r = 0; r < gridH; r++) {
    nCells.push([r, 0]);
    nCells.push([r, 1]);
  }

  // Right vertical bar (2 cells wide)
  for (let r = 0; r < gridH; r++) {
    nCells.push([r, gridW - 2]);
    nCells.push([r, gridW - 1]);
  }

  // Diagonal / stepped bar (blocky, 2 cells wide)
  const diagSteps = [
    [2, 2], [2, 3],
    [3, 3], [3, 4],
    [4, 4], [4, 5],
    [5, 5], [5, 6],
    [6, 6], [6, 7],
    [7, 7], [7, 8],
    [8, 8], [8, 9],
    [9, 9], [9, 10],
  ];
  nCells.push(...diagSteps);

  // Build SVG rects from cells
  const rects = nCells.map(([r, c]) => {
    const x = offsetX + c * cell;
    const y = offsetY + r * cell;
    // Small gap between blocks for the "block character" look
    const gap = cell * 0.08;
    return `<rect x="${x + gap}" y="${y + gap}" width="${cell - gap * 2}" height="${cell - gap * 2}" rx="${cell * 0.1}" fill="${COLORS.primary}" />`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <!-- Solid dark background -->
  <rect x="0" y="0" width="${size}" height="${size}" rx="${cornerRadius}" fill="${COLORS.background}" />
  <!-- Blocky N -->
  ${rects.join("\n  ")}
</svg>`;
}

async function generatePngFromSvg(svgPath, pngPath, size) {
  await execFileAsync("magick", [
    "-background", "none",
    svgPath,
    "-resize", `${size}x${size}`,
    pngPath,
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

  const svgPath = path.join(ICONS_DIR, "icon.svg");
  const masterPngPath = path.join(ICONS_DIR, "icon.png");
  const linuxPngPath = path.join(ICONS_DIR, "icon_512.png");
  const icnsPath = path.join(ICONS_DIR, "icon.icns");

  console.log("Generating SVG icon...");
  const svg = buildSvg();
  fs.writeFileSync(svgPath, svg, "utf-8");

  console.log("Generating master PNG (1024x1024)...");
  await generatePngFromSvg(svgPath, masterPngPath, MASTER_SIZE);

  console.log("Generating Linux PNG (512x512)...");
  await generatePngFromSvg(svgPath, linuxPngPath, 512);

  console.log("Generating macOS ICNS...");
  await generateIcns(masterPngPath, icnsPath);

  console.log("Done! Icons generated in assets/icons/");
  console.log("  - icon.svg (source)");
  console.log("  - icon.png (1024x1024 master)");
  console.log("  - icon_512.png (Linux app icon)");
  console.log("  - icon.icns (macOS app icon)");
}

main().catch((err) => {
  console.error("Icon generation failed:", err);
  process.exit(1);
});
