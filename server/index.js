'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const db = require('./db');
const auth = require('./auth');
const sms = require('./sms');
const csv = require('./csv');
const clock = require('./clock');
const reports = require('./reports');
const { ODDS_TABLE, drawTier } = require('./rng');
const {
  isValidSmartcard,
  normalizeSmartcard,
  isValidMobile,
  normaliseMobile,
  sign,
  verifyOutletSig,
  maskSmartcard,
  maskMobile,
} = require('./validate');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const SPIN_TOKEN_TTL_MS = 10 * 60 * 1000;

// ---------------------------------------------------------------------
// tiny helpers
// ---------------------------------------------------------------------

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
  });
  res.end(data);
}

function sendText(res, status, body, contentType) {
  res.writeHead(status, { 'Content-Type': contentType || 'text/plain; charset=utf-8' });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 5 * 1024 * 1024) req.destroy();
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(new Error('invalid_json'));
      }
    });
    req.on('error', reject);
  });
}

function logAdminAction(state, session, action, detail) {
  state.adminAuditLog.push({
    id: db.newId('aud'),
    ts: db.nowIso(),
    user: session ? session.username : 'system',
    role: session ? session.role : null,
    action,
    detail: detail || null,
  });
}

// ---------------------------------------------------------------------
// router
// ---------------------------------------------------------------------

const routes = []; // {method, pattern: RegExp, keys: [...], handler}

function route(method, pattern, handler) {
  const keys = [];
  const regex = new RegExp(
    '^' +
      pattern
        .split('/')
        .map((seg) => {
          if (seg.startsWith(':')) {
            keys.push(seg.slice(1));
            return '([^/]+)';
          }
          return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        })
        .join('/') +
      '$'
  );
  routes.push({ method, regex, keys, handler });
}

function match(method, pathname) {
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = r.regex.exec(pathname);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      return { handler: r.handler, params };
    }
  }
  return null;
}

// ---------------------------------------------------------------------
// auth middleware helpers
// ---------------------------------------------------------------------

function requireSession(req) {
  const cookies = auth.parseCookies(req);
  return auth.sessionFor(cookies.sid);
}

function requireRole(session, roles) {
  return session && roles.includes(session.role);
}

// ===========================================================================
// PUBLIC CUSTOMER API
// ===========================================================================

route('GET', '/api/config', async (req, res) => {
  const state = db.get();
  const status = clock.campaignStatus();
  const qrBypassActive = Boolean(state.config.testBypassQr) && state.outlets.length > 0;
  const body = {
    campaign: {
      start: state.config.campaignStart,
      end: state.config.campaignEnd,
      running: status.running,
      phase: status.phase,
      now: status.now.toISOString(),
      testClockActive: Boolean(state.config.testClockOverride),
      qrBypassActive,
    },
    prizes: ODDS_TABLE.map((t) => ({ tier: t.tier, label: t.label, value: t.value, oddsPercent: Math.round(t.odds * 1000) / 10 })),
    termsUrl: state.config.termsUrl,
    messages: state.config.messages,
  };
  if (qrBypassActive) {
    // A valid signed outlet for testing only, so the customer app can skip
    // straight to the smartcard-check form without a scanned QR link.
    const o = state.outlets[0];
    body.testOutlet = { id: o.id, name: o.name, town: o.town, sig: sign(state.config.qrSecret, o.id) };
  }
  sendJson(res, 200, body);
});

route('GET', '/api/outlet', async (req, res, params, query) => {
  const state = db.get();
  const { o: outletId, s: sig } = query;
  const outlet = state.outlets.find((x) => x.id === outletId);
  if (!outlet || !verifyOutletSig(state.config.qrSecret, outletId, sig)) {
    return sendJson(res, 200, { ok: false, message: state.config.messages.badOutlet });
  }
  sendJson(res, 200, { ok: true, outlet });
});

