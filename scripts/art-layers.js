/*
 * art-layers.js
 *
 * Single source of truth for every PNG-based art layer in Litter Bug.
 * Used by import-art.js and contact-sheet.js (both take a layer name
 * as their CLI arg and look up its config here).
 *
 * Adding a new PNG layer = add one entry here + a gen-<layer>.js if
 * you want procedural placeholders + a sentinel block in bug-lab.html.
 *
 * Layers that are NOT here are intentionally non-PNG:
 *   - legs and antennae are procedural-only (line art driven by
 *     JSON shape parameters; no drop folder)
 *   - palette is pure data (16-color array, no art)
 *   - behavior is metadata (no visual)
 */
module.exports = {
  wings: {
    dirName: 'wings',
    filePrefix: 'wing',
    dimensions: [256, 128],
    defaultAttachment: [24, 64],     // left-middle (wing root on bug)
    bankConst: 'WING_BANK',
    sentinelStart: 'WING_BANK_AUTOGEN_START',
    sentinelEnd: 'WING_BANK_AUTOGEN_END',
    catalogFile: 'wings.json',
    displayName: 'wing',
    tintColorRGB: [0.784, 0.659, 0.294], // gold, for contact sheet preview
    targetSize: 40,
    source: 'procedural',            // provenance: procedural | midjourney-controlnet | meshy-bake | blender-bake | hand
    passes: ['procedural'],           // a baked layer ships: grayscale, ao, id-mask (see ASSETS.md)                  // HANDOFF §3.2 launch target
  },
  bodies: {
    dirName: 'bodies',
    filePrefix: 'body',
    dimensions: [200, 100],
    defaultAttachment: [200, 50],    // right-middle (head bolts here)
    bankConst: 'BODY_BANK',
    sentinelStart: 'BODY_BANK_AUTOGEN_START',
    sentinelEnd: 'BODY_BANK_AUTOGEN_END',
    catalogFile: 'bodies.json',
    displayName: 'body',
    tintColorRGB: [0.298, 0.486, 0.337], // sage green
    targetSize: 30,
    source: 'procedural',            // provenance: procedural | midjourney-controlnet | meshy-bake | blender-bake | hand
    passes: ['procedural'],           // a baked layer ships: grayscale, ao, id-mask (see ASSETS.md)
  },
  heads: {
    dirName: 'heads',
    filePrefix: 'head',
    dimensions: [96, 96],
    defaultAttachment: [0, 48],      // left-middle (sits on body's right)
    bankConst: 'HEAD_BANK',
    sentinelStart: 'HEAD_BANK_AUTOGEN_START',
    sentinelEnd: 'HEAD_BANK_AUTOGEN_END',
    catalogFile: 'heads.json',
    displayName: 'head',
    tintColorRGB: [0.290, 0.227, 0.180], // dark brown
    targetSize: 25,
    source: 'procedural',            // provenance: procedural | midjourney-controlnet | meshy-bake | blender-bake | hand
    passes: ['procedural'],           // a baked layer ships: grayscale, ao, id-mask (see ASSETS.md)
  },
  patterns: {
    dirName: 'patterns',
    filePrefix: 'pattern',
    dimensions: [200, 100],          // matches body so they overlay cleanly
    defaultAttachment: [100, 50],    // center (no attachment semantic, just for sheets)
    bankConst: 'PATTERN_BANK',
    sentinelStart: 'PATTERN_BANK_AUTOGEN_START',
    sentinelEnd: 'PATTERN_BANK_AUTOGEN_END',
    catalogFile: 'patterns.json',
    displayName: 'pattern',
    tintColorRGB: [0.290, 0.227, 0.180], // dark brown, for pattern preview
    targetSize: 50,
    source: 'procedural',            // provenance: procedural | midjourney-controlnet | meshy-bake | blender-bake | hand
    passes: ['procedural'],           // a baked layer ships: grayscale, ao, id-mask (see ASSETS.md)
  },

  // Procedural layers: JSON-only banks (no PNG art).
  // import-art.js sees `kind: 'procedural'` and skips raw/ + PNG ops;
  // it just rewrites the bank from the JSON catalog.
  legs: {
    kind: 'procedural',
    dirName: 'legs',
    bankConst: 'LEG_BANK',
    sentinelStart: 'LEG_BANK_AUTOGEN_START',
    sentinelEnd: 'LEG_BANK_AUTOGEN_END',
    catalogFile: 'legs.json',
    displayName: 'leg-set',
    targetSize: 20,
    source: 'procedural',            // provenance: procedural | midjourney-controlnet | meshy-bake | blender-bake | hand
    passes: ['procedural'],           // a baked layer ships: grayscale, ao, id-mask (see ASSETS.md)
  },
  antennae: {
    kind: 'procedural',
    dirName: 'antennae',
    bankConst: 'ANTENNA_BANK',
    sentinelStart: 'ANTENNA_BANK_AUTOGEN_START',
    sentinelEnd: 'ANTENNA_BANK_AUTOGEN_END',
    catalogFile: 'antennae.json',
    displayName: 'antenna-set',
    targetSize: 15,
    source: 'procedural',            // provenance: procedural | midjourney-controlnet | meshy-bake | blender-bake | hand
    passes: ['procedural'],           // a baked layer ships: grayscale, ao, id-mask (see ASSETS.md)
  },
};
