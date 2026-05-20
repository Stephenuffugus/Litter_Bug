#!/usr/bin/env node
/*
 * contact-sheet.js <layer>
 *
 * Renders every entry in a layer's catalog into a single labeled PNG
 * for visual review. Saves to `assets/<layer>/contact-sheet.png`.
 *
 * Examples:
 *   node scripts/contact-sheet.js wings
 *   node scripts/contact-sheet.js bodies
 *   npm run wings:contact   (same as the first)
 */
var fs = require('fs');
var path = require('path');
var sharp = require('sharp');
var LAYERS = require('./art-layers');

var ROOT = path.join(__dirname, '..');

var layerName = process.argv[2];
if (!layerName || !LAYERS[layerName]) {
  console.error('Usage: node scripts/contact-sheet.js <layer>');
  console.error('Available layers: ' + Object.keys(LAYERS).join(', '));
  process.exit(1);
}
var cfg = LAYERS[layerName];

var LAYER_DIR = path.join(ROOT, 'assets', cfg.dirName);
var JSON_PATH = path.join(LAYER_DIR, cfg.catalogFile);
var OUT_PATH = path.join(LAYER_DIR, 'contact-sheet.png');

if (!fs.existsSync(JSON_PATH)) {
  console.error(cfg.catalogFile + ' not found. Run `node scripts/import-art.js ' + layerName + '` first.');
  process.exit(1);
}
var catalog = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
if (catalog.length === 0) {
  console.error(cfg.catalogFile + ' is empty. Add ' + cfg.displayName + 's first.');
  process.exit(1);
}

// Layout adapts to layer aspect. Wider art (256x128 wings) → 4 cols;
// squarer art (96x96 heads) → 5-6 cols.
var aspect = cfg.dimensions[0] / cfg.dimensions[1];
var COLS = aspect > 1.5 ? 4 : (aspect > 0.95 ? 5 : 6);
var ROWS = Math.ceil(catalog.length / COLS);
var IMG_W = cfg.dimensions[0];
var IMG_H = cfg.dimensions[1];
var CELL_W = IMG_W + 32;
var CELL_H = IMG_H + 80;  // room for image + label
var PAD = 16;
var HEADER_H = 50;
var W = CELL_W * COLS + PAD * (COLS + 1);
var H = CELL_H * ROWS + PAD * (ROWS + 1) + HEADER_H;

function escapeXml(s) {
  return String(s).replace(/[&<>"']/g, function(c){
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'})[c];
  });
}

(async function(){
  var imgs = catalog.map(function(w){
    var p = path.join(LAYER_DIR, w.file);
    if (!fs.existsSync(p)) return null;
    var buf = fs.readFileSync(p);
    return 'data:image/png;base64,' + buf.toString('base64');
  });

  var pieces = [];
  pieces.push('<svg xmlns="http://www.w3.org/2000/svg"'
    + ' viewBox="0 0 ' + W + ' ' + H + '"'
    + ' width="' + W + '" height="' + H + '">');
  pieces.push('<rect width="' + W + '" height="' + H + '" fill="#0d100c"/>');

  pieces.push('<text x="' + PAD + '" y="34" fill="#c8a84b"'
    + ' font-family="Georgia, serif" font-size="22" font-weight="600">'
    + 'Litter Bug / ' + cfg.displayName + ' bank  (' + catalog.length + ' entries)'
    + '</text>');
  pieces.push('<text x="' + (W - PAD) + '" y="34" fill="#6f7766"'
    + ' font-family="ui-monospace, monospace" font-size="12"'
    + ' text-anchor="end">'
    + new Date().toISOString().slice(0, 10)
    + '</text>');

  // Pre-emit the tint filter defs (shared across tintable entries)
  var tintR = cfg.tintColorRGB[0];
  var tintG = cfg.tintColorRGB[1];
  var tintB = cfg.tintColorRGB[2];
  pieces.push('<defs><filter id="cs-tint">'
    + '<feColorMatrix type="matrix" values="'
    + tintR + ' 0 0 0 0  '
    + '0 ' + tintG + ' 0 0 0  '
    + '0 0 ' + tintB + ' 0 0  '
    + '0 0 0 1 0"/>'
    + '</filter></defs>');

  catalog.forEach(function(w, i){
    var col = i % COLS;
    var row = (i / COLS) | 0;
    var x = PAD + col * (CELL_W + PAD);
    var y = HEADER_H + PAD + row * (CELL_H + PAD);

    pieces.push('<rect x="' + x + '" y="' + y + '" width="' + CELL_W + '" height="' + CELL_H
      + '" fill="#131614" stroke="#1f231d" rx="10"/>');

    var ix = x + 16;
    var iy = y + 14;
    if (imgs[i]) {
      if (w.tintable !== false) {
        pieces.push('<image href="' + imgs[i] + '"'
          + ' x="' + ix + '" y="' + iy
          + '" width="' + IMG_W + '" height="' + IMG_H + '"'
          + ' filter="url(#cs-tint)"/>');
      } else {
        pieces.push('<image href="' + imgs[i] + '"'
          + ' x="' + ix + '" y="' + iy
          + '" width="' + IMG_W + '" height="' + IMG_H + '"/>');
      }
    } else {
      pieces.push('<text x="' + (ix + IMG_W / 2) + '" y="' + (iy + IMG_H / 2)
        + '" fill="#a85a3a" text-anchor="middle" font-size="14">file missing</text>');
    }

    if (w.attachment && imgs[i]) {
      var dotX = ix + w.attachment[0];
      var dotY = iy + w.attachment[1];
      pieces.push('<circle cx="' + dotX + '" cy="' + dotY
        + '" r="3" fill="#c8a84b" stroke="#0d100c" stroke-width="1"/>');
    }

    var labelY = y + CELL_H - 32;
    pieces.push('<text x="' + (x + 12) + '" y="' + labelY + '"'
      + ' fill="#e8dcc8" font-family="Georgia, serif" font-size="16"'
      + ' font-weight="600">' + escapeXml(w.name || '') + '</text>');
    pieces.push('<text x="' + (x + 12) + '" y="' + (labelY + 18) + '"'
      + ' fill="#8a9178" font-family="ui-monospace, monospace" font-size="11">'
      + escapeXml(w.file) + '  ·  ' + escapeXml(w.rarity || '?')
      + (w.tintable === false ? '  ·  colored' : '  ·  tintable')
      + '</text>');
  });

  pieces.push('</svg>');
  var svg = pieces.join('\n');

  await sharp(Buffer.from(svg), { density: 144 })
    .png({ compressionLevel: 9 })
    .toFile(OUT_PATH);

  var stat = fs.statSync(OUT_PATH);
  console.log('=== contact-sheet (' + layerName + ') ===');
  console.log('  wrote ' + path.relative(ROOT, OUT_PATH)
    + '  (' + W + 'x' + H + ', ' + Math.round(stat.size / 1024) + ' KB)');
})().catch(function(e){
  console.error('contact-sheet failed:', e && e.message || e);
  process.exit(1);
});
