import { writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const PUBLIC = path.join(ROOT, "public");

const BG = "#2a1c12";
const GLOW = "#c47a1a";
const ORANGE = "#e8a33a";
const CREAM = "#f6e7c4";

function iconSvg(size, { maskable = false } = {}) {
  const pad = maskable ? 0.18 : 0.08;
  const scale = 1 - pad * 2;
  const ox = size * pad;
  const art = size * scale;
  const cx = ox + art / 2;
  const apexY = ox + art * 0.16;
  const baseY = ox + art * 0.82;
  const barY = ox + art * 0.58;
  const halfBase = art * 0.36;
  const stroke = Math.max(18, art * 0.085);
  const inner = stroke * 1.65;
  const barHalf = art * 0.13;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BG}"/>
  <defs>
    <radialGradient id="glow" cx="50%" cy="42%" r="48%">
      <stop offset="0%" stop-color="${GLOW}" stop-opacity="0.42"/>
      <stop offset="100%" stop-color="${BG}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#glow)"/>
  <path
    fill="${ORANGE}"
    d="M ${cx} ${apexY}
       L ${cx + halfBase} ${baseY}
       L ${cx + halfBase - stroke} ${baseY}
       L ${cx + barHalf + inner * 0.15} ${barY + stroke * 0.15}
       L ${cx - barHalf - inner * 0.15} ${barY + stroke * 0.15}
       L ${cx - halfBase + stroke} ${baseY}
       L ${cx - halfBase} ${baseY}
       Z"
  />
  <path
    fill="${BG}"
    d="M ${cx} ${apexY + inner * 1.15}
       L ${cx + barHalf} ${barY - stroke * 0.2}
       L ${cx - barHalf} ${barY - stroke * 0.2}
       Z"
  />
  <rect
    x="${cx - art * 0.16}"
    y="${baseY + art * 0.045}"
    width="${art * 0.32}"
    height="${Math.max(8, art * 0.035)}"
    rx="${art * 0.02}"
    fill="${CREAM}"
    opacity="0.92"
  />
</svg>`;
}

async function writePng(file, svg, size) {
  const buf = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
  await writeFile(path.join(PUBLIC, file), buf);
  console.log(`wrote ${file} (${size}x${size}, ${buf.length} bytes)`);
}

await writePng("icon-192.png", iconSvg(192), 192);
await writePng("icon-512.png", iconSvg(512), 512);
await writePng("icon-192-maskable.png", iconSvg(192, { maskable: true }), 192);
await writePng("icon-512-maskable.png", iconSvg(512, { maskable: true }), 512);
await writePng("apple-touch-icon.png", iconSvg(180), 180);
await writePng("favicon.png", iconSvg(32), 32);
