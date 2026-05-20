#!/usr/bin/env node
/*
 * import-art.js <layer>
 *
 * The generic art-import pipeline. Takes a layer name (wings / bodies /
 * heads / patterns — see scripts/art-layers.js for the registry) and:
 *
 * 1. Processes anything in `assets/<layer>/raw/`. Each PNG gets
 *    normalized to the layer's target dimensions, assigned the next
 *    available `<prefix>-NN.png` slot, and moved into the layer dir.
 *    The raw file is deleted so the drop-folder stays clean.
 *
 * 2. Rebuilds `assets/<layer>/<layer>.json` from whatever
 *    `<prefix>-NN.png` files live in the layer dir. Existing metadata
 *    (name, rarity, tintable, attachment) is preserved across
 *    re-imports; only newly imported files get default metadata.
 *
 * 3. Patches the `<BANK_CONST>` block in `bug-lab.html` so the lab
 *    matches the catalog. The patched block lives between sentinel
 *    comments so this script can find and rewrite it idempotently.
 *
 * Examples:
 *   node scripts/import-art.js wings
 *   node scripts/import-art.js bodies
 *   npm run wings   (same as the first)
 */
var fs = require('fs');
var path = require('path');
var sharp = require('sharp');
var LAYERS = require('./art-layers');

var ROOT = path.join(__dirname, '..');
// Files that may contain bank sentinel blocks. Each is patched
// independently. Add new consumer files here as they land.
var PATCH_PATHS = [
  path.join(ROOT, 'bug-lab.html'),
  path.join(ROOT, 'preview.html')
];

var layerName = process.argv[2];
if (!layerName || !LAYERS[layerName]) {
  console.error('Usage: node scripts/import-art.js <layer>');
  console.error('Available layers: ' + Object.keys(LAYERS).join(', '));
  process.exit(1);
}
var cfg = LAYERS[layerName];
var IS_PROCEDURAL = cfg.kind === 'procedural';

var LAYER_DIR = path.join(ROOT, 'assets', cfg.dirName);
var RAW_DIR = path.join(LAYER_DIR, 'raw');
var JSON_PATH = path.join(LAYER_DIR, cfg.catalogFile);
var FILE_RE = cfg.filePrefix
  ? new RegExp('^' + cfg.filePrefix + '-(\\d{2,})\\.png$')
  : null;

fs.mkdirSync(LAYER_DIR, { recursive: true });
if (!IS_PROCEDURAL) fs.mkdirSync(RAW_DIR, { recursive: true });

