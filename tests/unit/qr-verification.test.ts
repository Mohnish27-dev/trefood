import { describe, expect, it } from "vitest";
import { generateTreFoodQrSvg, generateTreFoodQrDataUrl } from "@/server/services/qr";

describe("TreFood Branded QR Code Generator", () => {
  it("generates a valid SVG with TreFood branding elements", async () => {
    const targetUrl = "https://trefood.in/verify/delivery/TF-NITP-001";
    const svg = await generateTreFoodQrSvg({
      url: targetUrl,
      size: 800,
    });

    // Valid XML and SVG element
    expect(svg).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('width="800"');
    expect(svg).toContain('height="800"');

    // Outer brand border in signature TreFood orange (#ff5414)
    expect(svg).toContain('stroke="#ff5414"');

    // Rounded finder eyes
    expect(svg).toContain('class="finder-eye"');

    // Center logo badge
    expect(svg).toContain('id="center-logo"');
    expect(svg).toContain('id="logoClip"');

    // QR Code modules group
    expect(svg).toContain('id="qr-modules"');
  });

  it("generates a base64 Data URL matching the SVG output", async () => {
    const targetUrl = "https://trefood.in/verify/delivery/TF-NITP-002";
    const dataUrl = await generateTreFoodQrDataUrl({
      url: targetUrl,
    });

    expect(dataUrl.startsWith("data:image/svg+xml;base64,")).toBe(true);

    const base64Part = dataUrl.replace("data:image/svg+xml;base64,", "");
    const decodedSvg = Buffer.from(base64Part, "base64").toString("utf-8");

    expect(decodedSvg).toContain("<svg");
    expect(decodedSvg).toContain('stroke="#ff5414"');
  });
});