route('POST', '/api/check', async (req, res) => {
  const state = db.get();
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(res, 400, { ok: false, reason: 'bad_request', message: 'Malformed request.' });
  }

  const { smartcard = '', mobile = '', outletId = '', sig = '', consentAge, consentTerms } = body;
  const card = normalizeSmartcard(smartcard);
  const msgs = state.config.messages;

  const logCheck = (result, reason) => {
    state.checkLog.push({
      id: db.newId('chk'),
      ts: db.nowIso(),
      smartcard: card,
      mobile,
      outletId: outletId || null,
      result,
      reason: reason || null,
    });
    db.save();
  };

  const status = clock.campaignStatus();
  if (!status.running) {
    const reason = status.phase === 'outside_hours' ? 'outside_hours' : 'not_running';
    logCheck('fail', reason);
    return sendJson(res, 200, {
      ok: false,
      reason,
      message: status.phase === 'outside_hours' ? msgs.outsideHours : msgs.notRunning,
      nextStep: `Campaign dates: ${state.config.campaignStart.slice(0, 10)} to ${state.config.campaignEnd.slice(0, 10)}`,
    });
  }

  if (!outletId || !verifyOutletSig(state.config.qrSecret, outletId, sig)) {
    logCheck('fail', 'bad_outlet');
    return sendJson(res, 200, { ok: false, reason: 'bad_outlet', message: msgs.badOutlet, nextStep: 'Re-scan the outlet QR code.' });
  }

  if (!consentAge || !consentTerms) {
    logCheck('fail', 'needs_consent');
    return sendJson(res, 200, { ok: false, reason: 'needs_consent', message: msgs.needConsent, nextStep: 'Tick both boxes to continue.' });
  }

  if (!isValidSmartcard(card)) {
    logCheck('fail', 'invalid_smartcard');
    return sendJson(res, 200, {
      ok: false,
      reason: 'invalid_smartcard',
      message: msgs.invalidSmartcard,
      nextStep: 'Re-enter or scan the card.',
    });
  }

  if (!isValidMobile(mobile)) {
    logCheck('fail', 'invalid_mobile');
    return sendJson(res, 200, { ok: false, reason: 'invalid_mobile', message: msgs.invalidMobile, nextStep: 'Re-enter your mobile number.' });
  }

  // One spin per smartcard — permanent, even if it reappears in a later upload.
  if (state.usedSmartcards[card]) {
    logCheck('fail', 'already_spun');
    const prevRef = state.usedSmartcards[card].ref;
    const prize = state.prizeQueue[prevRef];
    return sendJson(res, 200, {
      ok: false,
      reason: 'already_spun',
      message: msgs.alreadySpun,
      nextStep: 'Showing your earlier result.',
      result: prize ? { ref: prize.ref, tier: prize.tier, value: prize.value, status: prize.status } : null,
    });
  }

  if (!state.whitelist[card]) {
    logCheck('fail', 'not_whitelisted');
    return sendJson(res, 200, {
      ok: false,
      reason: 'not_whitelisted',
      message: msgs.notOnWhitelist,
      nextStep: 'Try again later today; new reconnections are added daily.',
    });
  }

  // Pass: issue a single-use spin token.
  const token = db.newId('tok');
  state.spinTokens[token] = {
    smartcard: card,
    mobile: normaliseMobile(mobile),
    outletId,
    expires: Date.now() + SPIN_TOKEN_TTL_MS,
    usedRef: null,
  };
  logCheck('pass', null);
  sendJson(res, 200, { ok: true, spinToken: token, message: "You're in. One spin per smartcard." });
});

