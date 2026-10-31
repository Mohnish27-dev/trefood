import { formatINR } from "@/lib/money";
import type { KotOrder } from "@/components/vendor/kot-ticket";

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const paragraphs = text.split("\n");
  const allLines: string[] = [];

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      allLines.push("");
      continue;
    }
    const words = paragraph.split(/\s+/);
    let currentLine = "";

    for (const word of words) {
      if (!word) continue;
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(testLine).width <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) allLines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) allLines.push(currentLine);
  }

  return allLines.length > 0 ? allLines : [""];
}

function drawDashedLine(
  ctx: CanvasRenderingContext2D,
  y: number,
  x1: number,
  x2: number,
) {
  ctx.save();
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.restore();
}

/**
 * Renders the KOT ticket onto an HTML5 canvas and downloads/shares it as a PNG image.
 */
export async function downloadKotTicketImage(
  order: KotOrder,
  widthMm: "58" | "80",
): Promise<void> {
  if (typeof window === "undefined") return;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas context");

  // High resolution factor for crisp thermal-style typography
  const scale = 2;
  const canvasWidth = (widthMm === "58" ? 440 : 600) * scale;
  const pad = (widthMm === "58" ? 22 : 32) * scale;
  const contentWidth = canvasWidth - pad * 2;

  const font = (size: number, weight = "normal") =>
    `${weight} ${size * scale}px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;

  // First pass: compute total height needed
  let y = pad;

  // Header
  y += 24 * scale; // Restaurant name
  y += 18 * scale; // Subtitle
  y += 16 * scale; // Dashed rule

  // Order meta
  y += 22 * scale; // Order Number
  y += 20 * scale; // Time
  if (order.prepMinutes !== null) {
    y += 20 * scale; // Prep
  }
  y += 16 * scale; // Dashed rule

  // Items
  ctx.font = font(13, "bold");
  for (const item of order.items) {
    const itemHeader = `${item.quantity}x ${item.name.toUpperCase()} [${item.isVeg ? "VEG" : "NON-VEG"}]`;
    const itemLines = wrapText(ctx, itemHeader, contentWidth);
    y += itemLines.length * 18 * scale + 4 * scale;

    if (item.addOns.length > 0) {
      ctx.font = font(11, "normal");
      const addOnsText = `+ ${item.addOns.join(", ")}`;
      const addOnLines = wrapText(ctx, addOnsText, contentWidth - 20 * scale);
      y += addOnLines.length * 15 * scale + 4 * scale;
      ctx.font = font(13, "bold");
    }
  }

  // Customer note
  if (order.description) {
    ctx.font = font(11, "bold");
    const noteLines = wrapText(ctx, order.description, contentWidth - 20 * scale);
    y += 20 * scale + noteLines.length * 16 * scale + 16 * scale;
  }

  y += 16 * scale; // Dashed rule

  // Delivery info
  y += 18 * scale; // "DELIVER TO"
  ctx.font = font(14, "bold");
  const zoneLines = wrapText(ctx, order.zoneName.toUpperCase(), contentWidth);
  y += zoneLines.length * 18 * scale;

  ctx.font = font(12, "normal");
  const zoneInstrLines = wrapText(ctx, order.zoneInstructions, contentWidth);
  y += zoneInstrLines.length * 16 * scale + 6 * scale;

  const custLines = wrapText(ctx, `${order.customerName} · ${order.customerPhone}`, contentWidth);
  y += custLines.length * 16 * scale;

  y += 16 * scale; // Dashed rule

  // Cash due box
  y += 82 * scale; // Cash box height + margin
  y += 16 * scale; // Dashed rule

  // OTP / Packet Code
  if (order.gateCode) {
    y += 95 * scale;
  } else {
    y += 36 * scale;
  }
  y += 16 * scale; // Dashed rule

  // Safety protocol
  ctx.font = font(9.5, "normal");
  const safetyLines = wrapText(
    ctx,
    "Deliveries after 7:00 PM must be handled personally by the owner or co-owner to maintain security inside campus premises.",
    contentWidth,
  );
  y += 16 * scale + safetyLines.length * 14 * scale + 8 * scale;

  y += 16 * scale; // Dashed rule
  y += 20 * scale; // "Handover at the gate, always."
  y += pad; // Bottom padding

  const canvasHeight = Math.ceil(y);
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  // Second pass: actual rendering
  // Pure white thermal background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.fillStyle = "#000000";
  ctx.textBaseline = "top";
  const startX = pad;
  const centerX = canvasWidth / 2;
  const rightX = canvasWidth - pad;
  let drawY = pad;

  // 1. Restaurant Name & Subtitle
  ctx.font = font(16, "bold");
  ctx.textAlign = "center";
  const nameLines = wrapText(ctx, order.restaurantName.toUpperCase(), contentWidth);
  for (const line of nameLines) {
    ctx.fillText(line, centerX, drawY);
    drawY += 20 * scale;
  }

  ctx.font = font(11, "normal");
  ctx.fillText("TREFOOD kitchen ticket", centerX, drawY);
  drawY += 18 * scale;

  // Dashed rule
  drawDashedLine(ctx, drawY, startX, rightX);
  drawY += 14 * scale;

  // 2. Order Meta
  ctx.textAlign = "left";
  ctx.font = font(12, "bold");
  ctx.fillText("Order", startX, drawY);
  ctx.textAlign = "right";
  ctx.font = font(13, "bold");
  ctx.fillText(order.orderNumber, rightX, drawY);
  drawY += 20 * scale;

  ctx.textAlign = "left";
  ctx.font = font(11, "normal");
  ctx.fillText("Time", startX, drawY);
  ctx.textAlign = "right";
  ctx.fillText(order.placedAtLabel, rightX, drawY);
  drawY += 18 * scale;

  if (order.prepMinutes !== null) {
    ctx.textAlign = "left";
    ctx.fillText("Prep", startX, drawY);
    ctx.textAlign = "right";
    ctx.fillText(`${order.prepMinutes} min`, rightX, drawY);
    drawY += 18 * scale;
  }

  // Dashed rule
  drawDashedLine(ctx, drawY, startX, rightX);
  drawY += 14 * scale;

  // 3. Items
  ctx.textAlign = "left";
  for (const item of order.items) {
    ctx.font = font(12, "bold");
    const itemHeader = `${item.quantity}x ${item.name.toUpperCase()} [${item.isVeg ? "VEG" : "NON-VEG"}]`;
    const itemLines = wrapText(ctx, itemHeader, contentWidth);
    for (const line of itemLines) {
      ctx.fillText(line, startX, drawY);
      drawY += 17 * scale;
    }

    if (item.addOns.length > 0) {
      ctx.font = font(10.5, "normal");
      const addOnsText = `+ ${item.addOns.join(", ")}`;
      const addOnLines = wrapText(ctx, addOnsText, contentWidth - 16 * scale);
      for (const line of addOnLines) {
        ctx.fillText(line, startX + 16 * scale, drawY);
        drawY += 15 * scale;
      }
    }
    drawY += 4 * scale;
  }

  // 4. Customer note
  if (order.description) {
    drawY += 4 * scale;
    ctx.font = font(9.5, "bold");
    const noteLines = wrapText(ctx, order.description, contentWidth - 16 * scale);
    const boxHeight = 20 * scale + noteLines.length * 15 * scale;

    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1 * scale;
    ctx.strokeRect(startX, drawY, contentWidth, boxHeight);

    ctx.fillText("CUSTOMER NOTE / SPECIAL INSTRUCTIONS:", startX + 8 * scale, drawY + 6 * scale);
    let noteY = drawY + 22 * scale;
    for (const line of noteLines) {
      ctx.fillText(line, startX + 8 * scale, noteY);
      noteY += 15 * scale;
    }
    drawY += boxHeight + 8 * scale;
  }

  // Dashed rule
  drawDashedLine(ctx, drawY, startX, rightX);
  drawY += 14 * scale;

  // 5. Deliver to
  ctx.font = font(10.5, "bold");
  ctx.fillText("DELIVER TO", startX, drawY);
  drawY += 16 * scale;

  ctx.font = font(13, "bold");
  const zoneLines2 = wrapText(ctx, order.zoneName.toUpperCase(), contentWidth);
  for (const line of zoneLines2) {
    ctx.fillText(line, startX, drawY);
    drawY += 18 * scale;
  }

  ctx.font = font(11, "normal");
  const zoneInstrLines2 = wrapText(ctx, order.zoneInstructions, contentWidth);
  for (const line of zoneInstrLines2) {
    ctx.fillText(line, startX, drawY);
    drawY += 15 * scale;
  }

  const custLines2 = wrapText(ctx, `${order.customerName} · ${order.customerPhone}`, contentWidth);
  for (const line of custLines2) {
    ctx.fillText(line, startX, drawY);
    drawY += 15 * scale;
  }
  drawY += 4 * scale;

  // Dashed rule
  drawDashedLine(ctx, drawY, startX, rightX);
  drawY += 14 * scale;

  // 6. Collect cash box
  const cashBoxHeight = 68 * scale;
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 2 * scale;
  ctx.strokeRect(startX, drawY, contentWidth, cashBoxHeight);

  ctx.textAlign = "center";
  ctx.font = font(10.5, "bold");
  ctx.fillText("COLLECT CASH", centerX, drawY + 8 * scale);

  ctx.font = font(22, "bold");
  ctx.fillText(formatINR(order.cashDuePaise ?? 0), centerX, drawY + 24 * scale);

  ctx.font = font(10, "normal");
  ctx.fillText("Exact amount. No change expected.", centerX, drawY + 50 * scale);

  drawY += cashBoxHeight + 12 * scale;

  // Dashed rule
  drawDashedLine(ctx, drawY, startX, rightX);
  drawY += 14 * scale;

  // 7. Gate code OTP
  ctx.textAlign = "center";
  if (order.gateCode) {
    ctx.font = font(10.5, "bold");
    ctx.fillText("PICKUP OTP / PACKET CODE", centerX, drawY);
    drawY += 18 * scale;

    ctx.font = font(32, "bold");
    // Format with wide spacing: "0  1  4  7"
    const spacedOtp = order.gateCode.split("").join("   ");
    ctx.fillText(spacedOtp, centerX, drawY);
    drawY += 38 * scale;

    ctx.font = font(10, "normal");
    ctx.fillText("Write on packet. Student matches OTP to confirm pickup.", centerX, drawY);
    drawY += 18 * scale;
  } else {
    ctx.font = font(10, "normal");
    ctx.fillText("Pickup OTP appears here once the order is accepted.", centerX, drawY);
    drawY += 22 * scale;
  }

  // Dashed rule
  drawDashedLine(ctx, drawY, startX, rightX);
  drawY += 14 * scale;

  // 8. Campus Safety Protocol
  ctx.font = font(10, "bold");
  ctx.fillText("CAMPUS SAFETY PROTOCOL", centerX, drawY);
  drawY += 16 * scale;

  ctx.font = font(9.5, "normal");
  const safetyLines2 = wrapText(
    ctx,
    "Deliveries after 7:00 PM must be handled personally by the owner or co-owner to maintain security inside campus premises.",
    contentWidth,
  );
  for (const line of safetyLines2) {
    ctx.fillText(line, centerX, drawY);
    drawY += 13 * scale;
  }
  drawY += 6 * scale;

  // Dashed rule
  drawDashedLine(ctx, drawY, startX, rightX);
  drawY += 14 * scale;

  // 9. Footer
  ctx.font = font(10, "normal");
  ctx.fillText("Handover at the gate, always.", centerX, drawY);

  // Export to Blob
  return new Promise<void>((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error("Failed to export canvas blob"));
        return;
      }

      const fileName = `KOT-${order.orderNumber}.png`;

      // If mobile supports Web Share API with files, offer native share/save
      if (
        typeof navigator !== "undefined" &&
        navigator.canShare &&
        typeof File !== "undefined"
      ) {
        try {
          const file = new File([blob], fileName, { type: "image/png" });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: `KOT #${order.orderNumber}`,
              text: `Kitchen Order Ticket #${order.orderNumber}`,
            });
            resolve();
            return;
          }
        } catch (shareErr) {
          // If share cancelled by user, resolve normally
          if (shareErr instanceof Error && shareErr.name === "AbortError") {
            resolve();
            return;
          }
          // Otherwise fall back to file download
        }
      }

      // Standard browser download
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      resolve();
    }, "image/png");
  });
}

