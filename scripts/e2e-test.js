#!/usr/bin/env node
'use strict';
// End-to-end check against the brief's acceptance criteria 1, 2, 4, 5 and 6
// (criterion 3 — 100,000 simulated spins within 0.5pp of published odds —
// is scripts/simulate-odds.js). Spins up a real server on an isolated,
// throwaway database, drives it over HTTP exactly as a client/back office
// would, and asserts on the responses.
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

const PORT = 3999;
const BASE = `http://127.0.0.1:${PORT}`;
const dbFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'spin-e2e-')), 'db.json');

let pass = 0;
let fail = 0;
function assert(cond, msg) {
  if (cond) {
    pass += 1;
    console.log(`  ✓ ${msg}`);
  } else {
    fail += 1;
    console.log(`  ✗ ${msg}`);
  }
}

function cookieJar() {
  let cookie = '';
  return {
    headers() {
      return cookie ? { Cookie: cookie } : {};
    },
    capture(res) {
      const set = res.headers.get('set-cookie');
      if (set) cookie = set.split(';')[0];
    },
  };
}

async function main() {
  const server = spawn('node', [path.join(__dirname, '..', 'server', 'index.js')], {
    env: { ...process.env, PORT: String(PORT), SPIN_DB_FILE: dbFile },
    stdio: 'pipe',
  });
  server.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));

  await waitForServer();

  // --- sign an outlet QR link the same way the server does, for test use ---
  const configResp = await fetch(`${BASE}/api/admin/outlets`).catch(() => null); // unauthenticated, expect 401
  assert(configResp.status === 401, 'Outlets endpoint requires back-office login');

  const adminJar = cookieJar();
  const adminLogin = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  adminJar.capture(adminLogin);
  const adminLoginBody = await adminLogin.json();
  assert(adminLoginBody.ok, 'Admin can log in to the back office');

  const outletsResp = await fetch(`${BASE}/api/admin/outlets`, { headers: adminJar.headers() });
  const { outlets } = await outletsResp.json();
  const outlet = outlets[0];
  const outletId = outlet.id;
  const sig = new URL(outlet.qrUrl, BASE).searchParams.get('s');

  // --- criterion 1: a whitelisted smartcard spins once; a second attempt
  //     shows the earlier result ---
  console.log('\nCriterion 1: one spin per smartcard, second attempt shows earlier result');
  const whitelistJar = cookieJar();
  const wlLogin = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'cvm.whitelist', password: 'whitelist123' }),
  });
  whitelistJar.capture(wlLogin);

  const testCard = '5551234501';
  const testMobile = '71234501';
  const upload = await fetch(`${BASE}/api/admin/whitelist/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...whitelistJar.headers() },
    body: JSON.stringify({ mode: 'add', rows: [testCard] }),
  }).then((r) => r.json());
  assert(upload.ok && upload.rowCount === 1, 'Whitelist upload accepts the test smartcard');

  const check1 = await fetch(`${BASE}/api/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ smartcard: testCard, mobile: testMobile, outletId, sig, consentAge: true, consentTerms: true }),
  }).then((r) => r.json());
  assert(check1.ok && check1.spinToken, 'First check passes and issues a spin token');

  const spin1 = await fetch(`${BASE}/api/spin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ spinToken: check1.spinToken }),
  }).then((r) => r.json());
  assert(spin1.ok && spin1.ref, 'Spin succeeds and returns a reference');

  const check2 = await fetch(`${BASE}/api/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ smartcard: testCard, mobile: testMobile, outletId, sig, consentAge: true, consentTerms: true }),
  }).then((r) => r.json());
  assert(!check2.ok && check2.reason === 'already_spun', 'Second attempt is rejected as already spun');
  assert(check2.result && check2.result.ref === spin1.ref, 'Rejection shows the earlier result');

  // --- criterion 2: not-on-whitelist gets the right message + logged
  //     reason; added in a new upload, it can spin ---
  console.log('\nCriterion 2: not-on-whitelist rejection, then added and spins');
  const newCard = '5551234502';
  const newMobile = '71234502';
  const checkBefore = await fetch(`${BASE}/api/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ smartcard: newCard, mobile: newMobile, outletId, sig, consentAge: true, consentTerms: true }),
  }).then((r) => r.json());
  assert(!checkBefore.ok && checkBefore.reason === 'not_whitelisted', 'Smartcard not on the whitelist is rejected with the right reason');

  const careBefore = await fetch(`${BASE}/api/admin/customer-care?q=${newCard}`, { headers: adminJar.headers() }).then((r) => r.json());
  assert(careBefore.checks.some((c) => c.reason === 'not_whitelisted'), 'The failed check was logged with its reason');

  await fetch(`${BASE}/api/admin/whitelist/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...whitelistJar.headers() },
    body: JSON.stringify({ mode: 'add', rows: [newCard] }),
  });
  const checkAfter = await fetch(`${BASE}/api/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ smartcard: newCard, mobile: newMobile, outletId, sig, consentAge: true, consentTerms: true }),
  }).then((r) => r.json());
  assert(checkAfter.ok, 'After being added in a new upload, the smartcard can spin');
  const spin2 = await fetch(`${BASE}/api/spin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ spinToken: checkAfter.spinToken }),
  }).then((r) => r.json());
  assert(spin2.ok, 'Spin succeeds for the newly whitelisted card');

  // --- alphanumeric smartcards, case-insensitive ---
  console.log('\nAlphanumeric smartcards: letters allowed, case-insensitive match');
  const alnuCard = 'ab12cd34ef'; // lowercase on upload
  const alnuMobile = '71234504';
  await fetch(`${BASE}/api/admin/whitelist/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...whitelistJar.headers() },
    body: JSON.stringify({ mode: 'add', rows: [alnuCard] }),
  });
  const alnuCheck = await fetch(`${BASE}/api/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // entered in a different case than uploaded
    body: JSON.stringify({ smartcard: 'AB12CD34EF', mobile: alnuMobile, outletId, sig, consentAge: true, consentTerms: true }),
  }).then((r) => r.json());
  assert(alnuCheck.ok, 'A letters-and-digits smartcard is accepted as valid');
  assert(alnuCheck.spinToken, 'Case-insensitive match against the whitelist entry succeeds');
  const alnuSpin = await fetch(`${BASE}/api/spin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ spinToken: alnuCheck.spinToken }),
  }).then((r) => r.json());
  assert(alnuSpin.ok, 'Spin succeeds for the alphanumeric smartcard');
  const alnuTooShort = await fetch(`${BASE}/api/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ smartcard: 'AB1', mobile: alnuMobile, outletId, sig, consentAge: true, consentTerms: true }),
  }).then((r) => r.json());
  assert(!alnuTooShort.ok && alnuTooShort.reason === 'invalid_smartcard', 'A too-short smartcard is still rejected as invalid');

  // --- criterion 4: a dropped connection after the tap still records the
  //     prize and sends the SMS — simulated as a retried /api/spin call
  //     with the same (now-consumed) token, as a client retry would send ---
  console.log('\nCriterion 4: retrying /api/spin after a dropped response is safe and idempotent');
  const retryCard = '5551234503';
  const retryMobile = '71234503';
  await fetch(`${BASE}/api/admin/whitelist/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...whitelistJar.headers() },
    body: JSON.stringify({ mode: 'add', rows: [retryCard] }),
  });
  const checkRetry = await fetch(`${BASE}/api/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ smartcard: retryCard, mobile: retryMobile, outletId, sig, consentAge: true, consentTerms: true }),
  }).then((r) => r.json());
  const spinA = await fetch(`${BASE}/api/spin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ spinToken: checkRetry.spinToken }),
  }).then((r) => r.json());
  const spinB = await fetch(`${BASE}/api/spin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ spinToken: checkRetry.spinToken }),
  }).then((r) => r.json());
  assert(spinA.ref === spinB.ref, 'Retried spin call returns the same reference, not a second prize');
  const reopen = await fetch(`${BASE}/api/result/${spinA.ref}`).then((r) => r.json());
  assert(reopen.ok && reopen.ref === spinA.ref, 'The result reopens from the reference (as the SMS link would)');
  const smsCheck = await fetch(`${BASE}/api/admin/sms-outbox`, { headers: adminJar.headers() }).then((r) => r.json());
  assert(smsCheck.messages.some((m) => m.ref === spinA.ref), 'An SMS was recorded for the award');

  // --- criterion 5: fulfilling a prize sends the delivery SMS and stores
  //     agent and time ---
  console.log('\nCriterion 5: marking a prize fulfilled stores agent/time and sends SMS');
  const agentJar = cookieJar();
  const agentLogin = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'cvm.agent', password: 'fulfil123' }),
  });
  agentJar.capture(agentLogin);
  const fulfil = await fetch(`${BASE}/api/admin/queue/${spin1.ref}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...agentJar.headers() },
    body: JSON.stringify({ status: 'fulfilled', method: 'airtime credit', note: 'E2E test' }),
  }).then((r) => r.json());
  assert(fulfil.ok, 'Fulfilment status update accepted');
  const historyEntry = fulfil.prize.history.find((h) => h.status === 'fulfilled');
  assert(historyEntry && historyEntry.agent === 'cvm.agent' && historyEntry.ts, 'History records the agent and timestamp');
  const smsAfterFulfil = await fetch(`${BASE}/api/admin/sms-outbox`, { headers: adminJar.headers() }).then((r) => r.json());
  assert(
    smsAfterFulfil.messages.some((m) => m.ref === spin1.ref && /delivered/.test(m.body)),
    'A delivery SMS was sent'
  );

  // --- criterion 6: daily summary, fulfilment report and CSV export have
  //     totals matching the logs ---
  console.log('\nCriterion 6: scheduled reports and CSV export match the logs');
  const reportJar = cookieJar();
  const reportLogin = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'trade.report', password: 'report123' }),
  });
  reportJar.capture(reportLogin);

  const daily = await fetch(`${BASE}/api/admin/reports/daily-summary`, { headers: reportJar.headers() }).then((r) => r.json());
  const fulfilReport = await fetch(`${BASE}/api/admin/reports/fulfilment`, { headers: agentJar.headers() }).then((r) => r.json());
  const csvText = await fetch(`${BASE}/api/admin/export/daily.csv`, { headers: reportJar.headers() }).then((r) => r.text());
  const csvDataRows = csvText.trim().split('\n').length - 1;

  const careSummary = await fetch(`${BASE}/api/admin/dashboard`, { headers: reportJar.headers() }).then((r) => r.json());
  assert(daily.report.campaignToDate.spins === careSummary.dashboard.tiers.toDate.total, 'Daily summary spin total matches the dashboard total');
  assert(csvDataRows === careSummary.dashboard.checks.toDate.scans, 'CSV export row count matches the total number of checks logged');
  assert(Array.isArray(fulfilReport.report.openByTierAndAge), 'Fulfilment report lists open prizes by age');
  // Masking: reporting role should not see raw smartcard/mobile.
  const queueMasked = await fetch(`${BASE}/api/admin/queue`, { headers: reportJar.headers() }).then((r) => r.json());
  const sampleRow = queueMasked.prizes.find((p) => p.ref === spin1.ref);
  assert(sampleRow && sampleRow.smartcard !== testCard, 'Reporting role sees masked smartcard, not the raw value (Data protection)');
  const queueUnmasked = await fetch(`${BASE}/api/admin/queue`, { headers: agentJar.headers() }).then((r) => r.json());
  const sampleRowCvm = queueUnmasked.prizes.find((p) => p.ref === spin1.ref);
  assert(sampleRowCvm && sampleRowCvm.smartcard === testCard, 'CVM fulfilment role sees the unmasked smartcard');

  server.kill();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

function waitForServer() {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 10000;
    (function poll() {
      fetch(`${BASE}/api/config`)
        .then(() => resolve())
        .catch(() => {
          if (Date.now() > deadline) reject(new Error('server did not start'));
          else setTimeout(poll, 150);
        });
    })();
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
