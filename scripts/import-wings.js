#!/usr/bin/env node
/*
 * import-wings.js
 *
 * The art pipeline for bug wings. Three jobs:
 *
 * 1. Process anything in `assets/wings/raw/`. Each PNG there gets
 *    normalized to 256x128 transparent, assigned the next available
 *    wing-NN slot, and moved into `assets/wings/`. The raw file is
 *    deleted so the drop-folder stays clean.
 *
 * 2. Rebuild `assets/wings/wings.json` from whatever wing-NN.png files
 *    live in `assets/wings/`. Existing metadata (name, rarity, tintable,
 *    attachment) is preserved across re-imports; only newly-imported
 *    wings get default metadata seeded.
 *
 * 3. Patch the `WING_BANK` block in `bug-lab.html` so the lab matches
 *    the catalog. The patched block lives between two sentinel comments
 *    so this script can find it and rewrite it idempotently.
 *
 * Run: `npm run wings` or `node scripts/import-wings.js`
 */
var fs = require('fs');
var path = require('path');
var sharp = require('sharp');

var ROOT = path.join(__dirname, '..');
var WINGS_DIR = path.join(ROOT, 'assets', 'wings');
var RAW_DIR = path.join(WINGS_DIR, 'raw');
var JSON_PATH = path.join(WINGS_DIR, 'wings.json');
var LAB_PATH = path.join(ROOT, 'bug-lab.html');

var TARGET_W = 256;
var TARGET_H = 128;
var DEFAULT_ATTACHMENT = [24, 64]; // px in normalized image

var SENTINEL_START = '// WING_BANK_AUTOGEN_START — managed by scripts/import-wings.js (do not edit by hand)';
var SENTINEL_END = '// WING_BANK_AUTOGEN_END';

fs.mkdirSync(WINGS_DIR, { recursive: true });
fs.mkdirSync(RAW_DIR, { recursive: true });