route('POST', '/api/spin', async (req, res) => {
  const state = db.get();
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(res, 400, { ok: false, message: 'Malformed request.' });
  }

  const tokenRec = state.spinTokens[body.spinToken];
  if (!tokenRec) {
    return sendJson(res, 400, { ok: false, message: 'Spin link expired or invalid. Please check in again.' });
  }

  // Idempotent replay: a second tap, refresh or back-button replay of the
  // same token returns the already-decided result instead of spinning again.
  if (tokenRec.usedRef) {
    const prize = state.prizeQueue[tokenRec.usedRef];
    return sendJson(res, 200, { ok: true, replay: true, ref: prize.ref, tier: prize.tier, label: labelFor(prize.tier), value: prize.value });
  }

  if (Date.now() > tokenRec.expires) {
    return sendJson(res, 400, { ok: false, message: 'Spin link expired. Please check in again.' });
  }

  if (!clock.campaignStatus().running) {
    return sendJson(res, 400, { ok: false, message: state.config.messages.notRunning });
  }

  if (state.usedSmartcards[tokenRec.smartcard]) {
    return sendJson(res, 400, { ok: false, message: state.config.messages.alreadySpun });
  }

  const tier = drawTier();
  const ref = db.newRef();
  const ts = db.nowIso();

  // Written to the append-only spin log before the animation starts
  // (the client only receives the already-decided tier).
  state.spinLog.push({ id: db.newId('spn'), ts, ref, smartcard: tokenRec.smartcard, mobile: tokenRec.mobile, outletId: tokenRec.outletId, tier: tier.tier, value: tier.value });

  state.prizeQueue[ref] = {
    ref,
    smartcard: tokenRec.smartcard,
    mobile: tokenRec.mobile,
    outletId: tokenRec.outletId,
    tier: tier.tier,
    value: tier.value,
    status: 'awarded',
    awardedAt: ts,
    failedAttempts: 0,
    history: [{ status: 'awarded', ts, agent: 'system', note: null }],
  };

  state.usedSmartcards[tokenRec.smartcard] = { ref, ts };
  tokenRec.usedRef = ref;
  db.save();

  sms.send(
    tokenRec.mobile,
    `MultiChoice: You won ${tier.label} (BWP ${tier.value})! Ref ${ref}. The MultiChoice team will contact you to deliver your prize.`,
    ref
  );

  sendJson(res, 200, { ok: true, ref, tier: tier.tier, label: tier.label, value: tier.value });
});

function labelFor(tierKey) {
  const t = ODDS_TABLE.find((x) => x.tier === tierKey);
  return t ? t.label : tierKey;
}

route('GET', '/api/result/:ref', async (req, res, params) => {
  const state = db.get();
  const prize = state.prizeQueue[params.ref];
  if (!prize) return sendJson(res, 404, { ok: false, message: 'Result not found.' });
  const outlet = state.outlets.find((o) => o.id === prize.outletId);
  sendJson(res, 200, {
    ok: true,
    ref: prize.ref,
    tier: prize.tier,
    label: labelFor(prize.tier),
    value: prize.value,
    status: prize.status,
    awardedAt: prize.awardedAt,
    outlet: outlet ? outlet.name : prize.outletId,
  });
});

// ===========================================================================
// BACK OFFICE: AUTH
// ===========================================================================

route('POST', '/api/admin/login', async (req, res) => {
  const body = await readJsonBody(req).catch(() => ({}));
  const token = auth.login(body.username, body.password);
  if (!token) return sendJson(res, 401, { ok: false, message: 'Invalid username or password.' });
  const state = db.get();
  const session = auth.sessionFor(token);
  logAdminAction(state, session, 'login');
  db.save();
  res.setHeader('Set-Cookie', `sid=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${8 * 60 * 60}`);
  sendJson(res, 200, { ok: true, user: { username: session.username, role: session.role, name: session.name } });
});

route('POST', '/api/admin/logout', async (req, res) => {
  const cookies = auth.parseCookies(req);
  auth.logout(cookies.sid);
  res.setHeader('Set-Cookie', 'sid=; HttpOnly; Path=/; Max-Age=0');
  sendJson(res, 200, { ok: true });
});

route('GET', '/api/admin/me', async (req, res) => {
  const session = requireSession(req);
  if (!session) return sendJson(res, 401, { ok: false });
  sendJson(res, 200, { ok: true, user: { username: session.username, role: session.role, name: session.name } });
});

// ===========================================================================
// BACK OFFICE: WHITELIST
// ===========================================================================

route('POST', '/api/admin/whitelist/upload', async (req, res) => {
  const session = requireSession(req);
  if (!requireRole(session, ['whitelist_upload', 'admin'])) return sendJson(res, 403, { ok: false, message: 'Not permitted.' });
  const state = db.get();
  const body = await readJsonBody(req).catch(() => null);
  if (!body || !Array.isArray(body.rows)) return sendJson(res, 400, { ok: false, message: 'Expected { mode, rows: [smartcard,...] }.' });

  const mode = body.mode === 'replace' ? 'replace' : 'add';
  const valid = body.rows.map((s) => String(s).trim()).filter(isValidSmartcard).map(normalizeSmartcard);
  const uploadId = db.newId('upl');
  const ts = db.nowIso();

  if (mode === 'replace') state.whitelist = {};
  valid.forEach((card) => {
    state.whitelist[card] = { addedAt: ts, uploadId };
  });

  state.whitelistUploads.push({ id: uploadId, ts, user: session.username, mode, rowCount: valid.length, rawCount: body.rows.length });
  logAdminAction(state, session, 'whitelist_upload', { mode, rowCount: valid.length });
  db.save();
  sendJson(res, 200, { ok: true, uploadId, rowCount: valid.length, rejected: body.rows.length - valid.length, whitelistSize: Object.keys(state.whitelist).length });
});

