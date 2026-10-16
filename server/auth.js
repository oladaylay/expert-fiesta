'use strict';
const crypto = require('crypto');
const db = require('./db');

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8-hour back-office session

const ROLES = ['admin', 'whitelist_upload', 'fulfilment', 'reporting', 'read_only'];
// Back-office roles belonging to the CVM team itself. Reports leaving this
// group get smartcard/mobile masked (brief, Data protection: "mask both in
// reports outside CVM").
const CVM_ROLES = new Set(['admin', 'whitelist_upload', 'fulfilment']);

function login(username, password) {
  const state = db.get();
  const user = state.users.find((u) => u.username === username && u.password === password);
  if (!user) return null;
  const token = crypto.randomBytes(24).toString('hex');
  state.sessions[token] = {
    username: user.username,
    role: user.role,
    name: user.name,
    expires: Date.now() + SESSION_TTL_MS,
  };
  db.save();
  return token;
}

function sessionFor(token) {
  if (!token) return null;
  const state = db.get();
  const s = state.sessions[token];
  if (!s) return null;
  if (s.expires < Date.now()) {
    delete state.sessions[token];
    db.save();
    return null;
  }
  return s;
}

function logout(token) {
  const state = db.get();
  delete state.sessions[token];
  db.save();
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i === -1) return;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function canSeeUnmasked(role) {
  return CVM_ROLES.has(role);
}

module.exports = { login, sessionFor, logout, parseCookies, canSeeUnmasked, ROLES, CVM_ROLES };
