# TREFOOD

Hyperlocal food delivery for Indian college campuses. First deployment: **NIT Patna**.
Multi-tenant from day one — a second campus is a database row, never a code change.

## Layout

An npm-workspaces monorepo with two independently runnable services.

| Package | What it is | Port |
| :-- | :-- | :-- |
| `shared/` | `@trefood/shared` — types, money, constants, API contracts. Imported by both. | — |
| `backend/` | `@trefood/backend` — Express API. Owns MongoDB, every business rule, and **every secret**. | 4000 |
| `frontend/` | `@trefood/frontend` — Next.js UI. Student PWA, vendor console, admin console. | 3000 |

**The two rules that shape everything:**

1. Business logic lives in `backend/src/services/`. Routes and components are thin
   adapters that authenticate, parse, call a service, and render.
2. The frontend never reaches past the backend. No MongoDB driver, no Razorpay SDK,
   no secret — enforced by lint, not by discipline.

## Read these first

| Document | What it settles |
| :-- | :-- |
| [docs/DECISIONS.md](docs/DECISIONS.md) | **Source of truth.** If another doc contradicts it, that doc is a bug. |
| [docs/MASTER_PROMPT_PRD.md](docs/MASTER_PROMPT_PRD.md) | What the product is, and the engineering rules that are not negotiable. |
| [docs/PHASES.md](docs/PHASES.md) | **The build plan.** P0 → P15, with an exit gate per phase. |
| [docs/SYSTEM_ARCHITECTURE_AND_FLOWS.md](docs/SYSTEM_ARCHITECTURE_AND_FLOWS.md) | Architecture, the order FSM, and the three end-to-end flows. |
| [docs/MONEY_AND_SETTLEMENT.md](docs/MONEY_AND_SETTLEMENT.md) | Every rupee. Pricing formula, refunds, settlement, the 7 invariants. |
| [docs/FAILURES_AND_EDGE_CASES.md](docs/FAILURES_AND_EDGE_CASES.md) | F1–F18, what we handle by hand, and what we deliberately do not build. |
| [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) | Where code goes and why. |

## Getting started

```bash
npm install

cp backend/.env.example        backend/.env          # then fill it in
cp frontend/.env.local.example frontend/.env.local   # then fill it in

npm run dev            # backend on :4000, frontend on :3000
curl http://localhost:4000/health/ready
```

`/health/ready` returns `{"ok":true,"db":{"ok":true,"latencyMs":…}}` when Mongo is
reachable. A missing or malformed secret crashes the backend at boot with every
problem listed at once — see `backend/src/env.ts`.

## Scripts

| Command | Does |
| :-- | :-- |
| `npm run dev` | Both services together |
| `npm run dev:backend` / `npm run dev:frontend` | One at a time |
| `npm run build` | Builds all three packages in dependency order |
| `npm run typecheck` | `tsc` across every package |
| `npm run lint` | ESLint, including the TREFOOD engineering rules |
| `npm run test` | Vitest in `shared` and `backend` |
| `npm run verify` | typecheck + lint + test. What CI runs. |

> `@trefood/shared` is built before the others can typecheck — they consume its
> emitted `.d.ts` files. Every root script handles this. If you run a workspace script
> directly and see "cannot find module @trefood/shared", run
> `npm run build -w @trefood/shared` first.

## Enforced by tooling, not by memory

- **No `any`**, and **no non-null `!`** — both are lint errors in both services.
- **No `.toFixed()` in a money path** — all money is integer paise
  (docs/MONEY_AND_SETTLEMENT.md §1).
- **The frontend cannot import `mongodb` or `razorpay`** — the split cannot be undone
  by accident.
- **`noUncheckedIndexedAccess`** — `items[0]` is `T | undefined`, so an out-of-range
  read cannot silently enter a money path.
- **Backend and shared are ESM** with `NodeNext` resolution: relative imports carry a
  `.js` extension even though the source is `.ts`.

## Current phase

**Phase 2 — Student PWA, complete (against fixtures).** Next up:
[Phase 3](docs/PHASES.md) — the vendor console.

Run `npm run dev:frontend` and walk the whole journey with no backend running:

| Route | Screen |
| :-- | :-- |
| `/` | Campus picker (remembers your choice) |
| `/c/nit-patna` | Restaurant list, filtered by delivery point |
| `/c/nit-patna/r/nit-canteen` | Menu, add-ons, 86-ed items |
| `/cart` · `/checkout` | Cart and the curfew guard |
| `/orders` · `/orders/order-at_gate` | History and the **gate screen** |
| `/account` | Profile and push-permission banner |
| `/dev/kitchen-sink` | Every primitive and all 18 order states |

Change `order-at_gate` to any status (`order-preparing`, `order-delivered`, …) to see
that state of the tracker.
