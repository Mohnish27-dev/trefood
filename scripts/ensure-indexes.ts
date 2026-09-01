/**
 * Create every index without touching data.
 *
 *   npm run db:indexes
 *
 * Safe to run on every deploy and safe to run concurrently from several
 * instances during a rolling release — createIndexes is a no-op when an
 * identical index already exists.
 */

import { getMongoClient } from "@/server/db/client";
import { ensureIndexes } from "@/server/db/indexes";

async function main(): Promise<void> {
  const reports = await ensureIndexes();
  let failures = 0;

  for (const report of reports) {
    if (report.error !== null) {
      failures += 1;
      console.error(`  ! ${report.collection}: ${report.error}`);
    } else {
      console.log(`  ${report.collection}: ${report.created.length} index(es)`);
    }
  }

  const client = await getMongoClient();
  await client.close();
  if (failures > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
