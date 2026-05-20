/*
 * Litter Bug preview.html smoke harness.
 *
 * Loads /preview.html in jsdom, lets the inline IIFE run + its initial
 * grid render complete, then asserts the multi-bug grid works: 60
 * cells on first paint, each with a bug SVG, and the renderer behaves
 * identically to the lab.
 *
 * Run via: `npm run smoke` (chains after smoke-lab.js)
 * or directly: `node scripts/smoke-preview.js`
 */
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var { JSDOM, VirtualConsole } = require('jsdom');

var ROOT = path.join(__dirname, '..');
var html = fs.readFileSync(path.join(ROOT, 'preview.html'), 'utf8');

var pageErrors = [];
var vConsole = new VirtualConsole();
vConsole.on('jsdomError', function(err){
  pageErrors.push(err && (err.detail ? err.detail.message : err.message) || String(err));
});

var dom = new JSDOM(html, {
  url: 'https://litterbug.test/',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole: vConsole,
  beforeParse: function(w){
    Object.defineProperty(w, 'crypto', {
      value: crypto.webcrypto, configurable: true, writable: true
    });
    // performance.now() is in jsdom but defensive check anyway.
    if (!w.performance) w.performance = { now: function(){ return Date.now(); } };
  }
});

var window = dom.window;
window.addEventListener('load', function(){
  // Preview's initial render is async (await sha256Hex for each seed).
  // Give it a generous window to populate the grid before we assert.
  setTimeout(runChecks, 400);
});

setTimeout(function(){
  console.error('SMOKE-PREVIEW TIMEOUT: preview.html never reached load in 10s.');
  if (pageErrors.length) {
    console.error('Page errors caught before timeout:');
    pageErrors.forEach(function(e){ console.error('  - ' + e); });
  }
  process.exit(2);
}, 10000);

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

  check('window._generateBugSVG is a function', function(){
    return { ok: typeof window._generateBugSVG === 'function' };
  });
  check('window.renderPreview is a function', function(){
    return { ok: typeof window.renderPreview === 'function' };
  });
  check('window.previewState exposed', function(){
    return { ok: !!window.previewState };
  });

  // Banks are populated (same source as lab).
  check('all 6 banks populated in preview', function(){
    var keys = ['WING_BANK','BODY_BANK','HEAD_BANK','LEG_BANK','ANTENNA_BANK','PATTERN_BANK'];
    var bad = keys.filter(function(k){
      return !Array.isArray(window[k]) || window[k].length === 0;
    });
    return { ok: bad.length === 0, detail: bad.length ? 'empty: ' + bad.join(',') : keys.length + ' populated' };
  });

  // Initial grid renders 60 cells.
  check('initial grid renders 60 cells', function(){
    var cells = window.document.querySelectorAll('.cell');
    return { ok: cells.length === 60, detail: 'count=' + cells.length };
  });

  // Each cell has an SVG inside.
  check('each cell has an inline SVG', function(){
    var cells = window.document.querySelectorAll('.cell svg');
    return { ok: cells.length === 60, detail: 'svgs=' + cells.length };
  });

  // Renderer matches the lab: same hash should produce same SVG.
  check('_generateBugSVG is deterministic in preview', function(){
    var hash = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    var a = window._generateBugSVG(hash, 96);
    var b = window._generateBugSVG(hash, 96);
    return { ok: a === b && a.length > 0, detail: 'len=' + a.length };
  });

  // Grid SVGs reference PNG layers (smoke that the engine is wired
  // up, not just emitting stubs).
  check('grid SVGs reference assets/bodies/ and assets/wings/', function(){
    var html = window.document.getElementById('grid').innerHTML;
    var hasBody = /<image[^>]+assets\/bodies\//.test(html);
    var hasWing = /<image[^>]+assets\/wings\//.test(html);
    return { ok: hasBody && hasWing,
      detail: 'body=' + hasBody + ' wing=' + hasWing };
  });

  // ── Output ───────────────────────────────────────────────────────────
  console.log('');
  console.log('=== Litter Bug preview smoke ===');
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