route('GET', '/api/admin/whitelist/history', async (req, res) => {
  const session = requireSession(req);
  if (!requireRole(session, ['whitelist_upload', 'admin', 'reporting', 'read_only'])) return sendJson(res, 403, { ok: false });
  sendJson(res, 200, { ok: true, uploads: db.get().whitelistUploads });
});

route('GET', '/api/admin/whitelist/stats', async (req, res) => {
  const session = requireSession(req);
  if (!session) return sendJson(res, 401, { ok: false });
  const state = db.get();
  sendJson(res, 200, {
    ok: true,
    size: Object.keys(state.whitelist).length,
    used: Object.keys(state.usedSmartcards).length,
    lastUploadAt: state.whitelistUploads.length ? state.whitelistUploads[state.whitelistUploads.length - 1].ts : null,
  });
});

route('DELETE', '/api/admin/whitelist/:card', async (req, res, params) => {
  const session = requireSession(req);
  if (!requireRole(session, ['whitelist_upload', 'admin'])) return sendJson(res, 403, { ok: false });
  const state = db.get();
  const card = normalizeSmartcard(params.card);
  const existed = Boolean(state.whitelist[card]);
  delete state.whitelist[card];
  logAdminAction(state, session, 'whitelist_remove', { smartcard: card });
  db.save();
  sendJson(res, 200, { ok: true, removed: existed });
});

// ===========================================================================
// BACK OFFICE: FULFILMENT QUEUE
// ===========================================================================

const QUEUE_ROLES = ['fulfilment', 'reporting', 'read_only', 'admin'];

function serialisePrize(state, p, unmasked) {
  const outlet = state.outlets.find((o) => o.id === p.outletId);
  return {
    ref: p.ref,
    smartcard: unmasked ? p.smartcard : maskSmartcard(p.smartcard),
    mobile: unmasked ? p.mobile : maskMobile(p.mobile),
    outletId: p.outletId,
    outletName: outlet ? outlet.name : p.outletId,
    tier: p.tier,
    label: labelFor(p.tier),
    value: p.value,
    status: p.status,
    awardedAt: p.awardedAt,
    ageDays: reports.ageingDays(p.awardedAt),
    failedAttempts: p.failedAttempts,
    history: p.history,
  };
}

route('GET', '/api/admin/queue', async (req, res, params, query) => {
  const session = requireSession(req);
  if (!requireRole(session, QUEUE_ROLES)) return sendJson(res, 403, { ok: false });
  const state = db.get();
  const unmasked = auth.canSeeUnmasked(session.role);
  let prizes = Object.values(state.prizeQueue);
  if (query.tier) prizes = prizes.filter((p) => p.tier === query.tier);
  if (query.status) prizes = prizes.filter((p) => p.status === query.status);
  if (query.outlet) prizes = prizes.filter((p) => p.outletId === query.outlet);
  if (query.date) prizes = prizes.filter((p) => p.awardedAt.slice(0, 10) === query.date);
  if (query.agent) prizes = prizes.filter((p) => p.history.some((h) => h.agent === query.agent));
  prizes.sort((a, b) => (a.awardedAt < b.awardedAt ? -1 : 1)); // oldest first
  // grand prizes flagged at the top
  prizes.sort((a, b) => (a.tier === 'grand_2000') === (b.tier === 'grand_2000') ? 0 : a.tier === 'grand_2000' ? -1 : 1);
  sendJson(res, 200, { ok: true, prizes: prizes.map((p) => serialisePrize(state, p, unmasked)) });
});

const VALID_STATUSES = ['awarded', 'in_progress', 'fulfilled', 'failed_attempt', 'unclaimed'];

