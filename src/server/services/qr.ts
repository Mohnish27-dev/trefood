/* eslint-disable no-restricted-syntax */
import fs from "node:fs";
import path from "node:path";
import QRCode from "qrcode";

export interface GenerateTreFoodQrOptions {
  url: string;
  brandColor?: string;
  size?: number;
  logoPath?: string;
  logoBase64?: string;
}

/**
 * Generates an official branded TreFood QR Code SVG string matching the
 * TreFood physical ID card design:
 * - High Error Correction (30% redundancy) for center logo overlay
 * - Rounded squircle data modules
 * - Custom smooth rounded finder patterns (eyes)
 * - Centered TreFood orange badge with white logo
 * - Rounded brand border in signature TreFood orange (#ff5414)
 */
export async function generateTreFoodQrSvg({
  url,
  brandColor = "#ff5414",
  size = 1000,
  logoPath,
  logoBase64,
}: GenerateTreFoodQrOptions): Promise<string> {
  // Generate QR matrix with High error correction (30% redundancy)
  const qr = QRCode.create(url, {
    errorCorrectionLevel: "H",
  });

  const matrixSize = qr.modules.size;

  // SVG dimensions & grid calculations
  const viewBoxSize = 1000;
  const frameMargin = 35;
  const frameRadius = 70;
  const borderWidth = 20;

  const contentPadding = 65; // breathing room between border and QR matrix
  const qrAreaSize = viewBoxSize - (frameMargin + borderWidth) * 2 - contentPadding * 2;
  const qrOffset = frameMargin + borderWidth + contentPadding;

  const moduleSize = qrAreaSize / matrixSize;

  // Center logo covers ~23% of the QR matrix
  const logoModules = Math.floor(matrixSize * 0.23);
  const logoStart = Math.floor((matrixSize - logoModules) / 2);
  const logoEnd = logoStart + logoModules;

  // Finder pattern areas (7x7 corners)
  function isFinderPattern(r: number, c: number): boolean {
    if (r < 7 && c < 7) return true; // Top-Left
    if (r < 7 && c >= matrixSize - 7) return true; // Top-Right
    if (r >= matrixSize - 7 && c < 7) return true; // Bottom-Left
    return false;
  }

  // Center logo badge exclusion area
  function isCenterLogoArea(r: number, c: number): boolean {
    return r >= logoStart - 1 && r <= logoEnd && c >= logoStart - 1 && c <= logoEnd;
  }

  // Build SVG data modules with smooth rounded squircles
  const modulesSvg: string[] = [];
  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      if (isFinderPattern(r, c) || isCenterLogoArea(r, c)) continue;

      if (qr.modules.get(r, c)) {
        const x = qrOffset + c * moduleSize;
        const y = qrOffset + r * moduleSize;
        const rRad = moduleSize * 0.22;
        modulesSvg.push(
          `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${moduleSize.toFixed(2)}" height="${moduleSize.toFixed(2)}" rx="${rRad.toFixed(2)}" fill="#000000" />`
        );
      }
    }
  }

  // Custom styled finder pattern with smooth rounded corners
  function renderFinderEye(startRow: number, startCol: number) {
    const x = qrOffset + startCol * moduleSize;
    const y = qrOffset + startRow * moduleSize;
    const w = 7 * moduleSize;
    const h = 7 * moduleSize;

    // Outer rounded square (7x7 modules)
    const outerRadius = moduleSize * 1.35;
    // Inner white cutout (5x5 modules)
    const innerWhiteOffset = 1 * moduleSize;
    const innerWhiteSize = 5 * moduleSize;
    const innerWhiteRadius = moduleSize * 0.95;
    // Center black dot (3x3 modules)
    const centerOffset = 2 * moduleSize;
    const centerSize = 3 * moduleSize;
    const centerRadius = moduleSize * 0.65;

    return `
      <g class="finder-eye">
        <rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" rx="${outerRadius.toFixed(2)}" fill="#000000" />
        <rect x="${(x + innerWhiteOffset).toFixed(2)}" y="${(y + innerWhiteOffset).toFixed(2)}" width="${innerWhiteSize.toFixed(2)}" height="${innerWhiteSize.toFixed(2)}" rx="${innerWhiteRadius.toFixed(2)}" fill="#ffffff" />
        <rect x="${(x + centerOffset).toFixed(2)}" y="${(y + centerOffset).toFixed(2)}" width="${centerSize.toFixed(2)}" height="${centerSize.toFixed(2)}" rx="${centerRadius.toFixed(2)}" fill="#000000" />
      </g>
    `;
  }

  const finderTL = renderFinderEye(0, 0);
  const finderTR = renderFinderEye(0, matrixSize - 7);
  const finderBL = renderFinderEye(matrixSize - 7, 0);

  // Determine logo image base64
  let resolvedLogo = logoBase64 || "";
  if (!resolvedLogo) {
    const targetLogoPath = logoPath || path.join(process.cwd(), "public", "logo.png");
    try {
      if (fs.existsSync(targetLogoPath)) {
        const buf = fs.readFileSync(targetLogoPath);
        resolvedLogo = `data:image/png;base64,${buf.toString("base64")}`;
      }
    } catch {
      // Fallback to stylized vector badge if file system read is unavailable
    }
  }

  // Center logo positioning
  const logoX = qrOffset + (logoStart - 0.5) * moduleSize;
  const logoY = qrOffset + (logoStart - 0.5) * moduleSize;
  const logoPixelSize = (logoModules + 1) * moduleSize;
  const logoRadius = logoPixelSize * 0.22;

  // Zoom logo slightly (5%) to push exterior borders beyond clip mask
  const zoom = 0.05;
  const imgX = logoX - logoPixelSize * zoom;
  const imgY = logoY - logoPixelSize * zoom;
  const imgSize = logoPixelSize * (1 + zoom * 2);

  const cardX = frameMargin + borderWidth / 2;
  const cardY = frameMargin + borderWidth / 2;
  const cardSize = viewBoxSize - (frameMargin + borderWidth / 2) * 2;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${viewBoxSize} ${viewBoxSize}" width="${size}" height="${size}">
  <defs>
    <clipPath id="logoClip">
      <rect x="${logoX.toFixed(2)}" y="${logoY.toFixed(2)}" width="${logoPixelSize.toFixed(2)}" height="${logoPixelSize.toFixed(2)}" rx="${logoRadius.toFixed(2)}" />
    </clipPath>
  </defs>

  <!-- Background White Card -->
  <rect x="${cardX.toFixed(2)}" y="${cardY.toFixed(2)}" width="${cardSize.toFixed(2)}" height="${cardSize.toFixed(2)}" rx="${frameRadius.toFixed(2)}" fill="#ffffff" />

  <!-- Outer Rounded Brand Border -->
  <rect x="${cardX.toFixed(2)}" y="${cardY.toFixed(2)}" width="${cardSize.toFixed(2)}" height="${cardSize.toFixed(2)}" rx="${frameRadius.toFixed(2)}" fill="none" stroke="${brandColor}" stroke-width="${borderWidth}" />

  <!-- QR Code Matrix -->
  <g id="qr-modules">
    ${modulesSvg.join("\n    ")}
  </g>

  <!-- Finder Patterns (Rounded Eyes) -->
  ${finderTL}
  ${finderTR}
  ${finderBL}

  <!-- Center Logo Badge -->
  <g id="center-logo">
    <!-- White spacer padding around logo -->
    <rect x="${(logoX - moduleSize * 0.4).toFixed(2)}" y="${(logoY - moduleSize * 0.4).toFixed(2)}" width="${(logoPixelSize + moduleSize * 0.8).toFixed(2)}" height="${(logoPixelSize + moduleSize * 0.8).toFixed(2)}" rx="${(logoRadius + moduleSize * 0.4).toFixed(2)}" fill="#ffffff" />
    
    <!-- Logo Image cropped to smooth rounded squircle -->
    ${
      resolvedLogo
        ? `<image href="${resolvedLogo}" x="${imgX.toFixed(2)}" y="${imgY.toFixed(2)}" width="${imgSize.toFixed(2)}" height="${imgSize.toFixed(2)}" clip-path="url(#logoClip)" />`
        : `
          <rect x="${logoX.toFixed(2)}" y="${logoY.toFixed(2)}" width="${logoPixelSize.toFixed(2)}" height="${logoPixelSize.toFixed(2)}" rx="${logoRadius.toFixed(2)}" fill="${brandColor}" />
          <text x="${(logoX + logoPixelSize / 2).toFixed(2)}" y="${(logoY + logoPixelSize / 2 + logoPixelSize * 0.15).toFixed(2)}" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="${(logoPixelSize * 0.55).toFixed(2)}" fill="#ffffff" text-anchor="middle">Tf</text>
        `
    }
  </g>
</svg>`;
}

/**
 * Returns a base64 SVG data URL for direct embedding in <img src="..." />
 */
export async function generateTreFoodQrDataUrl(
  options: GenerateTreFoodQrOptions
): Promise<string> {
  const svg = await generateTreFoodQrSvg(options);
  const base64 = Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}