// ── 1. Load existing catalog so we preserve user-edited metadata. ─────
var existing = [];
if (fs.existsSync(JSON_PATH)) {
  try { existing = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8')); }
  catch (e) {
    console.error('  ! ' + cfg.catalogFile + ' failed to parse; starting fresh:', e.message);
    existing = [];
  }
}
var existingByFile = {};
existing.forEach(function(w){ if (w && w.file) existingByFile[w.file] = w; });

// ── 2. Process raw/ drops. ────────────────────────────────────────────
async function nextSlot() {
  var used = {};
  fs.readdirSync(LAYER_DIR).forEach(function(f){
    var m = f.match(FILE_RE);
    if (m) used[parseInt(m[1], 10)] = true;
  });
  for (var i = 1; i <= 999; i++) if (!used[i]) return i;
  throw new Error('exhausted ' + cfg.filePrefix + ' slots');
}

function slotName(idx) {
  return cfg.filePrefix + '-' + String(idx).padStart(2, '0') + '.png';
}

function nameFromRawFile(filename) {
  var base = filename.replace(/\.[^.]+$/, '');
  return base.split(/[-_\s]+/)
    .filter(Boolean)
    .map(function(w){ return w.charAt(0).toUpperCase() + w.slice(1); })
    .join(' ');
}

async function normalize(srcPath, destPath) {
  await sharp(srcPath)
    .resize(cfg.dimensions[0], cfg.dimensions[1], {
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
    var destPath = path.join(LAYER_DIR, slot);
    await normalize(path.join(RAW_DIR, raw), destPath);
    fs.unlinkSync(path.join(RAW_DIR, raw));
    imported.push({ slot: slot, name: nameFromRawFile(raw), srcName: raw });
    console.log('    ' + raw + '  →  ' + slot + '  (name: ' + nameFromRawFile(raw) + ')');
  }
  return imported;
}

// ── 3. Rebuild catalog from disk + imported list. ─────────────────────
function rebuildCatalog(imported) {
  var files = fs.readdirSync(LAYER_DIR)
    .filter(function(f){ return FILE_RE.test(f); })
    .sort();

  var seededByFile = {};
  imported.forEach(function(it){
    seededByFile[it.slot] = {
      file: it.slot,
      name: it.name,
      rarity: 'common',
      tintable: true,
      attachment: cfg.defaultAttachment.slice(),
      source: 'raw-import',
      addedAt: new Date().toISOString().slice(0, 10)
    };
  });

  var catalog = files.map(function(file){
    if (existingByFile[file]) {
      var prev = existingByFile[file];
      prev.file = file;
      return prev;
    }
    if (seededByFile[file]) return seededByFile[file];
    return {
      file: file,
      name: file.replace(/\.png$/, '').replace(/-/g, ' ')
        .replace(/\b\w/g, function(c){ return c.toUpperCase(); }),
      rarity: 'common',
      tintable: true,
      attachment: cfg.defaultAttachment.slice(),
      source: 'detected-on-disk',
      addedAt: new Date().toISOString().slice(0, 10)
    };
  });

  fs.writeFileSync(JSON_PATH, JSON.stringify(catalog, null, 2) + '\n');
  return catalog;
}

// ── 4. Patch the bank block in every file that has the sentinels. ────
// Files without the sentinels are skipped silently — a new consumer
// can opt in by adding its own sentinel block.
function buildBlock(catalog) {
  var sentinelStart = '// ' + cfg.sentinelStart;
  var sentinelEnd = '// ' + cfg.sentinelEnd;
  var indent = '  ';
  var entries;
  if (IS_PROCEDURAL) {
    entries = catalog.map(function(e){
      return indent + indent + JSON.stringify(e);
    }).join(',\n');
  } else {
    entries = catalog.map(function(w){
      return indent + indent + '{ file: ' + JSON.stringify(w.file)
        + ', name: ' + JSON.stringify(w.name || '')
        + ', tintable: ' + (w.tintable === false ? 'false' : 'true')
        + ', attachment: [' + (w.attachment ? w.attachment.join(', ') : cfg.defaultAttachment.join(', '))
        + '] }';
    }).join(',\n');
  }
  return sentinelStart + ' — managed by scripts/import-art.js (do not edit by hand)\n'
    + indent + 'var ' + cfg.bankConst + ' = [\n'
    + entries + '\n'
    + indent + '];\n'
    + indent + sentinelEnd;
}

function patchOne(filePath, block) {
  if (!fs.existsSync(filePath)) return 'missing';
  var src = fs.readFileSync(filePath, 'utf8');
  var sentinelStart = '// ' + cfg.sentinelStart;
  var sentinelEnd = '// ' + cfg.sentinelEnd;
  var startIdx = src.indexOf(sentinelStart);
  var endIdx = src.indexOf(sentinelEnd);
  if (startIdx < 0 || endIdx < 0 || endIdx < startIdx) return 'no-sentinels';
  var before = src.slice(0, startIdx);
  var afterRegion = src.slice(endIdx);
  var newlineAfter = afterRegion.indexOf('\n');
  var after = newlineAfter >= 0 ? afterRegion.slice(newlineAfter + 1) : '';
  var patched = before + block + '\n' + after;
  if (patched === src) return 'unchanged';
  fs.writeFileSync(filePath, patched);
  return 'patched';
}

function patchAll(catalog) {
  var block = buildBlock(catalog);
  var results = [];
  PATCH_PATHS.forEach(function(p){
    var status = patchOne(p, block);
    results.push({ path: p, status: status });
  });
  // At least one file must have the sentinels; otherwise the layer is
  // unwired everywhere.
  var anyPatchable = results.some(function(r){
    return r.status === 'patched' || r.status === 'unchanged';
  });
  if (!anyPatchable) {
    throw new Error(cfg.bankConst + ' sentinel comments not found in any patch target. '
      + 'Add `// ' + cfg.sentinelStart + '` and `// ' + cfg.sentinelEnd
      + '` around the ' + cfg.bankConst + ' declaration in bug-lab.html or preview.html.');
  }
  return results;
}

// ── Run. ───────────────────────────────────────────────────────────────
(async function(){
  console.log('=== import-art (' + layerName + ') ===');
  if (IS_PROCEDURAL) {
    // Procedural layer: skip raw/ + PNG ops. Read JSON, patch consumers.
    if (!fs.existsSync(JSON_PATH)) {
      throw new Error(cfg.catalogFile + ' not found. Run `node scripts/gen-' + layerName
        + '.js` to seed initial entries.');
    }
    var catalog = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
    var results = patchAll(catalog);
    console.log('');
    console.log('  catalog: ' + catalog.length + ' ' + cfg.displayName + '(s)');
    catalog.forEach(function(e){
      console.log('    - ' + (e.name || '').padEnd(20) + ' '
        + (e.rarity || 'common'));
    });
    console.log('');
    console.log('  ' + cfg.catalogFile + ': source of truth');
    results.forEach(function(r){
      console.log('  ' + path.relative(ROOT, r.path) + ': ' + r.status);
    });
    return;
  }

  var imported = await processRaw();
  var catalog = rebuildCatalog(imported);
  var results = patchAll(catalog);
  console.log('');
  console.log('  catalog: ' + catalog.length + ' ' + cfg.displayName + '(s)');
  catalog.forEach(function(w){
    console.log('    - ' + w.file + '  ' + (w.name || '').padEnd(20)
      + ' ' + (w.rarity || 'common') + (w.tintable === false ? '  [colored]' : '  [tintable]'));
  });
  console.log('');
  console.log('  ' + cfg.catalogFile + ': written');
  results.forEach(function(r){
    console.log('  ' + path.relative(ROOT, r.path) + ': ' + r.status);
  });
})().catch(function(e){
  console.error('import-art failed:', e && e.message || e);
  process.exit(1);
});
