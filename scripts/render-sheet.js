/*
 * Litter Bug render-sheet dev tool (art-spec w1ar100ei, Step 7).
 *
 * Rasterizes the procedural renderer to a PNG for eyeballing:
 *   node scripts/render-sheet.js variety [out.png]   -- N rolls in a grid
 *   node scripts/render-sheet.js palette [out.png]    -- one bug across schemes
 *
 * Imports bug-engine directly (pure renderer, no jsdom). Uses sharp (already
 * a dep) exactly like contact-sheet.js. Not part of smoke; a human-review aid.
 */
var path = require('path');
var crypto = require('crypto');
var sharp = require('sharp');
var E = require(path.join(__dirname, '..', 'bug-engine.js'));

function cb(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }
var mode = process.argv[2] || 'variety';
var out = process.argv[3] || ('/tmp/bug-' + mode + '.png');
var CELL = 150, COLS = 6;

var items = [];
if (mode === 'palette') {
  // one "shape" across a spread of the 80 palette schemes
  for (var pi = 0; pi < E.PALETTES.length; pi++) {
    var c = null;
    for (var k = 0; k < 400 && !c; k++) {
      var cand = cb('psweep' + pi + '_' + k);
      if (E.hashToBugTraits(cand).palette === pi) c = cand;
    }
    items.push(E._generateBugSVG(c || cb('p' + pi), CELL));
  }
} else {
  var N = parseInt(process.argv[3], 10) > 0 ? parseInt(process.argv[3], 10) : 36;
  out = process.argv[4] || '/tmp/bug-variety.png';
  for (var i = 0; i < N; i++) items.push(E._generateBugSVG(cb('sheet' + i), CELL));
}

var rows = Math.ceil(items.length / COLS), W = COLS * CELL, H = rows * CELL, g = '';
items.forEach(function (svg, i) {
  g += '<g transform="translate(' + ((i % COLS) * CELL) + ',' + (Math.floor(i / COLS) * CELL) + ')">'
    + svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '') + '</g>';
});
var sheet = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">'
  + '<rect width="' + W + '" height="' + H + '" fill="#12140f"/>' + g + '</svg>';
sharp(Buffer.from(sheet)).png().toFile(out)
  .then(function () { console.log('wrote ' + out + ' (' + items.length + ' bugs)'); })
  .catch(function (e) { console.error('render-sheet failed:', e.message); process.exit(1); });
