# Deployment

How a commit on `main` becomes the running site.

## Why it is shaped this way

Building Next.js on the Lightsail instance took roughly twenty minutes. That
box has 2 vCPU and 2 GiB, and it was being asked to compile a React app while
also serving traffic — the build competed with the thing it was building for.

So the build moved off the server entirely:

```
push to main
   │
   ├─ verify ──── typecheck, lint, tests (against a throwaway Mongo)
   │
   ├─ build ───── GitHub runner builds the image, pushes to ghcr.io
   │                tagged sha-<commit>  and  latest
   │
   └─ deploy ──── ssh to Lightsail:  pull the sha tag, restart,
                    wait for the health check,
                    roll back automatically if it fails
```

The server never compiles anything. It pulls a ~180 MB image and restarts a
container, which takes seconds.

Two properties are worth naming, because they are the reason for the extra
machinery:

- **Every build is tagged by commit sha.** Rolling back is redeploying a tag
  that already exists, not rebuilding an old commit and hoping it still
  compiles.
- **A deploy that does not pass the container's health check does not
  count.** `deploy/remote-deploy.sh` puts the previous image back by itself.
  A green checkmark over a dead site is worse than a red one.

## Files

| Path | What it is |
|---|---|
| `.github/workflows/verify.yml` | Reusable gate — typecheck, lint, test. Called by both other workflows so "green" means one thing. |
| `.github/workflows/ci.yml` | Runs the gate on every pull request. |
| `.github/workflows/deploy.yml` | Gate → build → push → deploy. Runs on `main`, or manually for a rollback. |
| `deploy/docker-compose.prod.yml` | Copied to `/opt/trefood/docker-compose.yml` each deploy. Never builds; pulls a pinned tag. |
| `deploy/remote-deploy.sh` | The server half: pull, restart, health-check, roll back. Piped over SSH. |
| `deploy/Caddyfile` | TLS terminator config, used only if the `caddy` profile is on. |
| `deploy/app.env.example` | Template for `/opt/trefood/app.env` — the runtime secrets. |

---

## Where configuration lives, and why it is split three ways

This trips people up, so it is worth being explicit. The app has three
different kinds of configuration and they cannot share a home.

**1. Repository Variables — `NEXT_PUBLIC_*` (build time)**

Next.js inlines these into the JavaScript bundle when the image is built.
Setting one at runtime does nothing at all: the value was frozen into the
bundle hours earlier. They live in GitHub as *Variables*, not Secrets,
because every one of them is shipped to every visitor's browser — they are
public by construction, and calling them secret would be theatre.

Changing one requires a rebuild, which means a new deploy.

**2. Repository Secrets — SSH access**

Only the four values needed to reach the server.

**3. `/opt/trefood/app.env` on the server — runtime secrets**

The Atlas URI, the Paytm merchant key, `CRON_SECRET`. Read when the
container boots, so they are never baked into the image and never pass
through GitHub. Changing one is `docker compose up -d` on the server — no
rebuild, no deploy.

`NEXT_PUBLIC_APP_URL` is the one value that belongs in **both** places, because
`src/lib/env.ts` parses it server-side as well as inlining it. Keep the two
identical or the server and the browser will disagree about where the site is.

---

## One-time setup

### 1. Repository Variables

`Settings → Secrets and variables → Actions → Variables → New repository variable`

Required — the build fails without it, on purpose:

| Variable | Example |
|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://www.trefood.in` (no trailing slash) |

Set these too, or the features they power ship dead in the image with no
error to tell you:

| Variable | Needed for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase auth, when `AUTH_PROVIDER=supabase` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | as above |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | web push (must pair with `VAPID_PRIVATE_KEY` in `app.env`) |
| `NEXT_PUBLIC_SUPPORT_WHATSAPP` | the WhatsApp row on `/account/support` |
| `NEXT_PUBLIC_SUPPORT_PHONE` | the tap-to-call row |

