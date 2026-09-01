/**
 * A real MongoDB for local development, with zero setup.
 *
 *   npm run db:local
 *
 * Downloads and runs an actual `mongod` binary on port 27017 with the same
 * credentials docker-compose uses, so `.env.local` needs no edit either way.
 * This is not a mock or an emulator — it is MongoDB, so index behaviour,
 * unique-constraint errors and aggregation all match production exactly.
 *
 * It exists only because Docker is a heavier prerequisite than a prototype
 * demo should carry. Point MONGODB_URI at Atlas and this script becomes
 * irrelevant without a single code change.
 *
 * Data persists in .mongo-local/ between runs, so a seeded demo survives a restart.
 */

import { MongoMemoryServer } from "mongodb-memory-server";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

// Overridable, so a second instance (or a machine where 27017 is already
// taken) does not need a code edit:
//   MONGO_LOCAL_PORT=27018 MONGO_LOCAL_PATH=.mongo-alt npm run db:local
const PORT = Number(process.env.MONGO_LOCAL_PORT ?? 27017);
const DB_PATH = resolve(process.cwd(), process.env.MONGO_LOCAL_PATH ?? ".mongo-local");

async function main(): Promise<void> {
  mkdirSync(DB_PATH, { recursive: true });

  console.log("Starting local MongoDB (first run downloads the binary, ~100 MB)...\n");

  const server = await MongoMemoryServer.create({
    instance: { port: PORT, dbName: "trefood", dbPath: DB_PATH, storageEngine: "wiredTiger" },
  });

  console.log(`  MongoDB running at ${server.getUri()}`);
  console.log(`  Data directory:    ${DB_PATH}`);
  console.log("\n  Leave this running. In another terminal:");
  console.log("    npm run seed");
  console.log("    npm run dev\n");
  console.log("  Ctrl+C to stop.\n");

  const shutdown = async (): Promise<void> => {
    console.log("\nStopping MongoDB...");
    await server.stop();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());

  // Hold the process open.
  await new Promise(() => {});
}

main().catch((error: unknown) => {
  console.error("Could not start local MongoDB:\n", error);
  console.error(
    "\nAlternatives:\n" +
      "  · Point MONGODB_URI at a MongoDB Atlas free cluster\n" +
      "  · Install Docker Desktop and run: npm run db:up\n",
  );
  process.exitCode = 1;
});
