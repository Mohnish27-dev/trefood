import "server-only";

import { MongoClient, type Db, type MongoClientOptions } from "mongodb";

import { serverEnv } from "@/lib/env.server";

/**
 * The cached MongoDB client.
 *
 * This file is load-bearing. Serverless opens a fresh connection pool per function
 * instance; without a `globalThis` cache, a burst of cold starts exhausts the Atlas
 * free-tier connection limit during the first exam-week surge — the failure
 * described in docs/FAILURES_AND_EDGE_CASES.md §5.5.
 *
 * `maxPoolSize: 10` is a ceiling, not a tuning knob. Raise it only together with an
 * Atlas tier upgrade.
 */
const options: MongoClientOptions = {
  maxPoolSize: 10,
  // Fail a dead connection fast rather than hanging a Server Action for 30s.
  serverSelectionTimeoutMS: 5_000,
  connectTimeoutMS: 10_000,
  // Retryable writes are on by default; stated explicitly because settlement and
  // order transitions depend on them.
  retryWrites: true,
};

/**
 * In development, Next.js hot-reload re-evaluates modules on every edit. Caching on
 * `globalThis` means the client survives reload instead of leaking a pool per save.
 * In production it deduplicates across the module instances a single lambda holds.
 */
declare global {
  var __trefoodMongoClientPromise: Promise<MongoClient> | undefined;
}

function createClientPromise(): Promise<MongoClient> {
  return new MongoClient(serverEnv.MONGODB_URI, options).connect();
}

const clientPromise: Promise<MongoClient> =
  globalThis.__trefoodMongoClientPromise ?? createClientPromise();

if (process.env.NODE_ENV !== "production") {
  globalThis.__trefoodMongoClientPromise = clientPromise;
}

/** The connected driver client. Prefer `getDb()` unless you need admin commands. */
export function getMongoClient(): Promise<MongoClient> {
  return clientPromise;
}

/** The TREFOOD database. Every collection accessor in `collections.ts` goes through this. */
export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  return client.db(serverEnv.MONGODB_DB);
}

/**
 * Round-trips a `ping` to the database. Used by /api/health and by the boot check in
 * `src/instrumentation.ts`.
 */
export async function pingDb(): Promise<{ ok: true; latencyMs: number }> {
  const startedAt = Date.now();
  const db = await getDb();
  await db.command({ ping: 1 });
  return { ok: true, latencyMs: Date.now() - startedAt };
}
