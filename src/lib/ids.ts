import { randomBytes } from "node:crypto";

/**
 * Document ids.
 *
 * Deliberately STRINGS, not ObjectId — a deviation from
 * SYSTEM_ARCHITECTURE_AND_FLOWS.md section 7, taken for one concrete reason:
 * an ObjectId is not serialisable across the React Server Component boundary.
 * With ObjectId, every Server Component that hands a document to a Client
 * Component needs a `.toString()` mapping layer, and forgetting one is a
 * runtime error that only shows up on the page that uses it. String ids delete
 * that whole class of bug.
 *
 * The format is lexicographically sortable by creation time: a base36
 * millisecond timestamp followed by random entropy. So `sort({_id: 1})` is
 * chronological, and an index on _id doubles as a creation-time index.
 */

const ENTROPY_BYTES = 8;

export function newId(prefix?: string): string {
  const time = Date.now().toString(36).padStart(9, "0");
  const random = randomBytes(ENTROPY_BYTES).toString("hex");
  const id = `${time}${random}`;
  return prefix === undefined ? id : `${prefix}_${id}`;
}

/**
 * Human-quotable order number: "TRF-NITP-8921".
 *
 * Read aloud at a gate, so it is short, has no ambiguous characters, and is
 * deliberately NOT derived from the gate code — knowing one must never let
 * anyone guess the other.
 */
export function newOrderNumber(campusCode: string, sequence: number): string {
  const suffix = String(sequence % 10_000).padStart(4, "0");
  return `TRF-${campusCode.toUpperCase()}-${suffix}`;
}

/** F12 — one per checkout attempt, so a double-tap returns the first order. */
export function newIdempotencyKey(): string {
  return globalThis.crypto.randomUUID();
}
