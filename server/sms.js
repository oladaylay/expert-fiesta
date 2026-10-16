'use strict';
// Mock SMS gateway. The brief lists "SMS gateway for the prize and delivery
// messages" as an open item still to be confirmed, so this module logs
// messages to an outbox (visible in the back office) instead of calling a
// real carrier API. Swap send() for the real gateway call once it's chosen —
// nothing else in the app needs to change.
const db = require('./db');

function send(to, body, ref) {
  const state = db.get();
  state.smsOutbox.push({
    id: db.newId('sms'),
    to,
    body,
    ref: ref || null,
    ts: db.nowIso(),
    status: 'sent (mock gateway)',
  });
  db.save();
}

module.exports = { send };
