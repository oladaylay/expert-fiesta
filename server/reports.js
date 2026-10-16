'use strict';
const { ODDS_TABLE } = require('./rng');
const clock = require('./clock');

function dateKey(iso) {
  return iso.slice(0, 10);
}

function todayKey() {
  return dateKey(clock.now().toISOString());
}

function outletLookup(state) {
  const m = new Map();
  state.outlets.forEach((o) => m.set(o.id, o));
  return m;
}

function groupCount(arr, keyFn) {
  const m = new Map();
  for (const item of arr) {
    const k = keyFn(item);
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

// ---------- scans / checks ----------

function checksSummary(checkLog, sinceKey) {
  const scoped = sinceKey ? checkLog.filter((c) => dateKey(c.ts) === sinceKey) : checkLog;
  const passes = scoped.filter((c) => c.result === 'pass').length;
  const failsByReason = {};
  scoped
    .filter((c) => c.result === 'fail')
    .forEach((c) => {
      failsByReason[c.reason] = (failsByReason[c.reason] || 0) + 1;
    });
  return { scans: scoped.length, passes, failures: scoped.length - passes, failsByReason };
}

// ---------- spins / tiers ----------

function tierMix(spinLog, sinceKey) {
  const scoped = sinceKey ? spinLog.filter((s) => dateKey(s.ts) === sinceKey) : spinLog;
  const byTier = {};
  ODDS_TABLE.forEach((t) => {
    byTier[t.tier] = { label: t.label, value: t.value, publishedOdds: t.odds, count: 0 };
  });
  scoped.forEach((s) => {
    if (byTier[s.tier]) byTier[s.tier].count += 1;
  });
  const total = scoped.length;
  Object.values(byTier).forEach((t) => {
    t.observedShare = total ? t.count / total : 0;
    t.deltaPct = total ? Math.round((t.observedShare - t.publishedOdds) * 1000) / 10 : 0;
  });
  return { total, byTier };
}

// ---------- outlets ----------

function outletRanking(state, sinceKey) {
  const outlets = outletLookup(state);
  const scoped = sinceKey ? state.spinLog.filter((s) => dateKey(s.ts) === sinceKey) : state.spinLog;
  const counts = groupCount(scoped, (s) => s.outletId);
  const ranked = state.outlets
    .map((o) => ({ outletId: o.id, name: o.name, town: o.town, spins: counts.get(o.id) || 0 }))
    .sort((a, b) => b.spins - a.spins);
  const noScans = ranked.filter((o) => o.spins === 0).map((o) => o.outletId);
  return { ranked, noScans };
}

// ---------- fulfilment ----------

function fulfilmentSummary(state) {
  const prizes = Object.values(state.prizeQueue);
  const byStatus = {};
  const byTier = {};
  let oldestOpen = null;
  prizes.forEach((p) => {
    byStatus[p.status] = (byStatus[p.status] || 0) + 1;
    byTier[p.tier] = byTier[p.tier] || { fulfilled: 0, open: 0, unclaimed: 0 };
    if (p.status === 'fulfilled') byTier[p.tier].fulfilled += 1;
    else if (p.status === 'unclaimed') byTier[p.tier].unclaimed += 1;
    else byTier[p.tier].open += 1;

    const isOpen = !['fulfilled', 'unclaimed'].includes(p.status);
    if (isOpen && (!oldestOpen || p.awardedAt < oldestOpen.awardedAt)) oldestOpen = p;
  });
  return { total: prizes.length, byStatus, byTier, oldestOpen };
}

function ageingDays(awardedAt) {
  const ms = clock.now() - new Date(awardedAt);
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

// ---------- dashboard (refreshed every 5 minutes per the brief) ----------

function dashboard(state) {
  const today = todayKey();
  return {
    asOf: clock.now().toISOString(),
    checks: { today: checksSummary(state.checkLog, today), toDate: checksSummary(state.checkLog) },
    tiers: { today: tierMix(state.spinLog, today), toDate: tierMix(state.spinLog) },
    outlets: { today: outletRanking(state, today), toDate: outletRanking(state) },
    fulfilment: fulfilmentSummary(state),
    whitelist: {
      size: Object.keys(state.whitelist).length,
      lastUploadAt: state.whitelistUploads.length
        ? state.whitelistUploads[state.whitelistUploads.length - 1].ts
        : null,
      used: Object.keys(state.usedSmartcards).length,
    },
  };
}

// ---------- scheduled reports ----------

function dailySummary(state, dateKeyStr) {
  const key = dateKeyStr || todayKey();
  const checksToday = checksSummary(state.checkLog, key);
  const checksToDate = checksSummary(state.checkLog);
  const tiersToday = tierMix(state.spinLog, key);
  const tiersToDate = tierMix(state.spinLog);
  const { ranked } = outletRanking(state, key);
  return {
    date: key,
    generatedAt: clock.now().toISOString(),
    yesterday: { scans: checksToday.scans, checks: checksToday, spins: tiersToday.total, prizesByTier: tiersToday.byTier },
    campaignToDate: { scans: checksToDate.scans, checks: checksToDate, spins: tiersToDate.total, prizesByTier: tiersToDate.byTier },
    topOutlets: ranked.slice(0, 10),
    bottomOutlets: ranked.slice(-10).reverse(),
  };
}

function fulfilmentReport(state, dateKeyStr) {
  const key = dateKeyStr || todayKey();
  const prizes = Object.values(state.prizeQueue);
  const open = prizes
    .filter((p) => !['fulfilled', 'unclaimed'].includes(p.status))
    .map((p) => ({ ref: p.ref, tier: p.tier, value: p.value, status: p.status, days: ageingDays(p.awardedAt) }))
    .sort((a, b) => b.days - a.days);
  const fulfilledYesterday = prizes.filter(
    (p) => p.status === 'fulfilled' && p.history.some((h) => h.status === 'fulfilled' && dateKey(h.ts) === key)
  );
  const byAgent = {};
  fulfilledYesterday.forEach((p) => {
    const h = [...p.history].reverse().find((x) => x.status === 'fulfilled');
    const agent = (h && h.agent) || 'unknown';
    byAgent[agent] = (byAgent[agent] || 0) + 1;
  });
  return {
    date: key,
    generatedAt: clock.now().toISOString(),
    openByTierAndAge: open,
    fulfilledYesterdayByAgent: byAgent,
    exceptions: exceptions(state),
  };
}

function outletPerformanceWeekly(state) {
  const since = new Date(clock.now());
  since.setDate(since.getDate() - 7);
  const sinceIso = since.toISOString();
  const spins = state.spinLog.filter((s) => s.ts >= sinceIso);
  const checks = state.checkLog.filter((c) => c.ts >= sinceIso);
  const outlets = state.outlets.map((o) => {
    const outletChecks = checks.filter((c) => c.outletId === o.id);
    const outletSpins = spins.filter((s) => s.outletId === o.id).length;
    const fails = outletChecks.filter((c) => c.result === 'fail').length;
    const failRate = outletChecks.length ? fails / outletChecks.length : 0;
    return {
      outletId: o.id,
      name: o.name,
      town: o.town,
      scans: outletChecks.length,
      failedChecks: fails,
      failRatePct: Math.round(failRate * 1000) / 10,
      spins: outletSpins,
      reBrief: failRate > 0.3 || outletChecks.length === 0,
    };
  });
  return { since: sinceIso, generatedAt: clock.now().toISOString(), outlets };
}

// ---------- exception alerts (brief, "Exception alerts") ----------

function exceptions(state) {
  const alerts = [];
  const today = todayKey();

  // 1. One outlet's spins jump above 3x its daily average.
  const byOutletDay = {};
  state.spinLog.forEach((s) => {
    const k = `${s.outletId}|${dateKey(s.ts)}`;
    byOutletDay[k] = (byOutletDay[k] || 0) + 1;
  });
  const dailyCountsByOutlet = {};
  Object.entries(byOutletDay).forEach(([k, count]) => {
    const [outletId] = k.split('|');
    (dailyCountsByOutlet[outletId] = dailyCountsByOutlet[outletId] || []).push(count);
  });
  Object.entries(dailyCountsByOutlet).forEach(([outletId, counts]) => {
    if (counts.length < 2) return;
    const todayCount = byOutletDay[`${outletId}|${today}`] || 0;
    const priorCounts = counts.slice(0, -1);
    const avg = priorCounts.reduce((a, b) => a + b, 0) / priorCounts.length;
    if (avg > 0 && todayCount > avg * 3) {
      alerts.push({
        type: 'spin_spike',
        outletId,
        message: `${outletId}: ${todayCount} spins today vs daily average ${avg.toFixed(1)} (>3x).`,
      });
    }
  });

  // 2. Failed checks above 30% at one outlet in a day.
  const byOutletDayChecks = {};
  state.checkLog.forEach((c) => {
    const k = `${c.outletId || 'unknown'}|${dateKey(c.ts)}`;
    byOutletDayChecks[k] = byOutletDayChecks[k] || { total: 0, fail: 0 };
    byOutletDayChecks[k].total += 1;
    if (c.result === 'fail') byOutletDayChecks[k].fail += 1;
  });
  Object.entries(byOutletDayChecks).forEach(([k, v]) => {
    const [outletId, day] = k.split('|');
    if (v.total >= 5 && v.fail / v.total > 0.3) {
      alerts.push({
        type: 'high_fail_rate',
        outletId,
        message: `${outletId} on ${day}: ${Math.round((v.fail / v.total) * 100)}% failed checks (briefing or QR problem?).`,
      });
    }
  });

  // 3. A grand prize won at the same outlet twice in a week.
  const since = new Date(clock.now());
  since.setDate(since.getDate() - 7);
  const sinceIso = since.toISOString();
  const grandByOutlet = {};
  state.spinLog
    .filter((s) => s.tier === 'grand_2000' && s.ts >= sinceIso)
    .forEach((s) => {
      grandByOutlet[s.outletId] = (grandByOutlet[s.outletId] || 0) + 1;
    });
  Object.entries(grandByOutlet).forEach(([outletId, count]) => {
    if (count >= 2) {
      alerts.push({ type: 'repeat_grand_prize', outletId, message: `${outletId}: ${count} grand prizes in the last 7 days.` });
    }
  });

  // 4. Open prizes older than 5 working days (approximated as 7 calendar days).
  Object.values(state.prizeQueue).forEach((p) => {
    if (!['fulfilled', 'unclaimed'].includes(p.status) && ageingDays(p.awardedAt) > 7) {
      alerts.push({ type: 'stale_prize', ref: p.ref, message: `${p.ref}: open ${ageingDays(p.awardedAt)} days (>5 working days).` });
    }
  });

  // 5. No whitelist upload in the last 24 hours.
  const lastUpload = state.whitelistUploads[state.whitelistUploads.length - 1];
  const dayMs = 24 * 60 * 60 * 1000;
  if (!lastUpload || clock.now() - new Date(lastUpload.ts) > dayMs) {
    alerts.push({ type: 'stale_whitelist', message: 'No whitelist upload in the last 24 hours.' });
  }

  return alerts;
}

// ---------- campaign close & audit (once, by 15 Jan 2027) ----------

function campaignClose(state) {
  const tiers = tierMix(state.spinLog);
  const prizes = Object.values(state.prizeQueue);
  return {
    generatedAt: clock.now().toISOString(),
    totalSpins: state.spinLog.length,
    tiersDrawnVsOdds: tiers.byTier,
    awardedVsFulfilled: {
      awarded: prizes.length,
      fulfilled: prizes.filter((p) => p.status === 'fulfilled').length,
      unclaimed: prizes.filter((p) => p.status === 'unclaimed').length,
      open: prizes.filter((p) => !['fulfilled', 'unclaimed'].includes(p.status)).length,
    },
    exceptions: exceptions(state),
    signOffs: state.signOffs,
    spins: state.spinLog.map((s) => ({ ref: s.ref, ts: s.ts, outletId: s.outletId, tier: s.tier, value: s.value })),
  };
}

module.exports = {
  dashboard,
  dailySummary,
  fulfilmentReport,
  outletPerformanceWeekly,
  exceptions,
  campaignClose,
  tierMix,
  ageingDays,
  todayKey,
  dateKey,
};
