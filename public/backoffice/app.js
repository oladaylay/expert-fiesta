(() => {
  'use strict';

  const loginScreen = document.getElementById('login-screen');
  const shell = document.getElementById('shell');
  const navEl = document.getElementById('nav');
  const mainEl = document.getElementById('main');
  const whoamiEl = document.getElementById('whoami');

  let user = null;
  let dashboardTimer = null;

  async function api(method, path, body) {
    const res = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.headers.get('content-type')?.includes('text/csv')) return res.text();
    return res.json();
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
  function fmt(ts) {
    return ts ? new Date(ts).toLocaleString('en-GB') : '—';
  }
  function downloadText(filename, text) {
    const blob = new Blob([text], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // =========================================================================
  // tabs
  // =========================================================================

  const TABS = [
    { key: 'dashboard', label: 'Dashboard', roles: ['reporting', 'admin', 'read_only'], render: renderDashboard },
    { key: 'whitelist', label: 'Whitelist', roles: ['whitelist_upload', 'admin'], render: renderWhitelist },
    { key: 'queue', label: 'Fulfilment queue', roles: ['fulfilment', 'reporting', 'read_only', 'admin'], render: renderQueue },
    { key: 'care', label: 'Customer care lookup', roles: ['fulfilment', 'reporting', 'read_only', 'admin'], render: renderCare },
    { key: 'reports', label: 'Reports', roles: ['reporting', 'admin', 'read_only'], render: renderReports },
    { key: 'outlets', label: 'Outlets & QR', roles: ['admin', 'whitelist_upload', 'fulfilment', 'reporting', 'read_only'], render: renderOutlets },
    { key: 'sms', label: 'SMS outbox', roles: ['admin', 'fulfilment', 'reporting'], render: renderSms },
    { key: 'settings', label: 'Settings', roles: ['admin'], render: renderSettings },
    { key: 'audit', label: 'Audit log', roles: ['admin', 'read_only'], render: renderAuditLog },
  ];

  let activeTab = null;

  function buildNav() {
    navEl.replaceChildren(
      ...TABS.filter((t) => t.roles.includes(user.role)).map((t) => {
        const btn = document.createElement('button');
        btn.textContent = t.label;
        btn.dataset.key = t.key;
        btn.addEventListener('click', () => selectTab(t.key));
        return btn;
      })
    );
  }

  function selectTab(key) {
    activeTab = key;
    if (dashboardTimer) {
      clearInterval(dashboardTimer);
      dashboardTimer = null;
    }
    [...navEl.children].forEach((b) => b.classList.toggle('active', b.dataset.key === key));
    const tab = TABS.find((t) => t.key === key);
    tab.render();
  }

  // =========================================================================
  // dashboard
  // =========================================================================

  async function renderDashboard() {
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `<h2>Live dashboard</h2><p class="sub">Refreshes every 5 minutes.</p><div id="dash-body">Loading…</div>`;
    mainEl.replaceChildren(panel);
    await loadDashboard();
    dashboardTimer = setInterval(loadDashboard, 5 * 60 * 1000);
  }

  async function loadDashboard() {
    const resp = await api('GET', '/api/admin/dashboard');
    if (!resp.ok) return;
    const d = resp.dashboard;
    const body = document.getElementById('dash-body');
    if (!body) return;

    const tierRows = Object.values(d.tiers.toDate.byTier)
      .map(
        (t) => `<tr><td>${t.label} (BWP ${t.value})</td><td>${Math.round(t.publishedOdds * 1000) / 10}%</td><td>${t.count}</td><td>${Math.round(t.observedShare * 1000) / 10}%</td><td>${t.deltaPct > 0 ? '+' : ''}${t.deltaPct}pp</td></tr>`
      )
      .join('');

    const outletRows = d.outlets.toDate.ranked
      .map((o) => `<tr><td>${esc(o.name)}</td><td>${esc(o.town)}</td><td>${o.spins}</td>${o.spins === 0 ? '<td class="pill pill-red">no scans</td>' : '<td></td>'}</tr>`)
      .join('');

    const failRows = Object.entries(d.checks.toDate.failsByReason)
      .map(([reason, count]) => `<tr><td>${esc(reason)}</td><td>${count}</td></tr>`)
      .join('');

    body.innerHTML = `
      <div class="stat-grid">
        <div class="card stat-card"><div class="num">${d.checks.today.scans}</div><div class="label">Scans today</div></div>
        <div class="card stat-card"><div class="num">${d.checks.today.passes}</div><div class="label">Passes today</div></div>
        <div class="card stat-card"><div class="num">${d.checks.today.failures}</div><div class="label">Failures today</div></div>
        <div class="card stat-card"><div class="num">${d.tiers.today.total}</div><div class="label">Spins today</div></div>
        <div class="card stat-card"><div class="num">${d.checks.toDate.scans}</div><div class="label">Scans to date</div></div>
        <div class="card stat-card"><div class="num">${d.tiers.toDate.total}</div><div class="label">Spins to date</div></div>
        <div class="card stat-card"><div class="num">${d.whitelist.size}</div><div class="label">Whitelist size</div></div>
        <div class="card stat-card"><div class="num">${d.whitelist.used}</div><div class="label">Smartcards used</div></div>
      </div>

      <h3>Tier mix vs published odds (campaign to date)</h3>
      <table class="dt"><thead><tr><th>Prize</th><th>Published odds</th><th>Won</th><th>Observed share</th><th>Delta</th></tr></thead><tbody>${tierRows}</tbody></table>

      <h3>Failures by reason (campaign to date)</h3>
      <table class="dt"><thead><tr><th>Reason</th><th>Count</th></tr></thead><tbody>${failRows || '<tr><td colspan="2">None</td></tr>'}</tbody></table>

      <h3>Spins by outlet (campaign to date)</h3>
      <table class="dt"><thead><tr><th>Outlet</th><th>Town</th><th>Spins</th><th></th></tr></thead><tbody>${outletRows}</tbody></table>

      <h3>Fulfilment</h3>
      <div class="stat-grid">
        ${Object.entries(d.fulfilment.byStatus)
          .map(([status, count]) => `<div class="card stat-card"><div class="num">${count}</div><div class="label">${status.replace('_', ' ')}</div></div>`)
          .join('')}
      </div>
      <p class="sub">Oldest open prize: ${d.fulfilment.oldestOpen ? `${d.fulfilment.oldestOpen.ref} (awarded ${fmt(d.fulfilment.oldestOpen.awardedAt)})` : 'none'}</p>
      <p class="sub">Dashboard as of ${fmt(d.asOf)}</p>
    `;
  }

  // =========================================================================
  // whitelist
  // =========================================================================

  async function renderWhitelist() {
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
      <h2>Whitelist</h2>
      <p class="sub">Upload smartcard numbers, one per line. Uploads can replace or add to the current list, as often as needed.</p>
      <div id="wl-stats" class="stat-grid"></div>
      <div class="toolbar">
        <div class="field"><label>Mode</label>
          <select id="wl-mode"><option value="add">Add to existing list</option><option value="replace">Replace entire list</option></select>
        </div>
      </div>
      <textarea class="bulk" id="wl-rows" placeholder="AB1234567C&#10;1234567890&#10;..."></textarea>
      <div style="margin:10px 0"><button class="btn btn-primary" id="wl-upload">Upload</button></div>
      <div id="wl-msg"></div>
      <h3>Upload history</h3>
      <table class="dt"><thead><tr><th>Date/time</th><th>User</th><th>Mode</th><th>Rows accepted</th></tr></thead><tbody id="wl-history"></tbody></table>
    `;
    mainEl.replaceChildren(panel);

    async function refresh() {
      const stats = await api('GET', '/api/admin/whitelist/stats');
      document.getElementById('wl-stats').innerHTML = `
        <div class="card stat-card"><div class="num">${stats.size}</div><div class="label">Current whitelist size</div></div>
        <div class="card stat-card"><div class="num">${stats.used}</div><div class="label">Smartcards used (all-time)</div></div>
        <div class="card stat-card"><div class="num" style="font-size:1.1rem">${fmt(stats.lastUploadAt)}</div><div class="label">Last upload</div></div>
      `;
      const hist = await api('GET', '/api/admin/whitelist/history');
      document.getElementById('wl-history').innerHTML = hist.uploads
        .slice()
        .reverse()
        .map((u) => `<tr><td>${fmt(u.ts)}</td><td>${esc(u.user)}</td><td>${u.mode}</td><td>${u.rowCount}</td></tr>`)
        .join('');
    }

    panel.querySelector('#wl-upload').addEventListener('click', async () => {
      const rows = panel.querySelector('#wl-rows').value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      const mode = panel.querySelector('#wl-mode').value;
      const resp = await api('POST', '/api/admin/whitelist/upload', { mode, rows });
      const msgEl = panel.querySelector('#wl-msg');
      if (resp.ok) {
        msgEl.innerHTML = `<div class="msg msg-success">Accepted ${resp.rowCount} smartcard(s)${resp.rejected ? `, rejected ${resp.rejected} invalid row(s)` : ''}. Whitelist size is now ${resp.whitelistSize}.</div>`;
        panel.querySelector('#wl-rows').value = '';
        refresh();
      } else {
        msgEl.innerHTML = `<div class="msg msg-error">${esc(resp.message)}</div>`;
      }
    });

    refresh();
  }

  // =========================================================================
  // fulfilment queue
  // =========================================================================

  async function renderQueue() {
    const panel = document.createElement('div');
    panel.className = 'panel';
    const canFulfil = ['fulfilment', 'admin'].includes(user.role);
    panel.innerHTML = `
      <h2>Fulfilment queue</h2>
      <p class="sub">Oldest first, grand prizes flagged at the top.</p>
      <div class="toolbar">
        <div class="field"><label>Tier</label><select id="f-tier"><option value="">All</option>
          <option value="airtime_20">Airtime/data (20)</option><option value="voucher_50">Voucher (50)</option>
          <option value="voucher_100">Voucher (100)</option><option value="voucher_150">Voucher (150)</option>
          <option value="grand_2000">Grand prize (2000)</option></select></div>
        <div class="field"><label>Status</label><select id="f-status"><option value="">All</option>
          <option value="awarded">Awarded</option><option value="in_progress">In progress</option>
          <option value="fulfilled">Fulfilled</option><option value="failed_attempt">Failed attempt</option>
          <option value="unclaimed">Unclaimed</option></select></div>
        <div class="field"><label>Outlet</label><input type="text" id="f-outlet" placeholder="e.g. GBE001"></div>
        <div class="field"><label>Date</label><input type="date" id="f-date"></div>
        <button class="btn btn-sm" id="f-apply">Filter</button>
        <button class="btn btn-sm" id="f-export">Export CSV</button>
      </div>
      ${canFulfil ? `<div class="toolbar"><div class="field" style="flex:1"><label>Bulk mark fulfilled (paste references, one per line)</label><textarea class="bulk" id="bulk-refs" style="min-height:70px"></textarea></div><button class="btn btn-sm" id="bulk-submit">Mark fulfilled</button></div>` : ''}
      <div id="queue-msg"></div>
      <table class="dt"><thead><tr><th>Ref</th><th>Tier</th><th>Value</th><th>Outlet</th><th>Smartcard</th><th>Mobile</th><th>Status</th><th>Age (d)</th>${canFulfil ? '<th>Actions</th>' : ''}</tr></thead><tbody id="queue-body"></tbody></table>
    `;
    mainEl.replaceChildren(panel);

    async function load() {
      const q = new URLSearchParams();
      ['tier', 'status', 'outlet', 'date'].forEach((f) => {
        const v = panel.querySelector(`#f-${f}`).value;
        if (v) q.set(f, v);
      });
      const resp = await api('GET', `/api/admin/queue?${q}`);
      const body = panel.querySelector('#queue-body');
      body.innerHTML = resp.prizes
        .map((p) => {
          const stale = p.ageDays > 2 && !['fulfilled', 'unclaimed'].includes(p.status);
          const actions = canFulfil
            ? `<td class="row-actions">
                <button class="btn btn-sm" data-ref="${p.ref}" data-status="in_progress">In progress</button>
                <button class="btn btn-sm" data-ref="${p.ref}" data-status="fulfilled">Fulfilled</button>
                <button class="btn btn-sm" data-ref="${p.ref}" data-status="failed_attempt">Failed attempt</button>
                <button class="btn btn-sm" data-ref="${p.ref}" data-status="unclaimed">Unclaimed</button>
              </td>`
            : '';
          return `<tr class="${stale ? 'stale' : ''}">
            <td>${p.ref}${p.tier === 'grand_2000' ? ' <span class="pill pill-gold">GRAND</span>' : ''}</td>
            <td>${p.label}</td><td>BWP ${p.value}</td><td>${p.outletName}</td>
            <td>${esc(p.smartcard)}</td><td>${esc(p.mobile)}</td>
            <td>${p.status.replace('_', ' ')}${p.failedAttempts ? ` (${p.failedAttempts} attempt${p.failedAttempts > 1 ? 's' : ''})` : ''}</td>
            <td>${p.ageDays}</td>${actions}
          </tr>`;
        })
        .join('');

      if (canFulfil) {
        body.querySelectorAll('button[data-ref]').forEach((btn) =>
          btn.addEventListener('click', async () => {
            let note = null;
            if (btn.dataset.status === 'failed_attempt') note = prompt('Reason for the failed attempt (wrong number, no answer, …):') || '';
            const resp = await api('POST', `/api/admin/queue/${btn.dataset.ref}/status`, { status: btn.dataset.status, note });
            const msgEl = panel.querySelector('#queue-msg');
            msgEl.innerHTML = resp.ok
              ? `<div class="msg msg-success">${btn.dataset.ref} set to ${btn.dataset.status.replace('_', ' ')}.</div>`
              : `<div class="msg msg-error">${esc(resp.message)}</div>`;
            if (resp.ok) load();
          })
        );
      }
    }

    panel.querySelector('#f-apply').addEventListener('click', load);
    panel.querySelector('#f-export').addEventListener('click', async () => {
      const text = await api('GET', '/api/admin/queue/export.csv');
      downloadText('open-prizes.csv', text);
    });

    if (canFulfil) {
      panel.querySelector('#bulk-submit').addEventListener('click', async () => {
        const refs = panel.querySelector('#bulk-refs').value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
        const resp = await api('POST', '/api/admin/queue/bulk-fulfil', { refs, note: 'bulk upload' });
        panel.querySelector('#queue-msg').innerHTML = `<div class="msg msg-success">Marked ${resp.count} prize(s) fulfilled.</div>`;
        panel.querySelector('#bulk-refs').value = '';
        load();
      });
    }

    load();
  }

  // =========================================================================
  // customer care lookup
  // =========================================================================

  async function renderCare() {
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
      <h2>Customer care lookup</h2>
      <p class="sub">Smartcard or mobile in; spin, prize and status out.</p>
      <div class="toolbar"><div class="field"><label>Smartcard or mobile</label><input type="text" id="care-q"></div><button class="btn btn-primary btn-sm" id="care-go">Look up</button></div>
      <div id="care-results"></div>
    `;
    mainEl.replaceChildren(panel);
    panel.querySelector('#care-go').addEventListener('click', async () => {
      const q = panel.querySelector('#care-q').value.trim();
      if (!q) return;
      const resp = await api('GET', `/api/admin/customer-care?q=${encodeURIComponent(q)}`);
      const out = panel.querySelector('#care-results');
      if (!resp.ok) {
        out.innerHTML = `<div class="msg msg-error">${esc(resp.message || 'Not found')}</div>`;
        return;
      }
      const prizeRows = resp.prizes
        .map((p) => `<tr><td>${p.ref}</td><td>${p.label}</td><td>BWP ${p.value}</td><td>${p.status}</td><td>${fmt(p.awardedAt)}</td></tr>`)
        .join('');
      const checkRows = resp.checks
        .map((c) => `<tr><td>${fmt(c.ts)}</td><td>${c.result}</td><td>${c.reason || ''}</td><td>${c.outletId || ''}</td></tr>`)
        .join('');
      out.innerHTML = `
        <h3>Prizes</h3><table class="dt"><thead><tr><th>Ref</th><th>Tier</th><th>Value</th><th>Status</th><th>Awarded</th></tr></thead><tbody>${prizeRows || '<tr><td colspan="5">None</td></tr>'}</tbody></table>
        <h3>Checks</h3><table class="dt"><thead><tr><th>Time</th><th>Result</th><th>Reason</th><th>Outlet</th></tr></thead><tbody>${checkRows || '<tr><td colspan="4">None</td></tr>'}</tbody></table>
      `;
    });
  }

  // =========================================================================
  // reports
  // =========================================================================

  async function renderReports() {
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
      <h2>Reports</h2>
      <div class="chip-nav" id="report-chips">
        <button data-r="daily" class="active">Daily summary</button>
        <button data-r="fulfil">Fulfilment report</button>
        <button data-r="outlet">Outlet performance (weekly)</button>
        <button data-r="close">Campaign close &amp; audit</button>
        <button data-r="exceptions">Exception alerts</button>
      </div>
      <div id="report-body"></div>
    `;
    mainEl.replaceChildren(panel);

    async function show(r) {
      const body = panel.querySelector('#report-body');
      body.innerHTML = 'Loading…';
      if (r === 'daily') {
        const { report } = await api('GET', '/api/admin/reports/daily-summary');
        const topRows = report.topOutlets.map((o) => `<tr><td>${esc(o.name)}</td><td>${o.spins}</td></tr>`).join('');
        const bottomRows = report.bottomOutlets.map((o) => `<tr><td>${esc(o.name)}</td><td>${o.spins}</td></tr>`).join('');
        body.innerHTML = `
          <p class="sub">Generated ${fmt(report.generatedAt)} for ${report.date}. Sent daily 08:00 to CVM and Trade.</p>
          <div class="stat-grid">
            <div class="card stat-card"><div class="num">${report.yesterday.scans}</div><div class="label">Scans (day)</div></div>
            <div class="card stat-card"><div class="num">${report.yesterday.spins}</div><div class="label">Spins (day)</div></div>
            <div class="card stat-card"><div class="num">${report.campaignToDate.scans}</div><div class="label">Scans (to date)</div></div>
            <div class="card stat-card"><div class="num">${report.campaignToDate.spins}</div><div class="label">Spins (to date)</div></div>
          </div>
          <h3>Top 10 outlets</h3><table class="dt"><thead><tr><th>Outlet</th><th>Spins</th></tr></thead><tbody>${topRows}</tbody></table>
          <h3>Bottom 10 outlets</h3><table class="dt"><thead><tr><th>Outlet</th><th>Spins</th></tr></thead><tbody>${bottomRows}</tbody></table>
          <button class="btn btn-sm" id="dl-daily">Download today's CSV export</button>
        `;
        const dl = body.querySelector('#dl-daily');
        if (dl) dl.addEventListener('click', async () => downloadText('daily-export.csv', await api('GET', '/api/admin/export/daily.csv')));
      } else if (r === 'fulfil') {
        const { report } = await api('GET', '/api/admin/reports/fulfilment');
        const openRows = report.openByTierAndAge.map((p) => `<tr class="${p.days > 5 ? 'stale' : ''}"><td>${p.ref}</td><td>${p.tier}</td><td>BWP ${p.value}</td><td>${p.status}</td><td>${p.days}</td></tr>`).join('');
        body.innerHTML = `
          <p class="sub">Generated ${fmt(report.generatedAt)} for ${report.date}. Sent daily 08:00 to CVM.</p>
          <h3>Open prizes by age</h3><table class="dt"><thead><tr><th>Ref</th><th>Tier</th><th>Value</th><th>Status</th><th>Days open</th></tr></thead><tbody>${openRows || '<tr><td colspan="5">None open</td></tr>'}</tbody></table>
          <h3>Fulfilled yesterday, by agent</h3><table class="dt"><thead><tr><th>Agent</th><th>Count</th></tr></thead><tbody>${Object.entries(report.fulfilledYesterdayByAgent).map(([a, c]) => `<tr><td>${esc(a)}</td><td>${c}</td></tr>`).join('') || '<tr><td colspan="2">None</td></tr>'}</tbody></table>
        `;
      } else if (r === 'outlet') {
        const { report } = await api('GET', '/api/admin/reports/outlet-performance');
        const rows = report.outlets.map((o) => `<tr class="${o.reBrief ? 'stale' : ''}"><td>${esc(o.name)}</td><td>${esc(o.town)}</td><td>${o.scans}</td><td>${o.failedChecks} (${o.failRatePct}%)</td><td>${o.spins}</td><td>${o.reBrief ? 'Re-brief' : ''}</td></tr>`).join('');
        body.innerHTML = `<p class="sub">Weekly, sent Mondays to Trade. Since ${fmt(report.since)}.</p><table class="dt"><thead><tr><th>Outlet</th><th>Town</th><th>Scans</th><th>Failed checks</th><th>Spins</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
      } else if (r === 'close') {
        const { report } = await api('GET', '/api/admin/reports/campaign-close');
        const tierRows = Object.values(report.tiersDrawnVsOdds).map((t) => `<tr><td>${t.label}</td><td>${Math.round(t.publishedOdds * 1000) / 10}%</td><td>${t.count}</td><td>${Math.round(t.observedShare * 1000) / 10}%</td></tr>`).join('');
        const signRows = report.signOffs.map((s) => `<tr><td>${fmt(s.ts)}</td><td>${esc(s.name)}</td><td>${esc(s.statement)}</td></tr>`).join('');
        const canSign = ['read_only', 'admin'].includes(user.role);
        body.innerHTML = `
          <p class="sub">For Internal Audit and the Gambling Authority. Due once, by 15 January 2027.</p>
          <div class="stat-grid">
            <div class="card stat-card"><div class="num">${report.totalSpins}</div><div class="label">Total spins</div></div>
            <div class="card stat-card"><div class="num">${report.awardedVsFulfilled.fulfilled}</div><div class="label">Fulfilled</div></div>
            <div class="card stat-card"><div class="num">${report.awardedVsFulfilled.unclaimed}</div><div class="label">Unclaimed</div></div>
            <div class="card stat-card"><div class="num">${report.awardedVsFulfilled.open}</div><div class="label">Still open</div></div>
          </div>
          <h3>Tiers drawn vs published odds</h3><table class="dt"><thead><tr><th>Prize</th><th>Published</th><th>Drawn</th><th>Observed</th></tr></thead><tbody>${tierRows}</tbody></table>
          <h3>Exceptions</h3>${renderExceptionList(report.exceptions)}
          <h3>Internal Audit sign-off</h3>
          <table class="dt"><thead><tr><th>Date</th><th>Signed by</th><th>Statement</th></tr></thead><tbody>${signRows || '<tr><td colspan="3">Not yet signed off</td></tr>'}</tbody></table>
          ${canSign ? `<div class="field" style="max-width:520px"><label>Sign-off statement</label><textarea class="bulk" id="signoff-text" style="min-height:70px">Tiers drawn match the published odds within tolerance. Reviewed and signed off.</textarea></div><button class="btn btn-primary btn-sm" id="signoff-btn">Record sign-off</button>` : ''}
        `;
        const signBtn = body.querySelector('#signoff-btn');
        if (signBtn) signBtn.addEventListener('click', async () => {
          await api('POST', '/api/admin/campaign-close/sign-off', { statement: body.querySelector('#signoff-text').value });
          show('close');
        });
      } else if (r === 'exceptions') {
        const { exceptions } = await api('GET', '/api/admin/exceptions');
        body.innerHTML = `<h3>Current exception alerts</h3>${renderExceptionList(exceptions)}`;
      }
    }

    function renderExceptionList(list) {
      if (!list.length) return `<ul class="alert-list empty"><li>No exceptions right now.</li></ul>`;
      return `<ul class="alert-list">${list.map((e) => `<li>${esc(e.message)}</li>`).join('')}</ul>`;
    }

    panel.querySelectorAll('#report-chips button').forEach((btn) =>
      btn.addEventListener('click', () => {
        panel.querySelectorAll('#report-chips button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        show(btn.dataset.r);
      })
    );
    show('daily');
  }

  // =========================================================================
  // outlets & QR
  // =========================================================================

  async function renderOutlets() {
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `<h2>Outlets &amp; QR links</h2><p class="sub">QR printing is out of scope for this app; these are the signed test links the QR codes should encode.</p><table class="dt" id="outlets-table"><thead><tr><th>Outlet</th><th>Town</th><th>Signed test link</th></tr></thead><tbody></tbody></table>`;
    mainEl.replaceChildren(panel);
    const resp = await api('GET', '/api/admin/outlets');
    panel.querySelector('tbody').innerHTML = resp.outlets
      .map((o) => `<tr><td>${esc(o.name)}</td><td>${esc(o.town)}</td><td><a href="${o.qrUrl}" target="_blank">${location.origin}${o.qrUrl}</a></td></tr>`)
      .join('');
  }

  // =========================================================================
  // SMS outbox
  // =========================================================================

  async function renderSms() {
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `<h2>SMS outbox</h2><p class="sub">Mock gateway — messages that a real SMS provider would have sent. See Open items: SMS gateway still to be confirmed.</p><table class="dt"><thead><tr><th>Time</th><th>To</th><th>Message</th><th>Ref</th></tr></thead><tbody id="sms-body"></tbody></table>`;
    mainEl.replaceChildren(panel);
    const resp = await api('GET', '/api/admin/sms-outbox');
    panel.querySelector('#sms-body').innerHTML = resp.messages
      .map((m) => `<tr><td>${fmt(m.ts)}</td><td>${esc(m.to)}</td><td>${esc(m.body)}</td><td>${m.ref || ''}</td></tr>`)
      .join('');
  }

  // =========================================================================
  // settings
  // =========================================================================

  async function renderSettings() {
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `<h2>Settings</h2><div id="settings-body">Loading…</div>`;
    mainEl.replaceChildren(panel);
    const { config, odds } = await api('GET', '/api/admin/config');
    const body = panel.querySelector('#settings-body');
    body.innerHTML = `
      <h3>Campaign dates</h3>
      <div class="toolbar">
        <div class="field"><label>Start</label><input type="datetime-local" id="s-start" value="${config.campaignStart.slice(0, 16)}"></div>
        <div class="field"><label>End</label><input type="datetime-local" id="s-end" value="${config.campaignEnd.slice(0, 16)}"></div>
        <button class="btn btn-sm" id="s-save-dates">Save</button>
      </div>

      <h3>Odds table (locked)</h3>
      <table class="dt"><thead><tr><th>Prize</th><th>Value</th><th>Odds</th></tr></thead><tbody>
        ${odds.map((o) => `<tr><td>${o.label}</td><td>BWP ${o.value}</td><td>${Math.round(o.odds * 1000) / 10}%</td></tr>`).join('')}
      </tbody></table>
      <p class="sub">Locked after launch — not editable from the back office, per the brief.</p>

      <h3>Customer-facing messages</h3>
      <div id="msg-fields"></div>
      <button class="btn btn-sm" id="s-save-messages">Save messages</button>

      <h3>Testing: simulated clock</h3>
      <p class="sub">UAT only. Set a date/time so testers can exercise the Dec 2026 campaign window before real launch. Leave blank to use the real clock in production.</p>
      <div class="toolbar">
        <div class="field"><label>Simulated "now"</label><input type="datetime-local" id="s-clock" value="${config.testClockOverride ? config.testClockOverride.slice(0, 16) : ''}"></div>
        <button class="btn btn-sm" id="s-save-clock">Apply</button>
        <button class="btn btn-sm" id="s-clear-clock">Use real clock</button>
      </div>
      <div id="settings-msg"></div>
    `;

    const msgFields = body.querySelector('#msg-fields');
    Object.entries(config.messages).forEach(([key, val]) => {
      const field = document.createElement('div');
      field.className = 'field';
      field.innerHTML = `<label>${key}</label><input type="text" data-msg="${key}" value="${esc(val)}" style="width:100%;padding:8px;border:1px solid var(--rule);border-radius:8px">`;
      msgFields.appendChild(field);
    });

    body.querySelector('#s-save-dates').addEventListener('click', async () => {
      await api('POST', '/api/admin/config', {
        campaignStart: new Date(body.querySelector('#s-start').value).toISOString(),
        campaignEnd: new Date(body.querySelector('#s-end').value).toISOString(),
      });
      body.querySelector('#settings-msg').innerHTML = `<div class="msg msg-success">Campaign dates saved.</div>`;
    });
    body.querySelector('#s-save-messages').addEventListener('click', async () => {
      const messages = {};
      msgFields.querySelectorAll('[data-msg]').forEach((inp) => (messages[inp.dataset.msg] = inp.value));
      await api('POST', '/api/admin/config', { messages });
      body.querySelector('#settings-msg').innerHTML = `<div class="msg msg-success">Messages saved.</div>`;
    });
    body.querySelector('#s-save-clock').addEventListener('click', async () => {
      const v = body.querySelector('#s-clock').value;
      await api('POST', '/api/admin/config', { testClockOverride: v ? new Date(v).toISOString() : null });
      body.querySelector('#settings-msg').innerHTML = `<div class="msg msg-success">Simulated clock applied.</div>`;
    });
    body.querySelector('#s-clear-clock').addEventListener('click', async () => {
      await api('POST', '/api/admin/config', { testClockOverride: null });
      body.querySelector('#s-clock').value = '';
      body.querySelector('#settings-msg').innerHTML = `<div class="msg msg-success">Using the real system clock.</div>`;
    });
  }

  // =========================================================================
  // audit log
  // =========================================================================

  async function renderAuditLog() {
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `<h2>Back-office audit log</h2><p class="sub">Every back-office action, append-only. Most recent first.</p><table class="dt"><thead><tr><th>Time</th><th>User</th><th>Role</th><th>Action</th><th>Detail</th></tr></thead><tbody id="audit-body"></tbody></table>`;
    mainEl.replaceChildren(panel);
    const resp = await api('GET', '/api/admin/audit-log');
    panel.querySelector('#audit-body').innerHTML = resp.log
      .map((e) => `<tr><td>${fmt(e.ts)}</td><td>${esc(e.user)}</td><td>${esc(e.role || '')}</td><td>${esc(e.action)}</td><td><code>${esc(JSON.stringify(e.detail || {}))}</code></td></tr>`)
      .join('');
  }

  // =========================================================================
  // auth / boot
  // =========================================================================

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const resp = await api('POST', '/api/admin/login', { username, password });
    const errEl = document.getElementById('login-error');
    if (!resp.ok) {
      errEl.hidden = false;
      errEl.textContent = resp.message;
      return;
    }
    errEl.hidden = true;
    enterShell(resp.user);
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await api('POST', '/api/admin/logout');
    location.reload();
  });

  function enterShell(u) {
    user = u;
    loginScreen.hidden = true;
    shell.hidden = false;
    whoamiEl.textContent = `${u.name} · ${u.role.replace('_', ' ')}`;
    buildNav();
    const first = TABS.find((t) => t.roles.includes(u.role));
    if (first) selectTab(first.key);
  }

  (async function boot() {
    const resp = await api('GET', '/api/admin/me');
    if (resp.ok) enterShell(resp.user);
  })();
})();
