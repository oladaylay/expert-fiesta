# Spin the Wheel — MultiChoice Botswana

Built against `Spin the Wheel App — Requirements Brief` (Oct 16, 2026, @ola.lightman).
Runs 1–31 December 2026 as the outlet mechanic in the December reactivation drive.

This is a working engineering build of the full brief: the customer web app,
the back-office console, and reporting — not a mockup. Its only runtime
dependency is `pg` (Postgres client), used only when `DATABASE_URL` is set.

## Run it

```sh
npm start          # http://localhost:3000
```

- Customer app: `http://localhost:3000/customer/?o=GBE001&s=<signed>` — get real
  signed outlet links from the back office's **Outlets & QR** tab (QR *printing*
  is explicitly out of scope per the brief; these links are what the QR codes
  should encode).
- Back office: `http://localhost:3000/backoffice/`

## Deploying to Render (a real, shareable link)

`render.yaml` in this repo is a Render Blueprint, including a free Postgres
database for persistence — it needs no build configuration beyond
connecting the repo:

1. On [dashboard.render.com](https://dashboard.render.com), **New → Blueprint**.
2. Connect this GitHub repo (`oladaylay/expert-fiesta`) and pick the
   `claude/spin-wheel-web-app-4hl02m` branch.
3. Render reads `render.yaml` automatically (free web service, `npm install` /
   `npm start`, health check on `/api/config`, plus a free `mcb-spin-wheel-db`
   Postgres database wired to the service via `DATABASE_URL`) — click **Apply**.
4. You get a public URL like `https://mcb-spin-the-wheel.onrender.com`.

If the web service already exists from before this database was added,
Render's dashboard → your Blueprint → **Manual Sync** picks up the new
`databases:` entry and provisions it without recreating the service.

No Blueprint support, or you'd rather click through manually: create a free
Postgres database first, then **New → Web Service** (same repo/branch, Build
Command `npm install`, Start Command `npm start`, plan Free), and add
`DATABASE_URL` as an environment variable pointing at that database's
connection string.

**Persistence:** with `DATABASE_URL` set, every spin, whitelist upload and
back-office action is written to Postgres and survives restarts, idle
spin-down and redeploys — `npm start` with no `DATABASE_URL` (e.g. running
locally) falls back to the `data/db.json` file instead, which does not
persist across a Render restart. One remaining caveat: **Render's free
Postgres plan is deleted after 30 days.** Fine for an extended UAT/demo
window, not for anything meant to run indefinitely — for that, upgrade to a
paid Postgres plan (same `DATABASE_URL` wiring, no code change) before the
30 days are up.

Demo back-office accounts (standing in for the company SSO the brief calls for):

| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | Admin — everything, including Settings |
| `cvm.whitelist` | `whitelist123` | Whitelist upload |
| `cvm.agent` | `fulfil123` | Fulfilment queue |
| `trade.report` | `report123` | Reporting (masked smartcard/mobile) |
| `auditor` | `audit123` | Read-only / Internal Audit (masked) |

Data lives in Postgres when `DATABASE_URL` is set (Render), otherwise in
`data/db.json` (gitignored, local dev only), created on first run. Reset it
with `npm run reset-data` (resets whichever backend is active).

### Testing before the real 1 Dec 2026 launch

The campaign only runs 1–31 December. So you can exercise it today, **Settings
→ Testing: simulated clock** lets you set a fake "now" for the whole app — set
it to any time inside the campaign window and the customer app and back office
both honour it. It ships set to the campaign start by default in this build;
clear it to use the real clock. This is a UAT control only.

## What's real vs mocked, and why

Built to match the brief's explicit scope and open items:

- **The draw is real and server-side.** `server/rng.js` uses
  `crypto.randomBytes` to draw a tier at the locked odds the moment `/api/spin`
  is called, before the wheel animation plays. The client never decides or
  sees the outcome early. `npm run simulate-odds` runs the brief's acceptance
  criterion 3 (100,000 simulated spins within 0.5pp of published odds).
- **Logs are real and append-only.** Check log, spin log and fulfilment
  history are only ever appended to, never edited or deleted, matching the
  Gambling Authority audit requirement.
- **One spin per smartcard is permanent**, independent of whitelist uploads —
  a card marked used stays used even if a later whitelist upload re-adds it
  (brief, "Smartcard check → One spin per smartcard").
- **SMS gateway is mocked.** The brief lists this as an open item ("SMS
  gateway for the prize and delivery messages"). `server/sms.js` logs
  messages to an outbox, visible in the back office's **SMS outbox** tab,
  instead of calling a real carrier. Swap that one module for the real
  gateway once it's chosen.
- **Back-office login is a simple demo account table**, standing in for the
  company single sign-on the brief specifies. Swap `server/auth.js` for real
  SSO (SAML/OIDC) before production; every route already checks role, not
  username, so that swap doesn't touch routing.
- **QR codes are signed** (`server/validate.js`, HMAC) so a copied or invented
  outlet ID is rejected, per the brief's security requirement — but QR
  *printing* and point-of-sale material are out of scope, so the back office
  just lists the signed links.
- **Data masking**: reporting and read-only (non-CVM) roles see masked
  smartcard/mobile everywhere; admin, whitelist-upload and fulfilment
  (CVM) roles see the real values, per "Data protection".
- **Storage is Postgres when deployed** (`server/db.js`, a single JSONB row
  holding the whole app state — not a relational schema, since the goal was
  persistence with minimal churn to the rest of the code; every route still
  just calls `db.get()`/`db.save()` on an in-memory object, same as before).
  Local dev and tests fall back to a `data/db.json` file when `DATABASE_URL`
  isn't set, so nothing extra is needed to run this locally. A real
  multi-instance production deployment would want a proper relational schema
  instead of one JSONB blob — this is a deliberate stepping-stone, not the
  final shape.
- **Prize details** (voucher retailer, airtime provider, voucher validity) are
  listed as an open item in the brief and aren't filled in here — the result
  screen, SMS text and terms page use generic wording pending that decision.

## Testing it yourself

```sh
npm run simulate-odds   # acceptance criterion 3: 100k draws vs odds
npm run test:e2e        # acceptance criteria 1, 2, 4, 5, 6, against a live server
```

`scripts/e2e-test.js` spins up a real server on an isolated database and
drives it exactly as a client/back office would: one spin per smartcard with
the second attempt shown its earlier result; a not-whitelisted card rejected
then able to spin once added in a new upload; a retried `/api/spin` call
(simulating a dropped connection) returning the same reference rather than a
second prize, and reopening via its reference as the SMS link would; marking
a prize fulfilled recording the agent/time and sending the delivery SMS; and
the daily summary, fulfilment report and CSV export all tying back to the
same logs.

## Where the brief's requirements live in the code

| Brief section | Where |
|---|---|
| Smartcard check, whitelist upload/history | `server/index.js` `/api/check`, `/api/admin/whitelist/*`; UI: back office **Whitelist** tab |
| Customer journey, landing/form/wheel/result | `public/customer/` |
| The spin function, odds table, locking | `server/rng.js` (locked, not editable from any route) |
| Fairness and audit, append-only logs | `server/db.js` arrays only ever pushed to; campaign-close report `/api/admin/reports/campaign-close` + Internal Audit sign-off |
| Manual fulfilment by CVM, exceptions | `server/index.js` `/api/admin/queue/*`; UI: **Fulfilment queue** tab |
| Live dashboard (5-min refresh) | `server/reports.js` `dashboard()`; UI: **Dashboard** tab |
| Scheduled reports, data export, exception alerts | `server/reports.js`; UI: **Reports** tab |
| Non-functional: security, data protection, config | `server/auth.js`, `server/validate.js` (masking), **Settings** tab |
| Language EN/TN | `public/customer/i18n.js` |

## Open items carried over from the brief (unchanged)

- Whitelist file format and upload schedule — this build accepts one
  smartcard per line; confirm against CVM's actual export format.
- SMS gateway selection.
- Gambling Authority confirmation that an instant draw satisfies "place,
  date and time of the draw".
- Named outlet list for the QR codes (the Store Universe file) — eight
  placeholder outlets are seeded in `server/db.js`.
- Prize details: voucher retailer, airtime provider, voucher validity.
