'use strict';
// Storage for the app's whole in-memory state. Every other module only
// calls get()/save() (and awaits init() once at boot) — the backend behind
// them can change without touching routing or business logic.
//
// Two backends:
//  - DATABASE_URL set (Render, in production): a single JSONB row in
//    Postgres. Survives restarts, idle spin-down and redeploys.
//  - DATABASE_URL unset (local dev, tests): a JSON file under data/, same
//    as before. Nothing to install or configure locally.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
// Overridable so tests/UAT runs can point at an isolated file instead of
// the real demo database.
const DB_FILE = process.env.SPIN_DB_FILE || path.join(DATA_DIR, 'db.json');
const DATABASE_URL = process.env.DATABASE_URL || null;

function nowIso() {
  return new Date().toISOString();
}

function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

// Human-friendly prize reference, e.g. RW-7F3K9Q2A.
function newRef() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
  let s = '';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) s += alphabet[bytes[i] % alphabet.length];
  return `RW-${s}`;
}

function seed() {
  const start = '2026-12-01T06:00:00+02:00';
  return {
    config: {
      campaignStart: start,
      campaignEnd: '2026-12-31T22:00:00+02:00',
      availabilityWindow: { startHour: 6, endHour: 22 },
      oddsLocked: true,
      termsUrl: '/customer/terms.html',
      qrSecret: 'demo-qr-secret-change-before-production',
      // Lets a tester simulate "now" so the Dec 2026 campaign window can be
      // exercised before real launch. Null = use the real system clock.
      // This is a UAT control only — it never ships switched on.
      testClockOverride: start,
      messages: {
        notOnWhitelist: "We can't find this smartcard in the promotion yet.",
        alreadySpun: 'This smartcard has already had its spin.',
        invalidSmartcard: "That doesn't look like a smartcard number.",
        invalidMobile: "That doesn't look like a Botswana mobile number.",
        notRunning: 'The promotion runs from 1 to 31 December 2026.',
        systemUnavailable: "We're having trouble right now.",
        outsideHours: "We're open 06:00–22:00 during the promotion. Please try again then.",
        badOutlet: "We couldn't verify this outlet's QR code.",
        needConsent: 'Please confirm both boxes to continue.',
      },
    },
    outlets: [
      { id: 'GBE001', name: 'Game City DStv Centre', town: 'Gaborone' },
      { id: 'GBE002', name: 'Riverwalk DStv Centre', town: 'Gaborone' },
      { id: 'GBE003', name: 'Airport Junction DStv Centre', town: 'Gaborone' },
      { id: 'FTW001', name: 'Galo Mall DStv Centre', town: 'Francistown' },
      { id: 'MUN001', name: 'Maun DStv Centre', town: 'Maun' },
      { id: 'PHK001', name: 'Selebi-Phikwe DStv Centre', town: 'Selebi-Phikwe' },
      { id: 'KAN001', name: 'Kanye DStv Agent', town: 'Kanye' },
      { id: 'MOL001', name: 'Molepolole DStv Agent', town: 'Molepolole' },
    ],
    // Demo back-office accounts standing in for the company single sign-on
    // the brief calls for. Swap for real SSO (SAML/OIDC) before launch.
    users: [
      { username: 'admin', password: 'admin123', role: 'admin', name: 'System Admin' },
      { username: 'cvm.whitelist', password: 'whitelist123', role: 'whitelist_upload', name: 'CVM Whitelist Team' },
      { username: 'cvm.agent', password: 'fulfil123', role: 'fulfilment', name: 'CVM Fulfilment Agent' },
      { username: 'trade.report', password: 'report123', role: 'reporting', name: 'Trade & Reporting' },
      { username: 'auditor', password: 'audit123', role: 'read_only', name: 'Internal Audit' },
    ],
    whitelist: {}, // smartcard -> { addedAt, uploadId }
    usedSmartcards: {}, // smartcard -> { ref, ts } — permanent, survives whitelist replacement
    whitelistUploads: [], // append-only: {id, ts, user, mode, rowCount}
    checkLog: [], // append-only
    spinLog: [], // append-only
    prizeQueue: {}, // ref -> record, history array is append-only
    smsOutbox: [],
    sessions: {}, // token -> {username, role, name, expires}
    spinTokens: {}, // token -> {smartcard, mobile, outletId, expires, usedRef}
    adminAuditLog: [], // append-only: every back-office action
    signOffs: [], // append-only: Internal Audit campaign-close sign-offs
  };
}

let state = null;
let ready = null; // promise that resolves once state is loaded

// ---------------------------------------------------------------------
// Postgres backend
// ---------------------------------------------------------------------

let pool = null;
function getPool() {
  if (!pool) {
    const { Pool } = require('pg');
    const isLocal = /localhost|127\.0\.0\.1/.test(DATABASE_URL);
    pool = new Pool({ connectionString: DATABASE_URL, ssl: isLocal ? false : { rejectUnauthorized: false } });
  }
  return pool;
}

async function pgEnsureTable() {
  await getPool().query(
    'CREATE TABLE IF NOT EXISTS mcb_spin_state (id INT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())'
  );
}

async function pgLoad() {
  await pgEnsureTable();
  const { rows } = await getPool().query('SELECT data FROM mcb_spin_state WHERE id = 1');
  if (rows.length) return rows[0].data;
  const fresh = seed();
  await getPool().query('INSERT INTO mcb_spin_state (id, data) VALUES (1, $1)', [JSON.stringify(fresh)]);
  return fresh;
}

function pgSave() {
  // Fire-and-forget: callers already call save() synchronously without
  // awaiting it, same contract as the file backend's writeFileSync.
  getPool()
    .query('UPDATE mcb_spin_state SET data = $1, updated_at = now() WHERE id = 1', [JSON.stringify(state)])
    .catch((err) => console.error('db save failed:', err.message));
}

// ---------------------------------------------------------------------
// File backend
// ---------------------------------------------------------------------

function fileLoad() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  const fresh = seed();
  fs.writeFileSync(DB_FILE, JSON.stringify(fresh, null, 2));
  return fresh;
}

function fileSave() {
  fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2));
}

// ---------------------------------------------------------------------
// public API
// ---------------------------------------------------------------------

// Call once at startup and await it before accepting requests. Safe to
// call more than once; later calls return the same promise.
function init() {
  if (!ready) {
    ready = (DATABASE_URL ? pgLoad() : Promise.resolve(fileLoad())).then((loaded) => {
      state = loaded;
      return state;
    });
  }
  return ready;
}

function get() {
  if (!state) {
    throw new Error('db.get() called before db.init() resolved — await db.init() at startup first');
  }
  return state;
}

function save() {
  if (DATABASE_URL) pgSave();
  else fileSave();
}

async function reset() {
  state = seed();
  if (DATABASE_URL) {
    await pgEnsureTable();
    await getPool().query('UPDATE mcb_spin_state SET data = $1, updated_at = now() WHERE id = 1', [JSON.stringify(state)]);
  } else {
    fileSave();
  }
  return state;
}

module.exports = { init, get, save, reset, seed, nowIso, newId, newRef, DB_FILE, usingPostgres: Boolean(DATABASE_URL) };
