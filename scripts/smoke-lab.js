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
    // Body can be an <image> (PNG from BODY_BANK) or a fallback <ellipse>.
    var hasBody = /<image[^>]+href="assets\/bodies\//.test(svg) || /<ellipse/.test(svg);
    var hasLegs = /<line/.test(svg);
    var hasHead = /<circle/.test(svg);
    var hasAntennae = /<path /.test(svg);
    var ok = hasOpen && hasClose && hasBody && hasLegs && hasHead && hasAntennae;
    return { ok: ok, detail: 'len=' + svg.length
      + ' body=' + hasBody + ' legs=' + hasLegs
      + ' head=' + hasHead + ' antennae=' + hasAntennae };
  });

  // 2a. Wings now render as PNG <image> tags from the WING_BANK.
  check('_generateBugSVG renders wing PNG from assets/wings/', function(){
    var svg = window._generateBugSVG(testHash, 160);
    var m = svg.match(/<image[^>]+href="assets\/wings\/(wing-\d+\.png)"/);
    return { ok: !!m, detail: m ? 'using ' + m[1] : 'no wing image found' };
  });

  // 2b. Per-bug tint filter exists so wings color match the bug palette.
  check('_generateBugSVG defines a per-bug wing tint filter', function(){
    var svg = window._generateBugSVG(testHash, 160);
    var hasFilterDef = /<filter id="wt-[0-9a-f]{8}"/.test(svg);
    var hasFilterUse = /filter="url\(#wt-[0-9a-f]{8}\)"/.test(svg);
    return { ok: hasFilterDef && hasFilterUse,
      detail: 'def=' + hasFilterDef + ' use=' + hasFilterUse };
  });

  // 2c. Body PNG is pulled from BODY_BANK and primary-tinted.
  check('_generateBugSVG renders body PNG from assets/bodies/', function(){
    var svg = window._generateBugSVG(testHash, 160);
    var m = svg.match(/<image href="assets\/bodies\/(body-\d+\.png)"/);
    return { ok: !!m, detail: m ? 'using ' + m[1] : 'no body image found' };
  });
  check('_generateBugSVG defines a per-bug body tint filter (bt-)', function(){
    var svg = window._generateBugSVG(testHash, 160);
    var hasDef = /<filter id="bt-[0-9a-f]{8}"/.test(svg);
    var hasUse = /filter="url\(#bt-[0-9a-f]{8}\)"/.test(svg);
    return { ok: hasDef && hasUse, detail: 'def=' + hasDef + ' use=' + hasUse };
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
    return { ok: a !== b, detail: a === b ? 'identical, bug' : 'differ' };
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

  // 7. WING_BANK is exposed and has the right shape.
  check('WING_BANK exposed with 8 entries of {file,name,tintable,attachment}', function(){
    var b = window.WING_BANK;
    if (!Array.isArray(b) || b.length !== 8) {
      return { ok: false, detail: 'len=' + (b && b.length) };
    }
    var bad = [];
    for (var i = 0; i < b.length; i++) {
      var e = b[i];
      if (!e || typeof e.file !== 'string') { bad.push('[' + i + '].file'); continue; }
      if (typeof e.name !== 'string') bad.push('[' + i + '].name');
      if (typeof e.tintable !== 'boolean') bad.push('[' + i + '].tintable');
      if (!Array.isArray(e.attachment) || e.attachment.length !== 2) {
        bad.push('[' + i + '].attachment');
      }
    }
    return { ok: bad.length === 0,
      detail: bad.length ? 'missing fields: ' + bad.join(',') : 'all fields present' };
  });

  // 8. Every WING_BANK file exists on disk.
  check('all WING_BANK files exist on disk', function(){
    var b = window.WING_BANK || [];
    var fs2 = require('fs');
    var pathMod = require('path');
    var missing = [];
    for (var i = 0; i < b.length; i++) {
      var f = b[i] && b[i].file;
      if (!f) { missing.push('[' + i + '] (no .file)'); continue; }
      var p = pathMod.join(ROOT, 'assets', 'wings', f);
      if (!fs2.existsSync(p)) missing.push(f);
    }
    return { ok: missing.length === 0,
      detail: missing.length ? 'missing: ' + missing.join(',') : 'all ' + b.length + ' present' };
  });

  // 9. Catalog JSONs are the source of truth; bank arrays in the lab
  // must match them exactly. If they drift, someone edited one but
  // forgot to re-run `npm run <layer>`.
  function catalogMatchesBank(layer, dirName, catalogFile, bankConst) {
    var fs2 = require('fs');
    var pathMod = require('path');
    var jsonPath = pathMod.join(ROOT, 'assets', dirName, catalogFile);
    if (!fs2.existsSync(jsonPath)) {
      return { ok: false, detail: catalogFile + ' missing, run `npm run ' + layer + '`' };
    }
    var catalog;
    try { catalog = JSON.parse(fs2.readFileSync(jsonPath, 'utf8')); }
    catch (e) { return { ok: false, detail: catalogFile + ' parse error: ' + e.message }; }
    var bank = window[bankConst] || [];
    if (catalog.length !== bank.length) {
      return { ok: false, detail: 'catalog=' + catalog.length + ' bank=' + bank.length };
    }
    for (var i = 0; i < catalog.length; i++) {
      if (catalog[i].file !== bank[i].file) {
        return { ok: false, detail: '[' + i + '] catalog=' + catalog[i].file
          + ' bank=' + bank[i].file + ' · run `npm run ' + layer + '`' };
      }
    }
    return { ok: true, detail: catalog.length + ' entries aligned' };
  }
  check('wings.json matches WING_BANK (same files, same count)', function(){
    return catalogMatchesBank('wings', 'wings', 'wings.json', 'WING_BANK');
  });
  check('bodies.json matches BODY_BANK (same files, same count)', function(){
    return catalogMatchesBank('bodies', 'bodies', 'bodies.json', 'BODY_BANK');
  });
  check('BODY_BANK exposed with correct shape', function(){
    var b = window.BODY_BANK;
    if (!Array.isArray(b) || b.length === 0) {
      return { ok: false, detail: 'len=' + (b && b.length) };
    }
    var bad = [];
    b.forEach(function(e, i){
      if (!e || typeof e.file !== 'string') bad.push('[' + i + '].file');
      else if (typeof e.tintable !== 'boolean') bad.push('[' + i + '].tintable');
      else if (!Array.isArray(e.attachment)) bad.push('[' + i + '].attachment');
    });
    return { ok: bad.length === 0,
      detail: bad.length ? 'bad: ' + bad.join(',') : b.length + ' entries, shape valid' };
  });
  check('all BODY_BANK files exist on disk', function(){
    var b = window.BODY_BANK || [];
    var fs2 = require('fs');
    var pathMod = require('path');
    var missing = [];
    for (var i = 0; i < b.length; i++) {
      var f = b[i] && b[i].file;
      if (!f) continue;
      if (!fs2.existsSync(pathMod.join(ROOT, 'assets', 'bodies', f))) missing.push(f);
    }
    return { ok: missing.length === 0,
      detail: missing.length ? 'missing: ' + missing.join(',') : 'all ' + b.length + ' present' };
  });

  // Heads: same shape of assertions as bodies.
  check('heads.json matches HEAD_BANK (same files, same count)', function(){
    return catalogMatchesBank('heads', 'heads', 'heads.json', 'HEAD_BANK');
  });
  check('HEAD_BANK exposed with correct shape', function(){
    var b = window.HEAD_BANK;
    if (!Array.isArray(b) || b.length === 0) {
      return { ok: false, detail: 'len=' + (b && b.length) };
    }
    var bad = [];
    b.forEach(function(e, i){
      if (!e || typeof e.file !== 'string') bad.push('[' + i + '].file');
      else if (typeof e.tintable !== 'boolean') bad.push('[' + i + '].tintable');
      else if (!Array.isArray(e.attachment)) bad.push('[' + i + '].attachment');
    });
    return { ok: bad.length === 0,
      detail: bad.length ? 'bad: ' + bad.join(',') : b.length + ' entries, shape valid' };
  });
  check('all HEAD_BANK files exist on disk', function(){
    var b = window.HEAD_BANK || [];
    var fs2 = require('fs');
    var pathMod = require('path');
    var missing = [];
    for (var i = 0; i < b.length; i++) {
      var f = b[i] && b[i].file;
      if (!f) continue;
      if (!fs2.existsSync(pathMod.join(ROOT, 'assets', 'heads', f))) missing.push(f);
    }
    return { ok: missing.length === 0,
      detail: missing.length ? 'missing: ' + missing.join(',') : 'all ' + b.length + ' present' };
  });
  check('_generateBugSVG renders head PNG from assets/heads/', function(){
    var svg = window._generateBugSVG(testHash, 160);
    var m = svg.match(/<image href="assets\/heads\/(head-\d+\.png)"/);
    return { ok: !!m, detail: m ? 'using ' + m[1] : 'no head image found' };
  });
  check('_generateBugSVG defines a per-bug head tint filter (ht-)', function(){
    var svg = window._generateBugSVG(testHash, 160);
    var hasDef = /<filter id="ht-[0-9a-f]{8}"/.test(svg);
    var hasUse = /filter="url\(#ht-[0-9a-f]{8}\)"/.test(svg);
    return { ok: hasDef && hasUse, detail: 'def=' + hasDef + ' use=' + hasUse };
  });

  // Procedural banks: legs and antennae. Both are JSON-only catalogs
  // patched into the lab as data-driven inline SVG.
  check('LEG_BANK populated with shape params', function(){
    var b = window.LEG_BANK;
    if (!Array.isArray(b) || b.length === 0) return { ok: false, detail: 'len=' + (b && b.length) };
    var bad = [];
    b.forEach(function(e, i){
      if (typeof e.name !== 'string') bad.push('[' + i + '].name');
      if (typeof e.count !== 'number') bad.push('[' + i + '].count');
      if (typeof e.length !== 'number') bad.push('[' + i + '].length');
      if (typeof e.thickness !== 'number') bad.push('[' + i + '].thickness');
    });
    return { ok: bad.length === 0,
      detail: bad.length ? 'bad: ' + bad.join(',') : b.length + ' entries, params valid' };
  });
  check('legs.json matches LEG_BANK (same count)', function(){
    var fs2 = require('fs');
    var pathMod = require('path');
    var p = pathMod.join(ROOT, 'assets', 'legs', 'legs.json');
    if (!fs2.existsSync(p)) return { ok: false, detail: 'legs.json missing' };
    var catalog = JSON.parse(fs2.readFileSync(p, 'utf8'));
    var bank = window.LEG_BANK || [];
    return { ok: catalog.length === bank.length,
      detail: 'catalog=' + catalog.length + ' bank=' + bank.length };
  });
  check('ANTENNA_BANK populated with shape params', function(){
    var b = window.ANTENNA_BANK;
    if (!Array.isArray(b) || b.length === 0) return { ok: false, detail: 'len=' + (b && b.length) };
    var bad = [];
    b.forEach(function(e, i){
      if (typeof e.name !== 'string') bad.push('[' + i + '].name');
      if (typeof e.length !== 'number') bad.push('[' + i + '].length');
      if (typeof e.curl !== 'number') bad.push('[' + i + '].curl');
      if (typeof e.thickness !== 'number') bad.push('[' + i + '].thickness');
    });
    return { ok: bad.length === 0,
      detail: bad.length ? 'bad: ' + bad.join(',') : b.length + ' entries, params valid' };
  });
  check('antennae.json matches ANTENNA_BANK (same count)', function(){
    var fs2 = require('fs');
    var pathMod = require('path');
    var p = pathMod.join(ROOT, 'assets', 'antennae', 'antennae.json');
    if (!fs2.existsSync(p)) return { ok: false, detail: 'antennae.json missing' };
    var catalog = JSON.parse(fs2.readFileSync(p, 'utf8'));
    var bank = window.ANTENNA_BANK || [];
    return { ok: catalog.length === bank.length,
      detail: 'catalog=' + catalog.length + ' bank=' + bank.length };
  });

  // Patterns: PNG overlay layer.
  check('patterns.json matches PATTERN_BANK (same files, same count)', function(){
    return catalogMatchesBank('patterns', 'patterns', 'patterns.json', 'PATTERN_BANK');
  });
  check('PATTERN_BANK exposed with correct shape', function(){
    var b = window.PATTERN_BANK;
    if (!Array.isArray(b) || b.length === 0) {
      return { ok: false, detail: 'len=' + (b && b.length) };
    }
    var bad = [];
    b.forEach(function(e, i){
      if (!e || typeof e.file !== 'string') bad.push('[' + i + '].file');
      else if (typeof e.tintable !== 'boolean') bad.push('[' + i + '].tintable');
    });
    return { ok: bad.length === 0,
      detail: bad.length ? 'bad: ' + bad.join(',') : b.length + ' entries, shape valid' };
  });
  check('all PATTERN_BANK files exist on disk', function(){
    var b = window.PATTERN_BANK || [];
    var fs2 = require('fs');
    var pathMod = require('path');
    var missing = [];
    for (var i = 0; i < b.length; i++) {
      var f = b[i] && b[i].file;
      if (!f) continue;
      if (!fs2.existsSync(pathMod.join(ROOT, 'assets', 'patterns', f))) missing.push(f);
    }
    return { ok: missing.length === 0,
      detail: missing.length ? 'missing: ' + missing.join(',') : 'all ' + b.length + ' present' };
  });
  check('_generateBugSVG renders pattern PNG from assets/patterns/', function(){
    var svg = window._generateBugSVG(testHash, 160);
    var m = svg.match(/<image href="assets\/patterns\/(pattern-\d+\.png)"/);
    return { ok: !!m, detail: m ? 'using ' + m[1] : 'no pattern image found' };
  });

  // 10. Non-tintable wings should NOT emit a filter attribute on their
  // <g> wrapper. Catches regressions where _generateBugSVG forgets to
  // honor the flag. We mutate (NOT reassign) the bank's first entry so
  // the IIFE's closed-over reference sees the change.
  check('_generateBugSVG honors tintable=false (no filter attr)', function(){
    var bank = window.WING_BANK;
    var orig = bank[0].tintable;
    try {
      bank[0].tintable = false;
      // Forge a hash whose byte 8 = 0x00 so wing index = 0 → wing-01,
      // the one we just toggled.
      var h = testHash.substr(0, 16) + '00' + testHash.substr(18);
      var svg = window._generateBugSVG(h, 160);
      var m = svg.match(/<g transform="rotate\(165[^"]+"([^>]*)>/);
      var noFilter = m && !/filter=/.test(m[1]);
      return { ok: !!noFilter,
        detail: m ? 'g attrs="' + m[1].trim() + '"' : 'g not found' };
    } finally {
      bank[0].tintable = orig;
    }
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
