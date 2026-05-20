#!/usr/bin/env node
/*
 * Generate placeholder body PNGs for the bug lab.
 *
 * Each body is a hand-written SVG silhouette inside a 200x100 viewBox.
 * Convention: the head end is on the right (x=200, attachment point),
 * tail end is on the left. White on transparent; tinted at render time
 * by feColorMatrix to the bug's primary palette color.
 *
 * Replace these with real art by overwriting the same filenames in
 * assets/bodies/. No code change needed.
 *
 * Run: `node scripts/gen-bodies.js` (or `npm run bodies:gen`)
 */
var fs = require('fs');
var path = require('path');
var sharp = require('sharp');
var LAYERS = require('./art-layers');

var cfg = LAYERS.bodies;
var OUT_DIR = path.join(__dirname, '..', 'assets', cfg.dirName);
var JSON_PATH = path.join(OUT_DIR, cfg.catalogFile);
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(path.join(OUT_DIR, 'raw'), { recursive: true });

// Body silhouettes inside 200x100. Right edge (~200) = head attachment.
// Vary length, width, taper, and segmentation for visual distinctness.
var BODIES = [
  { name: 'body-01', displayName: 'Oval',       rarity: 'common',
    path: 'M 25 50 C 30 18, 180 18, 195 50 C 180 82, 30 82, 25 50 Z' },
  { name: 'body-02', displayName: 'Slender',    rarity: 'uncommon',
    path: 'M 20 50 C 45 32, 180 35, 195 50 C 180 65, 45 68, 20 50 Z' },
  { name: 'body-03', displayName: 'Plump',      rarity: 'common',
    path: 'M 18 50 C 30 8, 180 8, 195 50 C 180 92, 30 92, 18 50 Z' },
  { name: 'body-04', displayName: 'Segmented',  rarity: 'uncommon',
    path: 'M 25 50 C 30 22, 95 22, 100 50 C 95 78, 30 78, 25 50 Z '
        + 'M 110 50 C 115 18, 190 18, 195 50 C 190 82, 115 82, 110 50 Z' },
  { name: 'body-05', displayName: 'Tapered',    rarity: 'common',
    path: 'M 15 50 L 55 28 L 180 32 C 195 38, 195 62, 180 68 L 55 72 Z' },
  { name: 'body-06', displayName: 'Round',      rarity: 'rare',
    path: 'M 55 50 C 55 10, 165 10, 175 50 C 165 90, 55 90, 55 50 Z' },
  { name: 'body-07', displayName: 'Elongated',  rarity: 'uncommon',
    path: 'M 12 50 C 25 38, 180 42, 196 50 C 180 58, 25 62, 12 50 Z' },
  { name: 'body-08', displayName: 'Compact',    rarity: 'rare',
    path: 'M 60 50 C 65 18, 155 18, 165 50 C 155 82, 65 82, 60 50 Z' }
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
  BODIES.forEach(function(b){
    var file = b.name + '.png';
    if (byFile[file]) return;
    existing.push({
      file: file,
      name: b.displayName,
      rarity: b.rarity,
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
    console.log('  ' + cfg.catalogFile + ': seeded ' + BODIES.length + ' placeholder entries');
  } else {
    console.log('  ' + cfg.catalogFile + ': all placeholders already have metadata');
  }
}

(async function(){
  for (var i = 0; i < BODIES.length; i++) {
    var b = BODIES[i];
    var buf = Buffer.from(svgFor(b.path));
    var outPath = path.join(OUT_DIR, b.name + '.png');
    await sharp(buf, { density: 300 })
      .png({ compressionLevel: 9 })
      .toFile(outPath);
    var stat = fs.statSync(outPath);
    console.log('  wrote ' + b.name + '.png  ' + b.displayName.padEnd(12) + stat.size + ' bytes');
  }
  console.log('');
  seedMetadata();
  console.log('');
  console.log(BODIES.length + ' bodies written to assets/bodies/.');
  console.log('Next: `node scripts/import-art.js bodies` to patch the lab.');
})().catch(function(e){
  console.error('gen-bodies failed:', e && e.message || e);
  process.exit(1);
});
