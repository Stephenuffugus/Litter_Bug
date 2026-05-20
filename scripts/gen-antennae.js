#!/usr/bin/env node
/*
 * Generate placeholder antenna-set entries for the bug lab.
 *
 * Antennae are procedural like legs — drawn as inline SVG bezier paths
 * at render time based on parameters in antennae.json.
 *
 * Run: `node scripts/gen-antennae.js && node scripts/import-art.js antennae`
 * (or `npm run antennae:gen`)
 */
var fs = require('fs');
var path = require('path');
var LAYERS = require('./art-layers');

var cfg = LAYERS.antennae;
var OUT_DIR = path.join(__dirname, '..', 'assets', cfg.dirName);
var JSON_PATH = path.join(OUT_DIR, cfg.catalogFile);
fs.mkdirSync(OUT_DIR, { recursive: true });

// Each antenna-set has parameters the lab interprets when drawing
// the two antennae from the head front:
//   length:    in viewBox px (14..40)
//   curl:      0..1 — how much the bezier midpoint pulls back/in
//   thickness: stroke width (1..2.5)
//   shape:     'straight' / 'curved' / 'club-tipped' / 'feathered' / 'bent'
//   spread:    angle in degrees between the two antennae (10..50)
var ANTENNAE = [
  { name: 'Threadlike', length: 24, curl: 0.4, thickness: 1.5, shape: 'straight',    spread: 30, rarity: 'common' },
  { name: 'Curled',     length: 22, curl: 0.8, thickness: 1.6, shape: 'curved',      spread: 28, rarity: 'common' },
  { name: 'Clubbed',    length: 26, curl: 0.4, thickness: 1.8, shape: 'club-tipped', spread: 32, rarity: 'uncommon' },
  { name: 'Feathered',  length: 28, curl: 0.5, thickness: 2.4, shape: 'feathered',   spread: 36, rarity: 'rare' },
  { name: 'Short',      length: 14, curl: 0.5, thickness: 1.6, shape: 'curved',      spread: 26, rarity: 'common' },
  { name: 'Long',       length: 38, curl: 0.4, thickness: 1.2, shape: 'straight',    spread: 42, rarity: 'uncommon' },
  { name: 'Elbowed',    length: 24, curl: 0.5, thickness: 2.0, shape: 'bent',        spread: 30, rarity: 'rare' },
  { name: 'Bristle',    length: 20, curl: 0.3, thickness: 1.5, shape: 'straight',    spread: 24, rarity: 'common' }
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
  ANTENNAE.forEach(function(a){
    if (byName[a.name]) return;
    existing.push(Object.assign({}, a, {
      source: 'placeholder-procedural',
      addedAt: new Date().toISOString().slice(0, 10)
    }));
    byName[a.name] = true;
    changed = true;
  });
  if (changed) {
    fs.writeFileSync(JSON_PATH, JSON.stringify(existing, null, 2) + '\n');
    console.log('  ' + cfg.catalogFile + ': seeded ' + ANTENNAE.length + ' placeholder entries');
  } else {
    console.log('  ' + cfg.catalogFile + ': all placeholders already have metadata');
  }
}

console.log('=== gen-antennae ===');
seedMetadata();
console.log('');
console.log(ANTENNAE.length + ' antenna-sets in ' + cfg.catalogFile + '.');
console.log('Next: `node scripts/import-art.js antennae` to patch the lab.');
