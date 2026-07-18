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
var E = require(path.join(__dirname, '..', 'bug-engine.js'));

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

check('buildFighter: 4 moves, >=2 self + 1 coverage, full HP', function () {
  var bad = 0, sawCover = false;
  for (var i = 0; i < 80; i++) {
    var f = B.buildFighter(cb('kit' + i), 5);
    var atk = f.moves.filter(function (m) { return m.kind === 'attack'; });
    var selfT = atk.filter(function (m) { return m.type === f.type; }).length;
    var cover = atk.filter(function (m) { return m.type !== f.type; }).length; // off-primary
    if (f.moves.length !== 4 || f.hp !== f.maxhp || selfT < 2 || cover < 1) bad++;
    if (cover >= 1) sawCover = true;
  }
  return { ok: bad === 0 && sawCover, detail: bad ? bad + ' malformed kits' : '>=2 self + coverage on all' };
});

check('dual-typing yields the {0.39..2.56} effectiveness band', function () {
  var seen = {};
  for (var i = 0; i < 400; i++) {
    var s = E.bugStats(cb('dt' + i));
    for (var k = 0; k < E.TYPES.length; k++) seen[E.typeMatchupDual(E.TYPES[k], s.type, s.type2).toFixed(3)] = 1;
  }
  var vals = Object.keys(seen).sort();
  var ok = vals.indexOf('0.391') >= 0 && vals.indexOf('2.560') >= 0 && vals.indexOf('1.000') >= 0;
  return { ok: ok, detail: vals.join(' ') };
});

