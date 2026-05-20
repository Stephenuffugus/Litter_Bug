/*
 * Generate placeholder wing PNGs for the bug lab.
 *
 * Each wing here is a hand-written SVG silhouette (white on transparent)
 * that gets rasterized to a PNG via sharp. The bug-lab tints these at
 * runtime via feColorMatrix, so they ship white and recolor per bug.
 *
 * Replace these with real FLUX/Midjourney art by overwriting the same
 * filenames in assets/wings/. No code change needed on the lab side.
 *
 * Run: `node scripts/gen-wings.js`
 */
var fs = require('fs');
var path = require('path');
var sharp = require('sharp');

var OUT_DIR = path.join(__dirname, '..', 'assets', 'wings');
fs.mkdirSync(OUT_DIR, { recursive: true });

// Each entry is a wing silhouette inside a 256x128 viewBox. The wing's
// attachment point is at x=24, y=64 (left middle) and it extends right.
// The lab places these on the bug with rotation; we ship the un-rotated
// silhouette so the lab is the one controlling pose.
//
// `displayName` and `rarity` are seeded into wings.json so the metadata
// matches the visual character of each placeholder. import-wings.js
// preserves these across re-runs.
var WINGS = [
  { name: 'wing-01', displayName: 'Rounded',    rarity: 'common',
    path: 'M 24 64 C 30 14, 200 12, 232 64 C 220 116, 60 124, 24 64 Z' },
  { name: 'wing-02', displayName: 'Pointed',    rarity: 'common',
    path: 'M 24 64 C 60 22, 220 24, 244 70 C 220 90, 110 100, 24 64 Z' },
  { name: 'wing-03', displayName: 'Elongated',  rarity: 'uncommon',
    path: 'M 24 64 C 80 46, 232 50, 246 66 C 232 84, 80 92, 24 64 Z' },
  { name: 'wing-04', displayName: 'Lobed',      rarity: 'uncommon',
    path: 'M 24 64 C 36 20, 110 6, 134 36 C 156 14, 214 18, 234 64 C 208 116, 60 122, 24 64 Z' },
  { name: 'wing-05', displayName: 'Triangular', rarity: 'common',
    path: 'M 24 40 L 240 70 L 24 100 Z' },
  { name: 'wing-06', displayName: 'Crescent',   rarity: 'rare',
    path: 'M 32 64 C 32 20, 168 14, 240 44 C 184 70, 130 86, 32 64 Z' },
  { name: 'wing-07', displayName: 'Swept',      rarity: 'uncommon',
    path: 'M 24 70 C 44 26, 214 14, 246 40 C 224 82, 110 102, 24 70 Z' },
  { name: 'wing-08', displayName: 'Compound',   rarity: 'rare',
    path: 'M 24 48 C 60 22, 214 26, 240 46 C 214 60, 100 66, 24 48 Z '
        + 'M 24 86 C 60 76, 214 78, 240 96 C 214 110, 100 116, 24 86 Z' }
];

function svgFor(d) {
  return ''
    + '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 128" width="256" height="128">'
    + '<path d="' + d + '" fill="white" />'
    + '</svg>';
}

// Seed wings.json metadata for any placeholder this script owns that
// doesn't already have an entry. Preserves user-edited metadata across
// re-runs. Existing entries are left alone.
function seedMetadata() {
  var JSON_PATH = path.join(OUT_DIR, 'wings.json');
  var existing = [];
  if (fs.existsSync(JSON_PATH)) {
    try { existing = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8')); }
    catch (e) { existing = []; }
  }
  var byFile = {};
  existing.forEach(function(w){ if (w && w.file) byFile[w.file] = w; });

  var changed = false;
  WINGS.forEach(function(w){
    var file = w.name + '.png';
    if (byFile[file]) return; // preserve whatever's already there
    existing.push({
      file: file,
      name: w.displayName,
      rarity: w.rarity,
      tintable: true,
      attachment: [24, 64],
      source: 'placeholder-procedural',
      addedAt: new Date().toISOString().slice(0, 10)
    });
    byFile[file] = true;
    changed = true;
  });
  if (changed) {
    // Sort by file so the JSON output is stable across runs.
    existing.sort(function(a, b){ return (a.file > b.file) ? 1 : -1; });
    fs.writeFileSync(JSON_PATH, JSON.stringify(existing, null, 2) + '\n');
    console.log('  wings.json: seeded ' + WINGS.length + ' placeholder metadata entries');
  } else {
    console.log('  wings.json: all placeholders already have metadata');
  }
}

(async function(){
  for (var i = 0; i < WINGS.length; i++) {
    var w = WINGS[i];
    var buf = Buffer.from(svgFor(w.path));
    var outPath = path.join(OUT_DIR, w.name + '.png');
    await sharp(buf, { density: 300 })
      .png({ compressionLevel: 9 })
      .toFile(outPath);
    var stat = fs.statSync(outPath);
    console.log('  wrote ' + w.name + '.png  ' + w.displayName.padEnd(12) + stat.size + ' bytes');
  }
  console.log('');
  seedMetadata();
  console.log('');
  console.log(WINGS.length + ' wings written to assets/wings/.');
  console.log('Next: `node scripts/import-wings.js` to patch the lab.');
})().catch(function(e){
  console.error('gen-wings failed:', e && e.message || e);
  process.exit(1);
});
