import type { Server } from "node:http";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";

/**
 * These tests exist to prove one structural property: `createApp()` can be mounted
 * without binding a well-known port and without opening a database connection. That
 * is why the Express app is built in `app.ts` and only started in `index.ts` — if the
 * two were one file, nothing here would be testable.
 */
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = createApp().listen(0, () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        throw new Error("Expected an ephemeral TCP port");
      }
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

describe("liveness", () => {
  it("answers without touching the database", async () => {
    const response = await fetch(`${baseUrl}/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, service: "trefood-backend" });
  });
});

describe("readiness", () => {
  it("fails closed with 503 when the database pool was never opened", async () => {
    // No connectDb() ran, so getDb() throws. An instance in this state must not be
    // sent traffic — reporting 200 here is how a deploy serves 500s to real students.
    const response = await fetch(`${baseUrl}/health/ready`);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ ok: false });
  });
});

describe("routing", () => {
  it("returns a JSON 404 rather than Express's HTML default", async () => {
    const response = await fetch(`${baseUrl}/does-not-exist`);
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toMatchObject({ ok: false, path: "/does-not-exist" });
  });
});

describe("cors", () => {
  it("allows the configured frontend origin with credentials", async () => {
    const response = await fetch(`${baseUrl}/health`, {
      headers: { Origin: "http://localhost:3000" },
    });
    expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it("refuses an origin that is not on the allowlist", async () => {
    // The session cookie travels cross-origin now, so the allowlist is real access
    // control. A wildcard would be illegal alongside credentials, and for good reason.
    const response = await fetch(`${baseUrl}/health`, {
      headers: { Origin: "https://evil.example" },
    });
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });
});
