/*
 * Litter Bug battle-stats smoke harness (P1: bugs as fighters).
 *
 * Covers bugStats + the type chart in bug-engine.js:
 *   - determinism (same codeblock => same fighter profile)
 *   - shape + ranges (6 stats, valid type/class/rarity, positive power)
 *   - type chart integrity (each type strong vs 2 / weak vs 2, reciprocal,
 *     self-neutral; multipliers 2 / 1 / 0.5)
 *   - design intent (winged bugs are faster than grounded on average)
 *   - rarity is DECOUPLED from power (a common can out-power a legendary)
 *   - variety (all types + classes appear across many bugs)
 *
 * Run via `npm run smoke` or directly: `node scripts/smoke-stats.js`.
 */
var path = require('path');
var crypto = require('crypto');
var E = require(path.join(__dirname, '..', 'bug-engine.js'));

function cb(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }

var results = [];
function check(name, fn) {
  try { var r = fn(); results.push({ name: name, ok: !!(r && r.ok), detail: r && r.detail }); }
  catch (e) { results.push({ name: name, ok: false, detail: 'threw: ' + (e && e.message) }); }
}

var STAT_KEYS = ['hp', 'atk', 'def', 'spd', 'acc', 'eva'];
var C0 = cb('alpha');

check('battle API present', function () {
  var need = ['TYPES', 'TYPE_CHART', 'typeMatchup', 'CLASSES', 'bugStats'];
  var missing = need.filter(function (k) { return E[k] === undefined; });
  return { ok: missing.length === 0, detail: missing.length ? 'missing ' + missing.join(',') : 'all present' };
});

check('bugStats is deterministic', function () {
  return { ok: JSON.stringify(E.bugStats(C0)) === JSON.stringify(E.bugStats(C0)),
           detail: E.bugStats(C0).type + '/' + E.bugStats(C0).cls };
});

check('stats block has all 6 keys as sane integers', function () {
  var bad = 0, lo = 999, hi = 0;
  for (var i = 0; i < 200; i++) {
    var s = E.bugStats(cb('r' + i)).stats;
    STAT_KEYS.forEach(function (k) {
      var v = s[k];
      if (!Number.isInteger(v) || v < 1 || v > 200) bad++;
      lo = Math.min(lo, v); hi = Math.max(hi, v);
    });
  }
  return { ok: bad === 0, detail: bad ? bad + ' out of range' : 'all in [' + lo + ',' + hi + ']' };
});

check('type / class / rarity / power are valid', function () {
  var clsNames = E.CLASSES.map(function (c) { return c.name; });
  var rarities = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
  var bad = 0;
  for (var i = 0; i < 300; i++) {
    var b = E.bugStats(cb('v' + i));
    if (E.TYPES.indexOf(b.type) < 0) bad++;
    if (clsNames.indexOf(b.cls) < 0) bad++;
    if (rarities.indexOf(b.rarity) < 0) bad++;
    if (!(b.power > 0)) bad++;
  }
  return { ok: bad === 0, detail: bad ? bad + ' invalid' : 'clean across 300' };
});

check('type chart is balanced and reciprocal', function () {
  var bad = 0;
  E.TYPES.forEach(function (a) {
    var c = E.TYPE_CHART[a];
    if (!c || c.strong.length !== 2 || c.weak.length !== 2) { bad++; return; }
    if (E.typeMatchup(a, a) !== 1) bad++;                 // no self super-effective
    c.strong.forEach(function (d) {
      if (E.typeMatchup(a, d) !== 1.6) bad++;               // strong => x2
      if (E.TYPE_CHART[d].weak.indexOf(a) < 0) bad++;     // reciprocal
    });
    c.weak.forEach(function (d) { if (E.typeMatchup(a, d) !== 0.625) bad++; }); // weak => x0.5
  });
  return { ok: bad === 0, detail: bad ? bad + ' chart issues' : 'all ' + E.TYPES.length + ' types balanced' };
});

check('winged bugs are faster than grounded (design intent)', function () {
  var ws = 0, wn = 0, gs = 0, gn = 0;
  for (var i = 0; i < 600; i++) {
    var b = E.bugStats(cb('spd' + i));
    if (b.tags.indexOf('Flying') >= 0) { ws += b.stats.spd; wn++; } else { gs += b.stats.spd; gn++; }
  }
  var wa = ws / wn, ga = gs / gn;
  return { ok: wa > ga, detail: 'winged avg SPD ' + wa.toFixed(1) + ' > grounded ' + ga.toFixed(1) };
});

check('rarity is decoupled from power (common can out-power legendary)', function () {
  var maxCommon = 0, minLegendary = 1e9, sawLeg = false;
  for (var i = 0; i < 3000; i++) {
    var b = E.bugStats(cb('d' + i));
    if (b.rarity === 'Common') maxCommon = Math.max(maxCommon, b.power);
    if (b.rarity === 'Legendary') { minLegendary = Math.min(minLegendary, b.power); sawLeg = true; }
  }
  return { ok: sawLeg && maxCommon >= minLegendary,
           detail: 'best common ' + maxCommon + ' vs weakest legendary ' + (sawLeg ? minLegendary : 'none') };
});

check('variety: all types and classes appear', function () {
  var T = {}, C = {};
  for (var i = 0; i < 2000; i++) { var b = E.bugStats(cb('var' + i)); T[b.type] = 1; C[b.cls] = 1; }
  var nt = Object.keys(T).length, nc = Object.keys(C).length;
  return { ok: nt === E.TYPES.length && nc === E.CLASSES.length,
           detail: nt + '/' + E.TYPES.length + ' types, ' + nc + '/' + E.CLASSES.length + ' classes' };
});

check('dual-typing: type2 is a valid type or null, ~35-40% mono', function () {
  var mono = 0, bad = 0;
  for (var i = 0; i < 3000; i++) {
    var s = E.bugStats(cb('dual' + i));
    if (s.type2 === null) mono++;
    else if (E.TYPES.indexOf(s.type2) < 0 || s.type2 === s.type) bad++;
  }
  var frac = mono / 3000;
  return { ok: bad === 0 && frac > 0.3 && frac < 0.45,
    detail: bad ? bad + ' bad secondaries' : (frac * 100).toFixed(0) + '% mono, rest valid dual' };
});

check('nature: valid up/down stat or neutral', function () {
  var keys = STAT_KEYS.concat([null]), bad = 0, neutral = 0;
  for (var i = 0; i < 600; i++) {
    var n = E.bugStats(cb('nat' + i)).nature;
    if (!n || keys.indexOf(n.up) < 0 || keys.indexOf(n.down) < 0) bad++;
    if (n && n.up === null) neutral++;
    if (n && n.up !== null && n.up === n.down) bad++;   // up==down should be neutral
  }
  return { ok: bad === 0, detail: bad ? bad + ' bad natures' : (neutral / 600 * 100).toFixed(0) + '% neutral, rest valid' };
});

// ── Output ─────────────────────────────────────────────────────────────
console.log('');
console.log('=== Litter Bug battle-stats smoke ===');
var pass = 0, fail = 0;
results.forEach(function (r) {
  console.log((r.ok ? '  ✓ ' : '  ✗ ') + r.name + (r.detail ? '   → ' + r.detail : ''));
  if (r.ok) pass++; else fail++;
});
console.log('');
console.log(pass + ' pass, ' + fail + ' fail');
process.exit(fail ? 1 : 0);
