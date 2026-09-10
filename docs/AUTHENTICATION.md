# Authentication

TREFOOD authenticates its own users. There is no third-party auth service in
the request path.

## Why this changed

Authentication used to be delegated to a hosted provider. Three problems, all
the same problem — the identity did not live here:

- **The email quota was not ours.** Verification codes rode a shared sending
  allowance counted across every project on the platform. A busy evening
  produced "email rate limit exceeded" for students who had done nothing
  wrong, and there was no dial to turn.
- **Sessions could not be revoked early.** A signed token is valid until it
  expires, so a password change did not sign anybody out.
- **Every account existed twice.** One record there, one here, kept in step by
  code that had to run on every sign-in.

Codes now go out over a mailbox on `trefood.in`. Sessions are rows in MongoDB.
There is one account record.

## The three ways in

| Method | What proves identity | Session opened with |
| --- | --- | --- |
| Email and password | scrypt hash in `users.passwordHash` | `PASSWORD` |
| Continue with Google | OAuth 2.0 authorization code with PKCE | `GOOGLE` |
| Six-digit email code | a code hashed in `emailOtps` | `OTP` |
| 4-digit quick unlock | PIN hash in `users.quickUnlock` | `QUICK_UNLOCK` |

All four end in the same place: a row in `sessions` and an opaque cookie.

## Sign-up

Sign-up is two steps, and the account is written at the end of the second.

1. Name, email and password are validated. The password is hashed.
2. A six-digit code is mailed. The name and the hash are parked on the code
   record, **not** in `users`.
3. The code is redeemed. Only then is the user document created.

Nothing lands in `users` until an address is proven. An abandoned sign-up
leaves no record, so an address cannot be squatted by starting a sign-up you
never finish, and the unique email index keeps meaning what it says.

## Sessions

The cookie (`trefood_session`) holds 32 random bytes. It is not a JWT and
deliberately says nothing about who you are. What is stored server-side is the
SHA-256 of the token, so a dump of the collection is not a pile of working
cookies.

A session dies when any of these is true, all checked on every request:

- the token is unknown, or the row is past `expiresAt`
- the user document is gone
- `users.passwordChangedAt` is newer than the session's `createdAt`

That last rule is what makes changing a password a real remedy: it signs out
every other browser, including whoever prompted the change.

Sessions last 30 days. `lastSeenAt` is refreshed at most once an hour, so a
page view does not cost a write.

## Rate limits

| Limit | Value | Where |
| --- | --- | --- |
| Wrong passwords before lockout | 5 | `users.loginLock` |
| Password lockout | 15 minutes | `signInWithEmail` |
| Wrong code guesses before the code burns | 6 | `emailOtps.attempts` |
| Code lifetime | 10 minutes | `OTP_TTL_MINUTES` |
| Seconds between resends | 60 | `OTP_RESEND_COOLDOWN_MS` |
| Codes per address per hour | 5 | `OTP_MAX_PER_HOUR` |

A six-digit code is a million possibilities only if a million guesses are
allowed. The attempt counter is the security here, not the digit count.

---

# Setting up the Zoho mailbox

You own `trefood.in`, so mail goes out from it.

## 1. Add the domain to Zoho Mail

Sign up at <https://www.zoho.in/mail/> and choose a plan with a custom domain.
Add `trefood.in` as the domain.

## 2. Verify the domain

Zoho gives you one record to add at your domain registrar. Add whichever it
offers — usually a `TXT` record on the root:

```
Type   TXT
Host   @
Value  zoho-verification=zb********.zmverify.zoho.in
```

Propagation is usually minutes. Press Verify in Zoho.

## 3. Point MX at Zoho

Delete any existing MX records, then add Zoho's. For the India data centre:

```
Priority  10   mx.zoho.in
Priority  20   mx2.zoho.in
Priority  50   mx3.zoho.in
```

## 4. Add SPF and DKIM

Without these, codes land in spam and students report that sign-up is broken.

**SPF** — a `TXT` record on the root:

```
v=spf1 include:zoho.in ~all
```

**DKIM** — Zoho Mail → Settings → Domains → `trefood.in` → Email
Configuration → DKIM → Add Selector. Zoho gives you a selector name and a
public key; add it as a `TXT` record:

```
Host   zmail._domainkey
Value  v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3...
```

Enable the selector in Zoho once the record resolves.

## 5. Create the sending mailbox

Zoho Mail → Users → Add User. Create `no-reply@trefood.in`.

It must be a real mailbox, not an alias. Zoho refuses to authenticate SMTP as
an alias.

## 6. Generate an app-specific password

**This is the step that catches people.** With two-factor authentication on the
mailbox, the account password is refused by SMTP outright.