// ── 1. Load existing wings.json so we preserve user-edited metadata. ──
var existing = [];
if (fs.existsSync(JSON_PATH)) {
  try { existing = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8')); }
  catch (e) {
    console.error('  ! wings.json failed to parse; starting fresh:', e.message);
    existing = [];
  }
}
var existingByFile = {};
existing.forEach(function(w){ if (w && w.file) existingByFile[w.file] = w; });

// ── 2. Process raw/ drops. ────────────────────────────────────────────
async function nextSlot() {
  // Find the lowest unused wing-NN.png index, starting at 01.
  var used = {};
  fs.readdirSync(WINGS_DIR).forEach(function(f){
    var m = f.match(/^wing-(\d{2,})\.png$/);
    if (m) used[parseInt(m[1], 10)] = true;
  });
  for (var i = 1; i <= 999; i++) if (!used[i]) return i;
  throw new Error('exhausted wing slots');
}

function slotName(idx) {
  return 'wing-' + String(idx).padStart(2, '0') + '.png';
}

function nameFromRawFile(filename) {
  // dragonfly-iridescent.png  →  "Dragonfly Iridescent"
  var base = filename.replace(/\.[^.]+$/, '');
  return base.split(/[-_\s]+/)
    .filter(Boolean)
    .map(function(w){ return w.charAt(0).toUpperCase() + w.slice(1); })
    .join(' ');
}

async function normalize(srcPath, destPath) {
  // Fit the source into TARGET_W x TARGET_H, pad with transparent,
  // ensure RGBA, write as PNG with max compression.
  await sharp(srcPath)
    .resize(TARGET_W, TARGET_H, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .ensureAlpha()
    .png({ compressionLevel: 9 })
    .toFile(destPath);
}

async function processRaw() {
  if (!fs.existsSync(RAW_DIR)) return [];
  var rawFiles = fs.readdirSync(RAW_DIR)
    .filter(function(f){ return /\.(png|jpe?g|webp)$/i.test(f); });
  if (rawFiles.length === 0) return [];

  console.log('  processing ' + rawFiles.length + ' file(s) from raw/');
  var imported = [];
  for (var i = 0; i < rawFiles.length; i++) {
    var raw = rawFiles[i];
    var idx = await nextSlot();
    var slot = slotName(idx);
    var destPath = path.join(WINGS_DIR, slot);
    await normalize(path.join(RAW_DIR, raw), destPath);
    fs.unlinkSync(path.join(RAW_DIR, raw));
    imported.push({ slot: slot, name: nameFromRawFile(raw), srcName: raw });
    console.log('    ' + raw + '  →  ' + slot + '  (name: ' + nameFromRawFile(raw) + ')');
  }
  return imported;
}

// ── 3. Rebuild wings.json from disk + imported list. ──────────────────
function rebuildCatalog(imported) {
  var files = fs.readdirSync(WINGS_DIR)
    .filter(function(f){ return /^wing-\d{2,}\.png$/.test(f); })
    .sort();

  // Default seed per newly-imported file.
  var seededByFile = {};
  imported.forEach(function(it){
    seededByFile[it.slot] = {
      file: it.slot,
      name: it.name,
      rarity: 'common',
      tintable: true,
      attachment: DEFAULT_ATTACHMENT.slice(),
      source: 'raw-import',
      addedAt: new Date().toISOString().slice(0, 10)
    };
  });

  var catalog = files.map(function(file){
    if (existingByFile[file]) {
      // Preserve all user-edited fields. Just make sure file matches.
      var prev = existingByFile[file];
      prev.file = file;
      return prev;
    }
    if (seededByFile[file]) return seededByFile[file];
    // File on disk that we don't know about — seed minimal defaults.
    return {
      file: file,
      name: file.replace(/\.png$/, '').replace(/-/g, ' ')
        .replace(/\b\w/g, function(c){ return c.toUpperCase(); }),
      rarity: 'common',
      tintable: true,
      attachment: DEFAULT_ATTACHMENT.slice(),
      source: 'detected-on-disk',
      addedAt: new Date().toISOString().slice(0, 10)
    };
  });

  fs.writeFileSync(JSON_PATH, JSON.stringify(catalog, null, 2) + '\n');
  return catalog;
}

// ── 4. Patch the lab's WING_BANK block. ───────────────────────────────
function patchLab(catalog) {
  var src = fs.readFileSync(LAB_PATH, 'utf8');
  var startIdx = src.indexOf(SENTINEL_START);
  var endIdx = src.indexOf(SENTINEL_END);
  if (startIdx < 0 || endIdx < 0 || endIdx < startIdx) {
    throw new Error('WING_BANK sentinel comments not found in bug-lab.html. '
      + 'Add them around the WING_BANK declaration so this script can patch it.');
  }
  // Inject a new block between the sentinels.
  var indent = '  '; // match surrounding two-space indent
  var entries = catalog.map(function(w){
    return indent + indent + '{ file: ' + JSON.stringify(w.file)
      + ', name: ' + JSON.stringify(w.name || '')
      + ', tintable: ' + (w.tintable === false ? 'false' : 'true')
      + ', attachment: [' + (w.attachment ? w.attachment.join(', ') : '24, 64')
      + '] }';
  }).join(',\n');
  var block = SENTINEL_START + '\n'
    + indent + 'var WING_BANK = [\n'
    + entries + '\n'
    + indent + '];\n'
    + indent + SENTINEL_END;

  // Replace everything between the sentinel lines (inclusive).
  var before = src.slice(0, startIdx);
  var afterRegion = src.slice(endIdx);
  var newlineAfter = afterRegion.indexOf('\n');
  var after = newlineAfter >= 0 ? afterRegion.slice(newlineAfter + 1) : '';
  var patched = before + block + '\n' + after;

  if (patched === src) return false;
  fs.writeFileSync(LAB_PATH, patched);
  return true;
}

// ── Run. ───────────────────────────────────────────────────────────────
(async function(){
  console.log('=== import-wings ===');
  var imported = await processRaw();
  var catalog = rebuildCatalog(imported);
  var labChanged = patchLab(catalog);
  console.log('');
  console.log('  catalog: ' + catalog.length + ' wing(s)');
  catalog.forEach(function(w){
    console.log('    - ' + w.file + '  ' + (w.name || '').padEnd(20)
      + ' ' + w.rarity + (w.tintable === false ? '  [colored]' : '  [tintable]'));
  });
  console.log('');
  console.log('  wings.json: written');
  console.log('  bug-lab.html: ' + (labChanged ? 'patched' : 'already current'));
})().catch(function(e){
  console.error('import-wings failed:', e && e.message || e);
  process.exit(1);
});