Optional, with working defaults if unset: `NEXT_PUBLIC_SUPPORT_EMAIL`,
`NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_POLL_VENDOR_MS`,
`NEXT_PUBLIC_POLL_STUDENT_MS`, `NEXT_PUBLIC_POLL_ADMIN_MS`,
`NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_POSTHOG_KEY`.

### 2. Repository Secrets

`Settings → Secrets and variables → Actions → Secrets`

| Secret | What |
|---|---|
| `LIGHTSAIL_HOST` | the instance's static IP |
| `LIGHTSAIL_USER` | SSH user — `ubuntu` on an Ubuntu blueprint, `bitnami` on Bitnami, `ec2-user` on Amazon Linux |
| `LIGHTSAIL_SSH_KEY` | private half of a deploy-only keypair, whole file including header and footer |
| `LIGHTSAIL_KNOWN_HOSTS` | the server's public host key, so the deploy cannot be pointed at an impostor |

Generate the keypair on your machine — a dedicated key, not your personal one,
so it can be revoked without locking yourself out:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/trefood_deploy -C "github-actions" -N ""

# Authorise it on the server
ssh-copy-id -i ~/.ssh/trefood_deploy.pub <USER>@<LIGHTSAIL_IP>

# LIGHTSAIL_SSH_KEY  — copy the whole output
cat ~/.ssh/trefood_deploy

# LIGHTSAIL_KNOWN_HOSTS — copy the whole output
ssh-keyscan -t ed25519 <LIGHTSAIL_IP>
```

### 3. GitHub Environment

`Settings → Environments → New environment → production`

The deploy job targets it. You can leave it empty; add a required reviewer
later if you want a human approving production deploys.

### 4. Server bootstrap

SSH in once and run:

```bash
# Docker with the compose v2 plugin
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"     # log out and back in for this to take effect

# Swap. A 2 GiB instance with none will OOM-kill the container under a
# modest burst, and sometimes takes sshd down with it.
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# The deploy directory, owned by the SSH user so scp does not need sudo
sudo mkdir -p /opt/trefood
sudo chown "$USER:$USER" /opt/trefood
```

Then the runtime secrets. Paste in the contents of `deploy/app.env.example`
and fill it in:

```bash
nano /opt/trefood/app.env
chmod 600 /opt/trefood/app.env
```

Generate a real `CRON_SECRET` while you are there — `env.ts` refuses to boot
in production if it is still the development placeholder:

```bash
openssl rand -hex 32
```

### 5. Let the server pull from GHCR

The image is private, so the server authenticates once. Create a token at
`github.com/settings/tokens` — classic, scope `read:packages` only — then:

```bash
echo "<TOKEN>" | docker login ghcr.io -u Mohnish27-dev --password-stdin
```

That is stored in `~/.docker/config.json` and survives reboots. A read-only
token is the whole point: if the box is compromised, it cannot push.

### 6. Atlas network access

Add the Lightsail static IP to `Atlas → Network Access`. Without it the
container starts fine and every request times out against a firewall —
`/api/health` will report `degraded`, which is the fastest way to spot this.

### 7. The reverse proxy

The instance was checked and has **none**: `nginx` and `caddy` are both
inactive, and the only thing on port 80 is the app container itself,
published as `0.0.0.0:80->3000`. The site is therefore served over plain
HTTP with no TLS.

So turn on the bundled Caddy. It obtains and renews a Let's Encrypt
certificate by itself — no certbot, no cron entry, nothing to forget:

```bash
cat > /opt/trefood/.env <<'CFG'
COMPOSE_PROFILES=caddy
APP_DOMAIN=www.trefood.in
CFG
```

Two things must be true before Caddy will be issued a certificate, and it
will keep failing until they are:

- the domain's A record points at the Lightsail **public** static IP
- ports **80 and 443** are open in `Lightsail → Networking → IPv4 Firewall`
  (80 is already open; 443 probably is not)

#### Cloudflare is in front of this

DNS for the domain is on Cloudflare (registered at Hostinger, nameservers
delegated to Cloudflare). That changes the TLS setup in a way that is worth
getting right the first time, because the failure mode is an infinite
redirect loop rather than an error message.

Check what the record is doing:

```bash
# What the world resolves. If this returns a 104.x / 172.6x address, the
# record is proxied (orange cloud) and you are seeing Cloudflare, not the
# instance. A match with the Lightsail public IP means DNS-only.
dig +short www.trefood.in
```

**Do the first issuance with the record set to DNS-only (grey cloud).**
In the Cloudflare dashboard, `DNS → Records`, click the orange cloud on the
`www` (and apex) record so it goes grey. Let's Encrypt then talks straight to
Caddy, the certificate is issued in seconds, and there is exactly one thing
that can be wrong instead of three.

Verify it worked before changing anything else:

```bash
curl -sI https://www.trefood.in | head -1     # expect HTTP/2 200
docker compose logs caddy | tail -20          # "certificate obtained successfully"
```

**Then, if you want Cloudflare's proxy back on**, turn the cloud orange again
and — this is the part that bites people — set
`SSL/TLS → Overview → Encryption mode` to **Full (strict)**.

- **Flexible** makes Cloudflare talk to the origin over plain HTTP on :80.
  Caddy redirects that to HTTPS, Cloudflare follows it back to itself, and
  the browser gets `ERR_TOO_MANY_REDIRECTS`. This is the single most common
  Cloudflare-plus-Caddy failure, and it looks like a Caddy bug when it is not.
- **Full (strict)** validates the real Let's Encrypt certificate Caddy holds.
  This is the correct setting and the only one that is end-to-end encrypted.

Keeping the record grey (DNS-only) is a perfectly good permanent answer too.
You lose Cloudflare's caching and DDoS absorption, and you gain one less
moving part between a user and the order they are placing.

> Cloudflare's proxy only forwards a fixed set of ports. If you ever move the
> site off 443, it stops working through the orange cloud with no obvious
> reason why.

**If there is no domain pointed at the box yet**, leave the caddy profile off
and reproduce the current behaviour instead, which keeps the site reachable
by IP while you sort out DNS:

```bash
echo 'APP_BIND=0.0.0.0:80' > /opt/trefood/.env
```

That is plain HTTP. It is fine for a staging box and not fine for taking
payments — a Paytm callback over `http://` is a genuine problem, not a
lint warning. Treat it as temporary.

