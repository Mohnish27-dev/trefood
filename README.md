# TREFOOD

Hyperlocal food delivery for Indian college campuses. First deployment: **NIT Patna**.
Multi-tenant from day one — a second campus is a database row, never a code change.

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

**The one rule that shapes everything:** business logic lives in `src/server/services/`.
Server Actions, Route Handlers and Components are thin adapters that authenticate,
parse, call a service, and render.

## Getting started

```bash
npm install
cp .env.local.example .env.local     # then fill it in — the app will not boot without it
npm run dev
curl http://localhost:3000/api/health
```

`/api/health` returns `{"ok":true,"db":{"ok":true,"latencyMs":…}}` when Mongo is reachable.

A missing or malformed secret crashes the server at boot with every problem listed at
once. That is deliberate — see `src/lib/env.server.ts`.

## Scripts

| Command | Does |
| :-- | :-- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint, including the TREFOOD engineering rules |
| `npm run test` | Vitest unit tests |
| `npm run verify` | typecheck + lint + test. What CI runs. |

## Enforced by tooling, not by memory

- **No `any`**, and **no non-null `!`** — both are lint errors (`eslint.config.mjs`).
- **No `.toFixed()` outside `src/lib/money.ts`** — all money is integer paise
  (docs/MONEY_AND_SETTLEMENT.md §1).
- **`noUncheckedIndexedAccess`** — `items[0]` is `T | undefined`, so an out-of-range
  read cannot silently enter a money path.
- **`import "server-only"`** on every module that reads a secret. A Client Component
  reaching one is a build error, not a leak.

## Current phase

**Phase 0 — Foundation.** Next up: [Phase 1](docs/PHASES.md) — type contracts,
`lib/money.ts`, fixtures, and the design system.