route('POST', '/api/admin/queue/:ref/status', async (req, res, params) => {
  const session = requireSession(req);
  if (!requireRole(session, ['fulfilment', 'admin'])) return sendJson(res, 403, { ok: false });
  const state = db.get();
  const prize = state.prizeQueue[params.ref];
  if (!prize) return sendJson(res, 404, { ok: false, message: 'Prize not found.' });
  const body = await readJsonBody(req).catch(() => ({}));
  const { status, note, method, txnRef } = body;

  if (!VALID_STATUSES.includes(status)) return sendJson(res, 400, { ok: false, message: 'Invalid status.' });
  if (status === 'unclaimed' && prize.failedAttempts < 3) {
    return sendJson(res, 400, { ok: false, message: 'Needs 3 recorded failed attempts before it can be closed unclaimed.' });
  }

  prize.status = status;
  if (status === 'failed_attempt') prize.failedAttempts += 1;
  const ts = db.nowIso();
  prize.history.push({ status, ts, agent: session.username, note: note || null, method: method || null, txnRef: txnRef || null });
  db.save();

  if (status === 'fulfilled') {
    sms.send(prize.mobile, `MultiChoice: Your prize (ref ${prize.ref}) has been delivered. Thank you for reconnecting!`, prize.ref);
  }
  logAdminAction(state, session, 'queue_status_change', { ref: prize.ref, status });
  db.save();
  sendJson(res, 200, { ok: true, prize: serialisePrize(state, prize, true) });
});

route('POST', '/api/admin/queue/bulk-fulfil', async (req, res) => {
  const session = requireSession(req);
  if (!requireRole(session, ['fulfilment', 'admin'])) return sendJson(res, 403, { ok: false });
  const state = db.get();
  const body = await readJsonBody(req).catch(() => ({}));
  const refs = Array.isArray(body.refs) ? body.refs : [];
  const ts = db.nowIso();
  let count = 0;
  refs.forEach((ref) => {
    const prize = state.prizeQueue[ref];
    if (!prize || prize.status === 'fulfilled') return;
    prize.status = 'fulfilled';
    prize.history.push({ status: 'fulfilled', ts, agent: session.username, note: body.note || 'bulk upload', method: body.method || null });
    sms.send(prize.mobile, `MultiChoice: Your prize (ref ${prize.ref}) has been delivered. Thank you for reconnecting!`, prize.ref);
    count += 1;
  });
  logAdminAction(state, session, 'queue_bulk_fulfil', { count });
  db.save();
  sendJson(res, 200, { ok: true, count });
});

route('GET', '/api/admin/queue/export.csv', async (req, res, params, query) => {
  const session = requireSession(req);
  if (!requireRole(session, ['fulfilment', 'admin', 'reporting'])) return sendJson(res, 403, { ok: false });
  const state = db.get();
  const unmasked = auth.canSeeUnmasked(session.role);
  let prizes = Object.values(state.prizeQueue).filter((p) => !['fulfilled', 'unclaimed'].includes(p.status));
  // "open airtime and voucher prizes" — grand prize is handled by hand-over, excluded unless asked.
  if (query.includeGrand !== '1') prizes = prizes.filter((p) => p.tier !== 'grand_2000');
  const rows = prizes.map((p) => serialisePrize(state, p, unmasked));
  const headers = ['ref', 'smartcard', 'mobile', 'outletId', 'outletName', 'tier', 'label', 'value', 'status', 'awardedAt', 'ageDays'];
  logAdminAction(state, session, 'export_queue_csv', { count: rows.length });
  db.save();
  sendText(res, 200, csv.toCsv(rows, headers), 'text/csv; charset=utf-8');
});

route('GET', '/api/admin/customer-care', async (req, res, params, query) => {
  const session = requireSession(req);
  if (!requireRole(session, QUEUE_ROLES)) return sendJson(res, 403, { ok: false });
  const state = db.get();
  const unmasked = auth.canSeeUnmasked(session.role);
  const q = (query.q || '').trim();
  if (!q) return sendJson(res, 400, { ok: false, message: 'Provide a smartcard or mobile number.' });
  const qCard = normalizeSmartcard(q);
  const prizes = Object.values(state.prizeQueue).filter((p) => p.smartcard === qCard || p.mobile === q || normaliseMobile(q) === p.mobile);
  const checks = state.checkLog.filter((c) => c.smartcard === qCard || c.mobile === q);
  sendJson(res, 200, {
    ok: true,
    prizes: prizes.map((p) => serialisePrize(state, p, unmasked)),
    checks: checks.map((c) => ({ ts: c.ts, result: c.result, reason: c.reason, outletId: c.outletId })),
  });
});

