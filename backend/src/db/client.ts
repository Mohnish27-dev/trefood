import { MongoClient, type Db, type MongoClientOptions } from "mongodb";

import { env } from "../env.js";

/**
 * The MongoDB client.
 *
 * `maxPoolSize: 10` is the Atlas free-tier ceiling described in
 * docs/FAILURES_AND_EDGE_CASES.md §5.5, not a tuning knob. Raise it only together
 * with a tier upgrade.
 *
 * Note what the split changed here: on Vercel this had to be a `globalThis` singleton
 * because every serverless instance opened its own pool, and a burst of cold starts
 * could exhaust the cluster. A long-lived container opens the pool once at boot and
 * keeps it, so the cache is gone and connection count is now a function of how many
 * backend replicas you run — a number you control directly in docker-compose.
 */
const options: MongoClientOptions = {
  maxPoolSize: 10,
  // Fail a dead connection fast rather than hanging a request for 30s.
  serverSelectionTimeoutMS: 5_000,
  connectTimeoutMS: 10_000,
  // Retryable writes are on by default; stated explicitly because settlement and
  // order transitions depend on them.
  retryWrites: true,
};

let client: MongoClient | undefined;

/** Opens the pool. Called once from `src/index.ts` before the port is bound. */
export async function connectDb(): Promise<MongoClient> {
  if (client) return client;
  client = await new MongoClient(env.MONGODB_URI, options).connect();
  return client;
}

/** The TREFOOD database. Every collection accessor goes through this. */
export function getDb(): Db {
  if (!client) {
    throw new Error("getDb() called before connectDb(). Check the boot order in src/index.ts.");
  }
  return client.db(env.MONGODB_DB);
}

/** Round-trips a `ping`. Used by /health and by the readiness probe. */
export async function pingDb(): Promise<{ ok: true; latencyMs: number }> {
  const startedAt = Date.now();
  await getDb().command({ ping: 1 });
  return { ok: true, latencyMs: Date.now() - startedAt };
}

/** Closes the pool on shutdown so in-flight writes are not severed mid-transition. */
export async function closeDb(): Promise<void> {
  await client?.close();
  client = undefined;
}
