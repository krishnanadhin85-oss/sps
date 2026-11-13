// Shared part: home screen, rooms, joining. Each game lives in its own game-*.js file.
firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.database(), $ = s => document.querySelector(s), app = $('#app');
const GAMES = window.GAMES || {};
const P = new URLSearchParams(location.search);
let name = localStorage.getItem('name') || '';
const esc = t => String(t).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
window.bind = (el, fn) => el.querySelectorAll('[data-v]').forEach(b => b.onclick = () => fn(b.dataset.v));
const say = m => app.innerHTML = `<h2>${m}</h2><button onclick="location.href=location.pathname">Back to games</button>`;

function home() {
  app.innerHTML = `<h1>Game Room</h1>
  <input id="nm" placeholder="Your name" maxlength="14" value="${esc(name)}">
  <div class="cards">${Object.entries(GAMES).map(([id, g]) =>
    `<button class="card" data-g="${id}"><span>${g.icon}</span><b>${g.name}</b><small>${g.desc}</small></button>`).join('')}</div>`;
  app.querySelectorAll('.card').forEach(b => b.onclick = () => {
    name = $('#nm').value.trim(); if (!name) return $('#nm').focus();
    localStorage.setItem('name', name); setup(b.dataset.g);
  });
}

function setup(id) {
  const g = GAMES[id];
  app.innerHTML = `<h2>${g.icon} ${g.name}</h2>
  ${(g.options || []).map(o => `<label>${o.label}<select data-o="${o.key}">${o.values.map(v => `<option>${v}</option>`).join('')}</select></label>`).join('')}
  <button id="go">Create game</button><button class="ghost" id="back">Back</button>`;
  $('#back').onclick = home;
  $('#go').onclick = async () => {
    const opts = {}; app.querySelectorAll('[data-o]').forEach(s => opts[s.dataset.o] = s.value);
    const code = Math.random().toString(36).slice(2, 7).toUpperCase();
    await db.ref('rooms/' + code).set({ game: id, players: { a: name }, state: g.init(opts), t: Date.now() });
    sessionStorage['r' + code] = 'a';
    history.replaceState(0, '', `?g=${id}&r=${code}`); room(code);
  };
}

async function join(code) {
  const ref = db.ref('rooms/' + code), snap = await ref.get();
  if (!snap.exists()) return say('Room not found');
  if (sessionStorage['r' + code]) return room(code);
  if (!name) {
    app.innerHTML = `<h2>Join game</h2><input id="nm" placeholder="Your name" maxlength="14"><button id="go">Join</button>`;
    return $('#go').onclick = () => { name = $('#nm').value.trim(); if (!name) return; localStorage.setItem('name', name); join(code); };
  }
  const res = await ref.child('players/b').transaction(v => v === null ? name : undefined);
  if (!res.committed) return say('This room is full');
  sessionStorage['r' + code] = 'b'; room(code);
}

function room(code) {
  const ref = db.ref('rooms/' + code), me = sessionStorage['r' + code];
  ref.on('value', s => {
    const r = s.val(); if (!r) return say('Room closed');
    const g = GAMES[r.game], pl = r.players;
    if (!g) return say('Unknown game');
    if (!pl.b) {
      const link = location.origin + location.pathname + `?g=${r.game}&r=${code}`;
      app.innerHTML = `<h2>Waiting for your opponent…</h2><p>Send them this link:</p>
      <input readonly value="${link}" onclick="this.select()"><button id="cp">Copy link</button>`;
      return $('#cp').onclick = () => { navigator.clipboard.writeText(link); $('#cp').textContent = 'Copied'; };
    }
    app.innerHTML = `<div class="bar"><span>${g.icon} ${esc(pl.a)} vs ${esc(pl.b)}</span><a href="${location.pathname}">Home</a></div><div id="g"></div>`;
    g.render($('#g'), r.state || {}, { me, names: pl, up: o => ref.child('state').update(o) });
  });
}

const code = (P.get('r') || '').toUpperCase();
if (code) join(code); else home();
