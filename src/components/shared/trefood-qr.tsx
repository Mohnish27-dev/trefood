"use client";

import React, { useMemo, useRef } from "react";
import QRCode from "qrcode";

interface TreFoodQRCodeProps {
  url?: string;
  size?: number;
  brandColor?: string;
  className?: string;
  showDownloadButtons?: boolean;
}

export function TreFoodQRCode({
  url = "https://trefood.in",
  size = 320,
  brandColor = "#ff5414",
  className = "",
  showDownloadButtons = false,
}: TreFoodQRCodeProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Generate QR matrix with High error correction (30% redundancy)
  const svgData = useMemo(() => {
    try {
      const qr = QRCode.create(url, { errorCorrectionLevel: "H" });
      const matrixSize = qr.modules.size;

      const viewBoxSize = 1000;
      const frameMargin = 35;
      const frameRadius = 70;
      const borderWidth = 20;

      const contentPadding = 65;
      const qrAreaSize = viewBoxSize - (frameMargin + borderWidth) * 2 - contentPadding * 2;
      const qrOffset = frameMargin + borderWidth + contentPadding;
      const moduleSize = qrAreaSize / matrixSize;

      const logoModules = Math.floor(matrixSize * 0.23);
      const logoStart = Math.floor((matrixSize - logoModules) / 2);
      const logoEnd = logoStart + logoModules;

      function isFinderPattern(r: number, c: number) {
        if (r < 7 && c < 7) return true;
        if (r < 7 && c >= matrixSize - 7) return true;
        if (r >= matrixSize - 7 && c < 7) return true;
        return false;
      }

      function isCenterLogoArea(r: number, c: number) {
        return r >= logoStart - 1 && r <= logoEnd && c >= logoStart - 1 && c <= logoEnd;
      }

      const modules: { x: number; y: number; s: number; r: number }[] = [];
      for (let r = 0; r < matrixSize; r++) {
        for (let c = 0; c < matrixSize; c++) {
          if (isFinderPattern(r, c) || isCenterLogoArea(r, c)) continue;

          if (qr.modules.get(r, c)) {
            modules.push({
              x: qrOffset + c * moduleSize,
              y: qrOffset + r * moduleSize,
              s: moduleSize,
              r: moduleSize * 0.22,
            });
          }
        }
      }

      function getFinderEye(startRow: number, startCol: number) {
        const x = qrOffset + startCol * moduleSize;
        const y = qrOffset + startRow * moduleSize;
        const w = 7 * moduleSize;
        const outerRadius = moduleSize * 1.35;
        const innerWhiteOffset = 1 * moduleSize;
        const innerWhiteSize = 5 * moduleSize;
        const innerWhiteRadius = moduleSize * 0.95;
        const centerOffset = 2 * moduleSize;
        const centerSize = 3 * moduleSize;
        const centerRadius = moduleSize * 0.65;

        return {
          x,
          y,
          w,
          outerRadius,
          innerWhiteOffset,
          innerWhiteSize,
          innerWhiteRadius,
          centerOffset,
          centerSize,
          centerRadius,
        };
      }

      const eyes = [
        getFinderEye(0, 0),
        getFinderEye(0, matrixSize - 7),
        getFinderEye(matrixSize - 7, 0),
      ];

      const logoX = qrOffset + (logoStart - 0.5) * moduleSize;
      const logoY = qrOffset + (logoStart - 0.5) * moduleSize;
      const logoPixelSize = (logoModules + 1) * moduleSize;
      const logoRadius = logoPixelSize * 0.22;

      const zoom = 0.05;
      const imgX = logoX - logoPixelSize * zoom;
      const imgY = logoY - logoPixelSize * zoom;
      const imgSize = logoPixelSize * (1 + zoom * 2);

      const cardX = frameMargin + borderWidth / 2;
      const cardY = frameMargin + borderWidth / 2;
      const cardSize = viewBoxSize - (frameMargin + borderWidth / 2) * 2;

      return {
        viewBoxSize,
        cardX,
        cardY,
        cardSize,
        frameRadius,
        borderWidth,
        modules,
        eyes,
        logoX,
        logoY,
        logoPixelSize,
        logoRadius,
        imgX,
        imgY,
        imgSize,
        moduleSize,
      };
    } catch {
      return null;
    }
  }, [url]);

  const downloadPNG = (resolution = 1024) => {
    const svgEl = containerRef.current?.querySelector("svg");
    if (!svgEl) return;

    const svgXml = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgXml], { type: "image/svg+xml;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = resolution;
      canvas.height = resolution;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, resolution, resolution);
        ctx.drawImage(img, 0, 0, resolution, resolution);
        const pngUrl = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = pngUrl;
        a.download = `trefood-qr-${resolution}px.png`;
        a.click();
      }
      URL.revokeObjectURL(blobUrl);
    };
    img.src = blobUrl;
  };

  const downloadSVG = () => {
    const svgEl = containerRef.current?.querySelector("svg");
    if (!svgEl) return;
    const svgXml = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgXml], { type: "image/svg+xml;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = "trefood-qr.svg";
    a.click();
    URL.revokeObjectURL(blobUrl);
  };

  if (!svgData) {
    return <div className="p-4 text-center text-sm text-red-400">Failed to generate QR code</div>;
  }

  const {
    viewBoxSize,
    cardX,
    cardY,
    cardSize,
    frameRadius,
    borderWidth,
    modules,
    eyes,
    logoX,
    logoY,
    logoPixelSize,
    logoRadius,
    imgX,
    imgY,
    imgSize,
    moduleSize,
  } = svgData;

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`} ref={containerRef}>
      <div
        className="relative overflow-hidden rounded-3xl bg-white shadow-xl"
        style={{ width: size, height: size }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          xmlnsXlink="http://www.w3.org/1999/xlink"
          viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
          className="h-full w-full"
        >
          <defs>
            <clipPath id="centerLogoClipComp">
              <rect
                x={logoX}
                y={logoY}
                width={logoPixelSize}
                height={logoPixelSize}
                rx={logoRadius}
              />
            </clipPath>
          </defs>

          {/* Background Card */}
          <rect
            x={cardX}
            y={cardY}
            width={cardSize}
            height={cardSize}
            rx={frameRadius}
            fill="#ffffff"
          />

          {/* Outer Rounded Brand Border */}
          <rect
            x={cardX}
            y={cardY}
            width={cardSize}
            height={cardSize}
            rx={frameRadius}
            fill="none"
            stroke={brandColor}
            strokeWidth={borderWidth}
          />

          {/* QR Data Modules */}
          <g id="qr-dots">
            {modules.map((m, idx) => (
              <rect
                key={idx}
                x={m.x}
                y={m.y}
                width={m.s}
                height={m.s}
                rx={m.r}
                fill="#000000"
              />
            ))}
          </g>

          {/* Corner Eyes (Finder Patterns) */}
          <g id="finder-patterns">
            {eyes.map((eye, idx) => (
              <g key={idx}>
                {/* Outer black box */}
                <rect
                  x={eye.x}
                  y={eye.y}
                  width={eye.w}
                  height={eye.w}
                  rx={eye.outerRadius}
                  fill="#000000"
                />
                {/* White spacing cutout */}
                <rect
                  x={eye.x + eye.innerWhiteOffset}
                  y={eye.y + eye.innerWhiteOffset}
                  width={eye.innerWhiteSize}
                  height={eye.innerWhiteSize}
                  rx={eye.innerWhiteRadius}
                  fill="#ffffff"
                />
                {/* Center black rounded square */}
                <rect
                  x={eye.x + eye.centerOffset}
                  y={eye.y + eye.centerOffset}
                  width={eye.centerSize}
                  height={eye.centerSize}
                  rx={eye.centerRadius}
                  fill="#000000"
                />
              </g>
            ))}
          </g>

          {/* Center TreFood Logo Emblem */}
          <g id="center-badge">
            <rect
              x={logoX - moduleSize * 0.4}
              y={logoY - moduleSize * 0.4}
              width={logoPixelSize + moduleSize * 0.8}
              height={logoPixelSize + moduleSize * 0.8}
              rx={logoRadius + moduleSize * 0.4}
              fill="#ffffff"
            />
            <image
              href="/logo.png"
              x={imgX}
              y={imgY}
              width={imgSize}
              height={imgSize}
              clipPath="url(#centerLogoClipComp)"
            />
          </g>
        </svg>
      </div>

      {showDownloadButtons && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => downloadPNG(1024)}
            className="rounded-lg bg-orange-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-orange-500"
          >
            Download PNG (1024px)
          </button>
          <button
            type="button"
            onClick={downloadSVG}
            className="rounded-lg border border-neutral-700 bg-neutral-800 px-3.5 py-2 text-xs font-semibold text-neutral-200 transition hover:bg-neutral-700"
          >
            Download SVG
          </button>
        </div>
      )}
    </div>
  );
}
