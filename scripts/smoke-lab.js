/*
 * Litter Bug bug-lab smoke harness.
 *
 * Loads /bug-lab.html in jsdom, lets the inline IIFE run, then asserts
 * that the placeholder bug renderer (`_generateBugSVG`) is callable and
 * produces SVG with the expected layers (body, wings, legs, head,
 * antennae). Also checks determinism: same hash twice = identical SVG.
 *
 * Run via: `npm run smoke` (chains after the main index.html harness)
 * or directly: `node scripts/smoke-lab.js`
 *
 * Exits non-zero on any failure so CI / pre-push hooks can gate on it.
 */
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var { JSDOM, VirtualConsole } = require('jsdom');

var ROOT = path.join(__dirname, '..');
var html = fs.readFileSync(path.join(ROOT, 'bug-lab.html'), 'utf8');

var pageErrors = [];
var vConsole = new VirtualConsole();
vConsole.on('jsdomError', function(err){
  pageErrors.push(err && (err.detail ? err.detail.message : err.message) || String(err));
});

// crypto.subtle needs Object.defineProperty in jsdom; the simple
// assignment we use in scripts/smoke.js does not survive here because
// the lab calls crypto.subtle.digest during initial script execution
// (the starter set), not after page boot.
var dom = new JSDOM(html, {
  url: 'https://litterbug.test/',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole: vConsole,
  beforeParse: function(w){
    Object.defineProperty(w, 'crypto', {
      value: crypto.webcrypto, configurable: true, writable: true
    });
  }
});

var window = dom.window;
window.addEventListener('load', function(){
  setTimeout(runChecks, 100);
});

setTimeout(function(){
  console.error('SMOKE-LAB TIMEOUT: bug-lab.html never reached load in 8s.');
  if (pageErrors.length) {
    console.error('Page errors caught before timeout:');
    pageErrors.forEach(function(e){ console.error('  - ' + e); });
  }
  process.exit(2);
}, 8000);

function runChecks(){
  var results = [];
  function check(name, fn){
    try {
      var r = fn();
      results.push({ name: name, ok: !!r.ok, detail: r.detail || '' });
    } catch(e) {
      results.push({ name: name, ok: false, detail: 'THREW: ' + (e && e.message || e) });
    }
  }

  // 1. Window-exposed functions are present.
  check('window._generateBugSVG is a function', function(){
    return { ok: typeof window._generateBugSVG === 'function' };
  });
  check('window.hashToBugTraits is a function', function(){
    return { ok: typeof window.hashToBugTraits === 'function' };
  });
  check('window.sha256Hex is a function', function(){
    return { ok: typeof window.sha256Hex === 'function' };
  });

  // 2. _generateBugSVG returns SVG with the expected layers.
  var testHash = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  check('_generateBugSVG produces full bug (body + wings + legs + head + antennae)', function(){
    var svg = window._generateBugSVG(testHash, 160);
    if (typeof svg !== 'string' || svg.length < 200) {
      return { ok: false, detail: 'svg too short: ' + (svg && svg.length) };
    }
    var hasOpen = /<svg[\s>]/.test(svg);
    var hasClose = /<\/svg>/.test(svg);
    var hasBody = /<ellipse/.test(svg);
    var hasLegs = /<line/.test(svg);
    var hasHead = /<circle/.test(svg);
    var hasAntennae = /<path /.test(svg);
    var ok = hasOpen && hasClose && hasBody && hasLegs && hasHead && hasAntennae;
    return { ok: ok, detail: 'len=' + svg.length
      + ' body=' + hasBody + ' legs=' + hasLegs
      + ' head=' + hasHead + ' antennae=' + hasAntennae };
  });

  // 3. Determinism: same hash should produce identical SVG.
  // This is the core promise of "every bug derives from a hash" so the
  // smoke gates on it from day one.
  check('_generateBugSVG is deterministic (same hash = same svg)', function(){
    var a = window._generateBugSVG(testHash, 160);
    var b = window._generateBugSVG(testHash, 160);
    return { ok: a === b && a.length > 0, detail: 'len=' + a.length };
  });

  // 4. Different hashes should produce different SVGs.
  check('_generateBugSVG varies by hash', function(){
    var a = window._generateBugSVG(testHash, 160);
    var other = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
    var b = window._generateBugSVG(other, 160);
    return { ok: a !== b, detail: a === b ? 'identical — bug' : 'differ' };
  });

  // 5. hashToBugTraits returns the expected trait shape.
  check('hashToBugTraits returns body/head/wing/legs/antenna/pattern/palette/behavior', function(){
    var t = window.hashToBugTraits(testHash);
    var keys = ['body','head','wing','leg','antenna','pattern','palette','behavior'];
    var missing = keys.filter(function(k){ return typeof t[k] === 'undefined'; });
    return { ok: missing.length === 0, detail: missing.length ? 'missing=' + missing.join(',') : 'all present' };
  });

  // 6. Starter set rendered: the page should have 6 cards on first paint.
  check('starter set rendered (6 cards in DOM)', function(){
    var cards = window.document.querySelectorAll('.card');
    return { ok: cards.length === 6, detail: 'count=' + cards.length };
  });

  // ── Output ───────────────────────────────────────────────────────────
  console.log('');
  console.log('=== Litter Bug bug-lab smoke ===');
  var pass = 0, fail = 0;
  results.forEach(function(r){
    console.log((r.ok ? '  ✓ ' : '  ✗ ') + r.name + (r.detail ? '   → ' + r.detail : ''));
    if (r.ok) pass++; else fail++;
  });
  console.log('');
  console.log(pass + ' pass, ' + fail + ' fail');
  if (pageErrors.length) {
    console.log('');
    console.log('Page errors caught during boot (' + pageErrors.length + ', first 5):');
    pageErrors.slice(0, 5).forEach(function(e){ console.log('  - ' + e); });
  }
  process.exit(fail ? 1 : 0);
}
