'use strict';
const $ = s => document.querySelector(s), app = $('#app');
const C = { stone: ['✊', 'Stone'], paper: ['✋', 'Paper'], scissors: ['✌️', 'Scissors'] };
const beats = { stone: 'scissors', paper: 'stone', scissors: 'paper' };
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sha = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))]
  .map(b => b.toString(16).padStart(2, '0')).join('');
const rnd = n => [...crypto.getRandomValues(new Uint8Array(n))].map(b => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');

const DB = (typeof DB_URL === 'string' ? DB_URL : '').replace(/\/$/, '');
const ME = rnd(10);
let es = null, G = null, savedName = '', seen = new Set();

function lobby(err) {
  const pre = new URLSearchParams(location.search).get('g') || '';
  const notSet = !DB.startsWith('https://');
  app.innerHTML = `<div class="card">
    ${notSet ? '<p class="msg bad">Setup needed: open config.js and paste your Firebase database URL (see README).</p>' : ''}
    <label>Your name</label><input id="nm" maxlength="20" placeholder="Enter your name" value="${esc(savedName)}">
    <label>Target score (when creating a game)</label><input id="tg" type="number" min="1" max="50" value="3">
    <button class="p" id="mk">Create game</button>
    <p class="msg">or join a friend’s game</p>
    <label>Game code</label><input id="cd" maxlength="5" placeholder="e.g. k4m9x" value="${esc(pre)}">
    <button class="p" id="jn">Join game</button>
    ${err ? `<p class="msg bad">${esc(err)}</p>` : ''}</div>`;
  $('#mk').onclick = () => start(true);
  $('#jn').onclick = () => start(false);
}

const url = code => `${DB}/rooms/${code}/msgs.json`;
const send = m => fetch(url(G.code), { method: 'POST', body: JSON.stringify({ ...m, from: ME }) }).catch(() => {});

function cleanup() {
  if (es) es.close();
  es = null; G = null; seen = new Set();
}

async function start(host) {
  const name = $('#nm').value.trim();
  const tInput = parseInt($('#tg').value);
  if (!DB.startsWith('https://')) return lobby('Setup needed: add your Firebase URL in config.js.');
  if (!name) return lobby('Please type your name.');
  let code = host ? rnd(5) : $('#cd').value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (code.length < 3) return lobby('Please enter the game code.');
  savedName = name;
  cleanup();
  G = { name, code, host, target: host ? Math.max(1, Math.min(50, tInput || 3)) : null,
        oppId: null, oppName: null, r: 1, meS: 0, oppS: 0, pick: null, last: null, over: false,
        resolved: 0, oppCommit: {}, oppReveal: {}, status: 'Connecting…' };
  draw();
  try {
    for (let i = 0; host && i < 5; i++) {              // make sure the code is unused
      const ex = await (await fetch(url(G.code))).json();
      if (ex === null) break;
      G.code = code = rnd(5);
    }
    if (!host) {
      const ex = await (await fetch(url(code))).json();
      if (ex === null) { cleanup(); return lobby('Game not found. Check the code.'); }
    }
  } catch (e) { cleanup(); return lobby('Cannot reach the game server. Check your internet and config.js.'); }
  listen();
  send({ t: 'hello', name, target: host ? G.target : undefined });
  draw();
}

function listen() {
  es = new EventSource(url(G.code));
  const ingest = (k, v) => {
    if (seen.has(k)) return; seen.add(k);
    if (v && typeof v === 'object' && v.from !== ME) onMsg(v);
  };
  const handle = e => {
    let d; try { d = JSON.parse(e.data); } catch (x) { return; }
    if (!d || d.path == null) return;
    if (d.path === '/') { if (d.data && typeof d.data === 'object') for (const k in d.data) ingest(k, d.data[k]); }
    else { const p = d.path.split('/'); if (p.length === 2) ingest(p[1], d.data); }
  };
  es.addEventListener('put', handle);
  es.addEventListener('patch', handle);
  es.onerror = () => { if (es && es.readyState === 2 && G) { G.status = 'Connection lost.'; G.left = true; draw(); } };
}

function onMsg(m) {
  if (!G) return;
  if (m.t === 'hello') {
    if (G.oppId && G.oppId !== m.from) return;          // room already has two players
    G.oppId = m.from;
    G.oppName = String(m.name || 'Opponent').slice(0, 20);
    if (!G.host && Number.isInteger(m.target)) G.target = Math.max(1, Math.min(50, m.target));
    return check();
  }
  if (m.from !== G.oppId) return;
  if (m.t === 'commit' && Number.isInteger(m.r) && typeof m.h === 'string') G.oppCommit[m.r] = m.h;
  else if (m.t === 'reveal' && Number.isInteger(m.r) && beats[m.c] && typeof m.s === 'string') G.oppReveal[m.r] = { c: m.c, s: m.s };
  else if (m.t === 'bye') { G.left = true; return draw(); }
  check();
}

async function choose(c) {
  if (G.pick || G.over || !G.oppId) return;
  const salt = rnd(12);
  G.pick = { c, salt, revealed: false };
  draw();
  const h = await sha(c + ':' + salt);
  G.pick.h = h;
  send({ t: 'commit', r: G.r, h });
  check();
}

async function check() {
  if (!G || !G.pick || !G.pick.h) return draw();
  const r = G.r;
  if (!G.pick.revealed && G.oppCommit[r]) {       // both committed → reveal
    G.pick.revealed = true;
    send({ t: 'reveal', r, c: G.pick.c, s: G.pick.salt });
  }
  const rv = G.oppReveal[r];
  if (G.pick.revealed && rv && G.resolved < r) {
    G.resolved = r;                                // claim round before async verify
    const ok = (await sha(rv.c + ':' + rv.s)) === G.oppCommit[r];
    if (!ok) { G.status = 'Opponent sent an invalid move. Game stopped.'; G.over = true; G.cheat = true; return draw(); }
    const m = G.pick.c, t = rv.c;
    const res = m === t ? 'draw' : beats[m] === t ? 'win' : 'lose';
    if (res === 'win') G.meS++;
    if (res === 'lose') G.oppS++;
    G.last = { m, t, res };
    G.over = G.meS >= G.target || G.oppS >= G.target;
    if (!G.over) setTimeout(() => { if (G && G.r === r) { G.r++; G.pick = null; G.last = null; draw(); } }, 2500);
  }
  draw();
}

function again() { G.meS = 0; G.oppS = 0; G.over = false; G.last = null; G.pick = null; G.r++; draw(); }
function leave() {
  if (G) { send({ t: 'bye' }); if (G.host) fetch(`${DB}/rooms/${G.code}.json`, { method: 'DELETE' }).catch(() => {}); }
  cleanup(); history.replaceState(null, '', location.pathname); lobby();
addEventListener('pagehide', () => { if (G) fetch(url(G.code), { method: 'POST', body: JSON.stringify({ t: 'bye', from: ME }), keepalive: true }); });
}

function draw() {
  if (!G) return;
  const link = location.origin + location.pathname + '?g=' + G.code;
  let h = `<div class="card"><div class="score"><div><span id="n1"></span><b>${G.meS}</b></div>
    <div class="msg">vs</div><div><span id="n2"></span><b>${G.oppS}</b></div></div>
    <div class="tgt">First to ${G.target ?? '…'} wins · Code <span class="code">${esc(G.code)}</span></div></div>`;
  if (G.left) {
    h += `<div class="card msg bad">Your opponent left the game.</div>`;
  } else if (!G.oppName) {
    h += G.host
      ? `<div class="card msg">Waiting for your opponent…<br>Share the code <span class="code">${esc(G.code)}</span> or this link:
         <input id="lk" readonly value="${esc(link)}" style="margin-top:10px"><button class="s" id="cp">Copy link</button></div>`
      : `<div class="card msg">${esc(G.status)}</div>`;
  } else if (G.over) {
    const w = G.meS > G.oppS;
    h += G.cheat ? `<div class="card msg bad">${esc(G.status)}</div>` :
      `<div class="card res"><div class="big">${w ? '🏆' : '😔'}</div><b class="${w ? 'ok' : 'bad'}" id="win"></b><br>
       <span class="msg">Final round: ${C[G.last.m][0]} vs ${C[G.last.t][0]}</span>
       <button class="p" id="ag">Play again</button></div>`;
  } else {
    let st = 'Choose your move';
    if (G.last) st = G.last.res === 'draw' ? '🤝 Draw!' : G.last.res === 'win' ? '✅ You win this round' : '❌ You lose this round';
    else if (G.pick) st = 'Locked in. Waiting for opponent…';
    h += `<div class="card"><div class="res">${G.last ? `<div class="big">${C[G.last.m][0]} vs ${C[G.last.t][0]}</div>` : ''}${st}</div>
      <div class="picks">${Object.keys(C).map(k =>
        `<button data-k="${k}" class="${G.pick && G.pick.c === k ? 'sel' : ''}" ${G.pick ? 'disabled' : ''}>${C[k][0]}<small>${C[k][1]}</small></button>`).join('')}</div>
      <p class="tgt">Round ${G.r}</p></div>`;
  }
  h += `<button class="s" id="lv">Leave game</button>`;
  app.innerHTML = h;
  $('#n1').textContent = G.name + ' (you)';
  $('#n2').textContent = G.oppName || 'Opponent';
  if ($('#win')) $('#win').textContent = (G.meS > G.oppS ? G.name : G.oppName) + ' wins the match!';
  app.querySelectorAll('[data-k]').forEach(b => b.onclick = () => choose(b.dataset.k));
  if ($('#ag')) $('#ag').onclick = again;
  if ($('#cp')) $('#cp').onclick = () => { $('#lk').select(); navigator.clipboard && navigator.clipboard.writeText(link); };
  $('#lv').onclick = leave;
}

lobby();
addEventListener('pagehide', () => { if (G) fetch(url(G.code), { method: 'POST', body: JSON.stringify({ t: 'bye', from: ME }), keepalive: true }); });
