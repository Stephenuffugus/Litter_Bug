// bug-engine.js — Litter Bug shared bug generator (the "patented codeblock" core).
//
// Single source of truth for: input play-trace -> codeblock (SHA-256) -> bug.
// Extracted VERBATIM from bug-lab.html (lines 75-489) so behavior is identical,
// plus the new mint core (serializeTrace / mintCodeblock / bugFromCodeblock).
//
// Loads in the browser (attaches to window) and in Node (module.exports), so the
// same roll can be reproduced client-side, and later verified server-side.
//
// NOTE (Phase 0): the art BANKS below are duplicated from bug-lab.html for now.
// bug-lab.html and preview.html still carry their own inline copies. Migrating
// those two pages onto this module (and pointing scripts/import-art.js here) is
// the immediate follow-up. Banks are 8-entry placeholders today, so no real drift.

;(function () {
  "use strict";
  // ── Hash a string to SHA-256 hex via WebCrypto. ─────────────────────
  async function sha256Hex(s) {
    var enc = new TextEncoder().encode(s);
    var buf = await crypto.subtle.digest('SHA-256', enc);
    var bytes = new Uint8Array(buf);
    var out = '';
    for (var i = 0; i < bytes.length; i++) {
      var h = bytes[i].toString(16);
      out += h.length === 1 ? '0' + h : h;
    }
    return out;
  }

  // ── Read hash bytes / nibbles. ──────────────────────────────────────
  // hb(n) → byte n as 0..255. hc(n) → nibble n as 0..15.
  function hb(hash, n) { return parseInt(hash.substr(n * 2, 2), 16); }
  function hc(hash, n) { return parseInt(hash.substr(n, 1), 16); }

  // ── Hex color to {r,g,b} as 0..1 floats for feColorMatrix. ──────────
  function hexToRGB(hex) {
    var h = hex.replace('#', '');
    return {
      r: parseInt(h.substr(0, 2), 16) / 255,
      g: parseInt(h.substr(2, 2), 16) / 255,
      b: parseInt(h.substr(4, 2), 16) / 255
    };
  }

  // ── Map a hash to insect traits. ────────────────────────────────────
  // Bytes 0..18 carry anatomy; 19..27 are reserved for behavior later.
  // Bank sizes are placeholders for v0; replace with real catalogs.
  function hashToBugTraits(hash) {
    return {
      body:      hb(hash,  0) % 30,     // 30 body shapes (placeholder uses 3)
      head:      hb(hash,  4) % 25,     // 25 heads (placeholder uses 2)
      wing:      hb(hash,  8) % 40,     // 40 wing types
      leg:      hb(hash, 12) % 20,      // 20 leg sets
      antenna:   hb(hash, 14) % 15,     // 15 antenna sets
      pattern:   hb(hash, 16) % 50,     // 50 surface patterns
      palette:   hb(hash, 18) % PALETTES.length,   // index into one curated scheme
      behavior:  hb(hash, 22) % 12,
      // Plumbing
      bodyLen:   80 + (hb(hash, 1) % 40),  // 80..120
      bodyW:     40 + (hb(hash, 2) % 30),  // 40..70
      wingScale: 0.85 + ((hb(hash, 9) % 30) / 100), // 0.85..1.14
      headSize:  18 + (hb(hash, 5) % 12)   // 18..30
    };
  }

  // ══ SPECIMEN GRADE ═══════════════════════════════════════════════════
  // ⛔ 2026-08-24: the grade now reads the parts the renderer ACTUALLY DRAWS.
  // It used to score six trait indices (wing/body/head/pattern/leg/antenna)
  // that _generateBugSVG never looks at, so a LEGENDARY and a COMMON could be
  // the same picture and the label was a number with nothing behind it. The
  // scorer asks bugPlan() — the same rolls the renderer draws from — so a rare
  // bug is a bug that is VISIBLY more built: an elytra shell, a plated
  // carapace, a barbed stinger, a full spine ridge, raptorial forelegs.
  // `marks` is the human readable list of what scored, so the mint screen can
  // point at the art instead of asserting a tier.
  // ⛔ ONE implementation. index.html's gradeOf() is a thin wrapper on this,
  // scripts/grade_sim_live.js drives it through the live page, and
  // scripts/grade_tune.js fits GRADE_CUT to the histogram it produces.
  var GRADES = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC', 'COSMIC'];
  // ⛔ FITTED by scripts/grade_tune.js against 200k samples of THIS scorer,
  // never guessed. Re-run the tuner after any change to the scoring above.
  var GRADE_CUT = [0, 28, 36, 44, 52, 59, 65];
  function bugGrade(codeblock) {
    var P = bugPlan(codeblock), pl = P.plan, marks = [], score = 0, i;
    function add(n, label) { score += n; if (label) marks.push(label); }

    /* wings: the loudest thing in the silhouette. 25% of bugs are wingless. */
    if (pl.wings !== 999) {
      if (P.wingKind === 2) add(9, 'elytra shell');
      else if (P.wingKind === 1) add(7, 'four wings');
      else add(4, 'membrane wings');
    }
    /* carapace plates. The renderer suppresses them under an elytra shell, so
       the score must too or it would credit armour you cannot see. */
    if (P.plateKind && P.wingKind !== 2) add(6, 'plated carapace');
    if (pl.horns !== 999) add(5, 'horns');
    if (pl.pincers !== 999) add(P.jawKind === 3 ? 8 : 5, P.jawKind === 3 ? 'hooked pincers' : 'pincers');
    if (pl.tail !== 999) add(P.tailKind === 2 ? 8 : 5, P.tailKind === 2 ? 'barbed stinger' : 'stinger tail');
    if (pl.extraEyes !== 999) add(7, 'extra eyes');
    var sp = 0;
    for (i = 0; i < pl.spines.length; i++) if (pl.spines[i] !== 999) sp++;
    if (sp >= P.N) add(sp * 3 + 4, 'full spine ridge');
    else if (sp) add(sp * 3, sp + ' dorsal spine' + (sp > 1 ? 's' : ''));
    if (P.legKind === 2) add(6, 'raptorial forelegs');
    if (P.N >= 6) add(5, 'six segment body');
    else if (P.N === 5) add(3, 'long body');
    if (P.mats.length >= 4) add(4, 'four scrap patchwork');
    else if (P.mats.length === 3) add(2, 'three scrap patchwork');

    var g = 0;
    for (i = GRADE_CUT.length - 1; i >= 0; i--) { if (score >= GRADE_CUT[i]) { g = i; break; } }
    return { grade: GRADES[g], score: score, marks: marks };
  }

  // ── Palettes. Curated harmonious SCHEMES, one per bug. ──────────────
  // Each scheme is a designed 4-color set instead of 4 independent picks,
  // so bugs read as intentional, not muddy. Roles:
  //   primary = body   accent = wings (lightest, wings render translucent)
  //   dark = head/legs/pattern   secondary = reserved
  //   lore = the color word the backstory uses, so text matches the art.
  // Litter-born voice: rust, sodium light, bottle-glass, foil, damp moss.
  // Grow toward the ~80 launch target; adding schemes is pure data.
  var PALETTES = [
    { name: 'Rusted Tin',    primary: '#9a5a34', secondary: '#b87a44', accent: '#e0a55a', dark: '#3a2214', lore: 'rusted tin' },
    { name: 'Bottle Green',  primary: '#2f6a44', secondary: '#3f8a52', accent: '#8fce7a', dark: '#163020', lore: 'bottle green' },
    { name: 'Sodium Night',  primary: '#4a4658', secondary: '#625d76', accent: '#e6a13c', dark: '#1c1a26', lore: 'sodium amber' },
    { name: 'Oil Slick',     primary: '#2c3350', secondary: '#3e4f6e', accent: '#7fa6cf', dark: '#12141f', lore: 'oil-slick blue' },
    { name: 'Wax Paper',     primary: '#ddceac', secondary: '#cbb889', accent: '#b1935e', dark: '#6f5c39', lore: 'wax paper' },
    { name: 'Verdigris',     primary: '#3f8f7e', secondary: '#5cb39d', accent: '#b9dcc9', dark: '#1f4a3f', lore: 'verdigris' },
    { name: 'Wet Cardboard', primary: '#b3915d', secondary: '#9c7a48', accent: '#d8b881', dark: '#543c24', lore: 'wet cardboard' },
    { name: 'Cigarette Ash', primary: '#8b8b80', secondary: '#a3a397', accent: '#cbc7b3', dark: '#37372f', lore: 'cigarette ash' },
    { name: 'Ember',         primary: '#ad4a28', secondary: '#d67a38', accent: '#f4bb5e', dark: '#3a190d', lore: 'ember' },
    { name: 'Frostbitten',   primary: '#86a0b6', secondary: '#9db8cc', accent: '#dbe8f0', dark: '#384954', lore: 'frost blue' },
    { name: 'Marigold Rot',  primary: '#c79126', secondary: '#d9a83c', accent: '#f0d17a', dark: '#4a380f', lore: 'rotted marigold' },
    { name: 'Bruised Plum',  primary: '#5a3a58', secondary: '#744a70', accent: '#b487ac', dark: '#26162a', lore: 'bruised plum' },
    { name: 'Nettle',        primary: '#4d6a2e', secondary: '#67873f', accent: '#b0c96a', dark: '#23310f', lore: 'nettle green' },
    { name: 'Bone',          primary: '#d9d2be', secondary: '#c3bba2', accent: '#a89a76', dark: '#5c523c', lore: 'bone' },
    { name: 'Slate Drain',   primary: '#4a5560', secondary: '#616f7c', accent: '#9fb0bd', dark: '#202a30', lore: 'wet slate' },
    { name: 'Cola Brown',    primary: '#4a2f22', secondary: '#6a4632', accent: '#a5764f', dark: '#1e120a', lore: 'cola brown' },
    { name: 'Tarnished Brass', primary: '#7a6a3a', secondary: '#9a8a4a', accent: '#cabe6a', dark: '#2f2810', lore: 'tarnished brass' },
    { name: 'Antifreeze',    primary: '#4a9a6a', secondary: '#66b884', accent: '#c2ecae', dark: '#204a30', lore: 'antifreeze green' },
    { name: 'Ceramic Blue',  primary: '#4a7290', secondary: '#6a92ae', accent: '#b6d2e0', dark: '#1e3648', lore: 'ceramic blue' },
    { name: 'Crushed Foil',  primary: '#9a9ea6', secondary: '#b4b8bf', accent: '#dde0e5', dark: '#40434a', lore: 'crushed foil' },
    { name: 'Dried Rust',    primary: '#7a3230', secondary: '#9a4a44', accent: '#c88070', dark: '#2c100e', lore: 'dried rust-red' },
    { name: 'Damp Moss',     primary: '#3e5a40', secondary: '#547552', accent: '#9ab884', dark: '#1c2c1c', lore: 'damp moss' },
    { name: 'Streetlamp',    primary: '#b98a3a', secondary: '#d4a44e', accent: '#f2d488', dark: '#45320f', lore: 'streetlamp gold' },
    { name: 'Cellophane',    primary: '#8aa49a', secondary: '#a4c0b4', accent: '#d6e6dc', dark: '#3a4a44', lore: 'cellophane sheen' },
    { name: 'Burnt Umber',   primary: '#6b4a2e', secondary: '#86603e', accent: '#b68c5e', dark: '#2a1a0e', lore: 'burnt umber' },
    { name: 'Sea Glass',     primary: '#6a9a94', secondary: '#86b6ae', accent: '#c8e2dc', dark: '#2e4a46', lore: 'sea glass' },
    { name: 'Charcoal',      primary: '#3a3a3c', secondary: '#52524e', accent: '#8a8880', dark: '#161618', lore: 'charcoal' },
    { name: 'Tea Stain',     primary: '#8a6a2a', secondary: '#a5843c', accent: '#d4b268', dark: '#362810', lore: 'tea-stain brown' },
    // --- +52 from the content-expansion workflow (2026-07-17): now 80 schemes ---
    { name: 'Bent Nail', primary: '#a05730', secondary: '#bf7440', accent: '#e6a866', dark: '#37200f', lore: 'bent-nail rust' },
    { name: 'Brick Dust', primary: '#9c4f3a', secondary: '#ba6a4e', accent: '#dd9c82', dark: '#331311', lore: 'brick dust' },
    { name: 'Flowerpot', primary: '#b06844', secondary: '#cb8258', accent: '#ecb384', dark: '#3e2314', lore: 'terracotta clay' },
    { name: 'Kraft Paper', primary: '#a9814e', secondary: '#c39c66', accent: '#e4c996', dark: '#4a3418', lore: 'kraft paper' },
    { name: 'Chestnut Husk', primary: '#7d4a2b', secondary: '#9a6440', accent: '#c79668', dark: '#2a1609', lore: 'chestnut husk' },
    { name: 'Rust Bloom', primary: '#b0602f', secondary: '#cd7c42', accent: '#efb06a', dark: '#3c1e0c', lore: 'flaked rust' },
    { name: 'Sisal Twine', primary: '#b08a54', secondary: '#c8a46e', accent: '#e8d3a4', dark: '#50391c', lore: 'sisal twine' },
    { name: 'Tobacco Tin', primary: '#916c33', secondary: '#ab8546', accent: '#d4b56e', dark: '#382709', lore: 'tobacco tin' },
    { name: 'Ironstone', primary: '#8a5c4a', secondary: '#a4735e', accent: '#c9a08c', dark: '#301b13', lore: 'ironstone rust' },
    { name: 'Lichen Crust', primary: '#7f9068', secondary: '#97a880', accent: '#cdd6b4', dark: '#333c26', lore: 'grey-green lichen' },
    { name: 'Pond Scum', primary: '#6b7a34', secondary: '#869647', accent: '#c0cd7e', dark: '#262d0e', lore: 'pond scum' },
    { name: 'Weedcrack', primary: '#47692f', secondary: '#5f8542', accent: '#a0c073', dark: '#1b2c11', lore: 'weed-crack green' },
    { name: 'Gutter Fern', primary: '#3d6a4e', secondary: '#538765', accent: '#97c19f', dark: '#16301f', lore: 'gutter fern' },
    { name: 'River Algae', primary: '#5a8a4a', secondary: '#74a660', accent: '#b4d698', dark: '#22381a', lore: 'river algae' },
    { name: 'Mildew', primary: '#6d7d5e', secondary: '#869674', accent: '#bfc9a8', dark: '#2b3324', lore: 'mildew green' },
    { name: 'Roadside Clover', primary: '#567a3e', secondary: '#6f9552', accent: '#aecd82', dark: '#203010', lore: 'roadside clover' },
    { name: 'Bog Myrtle', primary: '#4c6042', secondary: '#647a57', accent: '#a2b48c', dark: '#1d281a', lore: 'bog myrtle' },
    { name: 'Dock Leaf', primary: '#5e7638', secondary: '#78904c', accent: '#b6c884', dark: '#242e12', lore: 'dock leaf' },
    { name: 'Split Mustard', primary: '#c69a2c', secondary: '#ddb245', accent: '#f4dd88', dark: '#4d3a0c', lore: 'mustard smear' },
    { name: 'Matchflame', primary: '#d06a26', secondary: '#ea8638', accent: '#f8bd72', dark: '#431d08', lore: 'matchflame orange' },
    { name: 'Traffic Cone', primary: '#cc5f34', secondary: '#e67c4a', accent: '#f5b184', dark: '#431806', lore: 'faded traffic cone' },
    { name: 'Caution Tape', primary: '#cead2e', secondary: '#e0c24a', accent: '#f4e58a', dark: '#4a3d0b', lore: 'caution-tape yellow' },
    { name: 'Egg Yolk', primary: '#d69b2a', secondary: '#edb442', accent: '#f9db7c', dark: '#4b380a', lore: 'egg-yolk gold' },
    { name: 'Old Honey', primary: '#c88b34', secondary: '#e0a44a', accent: '#f5cf84', dark: '#46300c', lore: 'old honey' },
    { name: 'Apricot Rot', primary: '#cf7a4e', secondary: '#e59668', accent: '#f6c39c', dark: '#45210f', lore: 'bruised apricot' },
    { name: 'Orange Peel', primary: '#d47a2c', secondary: '#ec9440', accent: '#f8c37c', dark: '#47230a', lore: 'orange rind' },
    { name: 'Turmeric', primary: '#cc8b24', secondary: '#e3a53c', accent: '#f6d078', dark: '#47320a', lore: 'turmeric stain' },
    { name: 'Sump Oil', primary: '#2b2f24', secondary: '#3d4232', accent: '#6f745e', dark: '#0a0b06', lore: 'sump oil' },
    { name: 'Ink Spill', primary: '#232a3a', secondary: '#333d52', accent: '#6c7893', dark: '#070911', lore: 'spilled ink' },
    { name: 'Bilge Water', primary: '#24382f', secondary: '#354e42', accent: '#6c8a7c', dark: '#08100b', lore: 'bilge water' },
    { name: 'Blackberry Sludge', primary: '#35243c', secondary: '#4a3452', accent: '#816a8a', dark: '#0d0710', lore: 'blackberry sludge' },
    { name: 'Motor Oil', primary: '#2f2a22', secondary: '#443c30', accent: '#766c58', dark: '#0a0805', lore: 'motor oil' },
    { name: 'Sewer Green', primary: '#2c3a2a', secondary: '#3e5039', accent: '#728468', dark: '#0a100a', lore: 'sewer green' },
    { name: 'Spilled Wine', primary: '#3f2029', secondary: '#58303a', accent: '#916069', dark: '#100609', lore: 'spilled wine' },
    { name: 'Tar Pit', primary: '#2b2823', secondary: '#403a33', accent: '#74695c', dark: '#080705', lore: 'wet tar' },
    { name: 'Milk Jug', primary: '#c3ccc6', secondary: '#d5ddd7', accent: '#f0f3ee', dark: '#5a635e', lore: 'milk-jug plastic' },
    { name: 'Frosted Pane', primary: '#9fb2b8', secondary: '#b6c6cb', accent: '#e2ebed', dark: '#43525a', lore: 'frosted glass' },
    { name: 'Jam Jar', primary: '#a2bcaa', secondary: '#b8ccbc', accent: '#e0ece0', dark: '#47584c', lore: 'jam-jar glass' },
    { name: 'Dish Soap', primary: '#86b0b6', secondary: '#a0c4c8', accent: '#d6e9ea', dark: '#365055', lore: 'dish-soap blue' },
    { name: 'Chalk Blue', primary: '#94a8bc', secondary: '#adbecf', accent: '#dde6ef', dark: '#3e4c5a', lore: 'chalk blue' },
    { name: 'Mint Wrapper', primary: '#9ec2ac', secondary: '#b6d3c0', accent: '#e2f0e6', dark: '#43594b', lore: 'mint-wrapper green' },
    { name: 'Cling Film', primary: '#b6c0c2', secondary: '#ccd4d5', accent: '#eef2f2', dark: '#515b5d', lore: 'cling film' },
    { name: 'Icebox Frost', primary: '#9ab6c0', secondary: '#b2cad2', accent: '#dfeef2', dark: '#3f545c', lore: 'icebox frost' },
    { name: 'Seafoam Rinse', primary: '#8fb8ac', secondary: '#a9ccc1', accent: '#dcefe8', dark: '#3a544b', lore: 'seafoam rinse' },
    { name: 'Wet Newsprint', primary: '#82868a', secondary: '#999da0', accent: '#c6cacc', dark: '#313436', lore: 'wet newsprint' },
    { name: 'Pencil Lead', primary: '#6b7076', secondary: '#83888e', accent: '#b3b8bd', dark: '#292c30', lore: 'graphite grey' },
    { name: 'Raw Concrete', primary: '#9a968c', secondary: '#b0aca1', accent: '#d6d3c8', dark: '#403d36', lore: 'raw concrete' },
    { name: 'Wet Asphalt', primary: '#4c4f54', secondary: '#63676c', accent: '#9aa0a6', dark: '#1d1f22', lore: 'wet asphalt' },
    { name: 'Chimney Soot', primary: '#3b3a37', secondary: '#52514c', accent: '#8a887f', dark: '#171614', lore: 'chimney soot' },
    { name: 'Gunmetal', primary: '#45494e', secondary: '#5c6167', accent: '#969ba1', dark: '#1b1d20', lore: 'gunmetal grey' },
    { name: 'Dryer Lint', primary: '#9c948f', secondary: '#b2aaa4', accent: '#d8d1cb', dark: '#433d39', lore: 'dryer lint' },
    { name: 'Spent Cinder', primary: '#4a443f', secondary: '#625a53', accent: '#948b80', dark: '#1c1917', lore: 'spent cinder' }
  ];

  // ── Wing bank. ─────────────────────────────────────────────────────
  // Catalog of available wings + their metadata. Each entry:
  //   file:       PNG filename in assets/wings/
  //   name:       human-readable name shown in UI / contact sheets
  //   tintable:   true = white silhouette gets feColorMatrix-tinted to
  //               the bug's accent color; false = render as-is (colored
  //               art delivered by the artist).
  //   attachment: [x, y] in PNG pixels (256x128 normalized) where the
  //               wing attaches to the body. Used to align the rotated
  //               wing on the bug's thorax. Default [24, 64].
  //
  // This block is REWRITTEN by `node scripts/import-art.js wings`
  // (or `npm run wings`). Edit wings.json instead, or drop new art
  // into assets/wings/raw/ and run the import script. Manual edits
  // between the sentinels will be lost.
  // WING_BANK_AUTOGEN_START — managed by scripts/import-art.js (do not edit by hand)
  var WING_BANK = [
    { file: "wing-01.png", name: "Rounded", tintable: true, attachment: [24, 64] },
    { file: "wing-02.png", name: "Pointed", tintable: true, attachment: [24, 64] },
    { file: "wing-03.png", name: "Elongated", tintable: true, attachment: [24, 64] },
    { file: "wing-04.png", name: "Lobed", tintable: true, attachment: [24, 64] },
    { file: "wing-05.png", name: "Triangular", tintable: true, attachment: [24, 64] },
    { file: "wing-06.png", name: "Crescent", tintable: true, attachment: [24, 64] },
    { file: "wing-07.png", name: "Swept", tintable: true, attachment: [24, 64] },
    { file: "wing-08.png", name: "Compound", tintable: true, attachment: [24, 64] }
  ];
  // WING_BANK_AUTOGEN_END

  // ── Part-source dispatch (NEXT_SESSION plan B, wired 2026-07-29) ────
  // Default is procedural everywhere and byte-identical to before this
  // block existed. Registering an authored symbol flips ONE part kind to
  // authored art, reversibly, without touching any roll: the same hash
  // still picks the same wing slot; only the drawing changes.
  // Contract for an authored wing symbol (matches PART_CATALOG 2):
  //   - inner SVG markup for a 256x128 canvas, root at the LOWER LEFT
  //     corner (0,128), wing sweeping up-right
  //   - fills/strokes in currentColor (the renderer sets color to the
  //     bug's accent); inner detail via opacity, never hard-coded hue
  var PART_SOURCES = { wing: { symbols: {}, count: 0 } };
  function registerPart(part, idx, svgInner) {
    if (!PART_SOURCES[part]) return false;
    PART_SOURCES[part].symbols[idx] = String(svgInner);
    PART_SOURCES[part].count = Object.keys(PART_SOURCES[part].symbols).length;
    return true;
  }
  function clearParts(part) {
    if (PART_SOURCES[part]) PART_SOURCES[part] = { symbols: {}, count: 0 };
  }

  // ── Body bank. ─────────────────────────────────────────────────────
  // PNG silhouettes of bug bodies (top-down, head end on the right).
  // 200x100 normalized; attachment at right edge (200, 50) is where
  // the head bolts on. Tinted to bug's primary color at render time.
  // Managed by `node scripts/import-art.js bodies` / `npm run bodies`.
  // BODY_BANK_AUTOGEN_START — managed by scripts/import-art.js (do not edit by hand)
  var BODY_BANK = [
    { file: "body-01.png", name: "Oval", tintable: true, attachment: [200, 50] },
    { file: "body-02.png", name: "Slender", tintable: true, attachment: [200, 50] },
    { file: "body-03.png", name: "Plump", tintable: true, attachment: [200, 50] },
    { file: "body-04.png", name: "Segmented", tintable: true, attachment: [200, 50] },
    { file: "body-05.png", name: "Tapered", tintable: true, attachment: [200, 50] },
    { file: "body-06.png", name: "Round", tintable: true, attachment: [200, 50] },
    { file: "body-07.png", name: "Elongated", tintable: true, attachment: [200, 50] },
    { file: "body-08.png", name: "Compact", tintable: true, attachment: [200, 50] }
  ];
  // BODY_BANK_AUTOGEN_END

  // ── Leg bank. ──────────────────────────────────────────────────────
  // Procedural — no PNG art. Each entry is { name, count, length,
  // segments, thickness, pose, rarity }. The lab interprets these
  // params into 6 (or 8) line strokes per bug. Edit assets/legs/legs.json
  // and run `npm run legs` to push changes here.
  // LEG_BANK_AUTOGEN_START — managed by scripts/import-art.js (do not edit by hand)
  var LEG_BANK = [
    {"name":"Sprinter","count":6,"length":22,"segments":2,"thickness":2.5,"pose":"spread","rarity":"common","source":"placeholder-procedural","addedAt":"2026-05-20"},
    {"name":"Crouched","count":6,"length":16,"segments":2,"thickness":2.8,"pose":"low","rarity":"common","source":"placeholder-procedural","addedAt":"2026-05-20"},
    {"name":"Long-Reach","count":6,"length":28,"segments":2,"thickness":2,"pose":"spread","rarity":"uncommon","source":"placeholder-procedural","addedAt":"2026-05-20"},
    {"name":"Stubby","count":6,"length":13,"segments":1,"thickness":3,"pose":"spread","rarity":"common","source":"placeholder-procedural","addedAt":"2026-05-20"},
    {"name":"Mantis","count":6,"length":26,"segments":3,"thickness":2.2,"pose":"forward","rarity":"rare","source":"placeholder-procedural","addedAt":"2026-05-20"},
    {"name":"Eight-Pack","count":8,"length":20,"segments":2,"thickness":1.8,"pose":"spread","rarity":"rare","source":"placeholder-procedural","addedAt":"2026-05-20"},
    {"name":"Bristled","count":6,"length":18,"segments":2,"thickness":1.5,"pose":"splayed","rarity":"uncommon","source":"placeholder-procedural","addedAt":"2026-05-20"},
    {"name":"Smooth","count":6,"length":22,"segments":1,"thickness":2.5,"pose":"spread","rarity":"common","source":"placeholder-procedural","addedAt":"2026-05-20"}
  ];
  // LEG_BANK_AUTOGEN_END

  // ── Antenna bank. ──────────────────────────────────────────────────
  // Procedural — no PNG art. Each entry is { name, length, curl,
  // thickness, shape, spread, rarity }. The lab interprets these into
  // two bezier-curve antennae per bug. Edit assets/antennae/antennae.json
  // and run `npm run antennae` to push changes here.
  // ANTENNA_BANK_AUTOGEN_START — managed by scripts/import-art.js (do not edit by hand)
  var ANTENNA_BANK = [
    {"name":"Threadlike","length":24,"curl":0.4,"thickness":1.5,"shape":"straight","spread":30,"rarity":"common","source":"placeholder-procedural","addedAt":"2026-05-20"},
    {"name":"Curled","length":22,"curl":0.8,"thickness":1.6,"shape":"curved","spread":28,"rarity":"common","source":"placeholder-procedural","addedAt":"2026-05-20"},
    {"name":"Clubbed","length":26,"curl":0.4,"thickness":1.8,"shape":"club-tipped","spread":32,"rarity":"uncommon","source":"placeholder-procedural","addedAt":"2026-05-20"},
    {"name":"Feathered","length":28,"curl":0.5,"thickness":2.4,"shape":"feathered","spread":36,"rarity":"rare","source":"placeholder-procedural","addedAt":"2026-05-20"},
    {"name":"Short","length":14,"curl":0.5,"thickness":1.6,"shape":"curved","spread":26,"rarity":"common","source":"placeholder-procedural","addedAt":"2026-05-20"},
    {"name":"Long","length":38,"curl":0.4,"thickness":1.2,"shape":"straight","spread":42,"rarity":"uncommon","source":"placeholder-procedural","addedAt":"2026-05-20"},
    {"name":"Elbowed","length":24,"curl":0.5,"thickness":2,"shape":"bent","spread":30,"rarity":"rare","source":"placeholder-procedural","addedAt":"2026-05-20"},
    {"name":"Bristle","length":20,"curl":0.3,"thickness":1.5,"shape":"straight","spread":24,"rarity":"common","source":"placeholder-procedural","addedAt":"2026-05-20"}
  ];
  // ANTENNA_BANK_AUTOGEN_END

  // ── Pattern bank. ──────────────────────────────────────────────────
  // PNG overlays applied on top of the body silhouette. 200x100
  // normalized (matches body). Tinted to bug's dark color so markings
  // read as shadows on the body surface.
  // Managed by `node scripts/import-art.js patterns` / `npm run patterns`.
  // PATTERN_BANK_AUTOGEN_START — managed by scripts/import-art.js (do not edit by hand)
  var PATTERN_BANK = [
    { file: "pattern-01.png", name: "Stripes Vertical", tintable: true, attachment: [100, 50] },
    { file: "pattern-02.png", name: "Bands", tintable: true, attachment: [100, 50] },
    { file: "pattern-03.png", name: "Spots", tintable: true, attachment: [100, 50] },
    { file: "pattern-04.png", name: "Eyespots", tintable: true, attachment: [100, 50] },
    { file: "pattern-05.png", name: "Speckled", tintable: true, attachment: [100, 50] },
    { file: "pattern-06.png", name: "Dashes", tintable: true, attachment: [100, 50] },
    { file: "pattern-07.png", name: "Swirl", tintable: true, attachment: [100, 50] },
    { file: "pattern-08.png", name: "Chevrons", tintable: true, attachment: [100, 50] }
  ];
  // PATTERN_BANK_AUTOGEN_END

  // ── Head bank. ─────────────────────────────────────────────────────
  // PNG silhouettes of bug heads (face on the right, neck on the left).
  // 96x96 normalized; attachment at left edge (0, 48) is where the
  // head meets the body. Tinted to bug's dark palette color at render
  // time so eyes/mandibles read as shadowed accents on the body.
  // Managed by `node scripts/import-art.js heads` / `npm run heads`.
  // HEAD_BANK_AUTOGEN_START — managed by scripts/import-art.js (do not edit by hand)
  var HEAD_BANK = [
    { file: "head-01.png", name: "Round", tintable: true, attachment: [0, 48] },
    { file: "head-02.png", name: "Triangular", tintable: true, attachment: [0, 48] },
    { file: "head-03.png", name: "Bulbous", tintable: true, attachment: [0, 48] },
    { file: "head-04.png", name: "Squared", tintable: true, attachment: [0, 48] },
    { file: "head-05.png", name: "Pointed", tintable: true, attachment: [0, 48] },
    { file: "head-06.png", name: "Broad", tintable: true, attachment: [0, 48] },
    { file: "head-07.png", name: "Compact", tintable: true, attachment: [0, 48] },
    { file: "head-08.png", name: "Lobed", tintable: true, attachment: [0, 48] }
  ];
  // HEAD_BANK_AUTOGEN_END

  // ── _generateBugSVG(hash, size). ────────────────────────────────────
  // Draws an insect facing right inside a viewBox of 220x200.
  // Layers (back-to-front): defs (tint filters) → wings (PNG)
  //   → legs → body (PNG, primary-tinted) → pattern → head → antennae.
  // Bodies and wings are PNG-driven; heads / patterns will join when
  // their banks land. Legs and antennae are inline SVG line art.
  // ── _generateBugSVG(hash, size): procedural flat-vector cel-shaded bug. ──
  // Fully drawn in SVG (no PNG layers, no feColorMatrix). Outlined, cel-shaded
  // insect parts whose SHAPES come from the trait indices and whose COLORS come
  // from the bug's palette scheme. Deterministic, recolorable, needs zero art
  // assets. Faces right, viewBox 200x200. The PNG-bank hybrid is retired as the
  // default; the banks remain exported for an optional future hand-art drop.
  // ── _generateBugSVG(hash, size): cohesion-rigged procedural bug. ──────
  // Art-cohesion system (research w1ar100ei): every dimension flows from ONE
  // master scale S through clamped ratio bands, so head<thorax<abdomen ALWAYS
  // (no bobbleheads, no pinched-off parts). Shapes are continuous superellipse
  // families (round..egg..rounded-box) for real silhouette variety. Colored
  // cel shadows (toward the scheme's dark), pattern clipped to the body, and a
  // fit-to-canvas pass keep any roll a viable, on-model fighter. Deterministic
  // (toFixed quantized). Faces right, viewBox 200x200.
  var _uidSeq = 0;   /* see the uid comment in _generateBugSVG: ids must be per RENDER */

  // ── pure colour helpers (module scope so bugPlan and the renderer share one
  //    implementation; hoisted out of _generateBugSVG 2026-08-24, unchanged). ──
  function _rgb(h){ h=h.replace('#',''); return { r:parseInt(h.slice(0,2),16), g:parseInt(h.slice(2,4),16), b:parseInt(h.slice(4,6),16) }; }
  function _hx(o){ var c=function(v){ return ('0'+Math.max(0,Math.min(255,Math.round(v))).toString(16)).slice(-2); }; return '#'+c(o.r)+c(o.g)+c(o.b); }
  function dk(h,f){ var c=_rgb(h); return _hx({ r:c.r*(1-f), g:c.g*(1-f), b:c.b*(1-f) }); }
  function lt(h,f){ var c=_rgb(h); return _hx({ r:c.r+(255-c.r)*f, g:c.g+(255-c.g)*f, b:c.b+(255-c.b)*f }); }
  function mix(a,b,tt){ var x=_rgb(a),y=_rgb(b); return _hx({ r:x.r+(y.r-x.r)*tt, g:x.g+(y.g-x.g)*tt, b:x.b+(y.b-x.b)*tt }); }

  // ── bugPlan(hash, pal) -> THE BODY PLAN THE RENDERER ACTUALLY DRAWS. ──
  // ⛔ Extracted VERBATIM from _generateBugSVG on 2026-08-24 and the renderer
  // now calls it, so there is exactly ONE roll sequence in this file. Anything
  // that wants to know what a bug LOOKS like (the grade, a gate, a sim) asks
  // this, instead of reading trait indices that nothing draws.
  // Level independent: `plan.*` are GROWTH THRESHOLDS, so the plan describes
  // the finished adult and a grade computed from it never changes as a bug
  // levels up. Proof of no drift: scripts/plan_determinism.js.
  function bugPlan(hash, pal) {
    pal = pal || PALETTES[hashToBugTraits(hash).palette] || PALETTES[0];
    var primary = pal.primary, accent = pal.accent, secondary = pal.secondary;
    var R = seededRng(hash + '|grow');
    var cx = 100, cy = 110, i, u, x;
    // roll the full body plan (level-independent)
    var N = 3 + Math.floor(R() * 4), seg = [], rTail = 13 + R() * 7, rHead = 8 + R() * 4;
    for (i = 0; i < N; i++) { u = i / (N - 1); seg.push({ r: rTail + (rHead - rTail) * u + (i > 0 && i < N - 1 ? (R() - 0.5) * 4 : 0) }); }
    x = cx - seg.reduce(function (a, s) { return a + s.r * 1.28; }, 0) / 2 + seg[0].r;
    for (i = 0; i < N; i++) { seg[i].x = x; seg[i].y = cy + Math.sin(i / (N - 1) * Math.PI) * -4 - (i === N - 1 ? 4 : 0); if (i < N - 1) x += (seg[i].r + seg[i + 1].r) * 0.6; }
    var thoraxI = N - 2;
    var plan = {
      legs: seg.map(function (s, i) { return (i >= 1 && i <= thoraxI) ? 0.12 + R() * 0.5 : (i < 1 ? 0.4 + R() * 0.4 : 999); }),
      wings: (R() < 0.75) ? 0.42 + R() * 0.25 : 999,
      horns: (R() < 0.55) ? 0.55 + R() * 0.35 : 999,
      pincers: (R() < 0.6) ? 0.3 + R() * 0.3 : 999,
      tail: (R() < 0.5) ? 0.6 + R() * 0.3 : 999,
      spines: seg.map(function () { return (R() < 0.5) ? 0.35 + R() * 0.5 : 999; }),
      extraEyes: (R() < 0.4) ? 0.7 + R() * 0.25 : 999
    };
    var wSweep = (R() - 0.5) * 16, hornCurl = (R() - 0.5) * 0.6, tailLen = 10 + R() * 8;
    // wing family (rolled last so it never shifts the spine/part rolls above):
    // 0 membrane pair, 1 dragonfly fore+hind, 2 beetle elytra shell.
    var wingKind = Math.floor(R() * 3), wingUp = wingKind === 2 ? 26 : (wingKind === 1 ? 56 : 46);
    var jawKind = 1 + Math.floor(R() * 3), tailKind = Math.floor(R() * 3);   // also rolled last
    // patchwork materials: each body segment is a different scrap tinted from the
    // palette family, so a bug reads as sewn from litter. mats[0] stays exactly
    // primary (keeps the palette-scheme smoke green). Rolled last, fill-only.
    var matPool = [secondary, mix(primary, pal.dark, 0.28), mix(primary, accent, 0.35), lt(primary, 0.18), dk(primary, 0.18)];
    var nMat = 2 + Math.floor(R() * 3), mats = [primary];
    for (i = 1; i < nMat; i++) mats.push(matPool[Math.floor(R() * matPool.length)]);
    var segMat = seg.map(function (s, i) { return i === N - 1 ? -1 : Math.floor(R() * mats.length); });
    var antKind = Math.floor(R() * 3), eyeKind = Math.floor(R() * 3);   // head detail, rolled last
    var legKind = Math.floor(R() * 3);   // 0 thin, 1 sturdy, 2 raptorial forelegs
    var plateKind = (R() < 0.4) ? 1 : 0;   // carapace: dorsal armor plates over each body segment
    return { N: N, seg: seg, thoraxI: thoraxI, plan: plan, wSweep: wSweep, hornCurl: hornCurl,
      tailLen: tailLen, wingKind: wingKind, wingUp: wingUp, jawKind: jawKind, tailKind: tailKind,
      mats: mats, segMat: segMat, antKind: antKind, eyeKind: eyeKind, legKind: legKind,
      plateKind: plateKind };
  }

  // ── _generateBugSVG(hash, size, level): grow-assembly bug. ───────────
  // The codeblock is the GENOME: it rolls a spine of stitch-point segments
  // plus a vocabulary of parts (legs, wings, dorsal spines, horns, pincers,
  // stinger tail, extra eyes), each with a rolled growth threshold. LEVEL
  // decides how much has grown in, so a fresh bug is a simple stitched grub
  // and a trained one is its full intricate fighter. Same codeblock always
  // grows the same path. Deterministic, palette-recolored, seams are visible
  // cross-stitches ("sewn from litter"). Faces right, viewBox 200x200.
  function _generateBugSVG(hash, size, level, opts) {
    level = level || 30;
    // FX LIVE (2026-07-29, NEXT_SESSION plan C): the free-fidelity pass is now
    // the default look everywhere. Pure seeded shading, no new rolls, so
    // determinism holds. One-line revert: FX_LIVE = false.
    var FX_LIVE = true;
    var fx = (opts && ('fx' in opts)) ? !!opts.fx : FX_LIVE;  // free-fidelity pass: merge + one-light cel shade + rim light + LOD
    var merge = fx || !!(opts && opts.merge);   // experimental: fuse segments into one silhouette + unified outline
    var lod = fx && size <= 64;           // small renders drop fine detail (stitches, veins, barbs)
    var t = hashToBugTraits(hash), pal = PALETTES[t.palette] || PALETTES[0];
    var primary = pal.primary, accent = pal.accent, secondary = pal.secondary;
    function q(v){ return v.toFixed(2); }
    var growth = Math.max(0.12, Math.min(1, level / 22));
    var ol = dk(pal.dark, 0.2), stitchCol = lt(pal.dark, 0.35), spineCol = mix(primary, pal.dark, 0.3);
    var cx = 100, cy = 110, i, u, x;
    /* ⛔ the body plan lives in bugPlan() now, so the GRADE can read the same
       rolls the renderer draws. Do not inline these rolls again. */
    var P = bugPlan(hash, pal);
    var N = P.N, seg = P.seg, thoraxI = P.thoraxI, plan = P.plan, wSweep = P.wSweep,
        hornCurl = P.hornCurl, tailLen = P.tailLen, wingKind = P.wingKind, wingUp = P.wingUp,
        jawKind = P.jawKind, tailKind = P.tailKind, mats = P.mats, segMat = P.segMat,
        antKind = P.antKind, eyeKind = P.eyeKind, legKind = P.legKind, plateKind = P.plateKind;
    var has = function (th) { return growth >= th; };
    var plated = plateKind && wingKind !== 2;   // no plates under an elytra shell

    /* The drawn extent of the bug at a given growth. Used twice: once to fit an
       oversized adult inside the canvas, and once to FRAME the camera. */
    function frameAt(gr) {
      var hv = function (th) { return gr >= th; };
      return {
        top: Math.min.apply(0, seg.map(function (s) { return s.y - s.r; })) - (hv(plan.wings) ? wingUp : 8) - (hv(Math.min.apply(0, plan.spines)) ? 10 : 0) - (plated ? 8 : 0),
        minx: Math.min.apply(0, seg.map(function (s) { return s.x - s.r; })) - (hv(plan.tail) ? tailLen * 1.3 + 6 : 4),
        maxx: Math.max.apply(0, seg.map(function (s) { return s.x + s.r; })) + (hv(plan.pincers) ? 16 : 8) + (hv(plan.horns) ? 10 : 0) + (hv(plan.wings) && wingKind !== 2 ? 16 : 0),
        bottom: Math.max.apply(0, seg.map(function (s) { return s.y + s.r; })) + 22
      };
    }
    // fit to canvas (account for the parts that have grown in)
    var fr = frameAt(growth);
    var top = fr.top, minx = fr.minx, maxx = fr.maxx, bottom = fr.bottom;
    var w = maxx - minx, h = bottom - top, f = Math.min(1, 176 / w, 182 / h);
    if (f < 1) { var mmx = (minx + maxx) / 2, mmy = (top + bottom) / 2; seg.forEach(function (s) { s.x = cx + (s.x - mmx) * f; s.y = cy + (s.y - mmy) * f; s.r *= f; }); tailLen *= f; }

    // ground shadow: a flat ellipse under the mass so the bug sits on a surface
    // (computed post-fit; hard-edged so the silhouette gate stays predictable).
    var shBy = Math.max.apply(0, seg.map(function (s) { return s.y + s.r; })) + 10;
    var shL = Math.min.apply(0, seg.map(function (s) { return s.x - s.r * 0.6; }));
    var shR = Math.max.apply(0, seg.map(function (s) { return s.x + s.r * 0.6; }));
    var shadow = '<ellipse cx="' + q((shL + shR) / 2) + '" cy="' + q(shBy) + '" rx="' + q((shR - shL) / 2) + '" ry="5" fill="' + pal.dark + '" opacity="0.18"/>';

    function grad(id, base) { return '<linearGradient id="' + id + '" x1="0.2" y1="0" x2="0.8" y2="1"><stop offset="0" stop-color="' + lt(base, 0.28) + '"/><stop offset="0.5" stop-color="' + base + '"/><stop offset="1" stop-color="' + mix(base, pal.dark, 0.42) + '"/></linearGradient>'; }
    /* ⛔ THE ID MUST BE UNIQUE PER RENDER, not per hash. It used to be
       hash.substr(0,6), so every copy of the same bug on a page emitted the
       SAME <linearGradient id="gb0abc123"> and <filter id="bfxabc123">. Your
       champion is drawn five times at once (HOME, the dumpster champion card,
       the challenger strip, a ladder row, and the arena), and an ID reference
       resolves to the FIRST match in document order, which is the copy sitting
       inside a display:none screen. Chrome never rasterizes paint servers in a
       hidden subtree, so every visible copy filled with url(#gb0abc123) painted
       NOTHING: the body vanished and the card showed a wire skeleton of legs,
       antennae and stitches. That is what the arena portraits and two of six
       BUGDEX cards looked like on 2026-08-24, in a real screenshot, at the real
       device pixel ratio. The counter makes every render its own document.
       ⛔ ids are the ONLY thing that varies between two renders of the same
       codeblock: scripts/plan_determinism.js normalizes them and still demands
       byte equality on everything else. */
    var uid = hash.substr(0, 6) + (_uidSeq = (_uidSeq + 1) % 100000).toString(36);
    var matDefs = mats.map(function (m, k) { return grad('gb' + k + uid, m); }).join('');
    // merged-silhouette filter: blur+threshold fuses overlapping segment circles
    // into one organic shape, then a dilated flood makes ONE ink outline hugging
    // the whole body. Crisp gradient fills draw on top, so patchwork survives.
    var bodyFx = merge ? '<filter id="bfx' + uid + '" x="-30%" y="-30%" width="160%" height="160%">'
      + '<feGaussianBlur in="SourceAlpha" stdDeviation="4.5" result="b"/>'
      + '<feColorMatrix in="b" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 26 -12" result="goo"/>'
      + '<feMorphology in="goo" operator="dilate" radius="2.6" result="d"/>'
      + '<feFlood flood-color="' + ol + '" result="oc"/>'
      + '<feComposite in="oc" in2="d" operator="in" result="stroke"/>'
      // fx rim light: the merged alpha minus itself offset down-right leaves a
      // crescent hugging the top-left edge — one implied light for the whole bug
      + (fx ? '<feOffset in="goo" dx="2.2" dy="2.6" result="go2"/>'
        + '<feComposite in="goo" in2="go2" operator="out" result="rimA"/>'
        + '<feFlood flood-color="' + lt(primary, 0.55) + '" flood-opacity="0.75" result="rc"/>'
        + '<feComposite in="rc" in2="rimA" operator="in" result="rim"/>' : '')
      + '<feMerge><feMergeNode in="stroke"/><feMergeNode in="SourceGraphic"/>'
      + (fx ? '<feMergeNode in="rim"/>' : '') + '</feMerge></filter>' : '';
    // fx one-light cel shade: hard-stop gradient (3 bands, no smooth ramp)
    // re-shades the WHOLE merged body under a single top-left light.
    var celGrad = fx ? '<linearGradient id="cel' + uid + '" x1="0.15" y1="0.05" x2="0.85" y2="0.95">'
      + '<stop offset="0" stop-color="#ffffff" stop-opacity="0.22"/>'
      + '<stop offset="0.38" stop-color="#ffffff" stop-opacity="0.22"/>'
      + '<stop offset="0.38" stop-color="#ffffff" stop-opacity="0"/>'
      + '<stop offset="0.66" stop-color="' + pal.dark + '" stop-opacity="0"/>'
      + '<stop offset="0.66" stop-color="' + pal.dark + '" stop-opacity="0.16"/>'
      + '<stop offset="1" stop-color="' + pal.dark + '" stop-opacity="0.3"/>'
      + '</linearGradient>' : '';
    var defs = '<defs>' + matDefs + grad('gh' + uid, secondary) + grad('gw' + uid, lt(accent, 0.1)) + bodyFx + celGrad + '</defs>';
    var back = '', legs = '', body = '', plates = '', stitches = '', shell = '', front = '';

    function membrane(ox, oy, sc, op) {
      return '<path d="M ' + q(ox) + ' ' + q(oy)
        + ' Q ' + q(ox - 32 * sc) + ' ' + q(oy - 38 * sc) + ' ' + q(ox + 8 + wSweep) + ' ' + q(oy - 44 * sc)
        + ' Q ' + q(ox + 36 * sc) + ' ' + q(oy - 32 * sc) + ' ' + q(ox + 32 * sc) + ' ' + q(oy - 6 * sc)
        + ' Q ' + q(ox + 18 * sc) + ' ' + q(oy + 2) + ' ' + q(ox) + ' ' + q(oy) + ' Z"'
        + ' fill="url(#gw' + uid + ')" stroke="' + dk(accent, 0.4) + '" stroke-width="1.6" opacity="' + op + '"/>'
        + '<path d="M ' + q(ox + 2) + ' ' + q(oy - 3) + ' Q ' + q(ox + 8) + ' ' + q(oy - 26 * sc) + ' ' + q(ox + 20) + ' ' + q(oy - 30 * sc) + '" fill="none" stroke="' + dk(accent, 0.35) + '" stroke-width="0.9" opacity="0.6"/>';
    }
    if (has(plan.wings)) { var sw = seg[thoraxI], wx = sw.x, wy = sw.y - sw.r * 0.3;
      if (wingKind === 2) {
        // beetle elytra: a hard domed shell over the back, seam + gloss, sits ON TOP of the sewn body
        var ea = seg[0], eb = sw, lx = ea.x - ea.r * 0.2, rx = eb.x + eb.r, topY = Math.min(ea.y, eb.y) - Math.max(ea.r, eb.r) - 6;
        shell += '<path d="M ' + q(lx) + ' ' + q(ea.y) + ' Q ' + q((lx + rx) / 2) + ' ' + q(topY) + ' ' + q(rx) + ' ' + q(eb.y - 2)
          + ' L ' + q(rx) + ' ' + q(eb.y + 3) + ' L ' + q(lx) + ' ' + q(ea.y + 3) + ' Z" fill="url(#gh' + uid + ')" stroke="' + ol + '" stroke-width="2.2" stroke-linejoin="round"/>';
        shell += '<path d="M ' + q(lx + 3) + ' ' + q(ea.y - 1) + ' Q ' + q((lx + rx) / 2) + ' ' + q(topY + 5) + ' ' + q(rx - 3) + ' ' + q(eb.y - 3) + '" fill="none" stroke="' + dk(pal.dark, 0.1) + '" stroke-width="1.4" opacity="0.55"/>';
        shell += '<ellipse cx="' + q(lx + (rx - lx) * 0.3) + '" cy="' + q(topY + 11) + '" rx="7" ry="4" fill="' + lt(secondary, 0.4) + '" opacity="0.5"/>';
      } else if (PART_SOURCES.wing.count > 0) {
        // authored wing symbol, placed on the exact same anchor the
        // procedural membrane uses; hindwing echo preserved for kind 1
        var wkeys = Object.keys(PART_SOURCES.wing.symbols).sort();
        var wsym = PART_SOURCES.wing.symbols[wkeys[t.wing % wkeys.length]];
        var wsc = (wingKind === 1 ? 1.18 : 1) * (t.wingScale || 1);
        var placedWing = function (px, py, s3, op) {
          return '<g color="' + accent + '" opacity="' + op + '" transform="translate(' + q(px) + ' ' + q(py) + ') scale(' + q(0.25 * s3) + ') translate(0 -128)">' + wsym + '</g>';
        };
        if (wingKind === 1) back += placedWing(wx - 3, wy + 4, wsc * 0.72, 0.8);
        back += placedWing(wx, wy, wsc, 0.95);
      } else {
        var sc = wingKind === 1 ? 1.18 : 1;
        if (wingKind === 1) back += membrane(wx - 3, wy + 4, 0.72, 0.8);   // hindwing, behind the forewing
        back += membrane(wx, wy, sc, 0.95);
      }
    }
    if (has(plan.tail)) { var stl = seg[0], tx = stl.x, ty = stl.y;
      if (tailKind === 1) {   // forked
        back += '<path d="M ' + q(tx) + ' ' + q(ty) + ' l ' + q(-tailLen) + ' -6 l 3 5 z" fill="' + spineCol + '" stroke="' + ol + '" stroke-width="1.4" stroke-linejoin="round"/>'
          + '<path d="M ' + q(tx) + ' ' + q(ty) + ' l ' + q(-tailLen) + ' 8 l 3 -5 z" fill="' + spineCol + '" stroke="' + ol + '" stroke-width="1.4" stroke-linejoin="round"/>';
      } else if (tailKind === 2) {   // clubbed stinger
        back += '<path d="M ' + q(tx) + ' ' + q(ty) + ' q ' + q(-tailLen) + ' 2 ' + q(-tailLen * 1.1) + ' 0" fill="none" stroke="' + spineCol + '" stroke-width="3" stroke-linecap="round"/>'
          + '<circle cx="' + q(tx - tailLen * 1.15) + '" cy="' + q(ty) + '" r="' + q(4 + tailLen * 0.12) + '" fill="' + spineCol + '" stroke="' + ol + '" stroke-width="1.4"/>';
      } else {   // straight stinger (original)
        back += '<path d="M ' + q(tx) + ' ' + q(ty) + ' q ' + q(-tailLen) + ' 4 ' + q(-tailLen * 1.2) + ' -8 l 5 -4 z" fill="' + spineCol + '" stroke="' + ol + '" stroke-width="1.6" stroke-linejoin="round"/>';
      }
    }
    var lw = (legKind === 1) ? 1 : 0;   // sturdy legs are thicker
    /* COHERENCE PASS (2026-09-05, the Lucid Winds flower lessons): every leg starts at a dark
       coxa socket on the segment, the way every plant leaf leaves the stem through a petiole
       swell, so a limb reads as attached instead of laid beside the body. No new rolls. */
    var sockets = '';
    seg.forEach(function (s, i) { if (!has(plan.legs[i])) return; var ky = s.y + s.r * 0.7 + 8;
      if (!lod) sockets += '<circle cx="' + q(s.x - 2) + '" cy="' + q(s.y + s.r * 0.5) + '" r="' + q(1.5 + lw * 0.6) + '" fill="' + ol + '"/>'
        + '<circle cx="' + q(s.x + 2) + '" cy="' + q(s.y + s.r * 0.5) + '" r="' + q(1.5 + lw * 0.6) + '" fill="' + ol + '"/>';
      legs += '<path d="M ' + q(s.x - 2) + ' ' + q(s.y + s.r * 0.5) + ' L ' + q(s.x - 7) + ' ' + q(ky) + ' L ' + q(s.x - 11) + ' ' + q(ky + 9) + '" fill="none" stroke="' + dk(ol, -0.2) + '" stroke-width="' + (2.2 + lw) + '" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>';
      legs += '<path d="M ' + q(s.x + 2) + ' ' + q(s.y + s.r * 0.5) + ' L ' + q(s.x - 3) + ' ' + q(ky) + ' L ' + q(s.x - 6) + ' ' + q(ky + 10) + '" fill="none" stroke="' + ol + '" stroke-width="' + (2.6 + lw) + '" stroke-linecap="round" stroke-linejoin="round"/>'; });
    if (legKind === 2) {   // raptorial forelegs: a bent, hooked limb reaching forward off the thorax
      var rs = seg[thoraxI], rx0 = rs.x + rs.r * 0.3, ry0 = rs.y + rs.r * 0.45;
      legs += '<path d="M ' + q(rx0) + ' ' + q(ry0) + ' L ' + q(rx0 + 7) + ' ' + q(ry0 + 10) + ' L ' + q(rx0 + 17) + ' ' + q(ry0 + 3) + ' L ' + q(rx0 + 15) + ' ' + q(ry0 + 11) + '" fill="none" stroke="' + ol + '" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>';
    }
    seg.forEach(function (s, i) { if (!has(plan.spines[i])) return; back += '<path d="M ' + q(s.x) + ' ' + q(s.y - s.r) + ' l -3 -9 l 6 0 z" fill="' + spineCol + '" stroke="' + ol + '" stroke-width="1"/>'; });
    seg.forEach(function (s, i) { var isHead = (i === N - 1), gid = isHead ? ('gh' + uid) : ('gb' + segMat[i] + uid);
      body += '<circle cx="' + q(s.x) + '" cy="' + q(s.y) + '" r="' + q(s.r) + '" fill="url(#' + gid + ')"' + (merge ? '' : ' stroke="' + ol + '" stroke-width="2.4"') + '/>';
      if (i < N - 1 && !lod) { var s2 = seg[i + 1], mx = (s.x + s2.x) / 2, my = (s.y + s2.y) / 2, rr = Math.min(s.r, s2.r) * 0.8, j, yy; for (j = -1; j <= 1; j++) { yy = my + j * rr * 0.7; stitches += '<path d="M ' + q(mx - 3) + ' ' + q(yy - 2.5) + ' L ' + q(mx + 3) + ' ' + q(yy + 2.5) + ' M ' + q(mx + 3) + ' ' + q(yy - 2.5) + ' L ' + q(mx - 3) + ' ' + q(yy + 2.5) + '" stroke="' + stitchCol + '" stroke-width="1" stroke-linecap="round"/>'; } } });
    // fx cel-shade overlay: the same segment circles once more, filled with the
    // hard-stop one-light gradient. Same alpha, so the merge outline/rim are
    // unaffected; it simply re-lights the patchwork under a single sun.
    var celOverlay = '';
    if (fx) { seg.forEach(function (s) { celOverlay += '<circle cx="' + q(s.x) + '" cy="' + q(s.y) + '" r="' + q(s.r) + '" fill="url(#cel' + uid + ')"/>'; }); }
    /* three layer catch light (flower renderer, Phase 22): a wide soft glow, then a tight
       specular hot spot on the tightest curve, both on the top-left of every segment so the
       whole bug agrees on one light. Skipped at LOD so a 58px card stays clean. */
    if (fx && !lod) { seg.forEach(function (s) {
      var hx = s.x - s.r * 0.36, hy = s.y - s.r * 0.42;
      celOverlay += '<circle cx="' + q(hx) + '" cy="' + q(hy) + '" r="' + q(s.r * 0.5) + '" fill="' + lt(primary, 0.5) + '" opacity="0.14"/>'
        + '<ellipse cx="' + q(hx) + '" cy="' + q(hy) + '" rx="' + q(s.r * 0.22) + '" ry="' + q(s.r * 0.13) + '" fill="#ffffff" opacity="0.34" transform="rotate(-28 ' + q(hx) + ' ' + q(hy) + ')"/>';
    }); }
    if (plated) {   // dorsal armor cap over each body segment (not the head)
      seg.forEach(function (s, i) {
        if (i === N - 1) return;
        var pw = s.r * 0.86, pc = mix(mats[segMat[i]], pal.dark, 0.32);
        plates += '<path d="M ' + q(s.x - pw) + ' ' + q(s.y - s.r * 0.12)
          + ' Q ' + q(s.x) + ' ' + q(s.y - s.r * 1.24) + ' ' + q(s.x + pw) + ' ' + q(s.y - s.r * 0.12)
          + ' Q ' + q(s.x) + ' ' + q(s.y + s.r * 0.14) + ' ' + q(s.x - pw) + ' ' + q(s.y - s.r * 0.12) + ' Z"'
          + ' fill="' + pc + '" stroke="' + ol + '" stroke-width="1.3" stroke-linejoin="round" opacity="0.92"/>';
        plates += '<path d="M ' + q(s.x - pw * 0.6) + ' ' + q(s.y - s.r * 0.55) + ' Q ' + q(s.x) + ' ' + q(s.y - s.r * 1.02) + ' ' + q(s.x + pw * 0.6) + ' ' + q(s.y - s.r * 0.55) + '" fill="none" stroke="' + lt(mats[segMat[i]], 0.22) + '" stroke-width="1.1" opacity="0.55"/>';
      });
    }

    var head = seg[N - 1], eR = head.r * 0.42, ax = head.x + head.r * 0.2, ay = head.y - head.r * 0.8;
    if (has(0.12)) {
      var t1x = ax + 20, t1y = ay - 20, t2x = ax + 12, t2y = ay - 24;   // antenna tips
      if (!lod) front += '<circle cx="' + q(ax - 2) + '" cy="' + q(ay + 0.5) + '" r="2.1" fill="' + ol + '"/>';
      front += '<path d="M ' + q(ax) + ' ' + q(ay) + ' Q ' + q(ax + 10) + ' ' + q(ay - 14) + ' ' + q(t1x) + ' ' + q(t1y) + '" fill="none" stroke="' + ol + '" stroke-width="1.8" stroke-linecap="round"/>'
        + '<path d="M ' + q(ax - 4) + ' ' + q(ay) + ' Q ' + q(ax + 4) + ' ' + q(ay - 16) + ' ' + q(t2x) + ' ' + q(t2y) + '" fill="none" stroke="' + ol + '" stroke-width="1.8" stroke-linecap="round"/>';
      if (antKind === 1) {   // clubbed tips
        front += '<circle cx="' + q(t1x) + '" cy="' + q(t1y) + '" r="2.5" fill="' + spineCol + '" stroke="' + ol + '" stroke-width="0.8"/>'
          + '<circle cx="' + q(t2x) + '" cy="' + q(t2y) + '" r="2.5" fill="' + spineCol + '" stroke="' + ol + '" stroke-width="0.8"/>';
      } else if (antKind === 2) {   // feathered barbs
        for (var bi = 1; bi <= 3; bi++) {
          var tt = bi / 4;
          front += '<path d="M ' + q(ax + (t1x - ax) * tt) + ' ' + q(ay + (t1y - ay) * tt) + ' l 4 -1" stroke="' + ol + '" stroke-width="1" stroke-linecap="round"/>'
            + '<path d="M ' + q((ax - 4) + (t2x - (ax - 4)) * tt) + ' ' + q(ay + (t2y - ay) * tt) + ' l 4 -1" stroke="' + ol + '" stroke-width="1" stroke-linecap="round"/>';
        }
      }
    }
    if (has(plan.horns)) { front += '<path d="M ' + q(head.x + head.r * 0.1) + ' ' + q(head.y - head.r * 0.85) + ' Q ' + q(head.x + head.r * 0.6 + hornCurl * 10) + ' ' + q(head.y - head.r * 1.6) + ' ' + q(head.x + head.r * 1.1) + ' ' + q(head.y - head.r * 1.5) + '" fill="none" stroke="' + spineCol + '" stroke-width="3" stroke-linecap="round"/>'; }
    if (has(plan.pincers)) { var jx = head.x + head.r * 0.8, jy = head.y;
      if (jawKind === 2) {   // crossing tusks
        front += '<path d="M ' + q(jx) + ' ' + q(jy + head.r * 0.2) + ' q 12 0 15 8" fill="none" stroke="' + ol + '" stroke-width="2.6" stroke-linecap="round"/>'
          + '<path d="M ' + q(jx) + ' ' + q(jy + head.r * 0.55) + ' q 12 2 15 -3" fill="none" stroke="' + ol + '" stroke-width="2.6" stroke-linecap="round"/>';
      } else if (jawKind === 3) {   // open filled mandibles
        front += '<path d="M ' + q(jx) + ' ' + q(jy + head.r * 0.12) + ' l 12 -3 l -2 7 z" fill="' + spineCol + '" stroke="' + ol + '" stroke-width="1.4" stroke-linejoin="round"/>'
          + '<path d="M ' + q(jx) + ' ' + q(jy + head.r * 0.62) + ' l 12 4 l -3 -7 z" fill="' + spineCol + '" stroke="' + ol + '" stroke-width="1.4" stroke-linejoin="round"/>';
      } else {   // curved pincers (original)
        front += '<path d="M ' + q(jx) + ' ' + q(jy + head.r * 0.3) + ' q 9 3 7 10" fill="none" stroke="' + ol + '" stroke-width="2.6" stroke-linecap="round"/>'
          + '<path d="M ' + q(jx) + ' ' + q(jy + head.r * 0.55) + ' q 8 5 4 11" fill="none" stroke="' + ol + '" stroke-width="2.2" stroke-linecap="round"/>';
      }
    }
    var eyeX = head.x + head.r * 0.3, eyeY = head.y - head.r * 0.2;
    if (eyeKind === 1) {   // compound eye: a cluster of facets
      var er2 = eR * 0.95;
      [[0, 0], [-0.55, -0.5], [0.5, -0.45], [-0.45, 0.55], [0.55, 0.45]].forEach(function (o) {
        front += '<circle cx="' + q(eyeX + o[0] * er2) + '" cy="' + q(eyeY + o[1] * er2) + '" r="' + q(er2 * 0.44) + '" fill="' + dk(pal.dark, 0.05) + '" stroke="' + ol + '" stroke-width="0.8"/>';
      });
      front += '<circle cx="' + q(eyeX - er2 * 0.3) + '" cy="' + q(eyeY - er2 * 0.35) + '" r="' + q(er2 * 0.2) + '" fill="#fdfdfa"/>';
    } else {   // single eye (original), optionally half-lidded
      front += '<ellipse cx="' + q(eyeX) + '" cy="' + q(eyeY) + '" rx="' + q(eR * 0.85) + '" ry="' + q(eR) + '" fill="' + dk(pal.dark, 0.05) + '" stroke="' + ol + '" stroke-width="1.2"/><circle cx="' + q(head.x + head.r * 0.15) + '" cy="' + q(head.y - head.r * 0.4) + '" r="' + q(eR * 0.32) + '" fill="#fdfdfa"/>';
      if (eyeKind === 2) front += '<path d="M ' + q(eyeX - eR * 0.85) + ' ' + q(eyeY - eR * 0.45) + ' q ' + q(eR * 0.85) + ' ' + q(-eR * 0.6) + ' ' + q(eR * 1.7) + ' 0" fill="none" stroke="' + ol + '" stroke-width="1.4" stroke-linecap="round"/>';
    }
    if (has(plan.extraEyes)) { front += '<ellipse cx="' + q(head.x + head.r * 0.05) + '" cy="' + q(head.y - head.r * 0.45) + '" rx="' + q(eR * 0.5) + '" ry="' + q(eR * 0.6) + '" fill="' + dk(pal.dark, 0.05) + '" stroke="' + ol + '" stroke-width="1"/>'; }

    /* ⛔ THE CAMERA. Until 2026-08-24 this was a hard viewBox="0 0 200 200", and
       the fit above only ever scales DOWN, so a compact bug drew inside maybe a
       third of its own box. At the sizes the game actually uses (58px champion
       picker, 84px BUGDEX card) that left four faint specks: playing it, you
       could not tell an insect from a smudge. The camera now frames the art.
       It does NOT frame it tight, because then a level 1 grub and a level 30
       adult would fill the card identically and growth would stop reading.
       The camera is framed on the FINISHED ADULT and then held still, so a
       level 1 grub sits small in the box its grown self will fill, grows in
       place rather than jumping around, and both ends of that are legible.
       Camera only: no path in this function moves because of it. */
    /* depth separation without a filter: a dark copy of a part layer offset 1.4px down-right at
       0.38, the flower renderer's leaf shadow. Ids and url(#) refs inside the copy get a suffix so
       an authored wing symbol's gradient never resolves into its own shadow. Off at LOD. */
    function partShadow(layer) {
      if (lod || !layer) return '';
      var sh = layer.replace(/id="([^"]+)"/g, 'id="$1_sh"').replace(/url\(#([^)]+)\)/g, 'url(#$1_sh)')
        .replace(/fill="[^"]*"/g, 'fill="' + ol + '"').replace(/stroke="[^"]*"/g, 'stroke="' + ol + '"').replace(/opacity="[^"]*"/g, '');
      return '<g transform="translate(1.4 1.6)" opacity="0.38">' + sh + '</g>';
    }
    /* when the hero part is in (wings), the legs step back a little, the way leaves dim under a bloom */
    var legsGroup = sockets + (has(plan.wings) ? '<g opacity="0.88">' + legs + '</g>' : legs);
    var fA = frameAt(1);
    var side = Math.max(fA.maxx - fA.minx, fA.bottom - fA.top) * 1.06;
    var vbx = (fA.minx + fA.maxx) / 2 - side / 2, vby = (fA.top + fA.bottom) / 2 - side / 2;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + q(vbx) + ' ' + q(vby) + ' ' + q(side) + ' ' + q(side) + '" width="' + size + '" height="' + size + '">'
      /* ⛔ the body is drawn TWICE when the merge filter is on, and that is
         deliberate. The filter fuses the segment circles with a gaussian blur
         and then an feColorMatrix threshold (alpha must clear 0.46). Chrome
         rasterizes filters at device resolution, and at the sizes this game
         actually ships (84px BUGDEX card at devicePixelRatio 2) some genomes
         fall under that threshold and the ENTIRE BODY DISAPPEARS, leaving a
         wire skeleton of legs, antennae and stitches on the card. Seen on 2 of
         6 cards in a real 412x915 dsf2 screenshot on 2026-08-24; invisible at
         dsf5, which is why no review had ever caught it. The plain copy under
         the filtered group is covered pixel for pixel by the filter's own
         SourceGraphic when the filter works, so it changes nothing then, and
         it is the whole bug when the filter blows out. */
        + defs + shadow + partShadow(back) + back + partShadow(legs) + legsGroup + (merge ? body + '<g filter="url(#bfx' + uid + ')">' + body + celOverlay + '</g>' : body) + plates + stitches + shell + front + '</svg>';
  }

  // ══ IDENTITY ENGINE ═════════════════════════════════════════════════
  // Every bug gets a common name, a pseudo-Latin species binomial, a
  // near-unique specimen designation, and a short poetic backstory, all
  // deterministic from the codeblock. The codeblock carries 256 bits, far
  // more than the anatomy uses, so name and lore draw from an independent,
  // effectively bottomless space. Voice: litter-born field-journal — these
  // are little lives made from what people threw away, now holding turf.
  //
  // STABILITY NOTE: outputs are deterministic from the codeblock AND from
  // the current bank contents. Growing a bank (append/reorder) shifts the
  // draws, so a persisted bug should FREEZE its name+lore at mint time;
  // bank growth then only enriches future rolls, never rewrites old ones.

  // Deterministic PRNG seeded from a string (cyrb128 -> sfc32). Pure integer
  // ops, so identical output in browser and Node. Gives unlimited stable draws.
  function cyrb128(str) {
    var h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
    for (var i = 0, k; i < str.length; i++) {
      k = str.charCodeAt(i);
      h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
      h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
      h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
      h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
  }
  function sfc32(a, b, c, d) {
    return function () {
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      var t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  }
  function seededRng(seedStr) {
    var s = cyrb128(String(seedStr));
    return sfc32(s[0], s[1], s[2], s[3]);
  }
  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
  function pickN(rng, arr, n) {
    var pool = arr.slice(), out = [];
    for (var i = 0; i < n && pool.length; i++) {
      out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    }
    return out;
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // ── Common-name banks. ──────────────────────────────────────────────
  var NAME_ADJ = ['mossy','tin','husk','glass','rust','paper','brittle','velvet',
    'salt','cobweb','dusty','lichen','brass','wax','sodium','cellophane','grit',
    'ember','tallow','soot','amber','chrome','vellum','foil','ash','clinker',
    'ceramic','frost','gutter','bottleglass'];
  var NAME_CREATURE = ['beetle','moth','hopper','skit','click','watcher','vesper',
    'mite','crawler','spinner','filing','weevil','lantern','borer','chafer','gnat',
    'locust','mantis','earwig','firebrat','silverfish','roach','katydid','cicada',
    'longhorn','drift'];
  var NAME_HONORIFIC = ['Little','Old','Saint','Sir','Dame','King','Warden','Mother','Baron','Duke'];
  var NAME_EPITHET = ['the Tarnished','the Unswept','the Ninefold','the Late',
    'the Gutterborn','the Persistent','the Frayed','the Kept','the Overlooked',
    'the Recurring','the Sodium-Lit','the Unspent','the Wintered','the Hollow',
    'the Bottlefed','the Long-Waiting'];

  // ── Species (pseudo-Latin taxonomy) banks. ──────────────────────────
  var SP_GENUS = ['Chitin','Vespa','Gutter','Litho','Ferra','Scoria','Detrita',
    'Noctu','Cinis','Strata','Culex','Blatta','Carab','Formic','Lampyr','Acanth',
    'Tenebri','Crypto','Sordid','Aurel'];
  var SP_GSUFFIX = ['a','us','ops','ina','ella','odes','ymis'];
  var SP_ROOT = ['sordid','noctis','ferri','cellophan','vulgar','gutteri','sodium',
    'rubig','tarnix','oblit','recurr','vespid','minim','detrit','cinere','stratum'];
  var SP_SUFFIX = ['us','a','ii','ensis','ata','osa'];

  // ── Lore banks (trait-linked color/temper + litter-born imagery). ───
  // Lore color now comes from the bug's actual palette scheme (PALETTES[].lore),
  // so the backstory names the color the player is looking at.
  var LORE_TEMPER = ['patient','vengeful','skittish','stubborn','watchful','restless',
    'territorial','solitary','tireless','wary','defiant','quiet'];
  var LORE_WHEN = ['at first frost','on a rain-slick morning','under a dead streetlight',
    'in the last week of summer','on collection day','at the turn of the tide',
    'during the long dust','on a grey Tuesday','after the floods','at closing time'];
  var LORE_PLACE = ['the gutter','the tin gardens','a drain-mouth','the recycling drift',
    'a landfill dawn','the underpass','the bottle-bank','the storm grate',
    'the alley behind the diner','the wet cardboard','the culvert','a heap of raked leaves',
    'the parking-lot verge','the sodium dark','the overflow','the skip'];
  var LORE_MATERIAL = ['cellophane','foil','wax paper','bottle-glass','a snapped twist-tie',
    'grit','a bottlecap crown','cigarette silver','a bent straw','packing foam'];
  var LORE_EVENT = ['the lamps first buzzed on','nothing was thrown away',
    'the rain forgot to stop','the bins went uncollected','the frost took the others',
    'a gate was left open','the tide left its wrack','the machines went quiet'];
  var LORE_HABIT = ['counts what it cannot keep','guards a square of warm concrete',
    'follows the scent of spilled sugar','hoards bright scraps','answers only to the rain',
    'walks the same seam of pavement','keeps the old boundaries','waits out the sweepers',
    'maps the drains by heart'];
  var LORE_ENEMY = ['no sweeper','no gull','no rival brood','no boot','no frost','no rival king'];
  var LORE_VERBPAST = ['moved','routed','out-waited','unseated','cornered','outlasted'];
  var LORE_OATH = ['to hold the grate','to keep the corner','to outlast the winter',
    'to guard the drift','to answer the lamp','to keep what it found'];
  var LORE_WEATHER = ['the rain','the frost','the sweepers','the long heat','the floodwater','the grey'];
  var LORE_REACTION = ['goes still and waits','digs in deeper','holds its ground',
    'folds its wings and endures','doubles its patrol','will not be moved'];
  var LORE_MEMORY = ['a warmth it never names','one bright wrapper','the shape of an old territory',
    'the hum of the last lamp','a season that did not come back','the taste of spilled syrup'];
  var LORE_COUNT = ['three','seven','a dozen','forty','nine','more'];
  var LORE_TRAIT_TPL = ['its shell holds the {color} of {material}',
    'a {temper} thing, it {habit}', 'logged as {color}, tempered {temper}',
    '{temper} to the last, it keeps to {place}'];
  var LORE_GEN_TPL = ['hatched {when} in {place}', 'born where {event}',
    'it remembers {memory}, and little else', 'sworn {oath}',
    'when {weather} comes, it {reaction}',
    'they found it in {place}, crowned in {material}',
    'it has outlived {count} broods and buried the count',
    '{enemy} has ever {verbpast} it twice', 'it {habit}, and asks for nothing'];

  // bugName: evocative common name. Core is Adj + Creature; sometimes an
  // honorific prefix, sometimes an epithet tail. Deterministic per codeblock.
  function bugName(codeblock) {
    var rng = seededRng(codeblock + '|name');
    var out = cap(pick(rng, NAME_ADJ)) + ' ' + cap(pick(rng, NAME_CREATURE));
    if (rng() < 0.32) out = pick(rng, NAME_HONORIFIC) + ' ' + out;
    if (rng() < 0.42) out = out + ' ' + pick(rng, NAME_EPITHET);
    return out;
  }

  // bugSpecies: pseudo-Latin binomial. Huge, taxonomy-flavored space.
  function bugSpecies(codeblock) {
    var rng = seededRng(codeblock + '|species');
    var genus = pick(rng, SP_GENUS) + pick(rng, SP_GSUFFIX);
    var epithet = pick(rng, SP_ROOT) + pick(rng, SP_SUFFIX);
    return cap(genus) + ' ' + epithet;
  }

  // bugDesignation: near-unique specimen tag pulled straight from the hash.
  function bugDesignation(codeblock) {
    var h = String(codeblock);
    return 'LB-' + h.slice(0, 4).toUpperCase() + '-' + h.slice(4, 8).toUpperCase();
  }

  // bugLore: 3 short poetic lines. One line is trait-linked (the bug's actual
  // primary color and its behavior-derived temperament), two are drawn from
  // the litter-born imagery banks. Deterministic per codeblock.
  function bugLore(codeblock) {
    var t = hashToBugTraits(codeblock);
    var rng = seededRng(codeblock + '|lore');
    var color = (PALETTES[t.palette] || PALETTES[0]).lore;
    var temper = LORE_TEMPER[(t.behavior || 0) % LORE_TEMPER.length];
    function fill(tpl) {
      return tpl
        .replace('{when}', pick(rng, LORE_WHEN))
        .replace('{place}', pick(rng, LORE_PLACE))
        .replace('{material}', pick(rng, LORE_MATERIAL))
        .replace('{event}', pick(rng, LORE_EVENT))
        .replace('{habit}', pick(rng, LORE_HABIT))
        .replace('{enemy}', pick(rng, LORE_ENEMY))
        .replace('{verbpast}', pick(rng, LORE_VERBPAST))
        .replace('{oath}', pick(rng, LORE_OATH))
        .replace('{weather}', pick(rng, LORE_WEATHER))
        .replace('{reaction}', pick(rng, LORE_REACTION))
        .replace('{memory}', pick(rng, LORE_MEMORY))
        .replace('{count}', pick(rng, LORE_COUNT))
        .replace('{color}', color)
        .replace('{temper}', temper);
    }
    var lines = [pick(rng, LORE_TRAIT_TPL)].concat(pickN(rng, LORE_GEN_TPL, 2));
    return lines.map(function (tpl) {
      var s = fill(tpl);
      s = s.charAt(0).toUpperCase() + s.slice(1);
      return /[.!?]$/.test(s) ? s : s + '.';
    }).join('\n');
  }

  // bugIdentity: the whole nameplate for a bug.
  function bugIdentity(codeblock) {
    return {
      name: bugName(codeblock),
      species: bugSpecies(codeblock),
      designation: bugDesignation(codeblock),
      lore: bugLore(codeblock)
    };
  }

  // ══ BATTLE STATS (P1: a bug is a fighter) ═══════════════════════════
  // Every combat number is DERIVED from the same traits that draw the bug,
  // so a bug's look predicts its fight: big body = HP, big head = ATK, wings
  // = speed/dodge, no wings = tankier, antennae = accuracy. Deterministic.

  // Six litter-born elemental types. A bug's type comes from its palette
  // scheme (the color the player sees), so type is legible at a glance.
  var TYPES = ['Rust', 'Moss', 'Spark', 'Ooze', 'Glass', 'Ash'];
  // Type of each palette scheme, parallel to PALETTES by index.
  var PALETTE_TYPE = [
    'Rust','Moss','Spark','Ooze','Glass','Moss','Rust','Ash','Spark','Glass',
    'Spark','Ooze','Moss','Glass','Ash','Rust','Rust','Ooze','Glass','Glass',
    'Rust','Moss','Spark','Glass','Rust','Moss','Ash','Rust','Rust','Rust',
    'Rust','Rust','Rust','Rust','Rust','Rust','Rust','Moss','Moss','Moss',
    'Moss','Moss','Moss','Moss','Moss','Moss','Spark','Spark','Spark','Spark',
    'Spark','Spark','Spark','Spark','Spark','Ooze','Ooze','Ooze','Ooze','Ooze',
    'Ooze','Ooze','Ooze','Glass','Glass','Glass','Glass','Glass','Glass','Glass',
    'Glass','Glass','Ash','Ash','Ash','Ash','Ash','Ash','Ash','Ash'];
  // Cyclic chart: each type is strong vs the next two in the ring, weak vs the
  // previous two, neutral vs the one opposite. Balanced by construction.
  var TYPE_CHART = {};
  (function () {
    var n = TYPES.length;
    for (var i = 0; i < n; i++) {
      TYPE_CHART[TYPES[i]] = {
        strong: [TYPES[(i + 1) % n], TYPES[(i + 2) % n]],
        weak:   [TYPES[(i + n - 1) % n], TYPES[(i + n - 2) % n]]
      };
    }
  })();
  // typeMatchup(attacker, defender) -> damage multiplier (2 / 1 / 0.5).
  function typeMatchup(atk, def) {
    var c = TYPE_CHART[atk];
    if (!c) return 1;
    if (c.strong.indexOf(def) >= 0) return 1.6;
    if (c.weak.indexOf(def) >= 0) return 0.625;
    return 1;
  }
  // Dual-type effectiveness: product of the two per-type factors. With our
  // reciprocal 1.6/0.625 base this yields {0.39, 0.625, 1, 1.6, 2.56} -- a
  // gentle resistance/weakness band, no immunities, no hard 0.25/4x.
  function typeMatchupDual(atk, defPrimary, defSecondary) {
    var m = typeMatchup(atk, defPrimary);
    if (defSecondary) m *= typeMatchup(atk, defSecondary);
    return m;
  }

  // Eight tactical classes, from the bug's behavior trait. Each is a kit
  // hint the turn-based battle engine (P2) will read.
  var CLASSES = [
    { name: 'Aggressor',  kit: 'raw damage, hits first and hard' },
    { name: 'Bulwark',    kit: 'soaks hits, high HP and DEF' },
    { name: 'Skirmisher', kit: 'fast, dodges, chips away' },
    { name: 'Ambusher',   kit: 'big first strike, high crit' },
    { name: 'Venomancer', kit: 'poison and damage over time' },
    { name: 'Sentinel',   kit: 'guards allies and counters' },
    { name: 'Trickster',  kit: 'lowers enemy accuracy and speed' },
    { name: 'Swarm',      kit: 'many small multi-hits' }
  ];

  // Rarity is a separate roll (hash byte 24), DECOUPLED from power on purpose:
  // a common bug can still be a strong battler. Rarity is a collection/flex axis.
  var RARITIES = [
    { name: 'Common', min: 0 }, { name: 'Uncommon', min: 150 },
    { name: 'Rare', min: 210 }, { name: 'Epic', min: 240 },
    { name: 'Legendary', min: 253 }
  ];
  function rarityFor(roll) {
    var r = RARITIES[0];
    for (var i = 0; i < RARITIES.length; i++) if (roll >= RARITIES[i].min) r = RARITIES[i];
    return r.name;
  }

  // bugStats(codeblock) -> the full fighter profile. Deterministic.
  function bugStats(codeblock) {
    var t = hashToBugTraits(codeblock);
    /* ⛔ 2026-08-24: winged used to be (t.wing % 5) !== 4, a trait index the
       renderer never draws, so a bug with no wings on screen could be tagged
       Flying and carry +22 spd and +12 eva for wings you cannot see. It now
       asks bugPlan, which is what _generateBugSVG draws from: the tag and the
       picture agree. */
    var winged = bugPlan(codeblock).plan.wings !== 999;
    var hp  = 40 + (t.bodyLen % 40) + Math.floor((t.bodyW % 30) / 2);
    var atk = 30 + (t.head * 7) % 50 + ((t.head % 2) ? 8 : 0);
    var def = 30 + (t.body * 5) % 45 + ((t.pattern % 5 === 0) ? 6 : 0) + (winged ? 0 : 12);
    var spd = 28 + (winged ? 22 : 0) + (t.leg % 14) * 2;
    var acc = 45 + (t.antenna * 3) % 40;
    var eva = 8 + (winged ? 12 : 0) + (t.leg % 10) * 2;
    var stats = { hp: hp, atk: atk, def: def, spd: spd, acc: acc, eva: eva };
    var power = Math.round(hp * 0.6 + atk * 1.2 + def * 1.0 + spd * 0.9 + acc * 0.5 + eva * 0.7);
    // class from the raw behaviour byte mod 8 (even distribution; t.behavior
    // is mod 12 which, mapped mod 8, would over-represent the first 4 classes).
    var cls = CLASSES[hb(codeblock, 22) % CLASSES.length];
    var tags = [winged ? 'Flying' : 'Grounded'];
    if (t.head % 2) tags.push('Mandibles');
    // Dual-typing: primary comes from the palette (legible), secondary from a
    // free byte. ~37.5% of bugs are mono (secondary null) for a cozy read.
    var primary = PALETTE_TYPE[t.palette] || TYPES[0];
    var r19 = hb(codeblock, 19);
    var others = TYPES.filter(function (x) { return x !== primary; });
    var type2 = r19 < 96 ? null : others[r19 % others.length];
    // Nature: one stat up 8%, one down 8% (neutral if they collide).
    var SK = ['hp', 'atk', 'def', 'spd', 'acc', 'eva'];
    var nUp = SK[hb(codeblock, 20) % 6], nDown = SK[hb(codeblock, 21) % 6];
    var nature = (nUp === nDown) ? { up: null, down: null } : { up: nUp, down: nDown };
    return {
      type: primary, type2: type2, nature: nature,
      cls: cls.name, kit: cls.kit,
      stats: stats, power: power,
      rarity: rarityFor(hb(codeblock, 24)), tags: tags
    };
  }

  // ── Breeding: two parents -> a child codeblock (deterministic). ─────
  // Each of the 32 trait-bytes is inherited from one parent or the other
  // (order-independent), with a ~12% chance of mutation. Because traits map to
  // fixed byte positions, the child visibly blends its parents (this body, that
  // wing) yet is its own unique bug. Same parents always yield the same child.
  function breed(cbA, cbB) {
    var p = [String(cbA), String(cbB)].sort(), a = p[0], b = p[1];
    var rng = seededRng("breed:" + a + ":" + b);
    var hexc = "0123456789abcdef", child = "";
    for (var i = 0; i < 64; i += 2) {
      var byte = (rng() < 0.5 ? a : b).substr(i, 2);
      if (rng() < 0.12) byte = hexc[Math.floor(rng() * 16)] + hexc[Math.floor(rng() * 16)];
      child += byte;
    }
    return child;
  }

  // ── NEW: the codeblock mint (play -> codeblock). ────────────────────
  // serializeTrace: canonical, order-sensitive string from a play trace.
  // A trace is an array of moves; each move is { i: <int action/cell>, dt:
  // <int ms since previous move> }. The serialization is deterministic so
  // the SAME trace always yields the SAME codeblock, which is what lets a
  // server later recompute and verify a submitted bug.
  function serializeTrace(trace) {
    if (!Array.isArray(trace)) return "lb1|";
    return "lb1|" + trace.map(function (m) {
      return ((m && m.i) | 0) + "." + ((m && m.dt) | 0);
    }).join(";");
  }

  // mintCodeblock: fold a salt into the serialized trace, then SHA-256.
  // The salt is the "server secret" seam (director decision 2026-07-17):
  // in production the salt is held server-side so nobody can pre-compute or
  // replay an input to farm a specific bug. In Phase 0 it is a fixed local
  // stand-in. Returns a 64-hex codeblock string.
  async function mintCodeblock(salt, trace) {
    return sha256Hex(String(salt) + "#" + serializeTrace(trace));
  }

  // bugFromCodeblock: convenience — codeblock -> { traits, identity, svg }.
  function bugFromCodeblock(codeblock, size, level) {
    var id = bugIdentity(codeblock);
    return {
      traits: hashToBugTraits(codeblock),
      name: id.name,          // kept for back-compat
      identity: id,           // { name, species, designation, lore }
      stats: bugStats(codeblock),  // { type, cls, kit, stats, power, rarity, tags }
      svg: _generateBugSVG(codeblock, size || 160, level)  // level = growth (default full)
    };
  }

  // ── Exports (browser + Node). ───────────────────────────────────────
  var _api = {
    sha256Hex: sha256Hex, hb: hb, hc: hc, hexToRGB: hexToRGB,
    hashToBugTraits: hashToBugTraits, _generateBugSVG: _generateBugSVG, bugPlan: bugPlan,
    bugGrade: bugGrade, GRADES: GRADES, GRADE_CUT: GRADE_CUT,
    bugName: bugName, bugSpecies: bugSpecies, bugDesignation: bugDesignation,
    bugLore: bugLore, bugIdentity: bugIdentity, seededRng: seededRng, PALETTES: PALETTES,
    TYPES: TYPES, TYPE_CHART: TYPE_CHART, typeMatchup: typeMatchup,
    typeMatchupDual: typeMatchupDual, CLASSES: CLASSES, bugStats: bugStats,
    WING_BANK: WING_BANK, BODY_BANK: BODY_BANK, HEAD_BANK: HEAD_BANK,
    LEG_BANK: LEG_BANK, ANTENNA_BANK: ANTENNA_BANK, PATTERN_BANK: PATTERN_BANK,
    serializeTrace: serializeTrace, mintCodeblock: mintCodeblock,
    bugFromCodeblock: bugFromCodeblock, breed: breed,
    registerPart: registerPart, clearParts: clearParts
  };
  if (typeof module !== "undefined" && module.exports) { module.exports = _api; }
  if (typeof window !== "undefined") {
    window.BUG_ENGINE = _api;
    Object.keys(_api).forEach(function (k) { window[k] = _api[k]; });
  }
})();
