# Spin the Wheel — MultiChoice Botswana

Built against `Spin the Wheel App — Requirements Brief` (Oct 16, 2026, @ola.lightman).
Runs 1–31 December 2026 as the outlet mechanic in the December reactivation drive.

This is a working engineering build of the full brief: the customer web app,
the back-office console, and reporting — not a mockup. It has no external
dependencies, so it runs anywhere Node runs.

## Run it

```sh
npm start          # http://localhost:3000
```

- Customer app: `http://localhost:3000/customer/?o=GBE001&s=<signed>` — get real
  signed outlet links from the back office's **Outlets & QR** tab (QR *printing*
  is explicitly out of scope per the brief; these links are what the QR codes
  should encode).
- Back office: `http://localhost:3000/backoffice/`

Demo back-office accounts (standing in for the company SSO the brief calls for):

| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | Admin — everything, including Settings |
| `cvm.whitelist` | `whitelist123` | Whitelist upload |
| `cvm.agent` | `fulfil123` | Fulfilment queue |
| `trade.report` | `report123` | Reporting (masked smartcard/mobile) |
| `auditor` | `audit123` | Read-only / Internal Audit (masked) |

Data lives in `data/db.json` (gitignored), created on first run. Reset it with
`npm run reset-data`.

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
- **Storage is a JSON file** (`server/db.js`), not a managed database — it's
  the one piece that would change for a real multi-instance production
  deployment; every other module only calls `db.get()`/`db.save()`, so that
  swap is isolated.
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
