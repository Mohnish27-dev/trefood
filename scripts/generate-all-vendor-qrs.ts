/**
 * Generate official TreFood branded QR codes and ID card URLs for ALL campus vendors.
 *
 * Usage:
 *   node --env-file-if-exists=.env.local --conditions=react-server --import tsx scripts/generate-all-vendor-qrs.ts
 */

import fs from "node:fs";
import path from "node:path";
import * as db from "@/server/db/collections";
import { generateTreFoodQrSvg } from "@/server/services/qr";
import { getMongoClient } from "@/server/db/client";

async function main() {
  console.log("🚀 Generating TreFood Delivery QR codes for all campus vendors...\n");

  const outDir = path.join(process.cwd(), "public", "vendor-qrs");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const restaurantsCol = await db.restaurants();
  const vendors = await restaurantsCol.find({}).toArray();

  if (vendors.length === 0) {
    console.log("No restaurants found in database. Please run npm run seed:vendors first.");
    process.exit(1);
  }

  console.log(`Found ${vendors.length} vendors. Generating custom branded QR codes:\n`);

  for (const vendor of vendors) {
    const badgeId = `TF-VND-${vendor.slug.toUpperCase()}`;
    const verifyUrl = `https://trefood.in/verify/delivery/${badgeId}`;

    const svg = await generateTreFoodQrSvg({
      url: verifyUrl,
      size: 1000,
    });

    const filePath = path.join(outDir, `qr-${vendor.slug}.svg`);
    fs.writeFileSync(filePath, svg, "utf-8");

    console.log(`✅ [${vendor.name}]`);
    console.log(`   Badge ID:       ${badgeId}`);
    console.log(`   QR File:        public/vendor-qrs/qr-${vendor.slug}.svg`);
    console.log(`   Scan URL:       ${verifyUrl}`);
    console.log(`   Print ID Card:  https://trefood.in/print/id-card/${badgeId}\n`);
  }

  console.log("==========================================================================");
  console.log(`🎉 All ${vendors.length} vendor QR codes generated successfully in: public/vendor-qrs/`);
  console.log("You can print each vendor's ID card directly or hand them their specific QR code.");
  console.log("==========================================================================");

  const client = await getMongoClient();
  await client.close();
}

main().catch((err) => {
  console.error("Error generating vendor QR codes:", err);
  process.exit(1);
});
