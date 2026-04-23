function clampByte(value) {
  const n = Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(255, Math.round(n)));
}

function normalizeHex(input) {
  if (typeof input !== "string") return null;
  const raw = input.trim().replace(/^#/, "");
  if (raw.length === 3 && /^[0-9a-fA-F]{3}$/.test(raw)) {
    return raw
      .split("")
      .map((part) => `${part}${part}`)
      .join("")
      .toLowerCase();
  }
  if (raw.length === 6 && /^[0-9a-fA-F]{6}$/.test(raw)) {
    return raw.toLowerCase();
  }
  return null;
}

function hexToRgb(input) {
  const hex = normalizeHex(input);
  if (!hex) return null;

  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function rgbToHex(rgb) {
  if (!rgb) return "#000000";

  const r = clampByte(rgb.r).toString(16).padStart(2, "0");
  const g = clampByte(rgb.g).toString(16).padStart(2, "0");
  const b = clampByte(rgb.b).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}

function mixHex(colorA, colorB, ratioA = 0.5) {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);
  if (!a || !b) return colorA;

  const normalizedRatioA = Math.max(0, Math.min(1, ratioA));
  const ratioB = 1 - normalizedRatioA;

  return rgbToHex({
    r: a.r * normalizedRatioA + b.r * ratioB,
    g: a.g * normalizedRatioA + b.g * ratioB,
    b: a.b * normalizedRatioA + b.b * ratioB,
  });
}

module.exports = {
  mixHex,
};
