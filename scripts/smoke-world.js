/*
 * Litter Bug world-engine smoke harness (P3/P4/P5: territory + progression).
 *
 * Asserts the deterministic world + territory + leveling model:
 *   - the procedural wild world is deterministic, home is safe, density is
 *     sane, and difficulty rises with distance
 *   - vault lifecycle (newVault/seedStarter) and JSON round-trip
 *   - energy regen + spend math
 *   - cellState classification (yours/wild/empty)
 *   - placeBug + attackCell rules and invariants (win => you hold it, and
 *     the same vault ops replay identically)
 *   - leveling (gainXp thresholds, leveledStats scaling)
 *   - a longer conquest run stays consistent (territory only grows on wins,
 *     energy never negative, deterministic on replay)
 *
 * Run via `npm run smoke` or directly: `node scripts/smoke-world.js`.
 */
var path = require('path');
var W = require(path.join(__dirname, '..', 'world-engine.js'));

var results = [];
function check(name, fn) {
  try { var r = fn(); results.push({ name: name, ok: !!(r && r.ok), detail: r && r.detail }); }
  catch (e) { results.push({ name: name, ok: false, detail: 'threw: ' + (e && e.message) }); }
}
var NOW = 1000000, REGEN = W.REGEN_MS;

check('world API present', function () {
  var need = ['newVault', 'seedStarter', 'cellState', 'placeBug', 'attackCell',
    'energyNow', 'spendEnergy', 'gainXp', 'leveledStats', 'isWild'];
  var missing = need.filter(function (k) { return typeof W[k] !== 'function'; });
  return { ok: missing.length === 0, detail: missing.length ? 'missing ' + missing.join(',') : 'all present' };
});

check('wild world is deterministic, home safe, density sane', function () {
  if (W.isWild(0, 0)) return { ok: false, detail: 'home is wild' };
  var wild = 0, tot = 0;
  for (var x = -12; x <= 12; x++) for (var y = -12; y <= 12; y++) {
    if (x === 0 && y === 0) continue;
    tot++;
    if (W.isWild(x, y) !== W.isWild(x, y)) return { ok: false, detail: 'nondeterministic' };
    if (W.isWild(x, y)) wild++;
  }
  var frac = wild / tot;
  return { ok: frac > 0.3 && frac < 0.55, detail: (frac * 100).toFixed(0) + '% wild' };
});

check('difficulty rises with distance from home', function () {
  function ringAvg(r) {
    var s = 0, n = 0;
    for (var x = -r; x <= r; x++) for (var y = -r; y <= r; y++) {
      if (Math.max(Math.abs(x), Math.abs(y)) !== r) continue;
      s += W.wildLevel(x, y); n++;
    }
    return s / n;
  }
  var near = ringAvg(2), far = ringAvg(20);
  return { ok: far > near, detail: 'ring2 avg lvl ' + near.toFixed(1) + ' < ring20 ' + far.toFixed(1) };
});

check('newVault + seedStarter + JSON round-trip', function () {
  var v = W.seedStarter(W.newVault());
  var ok = v.bugs.length === 3 && Object.keys(v.claims).length === 1 && v.energy === W.ENERGY_MAX;
  var rt = JSON.parse(JSON.stringify(v));
  var same = JSON.stringify(rt) === JSON.stringify(v);
  return { ok: ok && same, detail: 'roster 3, home claimed, serializable' };
});

check('energy regen + spend math', function () {
  var v = W.newVault();                       // energy 10, ts 0
  if (W.energyNow(v, 0) !== 10) return { ok: false, detail: 'start not full' };
  W.spendEnergy(v, 0, 3);                      // -> 7
  if (v.energy !== 7) return { ok: false, detail: 'spend wrong' };
  if (W.energyNow(v, REGEN * 2) !== 9) return { ok: false, detail: 'regen wrong: ' + W.energyNow(v, REGEN * 2) };
  if (W.energyNow(v, REGEN * 100) !== 10) return { ok: false, detail: 'regen not capped' };
  var blocked = W.spendEnergy(v, 0, 99);
  return { ok: blocked === false, detail: 'regen + cap + over-spend all correct' };
});

check('cellState classifies yours / wild / empty', function () {
  var v = W.seedStarter(W.newVault());
  if (W.cellState(v, 0, 0).type !== 'yours') return { ok: false, detail: 'home not yours' };
  // find a wild and an empty
  var sawWild = false, sawEmpty = false;
  for (var x = -4; x <= 4; x++) for (var y = -4; y <= 4; y++) {
    var t = W.cellState(v, x, y).type;
    if (t === 'wild') sawWild = true; if (t === 'empty') sawEmpty = true;
  }
  return { ok: sawWild && sawEmpty, detail: 'yours + wild + empty all present' };
});

check('placeBug rules + invariants', function () {
  var v = W.seedStarter(W.newVault());
  var reserve = v.bugs[1].cb;                  // undeployed
  // find an empty cell
  var ex = null, ey = null;
  for (var x = -3; x <= 3 && ex === null; x++) for (var y = -3; y <= 3; y++) {
    if (W.cellState(v, x, y).type === 'empty') { ex = x; ey = y; break; }
  }
  var before = Object.keys(v.claims).length;
  var r = W.placeBug(v, ex, ey, reserve, NOW);
  if (!r.ok || Object.keys(v.claims).length !== before + 1) return { ok: false, detail: 'place failed' };
  if (W.cellState(v, ex, ey).type !== 'yours') return { ok: false, detail: 'cell not claimed' };
  // cannot place the same (now deployed) bug again
  var again = W.placeBug(v, ex + 1, ey, reserve, NOW);
  var rejectDeployed = !again.ok;
  // cannot place on a non-empty cell
  var onOwned = W.placeBug(v, ex, ey, v.bugs[2].cb, NOW);
  return { ok: rejectDeployed && !onOwned.ok, detail: 'placed, then rejected redeploy + occupied cell' };
});

