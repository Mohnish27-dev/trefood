/**
 * Generate the PWA icons.
 *
 *   node scripts/generate-icons.mjs
 *
 * Written by hand rather than pulled from a design file for one reason: the
 * repo has to build and install on a machine with no credentials and no asset
 * pipeline (PHASE_PLAN section 7.3, and the docker-compose exit criterion).
 * A checked-in binary that nobody can regenerate is worse than forty lines of
 * PNG encoder.
 *
 * The mark is deliberately trivial — a saffron ground with a bone "T" — and
 * MASKABLE: Android crops icons to a circle, a squircle or a rounded square
 * depending on the launcher, so the glyph sits inside the middle 60% safe zone
 * and the colour bleeds to every edge. An icon with its own rounded corners
 * gets those corners cropped off and looks broken.
 */

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

/** Midnight Campus, straight from globals.css. */
const SAFFRON = [0xff, 0x6b, 0x1a];
const BONE = [0xf5, 0xf3, 0xef];

function renderIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);

  // Full-bleed ground. Maskable icons must have no transparent margin.
  for (let i = 0; i < size * size; i += 1) {
    pixels[i * 4] = SAFFRON[0];
    pixels[i * 4 + 1] = SAFFRON[1];
    pixels[i * 4 + 2] = SAFFRON[2];
    pixels[i * 4 + 3] = 0xff;
  }

  // A "T" inside the safe zone: the crossbar and the stem, as two rectangles.
  const unit = size / 100;
  const barTop = Math.round(30 * unit);
  const barBottom = Math.round(41 * unit);
  const barLeft = Math.round(26 * unit);
  const barRight = Math.round(74 * unit);
  const stemLeft = Math.round(43 * unit);
  const stemRight = Math.round(57 * unit);
  const stemBottom = Math.round(72 * unit);

  const paint = (x0, y0, x1, y1) => {
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const i = (y * size + x) * 4;
        pixels[i] = BONE[0];
        pixels[i + 1] = BONE[1];
        pixels[i + 2] = BONE[2];
      }
    }
  };

  paint(barLeft, barTop, barRight, barBottom);
  paint(stemLeft, barBottom, stemRight, stemBottom);

  return encodePng(pixels, size, size);
}

/* ------------------------------------------------------------------ */
/* A minimal PNG encoder: signature, IHDR, IDAT, IEND                  */
/* ------------------------------------------------------------------ */

function encodePng(rgba, width, height) {
  // Each scanline is prefixed with a filter byte. Zero means "no filter",
  // which costs a few kilobytes and saves implementing the other four.
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);

  return Buffer.concat([length, body, crc]);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* ------------------------------------------------------------------ */

mkdirSync(OUT_DIR, { recursive: true });

for (const size of [192, 512]) {
  const file = join(OUT_DIR, `icon-${size}.png`);
  writeFileSync(file, renderIcon(size));
  console.log(`  ${file}`);
}

// iOS ignores the manifest's icons and reads this one from the <head>.
writeFileSync(join(OUT_DIR, "apple-touch-icon.png"), renderIcon(180));
console.log(`  ${join(OUT_DIR, "apple-touch-icon.png")}`);
