import { NextRequest, NextResponse } from "next/server";
import { generateTreFoodQrSvg } from "@/server/services/qr";
import { getDeliveryPartnerForVerification } from "@/server/services/delivery-partner";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!id) {
    return new NextResponse("Missing delivery partner ID", { status: 400 });
  }

  // Try to find the partner to use their canonical badgeId
  const result = await getDeliveryPartnerForVerification(id);
  const targetId = result?.partner.badgeId || id;

  // Resolve base domain
  const host = req.headers.get("host") || "trefood.in";
  const protocol = host.includes("localhost") ? "http" : "https";
  const verifyUrl = `${protocol}://${host}/verify/delivery/${encodeURIComponent(targetId)}`;

  try {
    const svg = await generateTreFoodQrSvg({
      url: verifyUrl,
      size: 1000,
    });

    return new NextResponse(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error("Failed to generate delivery partner QR code:", err);
    return new NextResponse("Failed to generate QR code", { status: 500 });
  }
}
