/*
 * Litter Bug battle-engine smoke harness (P2: turn-based combat).
 *
 * Asserts the deterministic combat core:
 *   - buildFighter shape (4 moves, self-typed, full HP)
 *   - resolveBattle is deterministic (same pair => identical battle)
 *   - every battle TERMINATES with a valid winner and no negative HP
 *   - the interactive path (startBattle + playerRound) is deterministic too
 *   - the type system actually fires (super-effective hits happen)
 *   - a bad move index is handled, not a crash
 *
 * Loads battle-engine.js (which loads bug-engine.js) in Node. Run via
 * `npm run smoke` or directly: `node scripts/smoke-battle.js`.
 */
var path = require('path');
var crypto = require('crypto');
var B = require(path.join(__dirname, '..', 'battle-engine.js'));

function cb(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }

var results = [];
function check(name, fn) {
  try { var r = fn(); results.push({ name: name, ok: !!(r && r.ok), detail: r && r.detail }); }
  catch (e) { results.push({ name: name, ok: false, detail: 'threw: ' + (e && e.message) }); }
}

var A = cb('alpha'), C = cb('charlie');

check('battle API present', function () {
  var need = ['buildFighter', 'startBattle', 'playerRound', 'resolveBattle'];
  var missing = need.filter(function (k) { return typeof B[k] !== 'function'; });
  return { ok: missing.length === 0, detail: missing.length ? 'missing ' + missing.join(',') : 'all present' };
});

check('buildFighter: 4 self-typed moves, full HP', function () {
  var f = B.buildFighter(A);
  var ok = f.moves.length === 4 && f.hp === f.maxhp && f.hp > 0
    && f.moves.filter(function (m) { return m.kind === 'attack'; })
        .every(function (m) { return m.type === f.type; });
  return { ok: ok, detail: f.name + ' / ' + f.type + ' / ' + f.cls + ' / hp ' + f.maxhp };
});

check('resolveBattle is deterministic', function () {
  var r1 = JSON.stringify(B.resolveBattle(A, C));
  var r2 = JSON.stringify(B.resolveBattle(A, C));
  return { ok: r1 === r2, detail: r1 === r2 ? 'identical replay' : 'DIVERGED' };
});

check('every battle terminates with a valid winner (400 pairs)', function () {
  var bad = 0, maxRounds = 0;
  for (var i = 0; i < 400; i++) {
    var r = B.resolveBattle(cb('x' + i), cb('y' + i));
    maxRounds = Math.max(maxRounds, r.rounds);
    if ((r.winner !== 'a' && r.winner !== 'b') || r.rounds < 1 || r.rounds > 60
        || r.aHp < 0 || r.bHp < 0) bad++;
  }
  return { ok: bad === 0, detail: bad ? bad + ' malformed' : '400 clean, longest ' + maxRounds + ' rounds' };
});

check('winner is the one left standing (non-timeout battles)', function () {
  var bad = 0;
  for (var i = 0; i < 300; i++) {
    var r = B.resolveBattle(cb('w' + i), cb('z' + i));
    if (r.rounds < 60 && !r.draw) {   // draws (simultaneous KO) are allowed to have 0 HP
      var winHp = r.winner === 'a' ? r.aHp : r.bHp;
      var loseHp = r.winner === 'a' ? r.bHp : r.aHp;
      if (winHp <= 0 || loseHp > 0) bad++;
    }
  }
  return { ok: bad === 0, detail: bad ? bad + ' wrong winners' : 'winner standing, loser down' };
});

check('interactive playerRound is deterministic and terminates', function () {
  function play(seedPair) {
    var st = B.startBattle(seedPair[0], seedPair[1]), guard = 0;
    while (!st.over && guard++ < 100) B.playerRound(st, st.round % 4);
    return { winner: st.winner, round: st.round, aHp: st.a.hp, bHp: st.b.hp };
  }
  var p = [A, C];
  var r1 = JSON.stringify(play(p)), r2 = JSON.stringify(play(p));
  return { ok: r1 === r2 && JSON.parse(r1).round < 60, detail: r1 === r2 ? 'stable: ' + r1 : 'DIVERGED' };
});

check('type system fires (super-effective hits occur)', function () {
  var seen = 0;
  for (var i = 0; i < 200 && seen < 1; i++) {
    if (B.resolveBattle(cb('se' + i), cb('se2' + i)).log.some(function (l) { return /Super effective/.test(l); })) seen++;
  }
  return { ok: seen > 0, detail: seen ? 'super-effective hits present' : 'never triggered' };
});

check('a bad move index does not crash', function () {
  var st = B.startBattle(A, C);
  B.playerRound(st, 99);   // out of range -> falls back to move 0
  return { ok: st.round === 1 && (st.a.hp <= st.a.maxhp), detail: 'round advanced safely' };
});

// ── Output ─────────────────────────────────────────────────────────────
console.log('');
console.log('=== Litter Bug battle-engine smoke ===');
var pass = 0, fail = 0;
results.forEach(function (r) {
  console.log((r.ok ? '  ✓ ' : '  ✗ ') + r.name + (r.detail ? '   → ' + r.detail : ''));
  if (r.ok) pass++; else fail++;
});
console.log('');
console.log(pass + ' pass, ' + fail + ' fail');
process.exit(fail ? 1 : 0);
