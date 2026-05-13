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
  shadow: "#5a9fa8",
  highlight: "#b0e8f0",
};

async function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function buildSvg() {
  const size = MASTER_SIZE;
  const cornerRadius = size * 0.22;
  const padding = size * 0.15;
  const innerSize = size - padding * 2;

  // Blocky "N" inspired by the dashboard ASCII art
  // The ASCII uses block characters creating a bold, geometric look
  const strokeWidth = innerSize * 0.18;
  const gap = strokeWidth * 0.25;

  // Center coordinates
  const cx = size / 2;
  const cy = size / 2;

  // The N is composed of 3 vertical/angled bars
  const halfW = innerSize * 0.38;
  const halfH = innerSize * 0.42;

  // Left vertical bar
  const leftX = cx - halfW;
  const leftBar = `<rect x="${leftX - strokeWidth / 2}" y="${cy - halfH}" width="${strokeWidth}" height="${halfH * 2}" rx="${strokeWidth * 0.15}" fill="${COLORS.primary}" />`;

  // Right vertical bar
  const rightX = cx + halfW;
  const rightBar = `<rect x="${rightX - strokeWidth / 2}" y="${cy - halfH}" width="${strokeWidth}" height="${halfH * 2}" rx="${strokeWidth * 0.15}" fill="${COLORS.primary}" />`;

  // Diagonal bar (composed of segments for blocky look)
  const diagSegments = [];
  const segCount = 7;
  const startX = leftX + strokeWidth / 2 + gap;
  const startY = cy + halfH - strokeWidth / 2;
  const endX = rightX - strokeWidth / 2 - gap;
  const endY = cy - halfH + strokeWidth / 2;

  for (let i = 0; i < segCount; i++) {
    const t1 = i / segCount;
    const t2 = (i + 1) / segCount;
    const x1 = startX + (endX - startX) * t1;
    const y1 = startY + (endY - startY) * t1;
    const x2 = startX + (endX - startX) * t2;
    const y2 = startY + (endY - startY) * t2;
    const segCx = (x1 + x2) / 2;
    const segCy = (y1 + y2) / 2;
    const segW = Math.abs(x2 - x1) + strokeWidth;
    const segH = Math.abs(y2 - y1) + strokeWidth;
    const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;

    diagSegments.push(
      `<rect x="${segCx - segW / 2}" y="${segCy - segH / 2}" width="${segW}" height="${segH}" rx="${strokeWidth * 0.1}" fill="${COLORS.primary}" transform="rotate(${angle} ${segCx} ${segCy})" />`
    );
  }

  // Subtle inner glow/shadow overlay
  const innerGlow = `<rect x="0" y="0" width="${size}" height="${size}" rx="${cornerRadius}" fill="url(#glow)" style="mix-blend-mode: overlay;" />`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${COLORS.background}" />
      <stop offset="100%" stop-color="#161b24" />
    </linearGradient>
    <linearGradient id="glow" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="white" stop-opacity="0.08" />
      <stop offset="100%" stop-color="black" stop-opacity="0.15" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="${size * 0.02}" stdDeviation="${size * 0.03}" flood-color="${COLORS.shadow}" flood-opacity="0.4" />
    </filter>
  </defs>
  <!-- Background -->
  <rect x="0" y="0" width="${size}" height="${size}" rx="${cornerRadius}" fill="url(#bg)" />
  <!-- N letter with shadow -->
  <g filter="url(#shadow)">
    ${leftBar}
    ${rightBar}
    ${diagSegments.join("\n    ")}
  </g>
  ${innerGlow}
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
