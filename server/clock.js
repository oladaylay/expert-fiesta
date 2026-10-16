'use strict';
// Every date/time decision in the app goes through here, so a single UAT
// control (config.testClockOverride, set in the back office under
// Settings → Testing) can simulate "now" before the real 1 Dec 2026
// launch. Leave it unset in production and this is just `new Date()`.
const db = require('./db');

function now() {
  const { testClockOverride } = db.get().config;
  return testClockOverride ? new Date(testClockOverride) : new Date();
}

function campaignStatus() {
  const { config } = db.get();
  const t = now();
  const start = new Date(config.campaignStart);
  const end = new Date(config.campaignEnd);
  if (t < start) return { running: false, phase: 'before', start, end, now: t };
  if (t > end) return { running: false, phase: 'after', start, end, now: t };
  // Botswana is UTC+2 year-round (Africa/Gaborone, no DST) — compute the
  // local hour from UTC directly so this is correct regardless of the
  // server's own timezone.
  const hour = (t.getUTCHours() + 2) % 24;
  const { startHour, endHour } = config.availabilityWindow;
  if (hour < startHour || hour >= endHour) {
    return { running: false, phase: 'outside_hours', start, end, now: t };
  }
  return { running: true, phase: 'live', start, end, now: t };
}

module.exports = { now, campaignStatus };
