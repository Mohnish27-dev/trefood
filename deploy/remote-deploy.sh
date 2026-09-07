#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════
#  TREFOOD — the half of the deploy that runs on the Lightsail box.
#
#  Piped over SSH by .github/workflows/deploy.yml:
#
#      ssh host "IMAGE_REF='ghcr.io/…:sha-abc1234' bash -s" < remote-deploy.sh
#
#  It lives in the repository rather than on the server so the deploy
#  procedure is reviewed like code and cannot quietly drift.
#
#  It does four things and nothing else: pull the pinned image, restart,
#  wait for the container's own health check, and — if that check fails —
#  put the previous image back. A deploy that leaves the site down while
#  reporting success is worse than one that refuses to finish.
# ══════════════════════════════════════════════════════════════════════
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/trefood}"
CONTAINER="trefood-app"
# Generous: the image has a 20s start-period, Atlas connection setup is
# not instant, and this box is small.
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-150}"

: "${IMAGE_REF:?IMAGE_REF was not passed in — this script is not meant to be run by hand}"

log() { printf '==> %s\n' "$*"; }
err() { printf '!!  %s\n' "$*" >&2; }

cd "$APP_DIR"

# ---- preflight -------------------------------------------------------
# These are the two failures that otherwise show up as a confusing crash
# loop three minutes later.
if [ ! -f docker-compose.yml ]; then
  err "$APP_DIR/docker-compose.yml is missing. The deploy workflow should have copied it."
  exit 1
fi
if [ ! -f app.env ]; then
  err "$APP_DIR/app.env is missing — the container has no MONGODB_URI, no CRON_SECRET."
  err "Create it from deploy/app.env.example. See docs/DEPLOYMENT.md."
  exit 1
fi

# ---- helpers ---------------------------------------------------------

# The image the container is running right now, so a bad rollout has
# something to fall back to. Empty on the very first deploy.
current_image() {
  docker inspect -f '{{.Config.Image}}' "$CONTAINER" 2>/dev/null || true
}

start_image() {
  export IMAGE_REF="$1"
  # Pull explicitly rather than letting `up` do it, so a registry auth
  # failure is reported as a registry auth failure and not as a vague
  # "service app failed to start".
  docker compose pull app
  # No service argument: this also starts the proxy when COMPOSE_PROFILES
  # enables it, and is a no-op for it when it does not.
  docker compose up -d
}

# Poll the HEALTHCHECK baked into the image (it curls /api/health, which
# pings Mongo). This is what makes "deployed" mean "actually serving".
wait_healthy() {
  local deadline=$((SECONDS + HEALTH_TIMEOUT)) state
  while [ "$SECONDS" -lt "$deadline" ]; do
    state="$(docker inspect \
      -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' \
      "$CONTAINER" 2>/dev/null || echo missing)"
    case "$state" in
      healthy)
        return 0
        ;;
      unhealthy)
        err "container reported unhealthy"
        return 1
        ;;
      none)
        # An image without a HEALTHCHECK — only possible when rolling back
        # to something old. Fall back to "is it still running".
        [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null)" = "true" ] && return 0
        return 1
        ;;
    esac
    sleep 3
  done
  err "timed out after ${HEALTH_TIMEOUT}s waiting for health (last state: ${state:-unknown})"
  return 1
}

# ---- deploy ----------------------------------------------------------
PREVIOUS_IMAGE="$(current_image)"
log "currently running: ${PREVIOUS_IMAGE:-<nothing>}"
log "deploying:         ${IMAGE_REF}"

start_image "$IMAGE_REF"

if wait_healthy; then
  log "healthy on ${IMAGE_REF}"
else
  err "rollout failed — last 80 log lines follow"
  docker compose logs --tail=80 app >&2 || true

  if [ -n "$PREVIOUS_IMAGE" ] && [ "$PREVIOUS_IMAGE" != "$IMAGE_REF" ]; then
    err "rolling back to ${PREVIOUS_IMAGE}"
    if start_image "$PREVIOUS_IMAGE" && wait_healthy; then
      err "rollback succeeded — the site is up on the previous image"
    else
      err "ROLLBACK ALSO FAILED. The site is down; this needs a human."
    fi
  else
    err "no previous image to roll back to"
  fi
  exit 1
fi

# ---- housekeeping ----------------------------------------------------
# Dangling images only: sha-tagged images stay, which is what keeps a
# rollback to last week's build a pull-free operation. Skipping this
# fills the disk, and a full disk on a one-box deploy is an outage.
log "pruning dangling images"
docker image prune -f >/dev/null || true

log "done"
