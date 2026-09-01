import { env } from "@/lib/env";

/**
 * The typed fetch wrapper for the TREFOOD API.
 *
 * Every call from the frontend to the backend goes through here — not because a
 * wrapper is tidy, but because four things must happen identically on every request
 * and will not if each caller does its own `fetch`:
 *
 *   1. `credentials: "include"`, or the session cookie is not sent cross-origin.
 *   2. A non-2xx becomes a thrown `ApiError` carrying the status, so callers cannot
 *      accidentally render an error body as data.
 *   3. Order reads are never cached. A stale "Cooking" screen while the rider waits
 *      at the gate is worse than a spinner (docs/SYSTEM_ARCHITECTURE_AND_FLOWS.md §9).
 *   4. One place to add the auth header when Phase 6 lands.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues?: Array<{ path: string; message: string }>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiRequestInit = Omit<RequestInit, "body" | "method"> & {
  /** Parsed and re-serialised as JSON. Never send a money value — the server computes it. */
  body?: unknown;
};

async function request<T>(
  method: string,
  path: string,
  init: ApiRequestInit = {},
): Promise<T> {
  const { body, headers, ...rest } = init;

  const response = await fetch(`${env.NEXT_PUBLIC_API_URL}${path}`, {
    ...rest,
    method,
    // The API is a different origin; without this the session cookie never arrives.
    credentials: "include",
    // Order state must never be served from a cache. See rule 3 above.
    cache: "no-store",
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const shape = payload as
      | { error?: string; issues?: Array<{ path: string; message: string }> }
      | null;
    throw new ApiError(
      response.status,
      shape?.error ?? `Request failed with ${response.status}`,
      shape?.issues,
    );
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, init?: ApiRequestInit) => request<T>("GET", path, init),
  post: <T>(path: string, body?: unknown, init?: ApiRequestInit) =>
    request<T>("POST", path, { ...init, body }),
  patch: <T>(path: string, body?: unknown, init?: ApiRequestInit) =>
    request<T>("PATCH", path, { ...init, body }),
  delete: <T>(path: string, init?: ApiRequestInit) => request<T>("DELETE", path, init),
};
