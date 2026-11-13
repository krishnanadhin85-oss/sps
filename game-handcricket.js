// Odd or Even (Hand Cricket): toss with odd/even, then bat/bowl with numbers 1-6. Same number = out.
(window.GAMES = window.GAMES || {}).handcricket = {
  icon: '🏏', name: 'Odd or Even (Hand Cricket)', desc: 'Toss, bat, bowl. Match the number and you are out',
  options: [{ key: 'wk', label: 'Wickets per innings', values: [1, 2, 3] }],
  init: o => ({ wk: +o.wk || 1, phase: 'call', r1: 0, r2: 0, out: 0, inn: 1 }),
  render(el, s, { me, names, up }) {
    const opp = me === 'a' ? 'b' : 'a', o = x => x === 'a' ? 'b' : 'a', pk = s.pick || {}, nm = x => x === me ? 'You' : names[x];
    const nums = `<div class="row" style="flex-wrap:wrap">${[1,2,3,4,5,6].map(n => `<button style="flex:1 0 28%" data-v="${n}">${n}</button>`).join('')}</div>`;
    const wait = t => `<div class="note">${t}</div>`;
    let h = '';
    if (me === 'a' && s.phase === 'toss' && pk.a && pk.b) { // host resolves toss
      const par = (+pk.a + +pk.b) % 2 ? 'odd' : 'even', tw = par === s.call ? 'a' : 'b';
      return up({ pick: null, tossNums: { a: pk.a, b: pk.b }, tw, phase: 'choose' });
    }
    if (me === 'a' && s.phase === 'play' && pk.a && pk.b) { // host resolves a ball
      const bt = s.batter, bw = o(bt), bn = +pk[bt], wn = +pk[bw], out = bn === wn;
      const u = { pick: null, last: { bn, wn, out, bt } };
      if (out) {
        u.out = (s.out || 0) + 1;
        if (u.out >= s.wk) {
          if (s.inn === 1) Object.assign(u, { inn: 2, out: 0, batter: bw, target: (s.r1 || 0) + 1 });
          else Object.assign(u, { phase: 'over', winner: bw });
        }
      } else {
        const k = 'r' + s.inn; u[k] = (s[k] || 0) + bn;
        if (s.inn === 2 && u[k] >= s.target) Object.assign(u, { phase: 'over', winner: bt });
      }
      return up(u);
    }
    if (s.phase === 'call') {
      h = me === 'a' ? `<h2>Toss: call it</h2><div class="row"><button data-v="odd">Odd</button><button data-v="even">Even</button></div>`
        : wait(`${names.a} is calling the toss…`);
    } else if (s.phase === 'toss') {
      h = `<h2>Toss</h2>${wait(`${nm('a')} called ${s.call}. Both pick a number; the sum decides.`)}` + (pk[me] ? wait(`Waiting for ${names[opp]}…`) : nums);
    } else if (s.phase === 'choose') {
      const t = s.tossNums;
      h = `<div class="note">Toss: ${t.a} + ${t.b} = ${+t.a + +t.b}</div><h2>${nm(s.tw)} won the toss</h2>` +
        (s.tw === me ? `<div class="row"><button data-v="bat">Bat</button><button data-v="bowl">Bowl</button></div>` : wait('Choosing bat or bowl…'));
    } else if (s.phase === 'play') {
      const bt = s.batter, l = s.last;
      h = `<div class="score">${s.r1 || 0}${s.inn === 2 ? ` → chasing ${s.target}: ${s.r2 || 0}` : ''}</div>
      <div class="note">Innings ${s.inn} · ${nm(bt)} batting · wickets ${s.out || 0}/${s.wk}</div>
      ${l ? `<div class="big">${l.bn} vs ${l.wn}</div><div class="note ${l.out ? 'lose' : 'win'}">${l.out ? 'OUT!' : l.bn + ' runs'}</div>` : ''}
      <h2>${bt === me ? 'You bat: pick 1–6' : 'You bowl: pick 1–6'}</h2>` + (pk[me] ? wait(`Waiting for ${names[opp]}…`) : nums);
    } else if (s.phase === 'over') {
      h = `<div class="score">${s.r1} vs ${s.r2}</div><div class="big ${s.winner === me ? 'win' : 'lose'}">${s.winner === me ? 'You win!' : names[s.winner] + ' wins'}</div><button id="rm">Play again</button>`;
    }
    el.innerHTML = h;
    bind(el, v => {
      if (s.phase === 'call') up({ call: v, phase: 'toss' });
      else if (s.phase === 'choose') up({ batter: v === 'bat' ? me : opp, phase: 'play' });
      else up({ ['pick/' + me]: v });
    });
    const rm = el.querySelector('#rm');
    if (rm) rm.onclick = () => up({ phase: 'call', call: null, r1: 0, r2: 0, out: 0, inn: 1, batter: null, target: null, last: null, pick: null, winner: null, tw: null, tossNums: null });
  }
};
