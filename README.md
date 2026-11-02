# TreFood 🍔🛵

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.6-green?logo=mongodb)](https://www.mongodb.com/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![Vitest](https://img.shields.io/badge/Tested%20with-Vitest-6E9F18?logo=vitest)](https://vitest.dev/)

> **Hyperlocal food delivery & campus commerce infrastructure engineered for the physical realities of university environments.**  
> _Initial pilot deployment: National Institute of Technology (NIT) Patna._

---

## 📌 The Problem TreFood Solves

Commercial food aggregators (like Zomato and Swiggy) frequently fail within university campus environments due to physical and economic constraints:

1. **Restricted Access & Gate Curfews**: Outside delivery riders cannot enter academic blocks or student hostels. Deliveries must happen strictly at designated campus gates before strict hostel curfews (e.g., 21:30 for girls' hostels, 22:00 for boys').
2. **Micro-Radius & Low Ticket Sizes**: 95% of campus orders travel less than 2.5 km with average order values between ₹50 and ₹250. Commercial 25–30% platform cuts make micro-meals unviable for local stall owners. TreFood operates on a sustainable 10% platform fee.
3. **No-Smartphone Rider Reality**: Campus vendors rely on their own internal kitchen staff for handovers, many of whom do not use smartphones. Live GPS rider tracking is replaced with an ETA-based stepper and student-confirmed 4-digit code matching on the delivery packet.
4. **Spiky Campus Demand**: Peak surges occur post-lecture (16:00–18:00) and late-night (22:30–02:30), especially during examination cycles.

---

## ✨ Key Features

- 📱 **Student Progressive Web App (PWA)**:
  - Mobile-first, lightweight ordering interface with offline caching and Web Push notifications.
  - Multi-campus picker and curfew-aware gate selection.
  - Order verification via physical 4-digit packet code matching.

- 👨‍🍳 **Vendor Operations Console**:
  - Real-time kitchen order ticket (KOT) generation and thermal printing.
  - Live sound alerts (`new-order.mp3`) on incoming orders.
  - Item availability toggles, operational hours management, and order fulfillment steppers.

- 🛡️ **Role-Based Admin & Co-Admin Dashboards**:
  - Multi-tiered RBAC (Super Admin, Campus Co-Admin, Vendor, Student).
  - Vendor onboarding, menu catalog management, and campus boundary configuration.
  - Transparent financial settlements, commission ledgers, and coupon campaign management.

- 🏢 **Multi-Tenant from Day 1**:
  - Engineered so onboarding a new college or university campus is a simple database record, never requiring code changes.

- 💰 **Deterministic Settlement & Refund Engine**:
  - Enforces strict refund rules (fault-based refunds, payment gateway fee retention, and vendor ledger debiting).

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org) (App Router, Server Actions, Route Handlers)
- **Frontend**: [React 19](https://react.dev), [Tailwind CSS v4](https://tailwindcss.com), [Radix UI](https://www.radix-ui.com/), [Lucide Icons](https://lucide.dev)
- **Database**: [MongoDB](https://www.mongodb.com/) with native Node.js driver and indexing scripts
- **Mapping**: [Leaflet](https://leafletjs.com/) & [React-Leaflet](https://react-leaflet.js.org/)
- **Validation**: [Zod](https://zod.dev/)
- **Testing**: [Vitest](https://vitest.dev/), [React Testing Library](https://testing-library.com/), [mongodb-memory-server](https://github.com/nodkz/mongodb-memory-server)
- **Utilities**: Web Push API, Nodemailer, QRCode

---

## 🏛️ Architecture & Project Structure

TreFood enforces a strict separation of concerns:

> **All core business logic lives exclusively in `src/server/services/`.**  
> Server actions, route handlers, and UI components are strictly adapters that authenticate, parse, call services, and render.

```
trefood/
├── docs/                     # Architectural decisions, PRDs, and audit reports
├── public/                   # Static assets, PWA manifest, service workers, alert sounds
├── scripts/                  # Seed scripts, index verification, and QR generators
├── src/
│   ├── app/                  # Next.js App Router (Student PWA, Vendor, Admin portals)
│   ├── components/           # Reusable UI primitives & domain components
│   ├── lib/                  # Shared utilities, environment validation, auth wrappers
│   └── server/
│       ├── db/               # MongoDB client singleton & collections
│       └── services/         # Isolated, testable core domain business logic
└── tests/                    # Unit, integration, and service tests (Vitest)
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `v22.0.0` or higher
- **MongoDB**: Local MongoDB instance or Docker daemon
- **npm** or preferred package manager

### Installation

1. **Clone the repository**:

   ```bash
   git clone https://github.com/Mohnish27-dev/trefood.git
   cd trefood
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Configure environment variables**:

   ```bash
   cp .env.local.example .env.local
   ```

   Fill in your MongoDB URI, Google OAuth credentials, and notification secrets.

4. **Start MongoDB (Optional via Docker)**:

   ```bash
   npm run db:up
   ```

5. **Seed initial vendors & campus data**:

   ```bash
   npm run seed
   npm run seed:vendors
   ```

6. **Run development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing & Verification

Run the full verification suite (Typecheck, ESLint, and Vitest):

```bash
# Run all checks
npm run verify

# Run unit & integration tests
npm test

# Run tests in watch mode
npm run test:watch
```

---

## 📚 Detailed Documentation

Comprehensive design specifications and operational flows can be found in the [`/docs`](docs/) directory:

- [Master PRD & Requirements](docs/MASTER_PROMPT_PRD.md)
- [System Architecture & State Flows](docs/SYSTEM_ARCHITECTURE_AND_FLOWS.md)
- [Money, Payouts & Settlement](docs/MONEY_AND_SETTLEMENT.md)
- [Authentication Architecture](docs/AUTHENTICATION.md)
- [Edge Cases & Failure Recovery](docs/FAILURES_AND_EDGE_CASES.md)
- [Deployment Guidelines](docs/DEPLOYMENT.md)

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
