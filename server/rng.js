'use strict';
// The prize draw. Odds are locked before launch (brief, "The spin function"
// and "Configuration": the odds table is locked after launch and no one
// can change it during the campaign) — this table is the single source of
// truth and nothing in the app writes to it at runtime.
const crypto = require('crypto');

const ODDS_TABLE = Object.freeze([
  { tier: 'airtime_20', label: 'Airtime / data top-up', value: 20, odds: 0.70 },
  { tier: 'voucher_50', label: 'Shopping voucher', value: 50, odds: 0.25 },
  { tier: 'voucher_100', label: 'Shopping voucher', value: 100, odds: 0.03 },
  { tier: 'voucher_150', label: 'Shopping voucher', value: 150, odds: 0.01 },
  { tier: 'grand_2000', label: 'Grand prize voucher', value: 2000, odds: 0.01 },
]);

const TOTAL_ODDS = ODDS_TABLE.reduce((s, t) => s + t.odds, 0);
if (Math.abs(TOTAL_ODDS - 1) > 1e-9) {
  throw new Error('ODDS_TABLE must sum to 1 — fix before starting the server');
}

// Cryptographically secure draw of one tier at the published odds.
// Uses a uniform 32-bit draw (crypto.randomBytes) mapped onto the
// cumulative odds — granularity of 1 in 2^32, far finer than the smallest
// published odds band (1%), so no detectable bias versus the stated table.
function drawTier() {
  const n = crypto.randomBytes(4).readUInt32BE(0) / 0x100000000; // [0, 1)
  let acc = 0;
  for (const tier of ODDS_TABLE) {
    acc += tier.odds;
    if (n < acc) return tier;
  }
  return ODDS_TABLE[ODDS_TABLE.length - 1]; // floating-point edge guard
}

module.exports = { ODDS_TABLE, drawTier };
