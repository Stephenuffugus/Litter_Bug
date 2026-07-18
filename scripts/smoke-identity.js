/*
 * Litter Bug identity-engine smoke harness.
 *
 * Covers the name + species + designation + lore engine in bug-engine.js:
 *   - determinism (same codeblock => same name/species/lore, always)
 *   - format (species is a binomial, designation matches LB-XXXX-XXXX, lore
 *     is 3 lines, and NOTHING contains an unfilled {placeholder})
 *   - trait-linkage (a bug's lore reflects its own primary colour or its
 *     behaviour-derived temperament)
 *   - variety (over many bugs, lore is near-unique and designations unique)
 *
 * Loads bug-engine.js in Node. Run via `npm run smoke` or directly.
 */
var path = require('path');
var crypto = require('crypto');
var E = require(path.join(__dirname, '..', 'bug-engine.js'));

// Mirror of the temperament bank in bug-engine.js, for the linkage assertion.
// The color word now comes from the bug's palette scheme (E.PALETTES[i].lore).
var TEMPER = ['patient','vengeful','skittish','stubborn','watchful','restless',
  'territorial','solitary','tireless','wary','defiant','quiet'];

function cb(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }

var results = [];
function check(name, fn) {
  try { var r = fn(); results.push({ name: name, ok: !!(r && r.ok), detail: r && r.detail }); }
  catch (e) { results.push({ name: name, ok: false, detail: 'threw: ' + (e && e.message) }); }
}

var C0 = cb('alpha');

check('identity API present', function () {
  var need = ['bugName', 'bugSpecies', 'bugDesignation', 'bugLore', 'bugIdentity', 'seededRng'];
  var missing = need.filter(function (k) { return typeof E[k] !== 'function'; });
  return { ok: missing.length === 0, detail: missing.length ? 'missing ' + missing.join(',') : 'all present' };
});

check('seededRng is deterministic and in [0,1)', function () {
  var a = E.seededRng('seed-x'), b = E.seededRng('seed-x');
  var va = a(), vb = b();
  return { ok: va === vb && va >= 0 && va < 1, detail: 'first draw ' + va.toFixed(6) };
});

check('bugName is deterministic and non-empty', function () {
  var n1 = E.bugName(C0), n2 = E.bugName(C0);
  return { ok: n1 === n2 && n1.length > 0, detail: n1 };
});

check('bugSpecies is a Capitalized binomial', function () {
  var sp = E.bugSpecies(C0);
  var parts = sp.split(' ');
  var ok = sp === E.bugSpecies(C0) && parts.length === 2
    && /^[A-Z]/.test(parts[0]) && /^[a-z]/.test(parts[1]);
  return { ok: ok, detail: sp };
});

check('bugDesignation matches LB-XXXX-XXXX', function () {
  var d = E.bugDesignation(C0);
  return { ok: /^LB-[0-9A-F]{4}-[0-9A-F]{4}$/.test(d) && d === E.bugDesignation(C0), detail: d };
});

check('bugLore is deterministic and 3 lines', function () {
  var l1 = E.bugLore(C0), l2 = E.bugLore(C0);
  var lines = l1.split('\n');
  var ok = l1 === l2 && lines.length === 3 && lines.every(function (x) { return x.length > 0; });
  return { ok: ok, detail: lines.length + ' lines' };
});

check('every lore line ends with punctuation', function () {
  var bad = 0;
  for (var i = 0; i < 50; i++) {
    E.bugLore(cb('punct-' + i)).split('\n').forEach(function (ln) {
      if (!/[.!?]$/.test(ln)) bad++;
    });
  }
  return { ok: bad === 0, detail: bad + ' unterminated lines / 150' };
});

check('no unfilled {placeholder} in name/species/lore', function () {
  var bad = [];
  for (var i = 0; i < 300; i++) {
    var c = cb('ph-' + i);
    ['name', 'species', 'lore'].forEach(function (f) {
      var v = E.bugIdentity(c)[f];
      if (/[{}]/.test(v)) bad.push(f + ':' + v);
    });
  }
  return { ok: bad.length === 0, detail: bad.length ? bad.slice(0, 2).join(' | ') : 'clean across 300 bugs' };
});

check('lore is trait-linked (reflects colour or temperament)', function () {
  var miss = 0;
  for (var i = 0; i < 40; i++) {
    var c = cb('link-' + i);
    var t = E.hashToBugTraits(c);
    var color = (E.PALETTES[t.palette] || E.PALETTES[0]).lore;
    var temper = TEMPER[(t.behavior) % TEMPER.length];
    var lore = E.bugLore(c).toLowerCase(); // line-start words get capitalized
    if (lore.indexOf(color) === -1 && lore.indexOf(temper) === -1) miss++;
  }
  return { ok: miss === 0, detail: miss + ' bugs / 40 with no trait word' };
});

check('bugFromCodeblock carries the identity object', function () {
  var bug = E.bugFromCodeblock(C0, 160);
  var id = bug.identity;
  var ok = id && id.name && id.species && id.designation && id.lore && bug.name === id.name;
  return { ok: ok, detail: id ? id.name + ' / ' + id.species : 'no identity' };
});

check('variety: lore near-unique, designations unique over 2000 bugs', function () {
  var N = 2000, names = new Set(), lores = new Set(), desig = new Set();
  for (var i = 0; i < N; i++) {
    var c = cb('var-' + i);
    names.add(E.bugName(c)); lores.add(E.bugLore(c)); desig.add(E.bugDesignation(c));
  }
  var loreRatio = lores.size / N, desigRatio = desig.size / N, nameRatio = names.size / N;
  var ok = loreRatio > 0.95 && desigRatio > 0.99 && nameRatio > 0.5;
  return { ok: ok, detail: 'names ' + (nameRatio * 100).toFixed(0) + '% lore '
    + (loreRatio * 100).toFixed(1) + '% desig ' + (desigRatio * 100).toFixed(1) + '% distinct' };
});

check('PALETTES exported and well-formed', function () {
  var P = E.PALETTES;
  if (!Array.isArray(P) || P.length < 8) return { ok: false, detail: 'not an array of schemes' };
  var bad = P.filter(function (s) {
    return !/^#[0-9a-f]{6}$/i.test(s.primary) || !/^#[0-9a-f]{6}$/i.test(s.accent)
        || !/^#[0-9a-f]{6}$/i.test(s.dark) || !s.lore;
  });
  return { ok: bad.length === 0, detail: P.length + ' schemes, ' + bad.length + ' malformed' };
});

check('bug picks a valid scheme and the render applies it', function () {
  var miss = 0;
  for (var i = 0; i < 60; i++) {
    var c = cb('pal-' + i);
    var t = E.hashToBugTraits(c);
    var scheme = E.PALETTES[t.palette];
    // The scheme's `primary` hex is used literally as the body gradient's
    // mid-stop, so it must appear in the SVG when the scheme is applied.
    if (!Number.isInteger(t.palette) || !scheme || E._generateBugSVG(c, 160).indexOf(scheme.primary) === -1) miss++;
  }
  return { ok: miss === 0, detail: miss + ' / 60 bugs with unapplied scheme' };
});

// ── Output ─────────────────────────────────────────────────────────────
console.log('');
console.log('=== Litter Bug identity smoke ===');
var pass = 0, fail = 0;
results.forEach(function (r) {
  console.log((r.ok ? '  ✓ ' : '  ✗ ') + r.name + (r.detail ? '   → ' + r.detail : ''));
  if (r.ok) pass++; else fail++;
});
console.log('');
console.log(pass + ' pass, ' + fail + ' fail');
process.exit(fail ? 1 : 0);
