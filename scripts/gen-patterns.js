#!/usr/bin/env node
/*
 * Generate placeholder pattern PNGs for the bug lab.
 *
 * Patterns are surface texture overlays that sit on top of the body
 * silhouette but underneath the head. 200x100 viewBox to match the
 * body's coordinate space. White on transparent; tinted to bug's
 * dark color at render time so the pattern reads as shadowed markings
 * on the body.
 *
 * Run: `node scripts/gen-patterns.js && node scripts/import-art.js patterns`
 * (or `npm run patterns:gen`)
 */
var fs = require('fs');
var path = require('path');
var sharp = require('sharp');
var LAYERS = require('./art-layers');

var cfg = LAYERS.patterns;
var OUT_DIR = path.join(__dirname, '..', 'assets', cfg.dirName);
var JSON_PATH = path.join(OUT_DIR, cfg.catalogFile);
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(path.join(OUT_DIR, 'raw'), { recursive: true });

// Each pattern is a fragment of SVG markup (not just a path). Patterns
// stay inside roughly x=30..170, y=20..80 to fit inside typical body
// silhouettes without spilling past the body edges.
var PATTERNS = [
  { name: 'pattern-01', displayName: 'Stripes Vertical', rarity: 'common',
    body: '<rect x="50" y="22" width="6" height="56" fill="white"/>'
        + '<rect x="80" y="22" width="6" height="56" fill="white"/>'
        + '<rect x="110" y="22" width="6" height="56" fill="white"/>'
        + '<rect x="140" y="22" width="6" height="56" fill="white"/>' },
  { name: 'pattern-02', displayName: 'Bands',            rarity: 'common',
    body: '<rect x="30" y="35" width="140" height="5" fill="white"/>'
        + '<rect x="30" y="48" width="140" height="5" fill="white"/>'
        + '<rect x="30" y="61" width="140" height="5" fill="white"/>' },
  { name: 'pattern-03', displayName: 'Spots',            rarity: 'uncommon',
    body: '<circle cx="60" cy="38" r="8" fill="white"/>'
        + '<circle cx="100" cy="58" r="10" fill="white"/>'
        + '<circle cx="140" cy="36" r="8" fill="white"/>'
        + '<circle cx="80" cy="68" r="6" fill="white"/>'
        + '<circle cx="125" cy="66" r="7" fill="white"/>' },
  { name: 'pattern-04', displayName: 'Eyespots',         rarity: 'rare',
    body: '<circle cx="70" cy="50" r="14" fill="white"/>'
        + '<circle cx="130" cy="50" r="14" fill="white"/>' },
  { name: 'pattern-05', displayName: 'Speckled',         rarity: 'common',
    body: (function(){
      var out = '';
      var positions = [
        [40, 30], [55, 60], [70, 35], [85, 70], [100, 30], [115, 65],
        [130, 40], [145, 60], [62, 50], [92, 50], [122, 50], [78, 25],
        [108, 75], [138, 30], [50, 45], [160, 55]
      ];
      positions.forEach(function(p){
        out += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="2.5" fill="white"/>';
      });
      return out;
    })() },
  { name: 'pattern-06', displayName: 'Dashes',           rarity: 'common',
    body: '<rect x="40" y="36" width="14" height="4" fill="white"/>'
        + '<rect x="70" y="36" width="14" height="4" fill="white"/>'
        + '<rect x="100" y="36" width="14" height="4" fill="white"/>'
        + '<rect x="130" y="36" width="14" height="4" fill="white"/>'
        + '<rect x="55" y="60" width="14" height="4" fill="white"/>'
        + '<rect x="85" y="60" width="14" height="4" fill="white"/>'
        + '<rect x="115" y="60" width="14" height="4" fill="white"/>'
        + '<rect x="145" y="60" width="14" height="4" fill="white"/>' },
  { name: 'pattern-07', displayName: 'Swirl',            rarity: 'rare',
    body: '<path d="M 45 50 Q 75 25, 100 50 T 155 50" stroke="white" stroke-width="4" fill="none" stroke-linecap="round"/>'
        + '<path d="M 45 65 Q 75 40, 100 65 T 155 65" stroke="white" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.7"/>' },
  { name: 'pattern-08', displayName: 'Chevrons',         rarity: 'uncommon',
    body: '<polyline points="40,40 70,30 100,40 130,30 160,40" stroke="white" stroke-width="3" fill="none" stroke-linejoin="round"/>'
        + '<polyline points="40,60 70,50 100,60 130,50 160,60" stroke="white" stroke-width="3" fill="none" stroke-linejoin="round"/>' }
];

function svgFor(body) {
  return ''
    + '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '
    + cfg.dimensions[0] + ' ' + cfg.dimensions[1] + '" width="'
    + cfg.dimensions[0] + '" height="' + cfg.dimensions[1] + '">'
    + body
    + '</svg>';
}

function seedMetadata() {
  var existing = [];
  if (fs.existsSync(JSON_PATH)) {
    try { existing = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8')); }
    catch (e) { existing = []; }
  }
  var byFile = {};
  existing.forEach(function(e){ if (e && e.file) byFile[e.file] = e; });

  var changed = false;
  PATTERNS.forEach(function(p){
    var file = p.name + '.png';
    if (byFile[file]) return;
    existing.push({
      file: file,
      name: p.displayName,
      rarity: p.rarity,
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
    console.log('  ' + cfg.catalogFile + ': seeded ' + PATTERNS.length + ' placeholder entries');
  } else {
    console.log('  ' + cfg.catalogFile + ': all placeholders already have metadata');
  }
}

(async function(){
  for (var i = 0; i < PATTERNS.length; i++) {
    var p = PATTERNS[i];
    var buf = Buffer.from(svgFor(p.body));
    var outPath = path.join(OUT_DIR, p.name + '.png');
    await sharp(buf, { density: 300 })
      .png({ compressionLevel: 9 })
      .toFile(outPath);
    var stat = fs.statSync(outPath);
    console.log('  wrote ' + p.name + '.png  ' + p.displayName.padEnd(20) + stat.size + ' bytes');
  }
  console.log('');
  seedMetadata();
  console.log('');
  console.log(PATTERNS.length + ' patterns written to assets/patterns/.');
  console.log('Next: `node scripts/import-art.js patterns` to patch the lab.');
})().catch(function(e){
  console.error('gen-patterns failed:', e && e.message || e);
  process.exit(1);
});