check('STAB: bugs get a same-type bonus flag on their own-type attacks', function () {
  var bad = 0;
  for (var i = 0; i < 60; i++) {
    var f = B.buildFighter(cb('stab' + i), 3);
    var selfAtk = f.moves.filter(function (m) { return m.kind === 'attack' && m.type === f.type; });
    if (!selfAtk.every(function (m) { return m.stab === true; })) bad++;
  }
  return { ok: bad === 0, detail: bad ? bad + ' missing STAB' : 'own-type attacks flagged STAB' };
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

check('arg-order symmetry: resolveBattle(A,B) agrees with (B,A)', function () {
  var bad = 0;
  for (var i = 0; i < 200; i++) {
    var x = cb('sym' + i), y = cb('sym2' + i);
    var ab = B.resolveBattle(x, y, 5, 5), ba = B.resolveBattle(y, x, 5, 5);
    if (ab.draw !== ba.draw) { bad++; continue; }
    var w1 = ab.winner === 'a' ? ab.aName : ab.bName;
    var w2 = ba.winner === 'a' ? ba.aName : ba.bName;
    if (!ab.draw && w1 !== w2) bad++;   // same bug wins regardless of arg order
  }
  return { ok: bad === 0, detail: bad ? bad + ' order-dependent' : 'winner independent of arg order' };
});

check('previewFoeMove is deterministic and drives the foe (telegraph)', function () {
  var bad = 0;
  for (var i = 0; i < 80; i++) {
    var st = B.startBattle(cb('pf' + i), cb('pf2' + i), 4, 4);
    var p1 = B.previewFoeMove(st), p2 = B.previewFoeMove(st);
    if (p1 !== p2 || st.b.moves.indexOf(p1) < 0) { bad++; continue; }
    B.playerRound(st, 0);
    if (!(st.events || []).some(function (e) { return e.side === 'b' || e.by === 'b'; })) bad++;
  }
  return { ok: bad === 0, detail: bad ? bad + ' mismatches' : 'stable telegraph, foe acted (80 battles)' };
});

check('resolveRound emits a structured event stream', function () {
  var st = B.startBattle(cb('ev1'), cb('ev2'), 4, 4), rounds = 0, sawHit = false, bad = 0;
  var kinds = ['hit', 'miss', 'status', 'dot', 'skip', 'ko', 'break'];
  while (!st.over && rounds < 60) {
    B.playerRound(st, rounds % 4); rounds++;
    if (!Array.isArray(st.events)) { bad++; break; }
    st.events.forEach(function (e) {
      if (kinds.indexOf(e.kind) < 0) bad++;
      if (e.kind === 'hit') { sawHit = true; if (typeof e.dmg !== 'number' || typeof e.hpAfter !== 'number') bad++; }
    });
  }
  return { ok: bad === 0 && sawHit, detail: bad ? bad + ' bad events' : 'valid events incl. hit dmg/hpAfter' };
});

check('poise stays in [0, poiseMax] and a broken bug never double-skips', function () {
  var bad = 0;
  function bestIdx(self, foe) {
    var bi = 0, bs = -1;
    self.moves.forEach(function (m, i) {
      var s = m.kind === 'attack' ? m.pow * (m.multi || 1) * E.typeMatchupDual(m.type, foe.type, foe.type2) * (m.stab ? 1.4 : 1) : 0.3;
      if (s > bs) { bs = s; bi = i; }
    });
    return bi;
  }
  for (var i = 0; i < 200; i++) {
    var st = B.startBattle(cb('po' + i), cb('po2' + i), 12, 12), g = 0, prevSkip = { a: false, b: false };
    if (st.a.poise !== st.a.poiseMax || st.b.poise !== st.b.poiseMax) bad++;
    while (!st.over && g++ < 100) {
      B.playerRound(st, bestIdx(st.a, st.b));
      if (st.a.poise < 0 || st.a.poise > st.a.poiseMax || st.b.poise < 0 || st.b.poise > st.b.poiseMax) bad++;
      var skipThis = { a: false, b: false };
      (st.events || []).forEach(function (e) { if (e.kind === 'skip' && e.reason === 'break') skipThis[e.side] = true; });
      // a break-skip must not repeat for the same side on consecutive rounds (guard reforms)
      if (skipThis.a && prevSkip.a) bad++;
      if (skipThis.b && prevSkip.b) bad++;
      prevSkip = skipThis;
    }
  }
  return { ok: bad === 0, detail: bad ? bad + ' poise violations' : 'poise bounded, no double-break-skip (200 battles)' };
});

check('Poise/Break mechanic is live (breaks occur under type-focused play)', function () {
  function bestIdx(self, foe) {
    var bi = 0, bs = -1;
    self.moves.forEach(function (m, i) {
      var s = m.kind === 'attack' ? m.pow * (m.multi || 1) * E.typeMatchupDual(m.type, foe.type, foe.type2) * (m.stab ? 1.4 : 1) : 0.3;
      if (s > bs) { bs = s; bi = i; }
    });
    return bi;
  }
  var breaks = 0, followSkips = 0;
  for (var i = 0; i < 300; i++) {
    var st = B.startBattle(cb('br' + i), cb('br2' + i), 12, 12), g = 0, pendBreak = {};
    while (!st.over && g++ < 100) {
      B.playerRound(st, bestIdx(st.a, st.b));
      (st.events || []).forEach(function (e) {
        if (e.kind === 'break') { breaks++; pendBreak[e.side] = true; }
        if (e.kind === 'skip' && e.reason === 'break') { followSkips++; }
      });
    }
  }
  // breaks must happen, and skips of reason 'break' must also occur (the payoff lands)
  return { ok: breaks > 0 && followSkips > 0, detail: breaks + ' breaks, ' + followSkips + ' break-skips over 300 battles' };
});

check('Poise/Break preserves determinism (identical poise trace on replay)', function () {
  function trace(x, y) {
    var st = B.startBattle(x, y, 12, 12), out = [], g = 0;
    while (!st.over && g++ < 100) { B.playerRound(st, 0); out.push(st.a.poise + ':' + st.b.poise + ':' + (st.a.broken ? 1 : 0) + (st.b.broken ? 1 : 0)); }
    return out.join('|');
  }
  var bad = 0;
  for (var i = 0; i < 60; i++) {
    var x = cb('pd' + i), y = cb('pd2' + i);
    if (trace(x, y) !== trace(x, y)) bad++;
  }
  return { ok: bad === 0, detail: bad ? bad + ' non-deterministic' : 'poise trace stable across 60 replays' };
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
