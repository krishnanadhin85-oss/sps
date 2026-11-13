(window.GAMES = window.GAMES || {}).rps = {
  icon: '✊', name: 'Rock Paper Scissors', desc: 'First to win the most rounds',
  options: [{ key: 'best', label: 'Best of', values: [3, 5, 7] }],
  init: o => ({ best: +o.best || 3, sa: 0, sb: 0, round: 1 }),
  render(el, s, { me, names, up }) {
    const E = { r: '✊', p: '✋', s: '✌️' }, beats = { r: 's', s: 'p', p: 'r' };
    const pk = s.pick || {}, need = Math.ceil(s.best / 2), you = me, opp = me === 'a' ? 'b' : 'a';
    // host resolves the round once both have picked
    if (me === 'a' && pk.a && pk.b && !s.over) {
      const w = pk.a === pk.b ? 'd' : beats[pk.a] === pk.b ? 'a' : 'b';
      const sa = (s.sa || 0) + (w === 'a'), sb = (s.sb || 0) + (w === 'b');
      return up({ pick: null, last: { a: pk.a, b: pk.b, w }, sa, sb, round: s.round + 1, over: sa >= need ? 'a' : sb >= need ? 'b' : null });
    }
    const l = s.last;
    el.innerHTML = `<div class="score">${s['s' + you] || 0} – ${s['s' + opp] || 0}</div>
    <div class="note">Round ${s.round} · first to ${need}</div>
    ${l ? `<div class="big">${E[l[you]]} vs ${E[l[opp]]}</div><div class="note ${l.w === you ? 'win' : l.w === 'd' ? '' : 'lose'}">${l.w === 'd' ? 'Draw' : l.w === you ? 'You won that round' : names[opp] + ' won that round'}</div>` : ''}
    ${s.over ? `<div class="big ${s.over === you ? 'win' : 'lose'}">${s.over === you ? 'You win!' : names[opp] + ' wins'}</div><button id="rm">Play again</button>`
      : pk[you] ? `<div class="note">Waiting for ${names[opp]}…</div>`
      : `<div class="row">${Object.keys(E).map(k => `<button data-v="${k}" aria-label="${k}">${E[k]}</button>`).join('')}</div>`}`;
    bind(el, v => up({ ['pick/' + you]: v }));
    const rm = el.querySelector('#rm'); if (rm) rm.onclick = () => up({ sa: 0, sb: 0, round: 1, over: null, last: null, pick: null });
  }
};
