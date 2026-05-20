#!/usr/bin/env node
/*
 * Generate placeholder leg-set entries for the bug lab.
 *
 * Legs are procedural — they're 6 line strokes drawn at render time
 * by the lab, NOT PNG art. This script seeds legs.json with 8 leg-set
 * variations that drive the line-drawing parameters (count, length,
 * segments, thickness, pose).
 *
 * Run: `node scripts/gen-legs.js && node scripts/import-art.js legs`
 * (or `npm run legs:gen`)
 */
var fs = require('fs');
var path = require('path');
var LAYERS = require('./art-layers');

var cfg = LAYERS.legs;
var OUT_DIR = path.join(__dirname, '..', 'assets', cfg.dirName);
var JSON_PATH = path.join(OUT_DIR, cfg.catalogFile);
fs.mkdirSync(OUT_DIR, { recursive: true });

// Each leg-set has parameters the lab interprets when drawing legs.
//   count:     number of legs (6 for insects; 8 for arachnid-style)
//   length:    leg length in viewBox px (12..30)
//   segments:  1 = straight stroke, 2 = one joint, 3 = two joints
//   thickness: stroke width in viewBox px (1.5..3.5)
//   pose:      'spread' / 'forward' / 'low' / 'splayed'
//              describes how legs angle from the body
var LEGS = [
  { name: 'Sprinter',   count: 6, length: 22, segments: 2, thickness: 2.5, pose: 'spread',  rarity: 'common' },
  { name: 'Crouched',   count: 6, length: 16, segments: 2, thickness: 2.8, pose: 'low',     rarity: 'common' },
  { name: 'Long-Reach', count: 6, length: 28, segments: 2, thickness: 2.0, pose: 'spread',  rarity: 'uncommon' },
  { name: 'Stubby',     count: 6, length: 13, segments: 1, thickness: 3.0, pose: 'spread',  rarity: 'common' },
  { name: 'Mantis',     count: 6, length: 26, segments: 3, thickness: 2.2, pose: 'forward', rarity: 'rare' },
  { name: 'Eight-Pack', count: 8, length: 20, segments: 2, thickness: 1.8, pose: 'spread',  rarity: 'rare' },
  { name: 'Bristled',   count: 6, length: 18, segments: 2, thickness: 1.5, pose: 'splayed', rarity: 'uncommon' },
  { name: 'Smooth',     count: 6, length: 22, segments: 1, thickness: 2.5, pose: 'spread',  rarity: 'common' }
];

function seedMetadata() {
  var existing = [];
  if (fs.existsSync(JSON_PATH)) {
    try { existing = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8')); }
    catch (e) { existing = []; }
  }
  var byName = {};
  existing.forEach(function(e){ if (e && e.name) byName[e.name] = e; });

  var changed = false;
  LEGS.forEach(function(l){
    if (byName[l.name]) return;
    existing.push(Object.assign({}, l, {
      source: 'placeholder-procedural',
      addedAt: new Date().toISOString().slice(0, 10)
    }));
    byName[l.name] = true;
    changed = true;
  });
  if (changed) {
    fs.writeFileSync(JSON_PATH, JSON.stringify(existing, null, 2) + '\n');
    console.log('  ' + cfg.catalogFile + ': seeded ' + LEGS.length + ' placeholder entries');
  } else {
    console.log('  ' + cfg.catalogFile + ': all placeholders already have metadata');
  }
}

console.log('=== gen-legs ===');
seedMetadata();
console.log('');
console.log(LEGS.length + ' leg-sets in ' + cfg.catalogFile + '.');
console.log('Next: `node scripts/import-art.js legs` to patch the lab.');
