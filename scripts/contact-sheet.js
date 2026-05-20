#!/usr/bin/env node
/*
 * contact-sheet.js
 *
 * Renders every wing in `wings.json` into a single labeled PNG so you
 * can review the bank at a glance. Useful for "do we have enough
 * variety" or "did the last drop import correctly."
 *
 * Output: assets/wings/contact-sheet.png
 * Run: `npm run wings:contact` or `node scripts/contact-sheet.js`
 */
var fs = require('fs');
var path = require('path');
var sharp = require('sharp');

var ROOT = path.join(__dirname, '..');
var WINGS_DIR = path.join(ROOT, 'assets', 'wings');
var JSON_PATH = path.join(WINGS_DIR, 'wings.json');
var OUT_PATH = path.join(WINGS_DIR, 'contact-sheet.png');

if (!fs.existsSync(JSON_PATH)) {
  console.error('wings.json not found. Run `node scripts/import-wings.js` first.');
  process.exit(1);
}
var catalog = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
if (catalog.length === 0) {
  console.error('wings.json is empty. Add wings first.');
  process.exit(1);
}

// Layout: 4 columns, N/4 rows. Each cell = 320x200 with PNG centered,
// labeled below in cream serif. Background = dark sage to match game.
var COLS = 4;
var ROWS = Math.ceil(catalog.length / COLS);
var CELL_W = 320;
var CELL_H = 200;
var PAD = 16;
var W = CELL_W * COLS + PAD * (COLS + 1);
var H = CELL_H * ROWS + PAD * (ROWS + 1) + 60; // header strip
var HEADER_H = 50;

function escapeXml(s) {
  return String(s).replace(/[&<>"']/g, function(c){
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'})[c];
  });
}

(async function(){
  // Read each PNG, base64-embed in SVG so sharp doesn't need to
  // resolve external image refs (which it doesn't reliably do).
  var imgs = catalog.map(function(w){
    var p = path.join(WINGS_DIR, w.file);
    if (!fs.existsSync(p)) return null;
    var buf = fs.readFileSync(p);
    return 'data:image/png;base64,' + buf.toString('base64');
  });

  var pieces = [];
  pieces.push('<svg xmlns="http://www.w3.org/2000/svg"'
    + ' viewBox="0 0 ' + W + ' ' + H + '"'
    + ' width="' + W + '" height="' + H + '">');
  pieces.push('<rect width="' + W + '" height="' + H + '" fill="#0d100c"/>');

  // Header
  pieces.push('<text x="' + PAD + '" y="34" fill="#c8a84b"'
    + ' font-family="Georgia, serif" font-size="22" font-weight="600">'
    + 'Litter Bug / wing bank  (' + catalog.length + ' wings)'
    + '</text>');
  pieces.push('<text x="' + (W - PAD) + '" y="34" fill="#6f7766"'
    + ' font-family="ui-monospace, monospace" font-size="12"'
    + ' text-anchor="end">'
    + new Date().toISOString().slice(0, 10)
    + '</text>');

  catalog.forEach(function(w, i){
    var col = i % COLS;
    var row = (i / COLS) | 0;
    var x = PAD + col * (CELL_W + PAD);
    var y = HEADER_H + PAD + row * (CELL_H + PAD);

    // Cell background
    pieces.push('<rect x="' + x + '" y="' + y + '" width="' + CELL_W + '" height="' + CELL_H
      + '" fill="#131614" stroke="#1f231d" rx="10"/>');

    // Wing PNG centered in top portion (256x128 native, scaled to fit)
    var imgW = 256, imgH = 128;
    var ix = x + (CELL_W - imgW) / 2;
    var iy = y + 14;
    if (imgs[i]) {
      // For tintable wings, apply a per-cell gold tint so the sheet
      // doesn't look like 8 identical white blobs. Non-tintable wings
      // render at their authored colors.
      if (w.tintable !== false) {
        pieces.push('<defs><filter id="cs-tint-' + i + '">'
          + '<feColorMatrix type="matrix" values="'
          + '0.784 0 0 0 0  '
          + '0.659 0 0 0 0  '
          + '0.294 0 0 0 0  '
          + '0 0 0 1 0"/>'
          + '</filter></defs>');
        pieces.push('<image href="' + imgs[i] + '"'
          + ' x="' + ix + '" y="' + iy
          + '" width="' + imgW + '" height="' + imgH + '"'
          + ' filter="url(#cs-tint-' + i + ')"/>');
      } else {
        pieces.push('<image href="' + imgs[i] + '"'
          + ' x="' + ix + '" y="' + iy
          + '" width="' + imgW + '" height="' + imgH + '"/>');
      }
    } else {
      pieces.push('<text x="' + (x + CELL_W / 2) + '" y="' + (y + 70)
        + '" fill="#a85a3a" text-anchor="middle" font-size="14">'
        + 'file missing</text>');
    }

    // Attachment marker (small red dot where the wing meets the body)
    if (w.attachment && imgs[i]) {
      var dotX = ix + w.attachment[0];
      var dotY = iy + w.attachment[1];
      pieces.push('<circle cx="' + dotX + '" cy="' + dotY
        + '" r="3" fill="#c8a84b" stroke="#0d100c" stroke-width="1"/>');
    }

    // Label strip
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
  console.log('=== contact-sheet ===');
  console.log('  wrote ' + path.relative(ROOT, OUT_PATH)
    + '  (' + W + 'x' + H + ', ' + Math.round(stat.size / 1024) + ' KB)');
})().catch(function(e){
  console.error('contact-sheet failed:', e && e.message || e);
  process.exit(1);
});
