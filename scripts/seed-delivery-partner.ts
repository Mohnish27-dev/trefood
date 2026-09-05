/**
 * Seed sample Delivery Partner and generate TreFood verification QR code.
 *
 * Usage:
 *   node --env-file-if-exists=.env.local --conditions=react-server --import tsx scripts/seed-delivery-partner.ts
 */

import fs from "node:fs";
import path from "node:path";
import * as db from "@/server/db/collections";
import { generateTreFoodQrSvg } from "@/server/services/qr";
import type { DeliveryPartner } from "@/types/delivery-partner";
import { getMongoClient } from "@/server/db/client";

async function main() {
  console.log("🚀 Seeding TreFood Delivery Partner for Campus Gate Entry...");

  const col = await db.deliveryPartners();
  const restaurantsCol = await db.restaurants();
  const campusesCol = await db.campuses();

  // Find an existing campus & restaurant, or use defaults
  const campus = (await campusesCol.findOne({})) || {
    _id: "campus_nitp",
    name: "NIT Patna",
  };
  const restaurant = (await restaurantsCol.findOne({})) || {
    _id: "rest_kolkata_biryani_nitp",
    name: "Kolkata Biryani & Fast Food",
  };

  const samplePartner: DeliveryPartner = {
    _id: "del_nitp_001",
    badgeId: "TF-NITP-001",
    name: "Ramesh Kumar",
    phone: "+91 98765 43210",
    photoUrl: null,
    restaurantId: restaurant._id,
    restaurantName: restaurant.name,
    campusId: campus._id,
    campusName: campus.name,
    vehicleNumber: "BR 01 EA 4521",
    status: "ACTIVE",
    allowedGates: ["Main Gate", "Boys Hostel Gate", "Girls Hostel Gate"],
    emergencyContact: "+91 91234 56789",
    issuedAt: new Date(),
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await col.updateOne(
    { badgeId: samplePartner.badgeId },
    { $set: samplePartner },
    { upsert: true }
  );

  console.log(`✅ Delivery Partner registered: ${samplePartner.name} (${samplePartner.badgeId})`);

  // Generate official TreFood branded QR code
  const verifyUrl = `https://trefood.in/verify/delivery/${samplePartner.badgeId}`;
  const qrSvg = await generateTreFoodQrSvg({
    url: verifyUrl,
    size: 1000,
  });

  const outPath = path.join(process.cwd(), "public", "delivery-TF-NITP-001.svg");
  fs.writeFileSync(outPath, qrSvg, "utf-8");
  console.log(`✅ Branded QR code with logo saved at: ${outPath}`);

  console.log("\n========================================================");
  console.log("🔗 Verification URL (Scanned by Campus Security Guard):");
  console.log(`   http://localhost:3000/verify/delivery/${samplePartner.badgeId}`);
  console.log("\n🪪 Printable ID Card URL (Standard CR80 54mm x 86mm):");
  console.log(`   http://localhost:3000/print/id-card/${samplePartner.badgeId}`);
  console.log("========================================================\n");

  const client = await getMongoClient();
  await client.close();
}

main().catch((err) => {
  console.error("Error seeding delivery partner:", err);
  process.exit(1);
});
