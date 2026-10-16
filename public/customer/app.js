(() => {
  'use strict';

  const appEl = document.getElementById('app');
  const bannerEl = document.getElementById('test-clock-banner');
  const TAU = Math.PI * 2;
  const POINTER_ANGLE = -Math.PI / 2;
  const SEGMENT_COLORS = ['#0b2545', '#e9a020', '#2e6fb7', '#1e8449', '#c0392b'];

  const params = new URLSearchParams(location.search);
  let outletId = params.get('o');
  let outletSig = params.get('s');
  let resultRef = params.get('ref');

  let config = null;
  let outlet = null;
  let spinToken = sessionStorage.getItem('mcb_spin_token');

  function h(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function render(node) {
    appEl.replaceChildren(node);
  }

  async function api(method, path, body) {
    const res = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  }

  function setLang(lang) {
    window.currentLang = lang;
    localStorage.setItem('mcb_lang', lang);
  }
  document.getElementById('lang-toggle').addEventListener('click', () => {
    setLang(window.currentLang === 'en' ? 'tn' : 'en');
    renderCurrentView();
  });

  let currentView = 'loading';
  let currentData = {};
  function go(view, data) {
    currentView = view;
    currentData = data || {};
    renderCurrentView();
  }
  function renderCurrentView() {
    views[currentView](currentData);
  }

  // ---------------------------------------------------------------------
  // views
  // ---------------------------------------------------------------------

  const views = {
    loading() {
      render(h(`<div class="hero"><p>Loading…</p></div>`));
    },

    needQr() {
      render(
        h(`
        <div class="hero">
          <h1>${t('campaignTitle')}</h1>
          <div class="msg msg-info">${t('scanQrFirst')}</div>
        </div>
      `)
      );
    },

    landing() {
      const prizeRows = config.prizes
        .map(
          (p) => `
        <tr class="${p.tier === 'grand_2000' ? 'grand' : ''}">
          <td>${p.label}</td>
          <td>BWP ${p.value}</td>
          <td class="odds">${p.oddsPercent}%</td>
        </tr>`
        )
        .join('');

      const node = h(`
        <div class="hero">
          <h1>${t('campaignTitle')}</h1>
          <p class="tag">${t('campaignTag')}</p>
          <p class="msg msg-info">${outlet.name} · ${outlet.town}</p>
          <h3>${t('oddsHeading')}</h3>
          <table class="prize-table">
            <thead><tr><th>Prize</th><th>Value</th><th>Odds</th></tr></thead>
            <tbody>${prizeRows}</tbody>
          </table>
          <button class="btn btn-primary" id="start-btn" style="width:100%">${t('startBtn')}</button>
        </div>
      `);
      node.querySelector('#start-btn').addEventListener('click', () => go('form'));
      render(node);
    },

    form(data) {
      const node = h(`
        <div>
          <h1>${t('campaignTitle')}</h1>
          <div class="field">
            <label for="smartcard">${t('smartcardLabel')}</label>
            <input type="text" id="smartcard" inputmode="numeric" autocomplete="off" placeholder="e.g. 1234567890" value="${data.smartcard || ''}">
            <label class="field-file">
              <input type="file" id="card-photo" accept="image/*" capture="environment" hidden>
              📷 ${t('smartcardScan')}
            </label>
            <div id="card-photo-preview"></div>
          </div>
          <div class="field">
            <label for="mobile">${t('mobileLabel')}</label>
            <input type="tel" id="mobile" inputmode="tel" placeholder="7XXXXXXX" value="${data.mobile || ''}">
          </div>
          <label class="consent"><input type="checkbox" id="consent-age" ${data.consentAge ? 'checked' : ''}> ${t('consentAge')}</label>
          <label class="consent"><input type="checkbox" id="consent-terms" ${data.consentTerms ? 'checked' : ''}> ${t('consentTerms')}</label>
          <div id="form-msg"></div>
          <button class="btn btn-primary" id="submit-btn" style="width:100%">${t('detailsBtn')}</button>
        </div>
      `);

      node.querySelector('#card-photo').addEventListener('change', (e) => {
        const file = e.target.files[0];
        const preview = node.querySelector('#card-photo-preview');
        if (!file) {
          preview.textContent = '';
          return;
        }
        preview.textContent = `Photo attached: ${file.name} (for your reference — enter the number above)`;
      });

      node.querySelector('#submit-btn').addEventListener('click', async () => {
        const smartcard = node.querySelector('#smartcard').value.trim();
        const mobile = node.querySelector('#mobile').value.trim();
        const consentAge = node.querySelector('#consent-age').checked;
        const consentTerms = node.querySelector('#consent-terms').checked;
        const msgEl = node.querySelector('#form-msg');
        const btn = node.querySelector('#submit-btn');
        btn.disabled = true;
        btn.textContent = t('checking');
        msgEl.innerHTML = '';

        const resp = await api('POST', '/api/check', {
          smartcard,
          mobile,
          outletId,
          sig: outletSig,
          consentAge,
          consentTerms,
        });

        btn.disabled = false;
        btn.textContent = t('detailsBtn');

        if (!resp.ok) {
          const extra =
            resp.reason === 'already_spun' && resp.result
              ? `<div class="link-row"><button class="linklike" id="view-earlier">View my earlier result</button></div>`
              : '';
          msgEl.innerHTML = `<div class="msg msg-error">${resp.message}<br><small>${resp.nextStep || ''}</small></div>${extra}`;
          if (resp.reason === 'already_spun' && resp.result) {
            msgEl.querySelector('#view-earlier').addEventListener('click', () => {
              resultRef = resp.result.ref;
              showResult();
            });
          }
          return;
        }

        spinToken = resp.spinToken;
        sessionStorage.setItem('mcb_spin_token', spinToken);
        go('unlocked', { passMessage: resp.message });
      });

      render(node);
    },

    unlocked(data) {
      const node = h(`
        <div>
          <h1>${t('campaignTitle')}</h1>
          <div class="msg msg-success">${data.passMessage || t('youreIn')}</div>
          <div class="wheel-wrap">
            <div class="pointer"></div>
            <canvas id="wheel"></canvas>
            <button class="spin-fab" id="spin-btn">${t('spinBtn')}</button>
          </div>
          <table class="prize-table">
            <tbody>
              ${config.prizes
                .map(
                  (p, i) =>
                    `<tr><td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${SEGMENT_COLORS[i]};margin-right:6px"></span>${p.label}</td><td class="odds">${p.oddsPercent}%</td></tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `);

      const canvas = node.querySelector('#wheel');
      drawWheel(canvas, 0);

      node.querySelector('#spin-btn').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.textContent = '…';
        const resp = await api('POST', '/api/spin', { spinToken });
        if (!resp.ok) {
          btn.disabled = false;
          btn.textContent = t('spinBtn');
          node.insertAdjacentHTML('beforeend', `<div class="msg msg-error">${resp.message}</div>`);
          return;
        }
        animateWheel(canvas, resp, () => {
          resultRef = resp.ref;
          history.replaceState(null, '', `?ref=${encodeURIComponent(resp.ref)}`);
          sessionStorage.removeItem('mcb_spin_token');
          showResult();
        });
      });

      render(node);
    },

    result(data) {
      const node = h(`
        <div class="card result-card">
          <p class="pill pill-gold">${t('resultLead')}</p>
          <h2>${data.label}</h2>
          <p class="prize-value">BWP ${data.value}</p>
          <p>${t('resultSub')}</p>
          <p class="ref">${t('refLabel')}: <strong>${data.ref}</strong></p>
          <p class="pill ${statusPill(data.status)}">${data.status.replace('_', ' ')}</p>
          <div class="share-row">
            <a class="btn" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(
              'I just won a prize playing Spin the Wheel at a MultiChoice Botswana outlet! Reconnect your DStv and you could too. #MultiChoiceBotswana'
            )}">WhatsApp</a>
            <a class="btn" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
              location.origin
            )}&quote=${encodeURIComponent('I just won a prize playing Spin the Wheel at a MultiChoice Botswana outlet!')}">Facebook</a>
          </div>
          <div class="link-row"><a href="/customer/">${t('backToStart')}</a></div>
        </div>
      `);
      render(node);
    },
  };

  function statusPill(status) {
    if (status === 'fulfilled') return 'pill-green';
    if (status === 'unclaimed') return 'pill-red';
    if (status === 'in_progress') return 'pill-blue';
    return 'pill-muted';
  }

  async function showResult() {
    const resp = await api('GET', `/api/result/${encodeURIComponent(resultRef)}`);
    if (!resp.ok) {
      go('needQr');
      return;
    }
    go('result', resp);
  }

  // ---------------------------------------------------------------------
  // wheel drawing
  // ---------------------------------------------------------------------

  function wheelGeometry() {
    const total = config.prizes.reduce((s, p) => s + p.oddsPercent, 0);
    let acc = 0;
    return config.prizes.map((p, i) => {
      const size = (p.oddsPercent / total) * TAU;
      const start = acc;
      acc += size;
      return { ...p, start, size, color: SEGMENT_COLORS[i % SEGMENT_COLORS.length] };
    });
  }

  function drawWheel(canvas, rotation) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const size = Math.max(1, Math.round((rect.width || 300) * dpr));
    if (canvas.width !== size) {
      canvas.width = size;
      canvas.height = size;
    }
    const ctx = canvas.getContext('2d');
    const c = size / 2;
    const radius = c - size * 0.01;
    ctx.clearRect(0, 0, size, size);

    const segs = wheelGeometry();
    const fontSize = size * 0.04;
    ctx.font = `600 ${fontSize}px Calibri, Arial, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';

    segs.forEach((seg) => {
      const start = rotation + seg.start;
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.arc(c, c, radius, start, start + seg.size);
      ctx.closePath();
      ctx.fillStyle = seg.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = size * 0.004;
      ctx.stroke();

      ctx.save();
      ctx.translate(c, c);
      ctx.rotate(start + seg.size / 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`BWP ${seg.value}`, radius * 0.92, 0);
      ctx.restore();
    });

    ctx.beginPath();
    ctx.arc(c, c, radius, 0, TAU);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = size * 0.008;
    ctx.stroke();
  }

  const easeOut = (x) => 1 - Math.pow(1 - x, 4);

  function animateWheel(canvas, spinResult, done) {
    const segs = wheelGeometry();
    const winner = segs.find((s) => s.tier === spinResult.tier) || segs[0];
    const offset = winner.start + winner.size / 2;
    const base = POINTER_ANGLE - offset;
    const turns = 4;
    const target = base + TAU * turns;
    const duration = 3800 + Math.random() * 1000; // brief: animation runs 3-5s
    const start = performance.now();

    function frame(now) {
      const p = Math.min(1, (now - start) / duration);
      drawWheel(canvas, target * easeOut(p));
      if (p < 1) requestAnimationFrame(frame);
      else done();
    }
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------------
  // boot
  // ---------------------------------------------------------------------

  async function boot() {
    const cfgResp = await api('GET', '/api/config');
    config = cfgResp;
    if (config.campaign && config.campaign.testClockActive) {
      bannerEl.hidden = false;
      bannerEl.textContent = `TEST MODE — simulated time: ${new Date(config.campaign.now).toLocaleString('en-GB')} (set in the back office; off by default in production)`;
    }

    if (resultRef) {
      await showResult();
      return;
    }

    if (!outletId || !outletSig) {
      go('needQr');
      return;
    }

    const outletResp = await api('GET', `/api/outlet?o=${encodeURIComponent(outletId)}&s=${encodeURIComponent(outletSig)}`);
    if (!outletResp.ok) {
      go('needQr');
      return;
    }
    outlet = outletResp.outlet;

    if (spinToken) {
      go('unlocked', {});
      return;
    }

    go('landing');
  }

  boot();
})();