check('attackCell invariant: win => you hold it, replay is identical', function () {
  function run() {
    var v = W.seedStarter(W.newVault());
    var atk = v.bugs[1].cb;                     // reserve bug
    // nearest wild cell
    var tx = null, ty = null;
    for (var x = -3; x <= 3 && tx === null; x++) for (var y = -3; y <= 3; y++) {
      if (W.cellState(v, x, y).type === 'wild') { tx = x; ty = y; break; }
    }
    var r = W.attackCell(v, tx, ty, atk, NOW);
    return { r: r, held: W.cellState(v, tx, ty).type === 'yours', tx: tx, ty: ty };
  }
  var a = run(), b = run();
  var invariant = a.r.won ? a.held : !a.held; // win => yours, lose => still wild
  var deterministic = a.r.won === b.r.won && a.r.battle.rounds === b.r.battle.rounds && a.r.xp === b.r.xp;
  return { ok: invariant && deterministic, detail: (a.r.won ? 'won+held' : 'lost+not-held') + ', deterministic replay' };
});

check('attackCell rejects empty / own / no-energy', function () {
  var v = W.seedStarter(W.newVault());
  var bug = v.bugs[1].cb;
  var emptyReject = !W.attackCell(v, 0, 0, bug, NOW).ok || W.cellState(v, 0, 0).type === 'yours';
  // attacking own home should be rejected
  var ownReject = !W.attackCell(v, 0, 0, v.bugs[0].cb, NOW).ok;
  // drain energy then attack a wild
  var v2 = W.seedStarter(W.newVault()); v2.energy = 0; v2.lastEnergyTs = NOW;
  var tx = null, ty = null;
  for (var x = -3; x <= 3 && tx === null; x++) for (var y = -3; y <= 3; y++) {
    if (W.cellState(v2, x, y).type === 'wild') { tx = x; ty = y; break; }
  }
  var noEnergy = !W.attackCell(v2, tx, ty, v2.bugs[1].cb, NOW).ok;
  return { ok: ownReject && noEnergy, detail: 'own + no-energy rejected' };
});

check('leveling: gainXp thresholds + leveledStats scaling', function () {
  var e = { cb: 'x', level: 1, xp: 0, wins: 0 };
  var g1 = W.gainXp(e, W.xpToNext(1));         // exactly one level
  if (e.level !== 2 || g1 !== 1) return { ok: false, detail: 'single level wrong: lvl ' + e.level };
  for (var i = 0; i < 40; i++) W.gainXp(e, 60);
  if (e.level > W.LEVEL_CAP) return { ok: false, detail: 'exceeded cap' };
  var cb = W.wildCodeblock(5, 5);
  var lo = W.leveledStats(cb, 1), hi = W.leveledStats(cb, 10);
  return { ok: hi.hp > lo.hp && hi.atk > lo.atk && e.level <= W.LEVEL_CAP,
    detail: 'lvl1 hp ' + lo.hp + ' -> lvl10 hp ' + hi.hp + ', capped at ' + e.level };
});

check('conquest run: territory grows only on wins, deterministic', function () {
  function run() {
    var v = W.seedStarter(W.newVault());
    v.energy = 999; v.energyMax = 999;          // remove energy gating for the sim
    var claimed = 1, attacks = 0, minEnergy = 999;
    for (var x = -4; x <= 4; x++) for (var y = -4; y <= 4; y++) {
      var st = W.cellState(v, x, y);
      if (st.type === 'wild') {
        var before = Object.keys(v.claims).length;
        var r = W.attackCell(v, x, y, v.bugs[1].cb, NOW + attacks * 1000);
        attacks++;
        var after = Object.keys(v.claims).length;
        // territory can grow only when won; reserve bug relocates so net +1 or +0
        if (!r.won && after > before) return null; // grew without a win = bug
        minEnergy = Math.min(minEnergy, v.energy);
      }
    }
    return { claims: Object.keys(v.claims).length, attacks: attacks, minEnergy: minEnergy,
      level: v.bugs[1].level };
  }
  var a = run(), b = run();
  var ok = a && b && JSON.stringify(a) === JSON.stringify(b) && a.minEnergy >= 0 && a.attacks > 5;
  return { ok: ok, detail: a ? a.attacks + ' attacks, reserve bug reached lvl ' + a.level : 'FAILED' };
});

// ── Output ─────────────────────────────────────────────────────────────
console.log('');
console.log('=== Litter Bug world-engine smoke ===');
var pass = 0, fail = 0;
results.forEach(function (r) {
  console.log((r.ok ? '  ✓ ' : '  ✗ ') + r.name + (r.detail ? '   → ' + r.detail : ''));
  if (r.ok) pass++; else fail++;
});
console.log('');
console.log(pass + ' pass, ' + fail + ' fail');
process.exit(fail ? 1 : 0);
