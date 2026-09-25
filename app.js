(() => {
  'use strict';

  const STORAGE_KEY = 'spin-wheel:v1';
  const DEFAULT_ENTRIES = ['Pizza', 'Sushi', 'Tacos', 'Burgers', 'Pasta', 'Salad', 'Curry', 'Ramen'];
  const PALETTE = ['#e6194b', '#f58231', '#ffe119', '#3cb44b', '#42d4f4', '#4363d8', '#911eb4', '#f032e6'];
  const TAU = Math.PI * 2;
  const POINTER_ANGLE = -Math.PI / 2; // pointer sits at 12 o'clock
  const MAX_HISTORY = 50;

  const $ = (id) => document.getElementById(id);
  const els = {
    wheel: $('wheel'),
    spinBtn: $('spin-btn'),
    result: $('result'),
    entries: $('entries'),
    count: $('count'),
    shuffleBtn: $('shuffle-btn'),
    sortBtn: $('sort-btn'),
    optSound: $('opt-sound'),
    optRemove: $('opt-remove'),
    optDuration: $('opt-duration'),
    historyList: $('history-list'),
    historyCount: $('history-count'),
    clearHistory: $('clear-history'),
    dialog: $('winner-dialog'),
    winnerName: $('winner-name'),
    removeWinner: $('remove-winner'),
    closeDialog: $('close-dialog'),
    confetti: $('confetti'),
    themeToggle: $('theme-toggle'),
  };

  const ctx = els.wheel.getContext('2d');

  let rotation = 0;       // current wheel rotation in radians
  let spinning = false;
  let lastWinnerIndex = -1;
  let history = [];

  // ---------- Persistence ----------

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved) {
        els.entries.value = Array.isArray(saved.entries) ? saved.entries.join('\n') : '';
        els.optSound.checked = saved.sound !== false;
        els.optRemove.checked = !!saved.remove;
        if (saved.duration) els.optDuration.value = String(saved.duration);
        history = Array.isArray(saved.history) ? saved.history.slice(0, MAX_HISTORY) : [];
        if (saved.theme) document.documentElement.dataset.theme = saved.theme;
        return;
      }
    } catch { /* storage unavailable or corrupt: fall through to defaults */ }
    els.entries.value = DEFAULT_ENTRIES.join('\n');
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        entries: getEntries(),
        sound: els.optSound.checked,
        remove: els.optRemove.checked,
        duration: Number(els.optDuration.value),
        history,
        theme: document.documentElement.dataset.theme || null,
      }));
    } catch { /* ignore */ }
  }

  // ---------- Entries ----------

  function getEntries() {
    return els.entries.value.split('\n').map((s) => s.trim()).filter(Boolean);
  }

  function setEntries(list) {
    els.entries.value = list.join('\n');
    onEntriesChanged();
  }

  function onEntriesChanged() {
    const n = getEntries().length;
    els.count.textContent = n;
    els.spinBtn.disabled = spinning || n === 0;
    draw();
    save();
  }

  function randomInt(max) {
    // Unbiased random integer in [0, max) using crypto when available.
    if (window.crypto && crypto.getRandomValues) {
      const limit = Math.floor(0x100000000 / max) * max;
      const buf = new Uint32Array(1);
      do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
      return buf[0] % max;
    }
    return Math.floor(Math.random() * max);
  }

  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ---------- Drawing ----------

  function segmentColor(i, n) {
    // Avoid the last slice matching the first when the palette wraps.
    if (n > 1 && i === n - 1 && (n - 1) % PALETTE.length === 0) return PALETTE[2];
    return PALETTE[i % PALETTE.length];
  }

  function textColorFor(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#1d1c1a' : '#ffffff';
  }

  function resizeCanvas() {
    const rect = els.wheel.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const size = Math.max(1, Math.round(rect.width * dpr));
    if (els.wheel.width !== size) {
      els.wheel.width = size;
      els.wheel.height = size;
    }
    draw();
  }

  function fitText(text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let lo = 0, hi = text.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (ctx.measureText(text.slice(0, mid) + '…').width <= maxWidth) lo = mid; else hi = mid - 1;
    }
    return text.slice(0, lo) + '…';
  }

  function draw() {
    const entries = getEntries();
    const size = els.wheel.width;
    const c = size / 2;
    const radius = c - size * 0.01;
    const n = entries.length;

    ctx.clearRect(0, 0, size, size);

    if (n === 0) {
      ctx.beginPath();
      ctx.arc(c, c, radius, 0, TAU);
      ctx.fillStyle = '#9a968e';
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `600 ${size * 0.045}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Add some entries', c, c + size * 0.18);
      return;
    }

    const slice = TAU / n;
    const fontSize = Math.max(size * 0.022, Math.min(size * 0.055, (size * 0.9) / n));
    ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';

    for (let i = 0; i < n; i++) {
      const start = rotation + i * slice;
      const color = segmentColor(i, n);

      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.arc(c, c, radius, start, start + slice);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      if (n > 1) {
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = Math.max(1, size * 0.003);
        ctx.stroke();
      }

      ctx.save();
      ctx.translate(c, c);
      ctx.rotate(start + slice / 2);
      ctx.fillStyle = textColorFor(color);
      const maxWidth = radius * 0.68;
      ctx.fillText(fitText(entries[i], maxWidth), radius * 0.92, 0);
      ctx.restore();
    }

    // Rim
    ctx.beginPath();
    ctx.arc(c, c, radius, 0, TAU);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = size * 0.008;
    ctx.stroke();
  }

  function indexAtPointer(rot, n) {
    const slice = TAU / n;
    const a = ((POINTER_ANGLE - rot) % TAU + TAU) % TAU;
    return Math.min(n - 1, Math.floor(a / slice));
  }

  // ---------- Sound ----------

  let audioCtx = null;
  function tick() {
    if (!els.optSound.checked) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const t = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1400, t);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.05);
    } catch { /* audio unavailable */ }
  }

  function fanfare() {
    if (!els.optSound.checked || !audioCtx) return;
    const t = audioCtx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.value = f;
      const s = t + i * 0.09;
      gain.gain.setValueAtTime(0.0001, s);
      gain.gain.exponentialRampToValueAtTime(0.08, s + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, s + 0.3);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(s);
      osc.stop(s + 0.32);
    });
  }

  // ---------- Spin ----------

  const easeOut = (t) => 1 - Math.pow(1 - t, 4);

  function spin() {
    const entries = getEntries();
    const n = entries.length;
    if (spinning || n === 0) return;

    spinning = true;
    els.spinBtn.disabled = true;
    els.wheel.classList.add('spinning');
    els.entries.disabled = true;
    els.shuffleBtn.disabled = true;
    els.sortBtn.disabled = true;
    els.result.textContent = '';

    // Choose the winner up front, then land on a random spot inside its slice.
    const slice = TAU / n;
    const winner = randomInt(n);
    const offset = (0.1 + Math.random() * 0.8) * slice;
    const duration = Number(els.optDuration.value) || 5500;
    const minTurns = Math.max(4, Math.round(duration / 1000));

    const base = POINTER_ANGLE - (winner * slice + offset);
    let target = base + TAU * Math.ceil((rotation - base) / TAU);
    target += minTurns * TAU;

    const from = rotation;
    const startTime = performance.now();
    let lastIdx = indexAtPointer(rotation, n);

    function frame(now) {
      const t = Math.min(1, (now - startTime) / duration);
      rotation = from + (target - from) * easeOut(t);
      draw();

      const idx = indexAtPointer(rotation, n);
      if (idx !== lastIdx) { lastIdx = idx; tick(); }

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        rotation %= TAU;
        finish(entries, winner);
      }
    }
    requestAnimationFrame(frame);
  }

  function finish(entries, winner) {
    spinning = false;
    els.wheel.classList.remove('spinning');
    els.entries.disabled = false;
    els.shuffleBtn.disabled = false;
    els.sortBtn.disabled = false;

    const name = entries[winner];
    lastWinnerIndex = winner;
    els.result.textContent = `🎉 ${name}`;

    history.unshift({ name, at: Date.now() });
    history = history.slice(0, MAX_HISTORY);
    renderHistory();

    if (els.optRemove.checked) {
      removeEntryAt(winner);
      els.removeWinner.hidden = true;
    } else {
      els.removeWinner.hidden = false;
      onEntriesChanged();
    }

    els.winnerName.textContent = name;
    els.dialog.showModal();
    fanfare();
    startConfetti();
  }

  function removeEntryAt(index) {
    const list = getEntries();
    if (index < 0 || index >= list.length) return;
    list.splice(index, 1);
    lastWinnerIndex = -1;
    setEntries(list);
  }

  // ---------- History ----------

  function renderHistory() {
    els.historyList.replaceChildren(...history.map((h) => {
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.textContent = h.name;
      const time = new Date(h.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      li.append(name, ` · ${time}`);
      return li;
    }));
    els.historyCount.textContent = history.length;
    els.clearHistory.disabled = history.length === 0;
  }

  // ---------- Confetti ----------

  let confettiRaf = 0;
  function startConfetti() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = els.confetti;
    const cctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    cctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const pieces = Array.from({ length: 160 }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 120,
      y: innerHeight * 0.45,
      vx: (Math.random() - 0.5) * 16,
      vy: -Math.random() * 16 - 6,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      rot: Math.random() * TAU,
      vr: (Math.random() - 0.5) * 0.4,
      color: PALETTE[randomInt(PALETTE.length)],
    }));

    cancelAnimationFrame(confettiRaf);
    const start = performance.now();
    function step(now) {
      cctx.clearRect(0, 0, innerWidth, innerHeight);
      let alive = false;
      for (const p of pieces) {
        p.vy += 0.4;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        if (p.y < innerHeight + 20) alive = true;
        cctx.save();
        cctx.translate(p.x, p.y);
        cctx.rotate(p.rot);
        cctx.fillStyle = p.color;
        cctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        cctx.restore();
      }
      if (alive && now - start < 5000) confettiRaf = requestAnimationFrame(step);
      else cctx.clearRect(0, 0, innerWidth, innerHeight);
    }
    confettiRaf = requestAnimationFrame(step);
  }

  function stopConfetti() {
    cancelAnimationFrame(confettiRaf);
    els.confetti.getContext('2d').clearRect(0, 0, els.confetti.width, els.confetti.height);
  }

  // ---------- Theme ----------

  function toggleTheme() {
    const root = document.documentElement;
    const current = root.dataset.theme
      || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    root.dataset.theme = current === 'dark' ? 'light' : 'dark';
    save();
  }

  // ---------- Events ----------

  els.spinBtn.addEventListener('click', spin);
  els.wheel.addEventListener('click', spin);
  els.entries.addEventListener('input', () => { lastWinnerIndex = -1; onEntriesChanged(); });
  els.shuffleBtn.addEventListener('click', () => setEntries(shuffle(getEntries())));
  els.sortBtn.addEventListener('click', () =>
    setEntries(getEntries().sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))));
  [els.optSound, els.optRemove, els.optDuration].forEach((el) => el.addEventListener('change', save));
  els.clearHistory.addEventListener('click', () => { history = []; renderHistory(); save(); });
  els.themeToggle.addEventListener('click', toggleTheme);

  els.closeDialog.addEventListener('click', () => els.dialog.close());
  els.removeWinner.addEventListener('click', () => {
    removeEntryAt(lastWinnerIndex);
    els.dialog.close();
  });
  els.dialog.addEventListener('close', stopConfetti);
  els.dialog.addEventListener('click', (e) => {
    const r = els.dialog.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside) els.dialog.close();
  });

  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || e.repeat || els.dialog.open) return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT' || tag === 'BUTTON') return;
    e.preventDefault();
    spin();
  });

  new ResizeObserver(resizeCanvas).observe(els.wheel);
  window.addEventListener('resize', resizeCanvas);

  // ---------- Init ----------

  load();
  renderHistory();
  onEntriesChanged();
  resizeCanvas();
})();
