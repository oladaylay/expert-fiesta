#!/usr/bin/env node
'use strict';
// Acceptance criterion 3: "A simulated 100,000 spins return tiers within
// 0.5 percentage points of the published odds."
const { ODDS_TABLE, drawTier } = require('../server/rng');

const N = 100000;
const counts = {};
ODDS_TABLE.forEach((t) => (counts[t.tier] = 0));

for (let i = 0; i < N; i++) counts[drawTier().tier] += 1;

console.log(`Simulated ${N} spins\n`);
console.log('tier'.padEnd(14), 'published'.padEnd(11), 'observed'.padEnd(11), 'delta(pp)', 'pass');
let allPass = true;
ODDS_TABLE.forEach((t) => {
  const observed = counts[t.tier] / N;
  const deltaPp = (observed - t.odds) * 100;
  const pass = Math.abs(deltaPp) <= 0.5;
  if (!pass) allPass = false;
  console.log(
    t.tier.padEnd(14),
    `${(t.odds * 100).toFixed(1)}%`.padEnd(11),
    `${(observed * 100).toFixed(2)}%`.padEnd(11),
    deltaPp.toFixed(2).padStart(7),
    pass ? 'PASS' : 'FAIL'
  );
});

console.log(`\nOverall: ${allPass ? 'PASS' : 'FAIL'}`);
process.exit(allPass ? 0 : 1);
