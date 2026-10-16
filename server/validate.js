'use strict';
const crypto = require('crypto');

// MultiChoice smartcards: alphanumeric, 10-12 characters (demo-reasonable range).
function isValidSmartcard(s) {
  return typeof s === 'string' && /^[A-Za-z0-9]{10,12}$/.test(s.trim());
}

// Case-insensitive on the card itself: "ab12345678" and "AB12345678" are the
// same smartcard, so normalise before storing or comparing.
function normalizeSmartcard(s) {
  return String(s).trim().toUpperCase();
}

// Botswana mobile: 8 digits starting 7, optionally prefixed +267/267.
function isValidMobile(s) {
  if (typeof s !== 'string') return false;
  const t = s.trim().replace(/\s+/g, '');
  return /^(\+267|267)?7[0-9]{7}$/.test(t);
}

function normaliseMobile(s) {
  const t = s.trim().replace(/\s+/g, '');
  const digits = t.replace(/^\+?267/, '');
  return `+267${digits}`;
}

function sign(secret, outletId) {
  return crypto.createHmac('sha256', secret).update(outletId).digest('hex').slice(0, 16);
}

function verifyOutletSig(secret, outletId, sig) {
  if (!outletId || !sig) return false;
  const expected = sign(secret, outletId);
  const a = Buffer.from(expected);
  const b = Buffer.from(String(sig));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function maskSmartcard(s) {
  if (!s) return s;
  const t = String(s);
  return `${'•'.repeat(Math.max(0, t.length - 4))}${t.slice(-4)}`;
}

function maskMobile(s) {
  if (!s) return s;
  const t = String(s);
  return `${t.slice(0, 5)}•••${t.slice(-2)}`;
}

module.exports = {
  isValidSmartcard,
  normalizeSmartcard,
  isValidMobile,
  normaliseMobile,
  sign,
  verifyOutletSig,
  maskSmartcard,
  maskMobile,
};