// ===========================================================================
// BACK OFFICE: DASHBOARD & REPORTS
// ===========================================================================

const REPORT_ROLES = ['reporting', 'admin', 'read_only'];

route('GET', '/api/admin/dashboard', async (req, res) => {
  const session = requireSession(req);
  if (!requireRole(session, REPORT_ROLES)) return sendJson(res, 403, { ok: false });
  sendJson(res, 200, { ok: true, dashboard: reports.dashboard(db.get()) });
});

route('GET', '/api/admin/reports/daily-summary', async (req, res, params, query) => {
  const session = requireSession(req);
  if (!requireRole(session, REPORT_ROLES)) return sendJson(res, 403, { ok: false });
  sendJson(res, 200, { ok: true, report: reports.dailySummary(db.get(), query.date) });
});

route('GET', '/api/admin/reports/fulfilment', async (req, res, params, query) => {
  const session = requireSession(req);
  if (!requireRole(session, ['fulfilment', 'admin', 'reporting'])) return sendJson(res, 403, { ok: false });
  sendJson(res, 200, { ok: true, report: reports.fulfilmentReport(db.get(), query.date) });
});

route('GET', '/api/admin/reports/outlet-performance', async (req, res) => {
  const session = requireSession(req);
  if (!requireRole(session, REPORT_ROLES)) return sendJson(res, 403, { ok: false });
  sendJson(res, 200, { ok: true, report: reports.outletPerformanceWeekly(db.get()) });
});

route('GET', '/api/admin/reports/campaign-close', async (req, res) => {
  const session = requireSession(req);
  if (!requireRole(session, ['admin', 'read_only'])) return sendJson(res, 403, { ok: false });
  sendJson(res, 200, { ok: true, report: reports.campaignClose(db.get()) });
});

route('POST', '/api/admin/campaign-close/sign-off', async (req, res) => {
  const session = requireSession(req);
  if (!requireRole(session, ['read_only', 'admin'])) return sendJson(res, 403, { ok: false, message: 'Only Internal Audit or Admin can sign off.' });
  const state = db.get();
  const body = await readJsonBody(req).catch(() => ({}));
  const entry = { id: db.newId('sign'), ts: db.nowIso(), user: session.username, name: session.name, statement: body.statement || 'Tiers drawn match the published odds within tolerance. Signed off.' };
  state.signOffs.push(entry);
  logAdminAction(state, session, 'campaign_close_signoff');
  db.save();
  sendJson(res, 200, { ok: true, entry });
});

route('GET', '/api/admin/exceptions', async (req, res) => {
  const session = requireSession(req);
  if (!requireRole(session, REPORT_ROLES)) return sendJson(res, 403, { ok: false });
  sendJson(res, 200, { ok: true, exceptions: reports.exceptions(db.get()) });
});

route('GET', '/api/admin/export/daily.csv', async (req, res) => {
  const session = requireSession(req);
  if (!requireRole(session, ['reporting', 'admin'])) return sendJson(res, 403, { ok: false });
  const state = db.get();
  const unmasked = auth.canSeeUnmasked(session.role);
  const byRef = {};
  state.spinLog.forEach((s) => {
    byRef[s.ref] = s;
  });
  const rows = state.checkLog.map((c) => {
    const spin = Object.values(byRef).find((s) => s.smartcard === c.smartcard && s.ts >= c.ts);
    const prize = spin ? state.prizeQueue[spin.ref] : null;
    return {
      datetime: c.ts,
      outletId: c.outletId,
      smartcard: unmasked ? c.smartcard : maskSmartcard(c.smartcard),
      mobile: unmasked ? c.mobile : maskMobile(c.mobile),
      checkResult: c.result === 'pass' ? 'pass' : `fail:${c.reason}`,
      prizeTier: prize ? prize.tier : '',
      prizeStatus: prize ? prize.status : '',
      fulfilmentDate: prize && prize.status === 'fulfilled' ? [...prize.history].reverse().find((h) => h.status === 'fulfilled').ts : '',
    };
  });
  const headers = ['datetime', 'outletId', 'smartcard', 'mobile', 'checkResult', 'prizeTier', 'prizeStatus', 'fulfilmentDate'];
  logAdminAction(state, session, 'export_daily_csv', { count: rows.length });
  db.save();
  sendText(res, 200, csv.toCsv(rows, headers), 'text/csv; charset=utf-8');
});