Zoho Mail → Settings → Security → App Passwords → Generate New Password. Name
it something like "TREFOOD app". Copy the generated password; Zoho shows it
once.

## 7. Fill in the environment

```bash
SMTP_HOST=smtp.zoho.in        # smtp.zoho.com globally, smtp.zoho.eu in Europe
SMTP_PORT=465                 # implicit TLS. 587 is STARTTLS.
SMTP_USER=no-reply@trefood.in
SMTP_PASSWORD=<the app-specific password>
MAIL_FROM=TREFOOD <no-reply@trefood.in>
MAIL_TRANSPORT=smtp
```

The host must match the region the Zoho account was created in. A `.in` domain
usually lands on `smtp.zoho.in`, and credentials for one region do not
authenticate against another.

`MAIL_FROM` must be the mailbox itself or one of its verified aliases. Zoho
refuses to send as an address the mailbox does not own.

## 8. Prove it works

```bash
npm run mail:verify                    # connect and authenticate only
npm run mail:verify you@gmail.com      # also send a real test message
```

The script names the likely cause on failure. Check the spam folder on the
first send.

## Developing without a mailbox

```bash
MAIL_TRANSPORT=console
```

Codes are printed to the server log instead of sent, so the whole flow is
walkable on a laptop. `serverEnv()` refuses to boot with this in production.

---

# Setting up Google sign-in

## 1. Create the OAuth client

Google Cloud console → APIs & Services → Credentials → Create Credentials →
OAuth client ID → **Web application**.

## 2. Authorised JavaScript origins

```
http://localhost:3000
https://www.trefood.in
```

## 3. Authorised redirect URIs

These must match byte for byte, including the scheme and the `www`, with no
trailing slash. A mismatch is the `redirect_uri_mismatch` error.

```
http://localhost:3000/api/auth/google/callback
https://www.trefood.in/api/auth/google/callback
```

**The `www` is not optional.** The app derives this URI from
`NEXT_PUBLIC_APP_URL`, and production is deployed on `https://www.trefood.in`
(see `docs/DEPLOYMENT.md`). Registering the bare `trefood.in` form instead
produces a redirect URI Google has never seen. If you later serve the apex
domain directly rather than redirecting it to `www`, register both.

## 4. Configure the consent screen

APIs & Services → OAuth consent screen. External. The only scopes needed are
`openid`, `email` and `profile`, which are non-sensitive and need no Google
review. Publish it, or sign-in works only for the test users you list.

## 5. Fill in the environment

```bash
GOOGLE_CLIENT_ID=<client id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<client secret>
NEXT_PUBLIC_GOOGLE_ENABLED=true
```

`NEXT_PUBLIC_GOOGLE_ENABLED` is inlined into the browser bundle at **build**
time, so on the Lightsail deployment it is a GitHub Actions repository
*variable*, not a line in `app.env`. Editing `app.env` will not make the button
appear; that needs a new image.

`NEXT_PUBLIC_GOOGLE_ENABLED` is what renders the button. Leave it `false` until
the other two are set, or the button dead-ends on Google's error page.

## What the flow does

`GET /api/auth/google/start` mints a `state`, a PKCE verifier and a nonce,
packs them into one HMAC-signed cookie that lives five minutes, and redirects
to Google. The callback checks all three before touching an account:

- the state cookie's signature, then its value against what Google echoed
- the PKCE verifier, at the token endpoint
- the nonce, inside the returned `id_token`

An unverified Google address is refused rather than linked. Adopting an
account on an unverified address is how somebody else's account gets taken.

---

# Migrating existing accounts

Accounts created under the old provider keep their record, their order history,
their strikes and their favourites. What cannot come across is the password —
hosted providers do not export hashes.

**Signing in with Google.** Nothing to do. The account is matched by its
verified email address and the Google subject is linked to it on first use.

**Signing in with a password.** The account has no `passwordHash`, so
`signInWithEmail` sends a code and the screen collects a new password. One
extra step, once. Order history is untouched.

Nothing about this is manual, and no migration script needs to run.

## Rolling this out

1. Set the mail variables and run `npm run mail:verify`.
2. Set the Google variables, then `NEXT_PUBLIC_GOOGLE_ENABLED=true`.
3. Set `AUTH_PROVIDER=trefood`. Production refuses `stub`.
4. Run `npm run db:indexes` — `sessions` and `emailOtps` need theirs, including
   the TTL indexes that reap expired rows.

Existing vendors stay signed in: the old vendor cookie is still read on the way
in, though nothing mints one any more. That fallback in `getSession()` can be
deleted once those cookies have aged out.
