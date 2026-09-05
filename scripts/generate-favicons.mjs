/**
 * Generate Google-compliant favicons, PWA icons, and OpenGraph social card.
 *
 * Uses public/logo.png as the high-resolution source.
 * Run: node scripts/generate-favicons.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const ICONS_DIR = path.join(PUBLIC_DIR, 'icons');
const SOURCE_LOGO = path.join(PUBLIC_DIR, 'logo.png');

if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

// 1. Multi-resolution ICO builder (16, 32, 48)
async function buildIco(sizes, srcPath, destPath) {
  const images = [];
  for (const s of sizes) {
    const buf = await sharp(srcPath).resize(s, s).png().toBuffer();
    images.push({ size: s, buf });
  }

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = ICO
  header.writeUInt16LE(images.length, 4); // count

  let offset = 6 + images.length * 16;
  const entries = [];
  for (const img of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(img.size >= 256 ? 0 : img.size, 0); // width
    entry.writeUInt8(img.size >= 256 ? 0 : img.size, 1); // height
    entry.writeUInt8(0, 2); // color palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(img.buf.length, 8); // size of image data
    entry.writeUInt32LE(offset, 12); // offset
    entries.push(entry);
    offset += img.buf.length;
  }

  const finalBuf = Buffer.concat([header, ...entries, ...images.map(i => i.buf)]);
  fs.writeFileSync(destPath, finalBuf);
  console.log(`✓ Generated ${path.relative(ROOT_DIR, destPath)} (${finalBuf.length} bytes)`);
}

// 2. Generate standard icon sizes
async function generateIcons() {
  console.log('Generating Google-compliant favicons and app icons...');

  // Google Search multiples of 48: 48, 96, 144, 192
  // Standard web/PWA: 32, 64, 128, 512, apple-touch-icon (180)
  const sizes = [
    { name: 'icon-32.png', size: 32 },
    { name: 'icon-48.png', size: 48 }, // Primary Google multiple of 48
    { name: 'icon-64.png', size: 64 },
    { name: 'icon-96.png', size: 96 }, // 2x Google multiple of 48
    { name: 'icon-128.png', size: 128 },
    { name: 'icon-144.png', size: 144 }, // 3x Google multiple of 48
    { name: 'icon-192.png', size: 192 }, // 4x Google multiple of 48 + PWA
    { name: 'icon-512.png', size: 512 }, // High-res PWA
    { name: 'apple-touch-icon.png', size: 180 },
  ];

  for (const item of sizes) {
    const dest = path.join(ICONS_DIR, item.name);
    await sharp(SOURCE_LOGO)
      .resize(item.size, item.size)
      .png({ quality: 100, compressionLevel: 9 })
      .toFile(dest);
    console.log(`✓ Generated ${path.relative(ROOT_DIR, dest)} (${item.size}x${item.size})`);
  }

  // Also write public/favicon.png (48x48) and apple-touch-icon in public root for crawlers that check /apple-touch-icon.png
  await sharp(SOURCE_LOGO)
    .resize(48, 48)
    .png({ quality: 100 })
    .toFile(path.join(PUBLIC_DIR, 'favicon.png'));
  console.log('✓ Generated public/favicon.png (48x48)');

  await sharp(SOURCE_LOGO)
    .resize(180, 180)
    .png({ quality: 100 })
    .toFile(path.join(PUBLIC_DIR, 'apple-touch-icon.png'));
  console.log('✓ Generated public/apple-touch-icon.png (180x180)');

  // Build ICO container with 16, 32, 48px
  await buildIco([16, 32, 48], SOURCE_LOGO, path.join(PUBLIC_DIR, 'favicon.ico'));
}

// 3. Generate 1200x630 OpenGraph Banner
async function generateOgImage() {
  console.log('Generating OpenGraph preview card (1200x630)...');
  const width = 1200;
  const height = 630;

  // Render SVG overlay with brand typography and styling
  const logoResizedBuf = await sharp(SOURCE_LOGO)
    .resize(200, 200)
    .png()
    .toBuffer();

  const logoBase64 = `data:image/png;base64,${logoResizedBuf.toString('base64')}`;

  const svgOverlay = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="glow" cx="60%" cy="40%" r="60%">
          <stop offset="0%" stop-color="#FF6B1A" stop-opacity="0.18" />
          <stop offset="100%" stop-color="#0B0D12" stop-opacity="0" />
        </radialGradient>
        <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#FF6B1A" stop-opacity="0.2" />
          <stop offset="100%" stop-color="#FF6B1A" stop-opacity="0.05" />
        </linearGradient>
      </defs>

      <!-- Background Glow -->
      <rect width="${width}" height="${height}" fill="url(#glow)" />

      <!-- Top Badge -->
      <g transform="translate(100, 120)">
        <rect width="240" height="38" rx="19" fill="url(#badgeGrad)" stroke="#FF6B1A" stroke-opacity="0.4" />
        <circle cx="20" cy="19" r="4" fill="#FF6B1A" />
        <text x="32" y="24" fill="#FF6B1A" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="600" letter-spacing="0.5">LIVE AT NIT PATNA</text>
      </g>

      <!-- Heading -->
      <text x="100" y="240" fill="#F5F3EF" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="64" font-weight="800" letter-spacing="-1">
        Hungry at 1 AM?
      </text>
      <text x="100" y="320" fill="#FF6B1A" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="64" font-weight="800" letter-spacing="-1">
        Food at your gate.
      </text>

      <!-- Subtitle -->
      <text x="100" y="400" fill="#9CA3AF" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="24" font-weight="400">
        Order from campus canteens. Match the 4 digits. Done.
      </text>

      <!-- URL footer -->
      <text x="100" y="520" fill="#F5F3EF" font-family="monospace" font-size="22" font-weight="700" letter-spacing="1">
        trefood.in
      </text>

      <!-- Brand Logo on Right -->
      <image href="${logoBase64}" x="880" y="215" width="200" height="200" />
    </svg>
  `);

  // Create base dark canvas #0B0D12
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 11, g: 13, b: 18, alpha: 1 },
    },
  })
    .composite([{ input: svgOverlay, top: 0, left: 0 }])
    .png({ quality: 95 })
    .toFile(path.join(PUBLIC_DIR, 'og-image.png'));

  console.log('✓ Generated public/og-image.png (1200x630)');
}

async function run() {
  try {
    await generateIcons();
    await generateOgImage();
    console.log('\nAll icon and OG assets generated successfully!');
  } catch (err) {
    console.error('Error generating icons:', err);
    process.exit(1);
  }
}

run();