> `/opt/trefood/.env` and `/opt/trefood/app.env` are different files with
> different jobs. `.env` is read by *compose* for `${...}` substitution;
> `app.env` is handed to the *container* as its environment. Putting
> `MONGODB_URI` in `.env` will not reach the app.

### 8. Cutover from the hand-built container

There is already a container called `trefood` running the locally built
`trefood-app` image and holding port 80. Two containers cannot bind the same
port, so it has to go — but the order below means the site never goes down
while it happens.

The trick is to let the new container come up on loopback, *alongside* the
old one, and only switch ports once it is proven healthy.

**a. Leave the caddy profile off for the very first deploy.** Either leave
`/opt/trefood/.env` absent entirely, or make sure it does not yet contain
`COMPOSE_PROFILES=caddy`. The new container will bind `127.0.0.1:3000`,
which nothing is using.

**b. Finish steps 1–6, then merge to `main`.** The deploy runs green. The
old container is still serving the public site the whole time.

**c. Prove the new container is actually healthy** before trusting it:

```bash
curl -s localhost:3000/api/health
# {"status":"ok","db":"ok", ...}   <- "degraded" means Atlas is not reachable;
#                                     fix step 6 before going further
```

**d. Switch over.** Only now does anything user-visible change. Set the
Cloudflare record to DNS-only (grey cloud) first, per §7 — Caddy needs a
clean path to Let's Encrypt for the first issuance:

```bash
docker rm -f trefood          # frees port 80

cat > /opt/trefood/.env <<'CFG'
COMPOSE_PROFILES=caddy
APP_DOMAIN=www.trefood.in
CFG
```

**e. Re-run the deploy workflow** (`Actions → Deploy to Lightsail → Run
workflow`, with `image_tag` set to the tag that just deployed). It rebinds
the app to loopback and brings Caddy up on 80/443. Downtime is the few
seconds between (d) and the end of (e).

