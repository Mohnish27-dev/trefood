import "server-only";

import { MongoClient, type Db } from "mongodb";

import { serverEnv } from "@/lib/env";

/**
 * Cached MongoDB client.
 *
 * Serverless opens a connection pool per function instance. Without a cached
 * globalThis client you exhaust the Atlas free tier during the first exam-week
 * surge - FAILURES_AND_EDGE_CASES.md section 5.5.
 *
 * This is the ONLY permitted globalThis singleton in the codebase. It exists
 * precisely because a connection pool must NOT be per-request. Nothing else may
 * hold request-scoped state at module level, which is what keeps every replica
 * interchangeable and horizontal scaling a replica-count change.
 */

declare global {
  var __trefoodMongo: { client: MongoClient; promise: Promise<MongoClient> } | undefined;
}

function createClient(): { client: MongoClient; promise: Promise<MongoClient> } {
  const env = serverEnv();

  const client = new MongoClient(env.MONGODB_URI, {
    maxPoolSize: env.MONGODB_MAX_POOL_SIZE,
    minPoolSize: 0,
    // Fail fast rather than hanging a request for 30s on a dead cluster.
    serverSelectionTimeoutMS: 5_000,
    connectTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,
    retryWrites: true,
    retryReads: true,
    // Free-tier friendly: release idle sockets instead of holding the pool open.
    maxIdleTimeMS: 60_000,
    appName: "trefood",
  });

  return { client, promise: client.connect() };
}

function holder(): { client: MongoClient; promise: Promise<MongoClient> } {
  // In development, HMR re-evaluates modules on every edit. Without the global
  // cache each edit would leak a fresh pool until the cluster refuses connections.
  if (!globalThis.__trefoodMongo) {
    globalThis.__trefoodMongo = createClient();
  }
  return globalThis.__trefoodMongo;
}

export async function getMongoClient(): Promise<MongoClient> {
  return holder().promise;
}

export async function getDb(): Promise<Db> {
  const client = await holder().promise;
  return client.db(serverEnv().MONGODB_DB);
}

/** Liveness probe used by /api/health and by the container healthcheck. */
export async function pingDb(): Promise<{ ok: true; roundTripMs: number }> {
  const started = Date.now();
  const db = await getDb();
  await db.command({ ping: 1 });
  return { ok: true, roundTripMs: Date.now() - started };
}
