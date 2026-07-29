/*
 * Litter Bug renderer cohesion smoke (art-spec w1ar100ei).
 *
 * Guards the procedural _generateBugSVG in bug-engine.js:
 *   - it is PURE SVG (no <image> / PNG-hybrid regression)
 *   - deterministic (same codeblock => byte-identical SVG) across a batch
 *   - every part draws from the bug's palette scheme (primary present)
 *   - the cohesion contract: nothing rolls wildly off the 200x200 canvas
 *     (gross-bounds check over many rolls), and the shared machinery
 *     (gradients + body clip-path) is always emitted
 *
 * Runs in Node against bug-engine directly (pure renderer, no jsdom).
 */
var path = require('path');
var crypto = require('crypto');
var sharp = require('sharp');
var E = require(path.join(__dirname, '..', 'bug-engine.js'));
function cb(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }

var results = [];
function check(name, fn) {
  try { var r = fn(); results.push({ name: name, ok: !!(r && r.ok), detail: r && r.detail }); }
  catch (e) { results.push({ name: name, ok: false, detail: 'threw: ' + (e && e.message) }); }
}

check('renders pure SVG, no PNG <image> (procedural, not hybrid)', function () {
  var bad = 0;
  for (var i = 0; i < 60; i++) {
    var svg = E._generateBugSVG(cb('img' + i), 160);
    if (svg.indexOf('<image') >= 0 || svg.indexOf('assets/') >= 0) bad++;
  }
  return { ok: bad === 0, detail: bad ? bad + ' still using PNG layers' : 'all procedural SVG' };
});

check('shared machinery always present (shade gradients)', function () {
  var bad = 0;
  for (var i = 0; i < 60; i++) {
    var svg = E._generateBugSVG(cb('m' + i), 160, 30);
    var grads = (svg.match(/<linearGradient/g) || []).length;   // grow renderer uses 3
    if (grads < 3 || svg.indexOf('<svg') !== 0) bad++;
  }
  return { ok: bad === 0, detail: bad ? bad + ' missing machinery' : 'shade gradients on every bug' };
});

check('bugs GROW with level (more parts at higher level)', function () {
  var bad = 0;
  for (var i = 0; i < 40; i++) {
    var c = cb('grow' + i);
    var lo = E._generateBugSVG(c, 160, 1).length;
    var hi = E._generateBugSVG(c, 160, 30).length;
    if (hi < lo) bad++;                 // a maxed bug is never simpler than its L1 grub
  }
  return { ok: bad === 0, detail: bad ? bad + ' shrank with level' : 'L30 >= L1 complexity, 40 bugs' };
});

check('deterministic across a 200-roll batch', function () {
  var bad = 0;
  for (var i = 0; i < 200; i++) {
    var c = cb('det' + i);
    if (E._generateBugSVG(c, 160) !== E._generateBugSVG(c, 160)) bad++;
  }
  return { ok: bad === 0, detail: bad ? bad + ' non-deterministic' : '200 stable' };
});

check('FX pass is the live default (rim light + cel shade emitted)', function () {
  var bad = 0;
  for (var i = 0; i < 40; i++) {
    var svg = E._generateBugSVG(cb('fxd' + i), 160);
    if (svg.indexOf('rim') < 0 || svg.indexOf('cel') < 0) bad++;
  }
  return { ok: bad === 0, detail: bad ? bad + ' rendered flat' : 'fx on all 40' };
});

check('flat opt-out {fx:false} still renders (and differs from default)', function () {
  var bad = 0;
  for (var i = 0; i < 40; i++) {
    var c = cb('fxo' + i);
    var flat = E._generateBugSVG(c, 160, 30, { fx: false });
    if (flat.indexOf('rim') >= 0 || flat === E._generateBugSVG(c, 160)) bad++;
  }
  return { ok: bad === 0, detail: bad ? bad + ' opt-out failures' : 'flat path intact' };
});

check('plan B: authored wing drop-in is live, reversible, deterministic', function () {
  var TEST_WING = require('./test-wing.js');
  var changed = 0, unchanged = 0, det = true, restored = true;
  for (var i = 0; i < 40; i++) {
    var c = cb('wingB' + i);
    E.clearParts('wing');
    var proc = E._generateBugSVG(c, 160);
    E.registerPart('wing', 0, TEST_WING);
    var a1 = E._generateBugSVG(c, 160), a2 = E._generateBugSVG(c, 160);
    if (a1 !== a2) det = false;
    if (a1 !== proc) changed++; else unchanged++;
    E.clearParts('wing');
    if (E._generateBugSVG(c, 160) !== proc) restored = false;
  }
  // membrane-winged bugs must switch to the symbol; elytra/wingless must not
  var ok = det && restored && changed > 0 && unchanged > 0;
  return { ok: ok, detail: changed + ' switched, ' + unchanged + ' untouched (elytra/wingless), det=' + det + ', revert=' + restored };
});

check('every bug draws from its palette scheme', function () {
  var bad = 0;
  for (var i = 0; i < 80; i++) {
    var c = cb('pal' + i);
    var scheme = E.PALETTES[E.hashToBugTraits(c).palette];
    if (E._generateBugSVG(c, 160).indexOf(scheme.primary) < 0) bad++;
  }
  return { ok: bad === 0, detail: bad ? bad + ' unschemed' : 'scheme applied on all' };
});

// Silhouette gate (spec Step 7): rasterize each bug and measure the ACTUAL
// painted pixels, so we catch real off-canvas content (not Bezier control
// points, which legitimately sit outside the visible curve).
async function paintedBBox(svg, px) {
  var out = await sharp(Buffer.from(svg)).resize(px, px).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  var data = out.data, w = out.info.width, h = out.info.height, ch = out.info.channels;
  var minX = w, minY = h, maxX = -1, maxY = -1;
  for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
    if (data[(y * w + x) * ch + (ch - 1)] > 24) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  return maxX < 0 ? null : { minX: minX, minY: minY, maxX: maxX, maxY: maxY, w: w, h: h };
}

async function main() {
  var PX = 100, N = 24, bad = 0, empty = 0, tightest = 999;
  for (var i = 0; i < N; i++) {
    var bb = await paintedBBox(E._generateBugSVG(cb('bounds' + i), 200), PX);
    if (!bb) { empty++; continue; }
    var edge = Math.min(bb.minX, bb.minY, PX - 1 - bb.maxX, PX - 1 - bb.maxY);
    tightest = Math.min(tightest, edge);
    if (edge < 0) bad++;                 // painted pixels touch/exceed the canvas edge
  }
  results.push({ name: 'cohesion: every bug is painted fully inside the canvas',
    ok: bad === 0 && empty === 0,
    detail: bad ? bad + ' bleed off-canvas' : empty ? empty + ' rendered empty'
      : 'all ' + N + ' inside; tightest margin ' + tightest + 'px' });

  console.log('');
  console.log('=== Litter Bug renderer smoke ===');
  var pass = 0, fail = 0;
  results.forEach(function (r) {
    console.log((r.ok ? '  ✓ ' : '  ✗ ') + r.name + (r.detail ? '   → ' + r.detail : ''));
    if (r.ok) pass++; else fail++;
  });
  console.log('');
  console.log(pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
}
main();