**f. Reclaim the space** once the new stack has been up for a day:

```bash
docker rmi trefood-app        # the old locally built image
docker builder prune -af      # build cache — nothing is built here any more
```

That last one matters: this box has been building Next.js, so it is likely
sitting on several GB of BuildKit cache that will never be used again.

> The instance also reported **\*\*\* System restart required \*\*\***. Reboot
> at a quiet moment once the cutover is done — `restart: unless-stopped`
> brings both containers back on their own.

---

## Deploying

Merge to `main`. That is the whole procedure.

Watch it under `Actions → Deploy to Lightsail`. The job summary prints the
image tag that landed.

### Rolling back

`Actions → Deploy to Lightsail → Run workflow`, and put a previous tag in
`image_tag`:

```
sha-a1b2c3d
```

Verify and build are skipped — the image already exists — so this takes about
as long as an `ssh` and a `docker pull`. Tags are listed under the repository's
**Packages**, or on the server with `docker images | grep trefood`.

### Changing a runtime secret

No deploy needed:

```bash
ssh <USER>@<IP>
nano /opt/trefood/app.env
cd /opt/trefood && docker compose up -d
```

### Changing a `NEXT_PUBLIC_*` value

Update the repository Variable, then re-run the deploy workflow. The value is
inlined at build time, so it needs a new image — editing `app.env` will not
do it.

---

## When it goes wrong

**`IMAGE_REF must be set`** — someone ran `docker compose up` by hand on the
server. Use the workflow, or export the tag first:
`IMAGE_REF=ghcr.io/mohnish27-dev/trefood:sha-abc1234 docker compose up -d`

**`denied` / `unauthorized` on pull** — the server's GHCR token expired or was
never created. Redo step 5.

**Deploy fails at the health check, then reports a successful rollback** — the
new image built fine but cannot serve. The workflow log includes the last 80
container log lines; the usual causes are a bad `app.env` value (env.ts prints
exactly which one) or Atlas rejecting the instance IP.

**Host key verification failed** — the instance was rebuilt and its host key
changed. Regenerate `LIGHTSAIL_KNOWN_HOSTS` with `ssh-keyscan`.

**Integration tests fail in CI but pass locally** — CI runs them against a
disposable Mongo service container, not your `.env.local` database. A test
that depends on data only your local database has will fail here, correctly.

**Caddy will not get a certificate** — DNS must resolve to the instance and
ports 80/443 must be open in the Lightsail firewall *before* Caddy asks. Check
`docker compose logs caddy`.

---

## Known gaps

Worth naming rather than discovering later:

- **The cron routes are not scheduled.** `/api/cron/*` — settlement,
  reconciliation, expiring unacked orders — are HTTP endpoints guarded by
  `CRON_SECRET`, and nothing currently calls them. They need a scheduler
  (a host `cron` entry with `curl`, or an external pinger). Until then those
  jobs do not run.
- **No database backups configured here.** Atlas has its own; make sure the
  cluster tier you are on actually includes them.
- **Paytm is on test credentials.** `PAYMENT_PROVIDER=paytm` with the staging
  MID and key, so no real money moves. Going live is four lines in `app.env`
  (the Paytm block in `deploy/app.env.example`) — but it needs HTTPS first,
  because Paytm will not accept an `http://` callback URL for production
  credentials. Do the TLS cutover before requesting production keys, not
  after.
- **`AUTH_PROVIDER` is `stub` in the example.** Confirm what the box is
  actually running before you overwrite `app.env` with the template:
  `docker inspect trefood --format '{{range .Config.Env}}{{println .}}{{end}}'`
- **The `caddy-data` volume holds the TLS certificates.** Destroying it means
  re-issuing, and Let's Encrypt rate-limits that to 5 per week per domain.
- **One instance, so a deploy is a brief restart.** Zero-downtime would need a
  second container and the proxy draining between them — worth doing only when
  a few seconds of 502 during a deploy actually costs something.
