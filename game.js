'use strict';
const $ = s => document.querySelector(s), app = $('#app');
const C = { stone: ['✊', 'Stone'], paper: ['✋', 'Paper'], scissors: ['✌️', 'Scissors'] };
const beats = { stone: 'scissors', paper: 'stone', scissors: 'paper' };
const PREFIX = 'spsgame-';           // namespace for peer IDs on the PeerJS cloud
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sha = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))]
  .map(b => b.toString(16).padStart(2, '0')).join('');
const rnd = n => [...crypto.getRandomValues(new Uint8Array(n))].map(b => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');

let peer = null, conn = null, G = null, savedName = '';

function lobby(err) {
  const pre = new URLSearchParams(location.search).get('g') || '';
  app.innerHTML = `<div class="card">
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

function cleanup() {
  if (conn) try { conn.close(); } catch (e) {}
  if (peer) try { peer.destroy(); } catch (e) {}
  conn = peer = G = null;
}

function start(host, retry = 0) {
  const name = $('#nm') ? $('#nm').value.trim() : savedName;
  const tInput = $('#tg') ? parseInt($('#tg').value) : 3;
  const code = host ? (G && G.code && retry ? rnd(5) : rnd(5))
                    : $('#cd').value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!name) return lobby('Please type your name.');
  if (code.length < 3) return lobby('Please enter the game code.');
  savedName = name;
  cleanup();
  G = { name, code, host, target: host ? Math.max(1, Math.min(50, tInput || 3)) : null,
        oppName: null, r: 1, meS: 0, oppS: 0, pick: null, last: null, over: false,
        resolved: 0, oppCommit: {}, oppReveal: {}, status: 'Connecting…' };
  draw();
  peer = host ? new Peer(PREFIX + code) : new Peer();
  peer.on('open', () => {
    if (host) { G.status = 'waiting'; draw(); }
    else { setup(peer.connect(PREFIX + code, { reliable: true })); }
  });
  peer.on('connection', c => {                    // host side
    if (conn) { c.on('open', () => c.close()); return; }   // room is full
    setup(c);
  });
  peer.on('error', e => {
    if (e.type === 'unavailable-id' && host && retry < 3) return start(true, retry + 1);
    const m = e.type === 'peer-unavailable' ? 'Game not found. Check the code.' :
              'Connection problem (' + e.type + '). Please try again.';
    cleanup(); lobby(m);
  });
}

function setup(c) {
  conn = c;
  const hello = () => c.send({ t: 'hello', name: G.name, target: G.host ? G.target : undefined });
  if (c.open) hello(); else c.on('open', hello);
  c.on('data', onMsg);
  c.on('close', () => { if (G) { G.left = true; draw(); } });
}

function onMsg(m) {
  if (!G || !m || typeof m !== 'object') return;
  if (m.t === 'hello') {
    G.oppName = String(m.name || 'Opponent').slice(0, 20);
    if (!G.host && Number.isInteger(m.target)) G.target = Math.max(1, Math.min(50, m.target));
  } else if (m.t === 'commit' && Number.isInteger(m.r) && typeof m.h === 'string') {
    G.oppCommit[m.r] = m.h;
  } else if (m.t === 'reveal' && Number.isInteger(m.r) && beats[m.c] && typeof m.s === 'string') {
    G.oppReveal[m.r] = { c: m.c, s: m.s };
  }
  check();
}

async function choose(c) {
  if (G.pick || G.over || !conn) return;
  const salt = rnd(12);
  G.pick = { c, salt, revealed: false };
  draw();
  const h = await sha(c + ':' + salt);
  G.pick.h = h;
  conn.send({ t: 'commit', r: G.r, h });
  check();
}

async function check() {
  if (!G || !G.pick || !G.pick.h) return draw();
  const r = G.r;
  if (!G.pick.revealed && G.oppCommit[r]) {       // both committed → reveal
    G.pick.revealed = true;
    conn.send({ t: 'reveal', r, c: G.pick.c, s: G.pick.salt });
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
function leave() { cleanup(); history.replaceState(null, '', location.pathname); lobby(); }

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
