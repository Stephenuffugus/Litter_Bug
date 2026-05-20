#!/usr/bin/env node
/*
 * Generate placeholder head PNGs for the bug lab.
 *
 * 96x96 viewBox. Convention: attachment point at PNG (0, 48) — left
 * middle, where the head meets the body. Heads face right (away from
 * body). White on transparent; tinted to bug's `dark` palette color
 * at render time.
 *
 * Run: `node scripts/gen-heads.js` (or `npm run heads:gen`)
 */
var fs = require('fs');
var path = require('path');
var sharp = require('sharp');
var LAYERS = require('./art-layers');

var cfg = LAYERS.heads;
var OUT_DIR = path.join(__dirname, '..', 'assets', cfg.dirName);
var JSON_PATH = path.join(OUT_DIR, cfg.catalogFile);
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(path.join(OUT_DIR, 'raw'), { recursive: true });

var HEADS = [
  { name: 'head-01', displayName: 'Round',      rarity: 'common',
    path: 'M 0 48 C 0 12, 80 8, 88 48 C 80 88, 0 84, 0 48 Z' },
  { name: 'head-02', displayName: 'Triangular', rarity: 'uncommon',
    path: 'M 0 38 L 88 28 L 92 48 L 88 68 L 0 58 Z' },
  { name: 'head-03', displayName: 'Bulbous',    rarity: 'common',
    path: 'M 0 48 C 0 6, 92 4, 92 48 C 92 92, 0 90, 0 48 Z' },
  { name: 'head-04', displayName: 'Squared',    rarity: 'rare',
    path: 'M 0 26 L 86 22 L 92 48 L 86 74 L 0 70 Z' },
  { name: 'head-05', displayName: 'Pointed',    rarity: 'uncommon',
    path: 'M 0 48 C 12 34, 88 30, 95 48 C 88 66, 12 62, 0 48 Z' },
  { name: 'head-06', displayName: 'Broad',      rarity: 'common',
    path: 'M 0 48 C 4 4, 80 8, 88 48 C 80 88, 4 92, 0 48 Z' },
  { name: 'head-07', displayName: 'Compact',    rarity: 'common',
    path: 'M 12 48 C 12 20, 80 20, 86 48 C 80 76, 12 76, 12 48 Z' },
  { name: 'head-08', displayName: 'Lobed',      rarity: 'rare',
    path: 'M 0 48 C 0 14, 38 8, 48 26 C 58 8, 92 14, 92 48 C 88 82, 4 82, 0 48 Z' }
];

function svgFor(d) {
  return ''
    + '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '
    + cfg.dimensions[0] + ' ' + cfg.dimensions[1] + '" width="'
    + cfg.dimensions[0] + '" height="' + cfg.dimensions[1] + '">'
    + '<path d="' + d + '" fill="white" />'
    + '</svg>';
}

function seedMetadata() {
  var existing = [];
  if (fs.existsSync(JSON_PATH)) {
    try { existing = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8')); }
    catch (e) { existing = []; }
  }
  var byFile = {};
  existing.forEach(function(w){ if (w && w.file) byFile[w.file] = w; });

  var changed = false;
  HEADS.forEach(function(h){
    var file = h.name + '.png';
    if (byFile[file]) return;
    existing.push({
      file: file,
      name: h.displayName,
      rarity: h.rarity,
      tintable: true,
      attachment: cfg.defaultAttachment.slice(),
      source: 'placeholder-procedural',
      addedAt: new Date().toISOString().slice(0, 10)
    });
    byFile[file] = true;
    changed = true;
  });
  if (changed) {
    existing.sort(function(a, b){ return (a.file > b.file) ? 1 : -1; });
    fs.writeFileSync(JSON_PATH, JSON.stringify(existing, null, 2) + '\n');
    console.log('  ' + cfg.catalogFile + ': seeded ' + HEADS.length + ' placeholder entries');
  } else {
    console.log('  ' + cfg.catalogFile + ': all placeholders already have metadata');
  }
}

(async function(){
  for (var i = 0; i < HEADS.length; i++) {
    var h = HEADS[i];
    var buf = Buffer.from(svgFor(h.path));
    var outPath = path.join(OUT_DIR, h.name + '.png');
    await sharp(buf, { density: 300 })
      .png({ compressionLevel: 9 })
      .toFile(outPath);
    var stat = fs.statSync(outPath);
    console.log('  wrote ' + h.name + '.png  ' + h.displayName.padEnd(12) + stat.size + ' bytes');
  }
  console.log('');
  seedMetadata();
  console.log('');
  console.log(HEADS.length + ' heads written to assets/heads/.');
  console.log('Next: `node scripts/import-art.js heads` to patch the lab.');
})().catch(function(e){
  console.error('gen-heads failed:', e && e.message || e);
  process.exit(1);
});
