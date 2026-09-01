# ══════════════════════════════════════════════════════════════════════
#  TREFOOD - multi-stage image
#
#  Relies on `output: "standalone"` in next.config.ts, which emits a
#  self-contained server bundle with only the node_modules it actually
#  imports. Final image is ~180 MB rather than ~1.2 GB.
#
#  The container is stateless: no local writes, no in-process cache that
#  survives a request, no sticky sessions. Scaling out is a replica-count
#  change, never a code change. docs/PHASE_PLAN.md section 2.
# ══════════════════════════════════════════════════════════════════════

# ---- deps: install once, cache on lockfile only ----------------------
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# ---- builder ---------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next inlines NEXT_PUBLIC_* at build time, so they must be present here.
# Non-public secrets are deliberately absent - they are read at runtime.
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_POLL_VENDOR_MS=5000
ARG NEXT_PUBLIC_POLL_STUDENT_MS=8000
ARG NEXT_PUBLIC_POLL_ADMIN_MS=10000
ARG NEXT_PUBLIC_DEMO_MODE=false
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_POLL_VENDOR_MS=$NEXT_PUBLIC_POLL_VENDOR_MS \
    NEXT_PUBLIC_POLL_STUDENT_MS=$NEXT_PUBLIC_POLL_STUDENT_MS \
    NEXT_PUBLIC_POLL_ADMIN_MS=$NEXT_PUBLIC_POLL_ADMIN_MS \
    NEXT_PUBLIC_DEMO_MODE=$NEXT_PUBLIC_DEMO_MODE \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---- runner ----------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Never run as root.
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