route('GET', '/api/admin/audit-log', async (req, res) => {
  const session = requireSession(req);
  if (!requireRole(session, ['admin', 'read_only'])) return sendJson(res, 403, { ok: false });
  sendJson(res, 200, { ok: true, log: db.get().adminAuditLog.slice(-500).reverse() });
});

route('GET', '/api/admin/sms-outbox', async (req, res) => {
  const session = requireSession(req);
  if (!requireRole(session, ['admin', 'fulfilment', 'reporting'])) return sendJson(res, 403, { ok: false });
  sendJson(res, 200, { ok: true, messages: db.get().smsOutbox.slice(-200).reverse() });
});

// ===========================================================================
// BACK OFFICE: CONFIG & OUTLETS/QR
// ===========================================================================

route('GET', '/api/admin/config', async (req, res) => {
  const session = requireSession(req);
  if (!requireRole(session, ['admin', 'read_only'])) return sendJson(res, 403, { ok: false });
  const state = db.get();
  sendJson(res, 200, { ok: true, config: state.config, odds: ODDS_TABLE });
});

route('POST', '/api/admin/config', async (req, res) => {
  const session = requireSession(req);
  if (!requireRole(session, ['admin'])) return sendJson(res, 403, { ok: false });
  const state = db.get();
  const body = await readJsonBody(req).catch(() => ({}));
  // Odds are never editable here — locked after launch per the brief.
  if ('campaignStart' in body) state.config.campaignStart = body.campaignStart;
  if ('campaignEnd' in body) state.config.campaignEnd = body.campaignEnd;
  if (body.messages && typeof body.messages === 'object') Object.assign(state.config.messages, body.messages);
  if ('testClockOverride' in body) state.config.testClockOverride = body.testClockOverride || null;
  if ('testBypassQr' in body) state.config.testBypassQr = Boolean(body.testBypassQr);
  logAdminAction(state, session, 'config_update', body);
  db.save();
  sendJson(res, 200, { ok: true, config: state.config });
});

route('GET', '/api/admin/outlets', async (req, res) => {
  const session = requireSession(req);
  if (!session) return sendJson(res, 401, { ok: false });
  const state = db.get();
  const withQr = state.outlets.map((o) => ({
    ...o,
    qrUrl: `/customer/?o=${encodeURIComponent(o.id)}&s=${sign(state.config.qrSecret, o.id)}`,
  }));
  sendJson(res, 200, { ok: true, outlets: withQr });
});

// ===========================================================================
// STATIC FILES
// ===========================================================================

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? '/customer/index.html' : pathname;
  if (rel === '/backoffice' || rel === '/backoffice/') rel = '/backoffice/index.html';
  if (rel === '/customer' || rel === '/customer/') rel = '/customer/index.html';
  const filePath = path.join(PUBLIC_DIR, rel);
  if (!filePath.startsWith(PUBLIC_DIR)) return sendText(res, 403, 'Forbidden');
  fs.readFile(filePath, (err, data) => {
    if (err) return sendText(res, 404, 'Not found');
    const ext = path.extname(filePath);
    sendText(res, 200, data, MIME[ext] || 'application/octet-stream');
  });
}

// ===========================================================================
// SERVER
// ===========================================================================

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const found = match(req.method, parsed.pathname);
  if (found) {
    try {
      await found.handler(req, res, found.params, parsed.query);
    } catch (e) {
      console.error(e);
      sendJson(res, 500, { ok: false, message: 'Internal error.' });
    }
    return;
  }
  if (req.method === 'GET' && !parsed.pathname.startsWith('/api/')) {
    return serveStatic(req, res, parsed.pathname);
  }
  sendJson(res, 404, { ok: false, message: 'Not found.' });
});

db.init()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`MCB Spin the Wheel listening on http://localhost:${PORT}`);
      console.log(`Customer app:  http://localhost:${PORT}/customer/`);
      console.log(`Back office:   http://localhost:${PORT}/backoffice/`);
      console.log(`Storage:       ${db.usingPostgres ? 'Postgres (persistent)' : `file (${db.DB_FILE})`}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialise storage:', err);
    process.exit(1);
  });

module.exports = server;
