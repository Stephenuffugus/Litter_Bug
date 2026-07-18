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
  function _generateBugSVG(hash, size) {
    var t = hashToBugTraits(hash), pal = PALETTES[t.palette] || PALETTES[0];
    var uid = hash.substr(0, 8);
    var primary = pal.primary, secondary = pal.secondary, accent = pal.accent;

    function _rgb(h){ h=h.replace('#',''); return { r:parseInt(h.slice(0,2),16), g:parseInt(h.slice(2,4),16), b:parseInt(h.slice(4,6),16) }; }
    function _hx(o){ var c=function(v){ return ('0'+Math.max(0,Math.min(255,Math.round(v))).toString(16)).slice(-2); }; return '#'+c(o.r)+c(o.g)+c(o.b); }
    function dk(h,f){ var c=_rgb(h); return _hx({ r:c.r*(1-f), g:c.g*(1-f), b:c.b*(1-f) }); }
    function lt(h,f){ var c=_rgb(h); return _hx({ r:c.r+(255-c.r)*f, g:c.g+(255-c.g)*f, b:c.b+(255-c.b)*f }); }
    function mix(a,b,tt){ var x=_rgb(a),y=_rgb(b); return _hx({ r:x.r+(y.r-x.r)*tt, g:x.g+(y.g-x.g)*tt, b:x.b+(y.b-x.b)*tt }); }
    function band(i,min,max){ return min + (hb(hash,i)/255)*(max-min); }
    function q(v){ return v.toFixed(2); }
    // superellipse closed path; taperRear scales the rear (x<cx) half-width.
    function bodyPath(cx2,cy2,a,b,n,taperRear,steps){
      var d='',i,th,ct,st,ax,x,y;
      for(i=0;i<=steps;i++){ th=(i/steps)*2*Math.PI; ct=Math.cos(th); st=Math.sin(th);
        ax = ct<0 ? a*taperRear : a;
        x = cx2 + ax*Math.sign(ct)*Math.pow(Math.abs(ct),2/n);
        y = cy2 + b*Math.sign(st)*Math.pow(Math.abs(st),2/n);
        d += (i?'L':'M')+q(x)+' '+q(y)+' '; }
      return d+'Z';
    }

    var ol = dk(pal.dark, 0.25);
    var cx = 97, cy = 108;

    // one size driver + clamped ratio bands
    var g = {};
    g.abRy = band(1, 26, 38);
    g.abRx = g.abRy * band(2, 1.05, 1.45);
    g.thR  = Math.min(g.abRy * band(4, 0.60, 0.86), g.abRy * 0.9);
    g.hR   = Math.min(g.thR * band(5, 0.55, 0.82), g.thR * 0.9);
    g.eR   = g.hR * band(6, 0.36, 0.5);
    g.legLen = g.abRy * band(7, 0.9, 1.6);
    g.antLen = g.hR * band(8, 1.4, 2.6);
    g.wingSpan = g.abRx * band(9, 0.95, 1.35);
    g.nAb = band(12, 2.0, 3.3); g.taper = band(13, 0.72, 1.0);
    g.nTh = band(15, 2.0, 2.7); g.nH = band(16, 2.0, 3.0);
    g.snout = band(17, 0, g.hR * 0.4);
    g.wSweep = band(19, -8, 20); g.wDroop = band(20, 0, 14);
    g.legPairs = band(21, 0, 1) < 0.75 ? 3 : 4;
    g.femur = band(22, 0.35, 0.6); g.curl = band(23, -0.3, 0.5);
    g.antCurl = band(24, 0.2, 0.9); g.club = band(26, 2, 5);
    g.patCount = Math.round(band(27, 2, 5));
    g.wf = t.wing % 5; g.af = t.antenna % 5; g.pf = t.pattern % 5; g.mand = t.head % 2; g.hfam = t.head % 5;
    if (g.wf === 4) { g.legLen *= 1.15; g.abRx *= 1.08; }   // wingless compensation

    // fit-to-canvas: uniform down-scale if the figure would exceed the safe rect
    function positions(g){
      var abCx = cx - g.abRx*0.5, thCx = abCx + g.abRx*0.5 + g.thR*0.42, hCx = thCx + g.thR*0.5 + g.hR*0.5;
      return { abCx:abCx, thCx:thCx, hCx:hCx,
        left: abCx - g.abRx*g.taper, right: hCx + g.hR + g.snout + (g.mand ? g.hR*0.5 : 0),
        top: cy - (g.abRy + g.wingSpan*0.72), bottom: cy + g.abRy*0.9 + g.legLen*0.9 };
    }
    var p = positions(g), m = 12;
    var f = Math.min(1, (cx-m)/(cx-p.left), (200-m-cx)/(p.right-cx), (cy-m)/(cy-p.top), (200-m-cy)/(p.bottom-cy));
    if (f < 0.999) { ['abRy','abRx','thR','hR','eR','legLen','antLen','wingSpan','snout'].forEach(function(k){ g[k]*=f; }); p = positions(g); }
    var abCx = p.abCx, thCx = p.thCx, hCx = p.hCx, hCy = cy - 2;

    function shade(id, base){ return '<linearGradient id="'+id+uid+'" x1="0.2" y1="0.05" x2="0.85" y2="1">'
      + '<stop offset="0" stop-color="'+lt(base,0.30)+'"/><stop offset="0.44" stop-color="'+base+'"/>'
      + '<stop offset="0.46" stop-color="'+base+'"/><stop offset="1" stop-color="'+mix(base,pal.dark,0.4)+'"/></linearGradient>'; }
    var abD = bodyPath(abCx, cy, g.abRx, g.abRy, g.nAb, g.taper, 52);
    var defs = '<defs>' + shade('gB',primary) + shade('gT',secondary) + shade('gH',secondary) + shade('gW',lt(accent,0.12))
      + '<clipPath id="ca'+uid+'"><path d="'+abD+'"/></clipPath></defs>';

    // wings (behind); family by t.wing%5, 4 = wingless
    var wing = '';
    if (g.wf !== 4) {
      var wsc = g.wingSpan/44, wx = thCx-3, wy = cy - g.thR*0.5, sw = g.wSweep, dr = g.wDroop, d;
      var wcol = 'fill="url(#gW'+uid+')" stroke="'+dk(accent,0.4)+'" stroke-width="1.8"';
      if (g.wf===0) d='M '+wx+' '+wy+' Q '+q(wx-38*wsc)+' '+q(wy-58*wsc)+' '+q(wx+16+sw)+' '+q(wy-64*wsc)+' Q '+q(wx+50*wsc)+' '+q(wy-52*wsc)+' '+q(wx+46*wsc)+' '+q(wy-12+dr)+' Q '+q(wx+32)+' '+q(wy+2)+' '+wx+' '+wy+' Z';
      else if (g.wf===1) d='M '+wx+' '+wy+' Q '+q(wx-28*wsc)+' '+q(wy-64*wsc)+' '+q(wx+28+sw)+' '+q(wy-70*wsc)+' L '+q(wx+58*wsc)+' '+q(wy-26+dr)+' Q '+q(wx+36)+' '+q(wy+2)+' '+wx+' '+wy+' Z';
      else if (g.wf===2) d='M '+wx+' '+wy+' Q '+q(wx-14)+' '+q(wy-54*wsc)+' '+q(wx+8+sw)+' '+q(wy-68*wsc)+' Q '+q(wx+28)+' '+q(wy-72*wsc)+' '+q(wx+38*wsc)+' '+q(wy-34+dr)+' Q '+q(wx+34)+' '+wy+' '+wx+' '+wy+' Z';
      else d='M '+wx+' '+wy+' Q '+q(wx-34*wsc)+' '+q(wy-54*wsc)+' '+q(wx+12+sw)+' '+q(wy-60*wsc)+' Q '+q(wx+46*wsc)+' '+q(wy-48*wsc)+' '+q(wx+42*wsc)+' '+q(wy-10+dr)+' Q '+q(wx+30)+' '+q(wy+2)+' '+wx+' '+wy+' Z';
      wing = '<path d="'+d+'" '+wcol+' opacity="0.96"/>'
        + '<path d="M '+q(wx+2)+' '+q(wy-4)+' Q '+q(wx+10)+' '+q(wy-30*wsc)+' '+q(wx+24)+' '+q(wy-38*wsc)+'" fill="none" stroke="'+lt(accent,0.5)+'" stroke-width="1.3" opacity="0.55"/>';
      if (g.wf===3) wing = '<path d="'+d+'" transform="translate(-12,6) scale(0.8)" '+wcol+' opacity="0.7"/>' + wing;
    }

    // legs (jointed, taper): far behind body + near in front
    var legW = 2.6 + (t.leg%3)*0.4; if (g.legPairs===4) legW *= 0.9;
    var bases = []; for (var li=0; li<g.legPairs; li++){ var t01 = g.legPairs===1?0.5:li/(g.legPairs-1); bases.push(thCx - g.thR*0.7 + (g.abRx*0.5+g.thR)*(-0.2+t01*0.5)); }
    function legPath(bx,dir,len){ var kx=bx+dir*len*0.35*(0.5+g.femur), ky=cy+g.abRy*0.5+len*0.5, fx=kx+dir*len*(0.4+g.curl*0.3), fy=ky+len*0.7; return 'M '+q(bx)+' '+q(cy+g.abRy*0.35)+' L '+q(kx)+' '+q(ky)+' L '+q(fx)+' '+q(fy); }
    var farLegs='', nearLegs='';
    for (var bi=0; bi<bases.length; bi++){
      farLegs += '<path d="'+legPath(bases[bi]-3,-1,g.legLen*0.95)+'" fill="none" stroke="'+dk(ol,-0.25)+'" stroke-width="'+legW+'" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>';
      nearLegs += '<path d="'+legPath(bases[bi],(bi===0?-1:1),g.legLen)+'" fill="none" stroke="'+ol+'" stroke-width="'+(legW+0.4)+'" stroke-linecap="round" stroke-linejoin="round"/>';
    }

    // abdomen + clipped pattern
    var abdomen = '<path d="'+abD+'" fill="url(#gB'+uid+')" stroke="'+ol+'" stroke-width="3"/>';
    var pc = mix(primary, pal.dark, 0.4), pat = '';
    if (g.pf===1){ for (var s=0;s<g.patCount;s++) pat += '<circle cx="'+q(abCx-g.abRx*0.3+s*(g.abRx*0.5/g.patCount))+'" cy="'+q(cy-6+((s%2)*12))+'" r="'+q(5-s*0.4)+'" fill="'+pc+'" opacity="0.5"/>'; }
    else if (g.pf===2){ for (var s2=0;s2<g.patCount;s2++) pat += '<path d="M '+q(abCx-g.abRx*0.4+s2*10)+' '+q(cy-g.abRy*0.7)+' Q '+q(abCx-g.abRx*0.4+s2*10-2)+' '+q(cy)+' '+q(abCx-g.abRx*0.4+s2*10+2)+' '+q(cy+g.abRy*0.7)+'" fill="none" stroke="'+pc+'" stroke-width="2.4" opacity="0.5"/>'; }
    else if (g.pf===3){ for (var s3=0;s3<Math.min(3,g.patCount);s3++) pat += '<path d="M '+q(abCx-g.abRx*0.7)+' '+q(cy-8+s3*13)+' Q '+q(abCx)+' '+q(cy-4+s3*13)+' '+q(abCx+g.abRx*0.6)+' '+q(cy-8+s3*13)+'" fill="none" stroke="'+pc+'" stroke-width="2.6" opacity="0.45"/>'; }
    else if (g.pf===0){ pat = '<circle cx="'+q(abCx)+'" cy="'+q(cy)+'" r="'+q(g.abRy*0.45)+'" fill="'+pc+'" opacity="0.4"/>'; }
    pat = '<g clip-path="url(#ca'+uid+')">'+pat+'</g>';

    // thorax (superellipse)
    var thorax = '<path d="'+bodyPath(thCx, cy-1, g.thR, g.thR*0.95, g.nTh, 1, 40)+'" fill="url(#gT'+uid+')" stroke="'+ol+'" stroke-width="3"/>';
    // un-tinted dorsal highlight
    var hl = '<circle cx="'+q(thCx-g.thR*0.35)+'" cy="'+q(cy-g.thR*0.4)+'" r="'+q(g.thR*0.16)+'" fill="#ffffff" opacity="0.35"/>';

    // antennae (pair) by t.antenna%5
    var af = g.af, aoy = hCy - g.hR*0.8;
    function antenna(ox, k, op){ var d2, tip='', L=g.antLen*k;
      if (af===0){ d2='M '+q(ox)+' '+q(aoy)+' Q '+q(ox+L*0.6)+' '+q(aoy-L*0.6)+' '+q(ox+L)+' '+q(aoy-L); }
      else if (af===1){ d2='M '+q(ox)+' '+q(aoy)+' Q '+q(ox+L*0.7)+' '+q(aoy-L*0.4)+' '+q(ox+L*0.6)+' '+q(aoy-L)+' Q '+q(ox+L*0.5)+' '+q(aoy-L*1.2)+' '+q(ox+L*0.8)+' '+q(aoy-L*1.25); }
      else if (af===2){ d2='M '+q(ox)+' '+q(aoy)+' Q '+q(ox+L*0.5)+' '+q(aoy-L*0.6)+' '+q(ox+L*0.85)+' '+q(aoy-L); tip='<circle cx="'+q(ox+L*0.85)+'" cy="'+q(aoy-L)+'" r="'+q(g.club*0.7)+'" fill="'+ol+'" opacity="'+op+'"/>'; }
      else if (af===3){ d2='M '+q(ox)+' '+q(aoy)+' Q '+q(ox+L*0.45)+' '+q(aoy-L*0.6)+' '+q(ox+L*0.7)+' '+q(aoy-L); for (var b=1;b<=4;b++) tip += '<path d="M '+q(ox+L*0.15+b*L*0.13)+' '+q(aoy-b*L*0.22)+' l '+q(L*0.16)+' '+q(-L*0.1)+'" stroke="'+ol+'" stroke-width="1.2" stroke-linecap="round" opacity="'+op+'"/>'; }
      else { d2='M '+q(ox)+' '+q(aoy)+' Q '+q(ox+L*0.7)+' '+q(aoy-L*0.7)+' '+q(ox+L*1.2)+' '+q(aoy-L*0.85); }
      return '<path d="'+d2+'" fill="none" stroke="'+ol+'" stroke-width="2.2" stroke-linecap="round" opacity="'+op+'"/>'+tip; }
    var antPair = antenna(hCx + g.hR*0.05, 0.85, 0.6) + antenna(hCx + g.hR*0.28, 1.0, 1.0);

    // head (superellipse, forward-stretched for snouted families) + eye + mandible
    var headA = g.hR * (1 + (g.hfam < 2 ? g.snout/g.hR : 0));
    var head = '<path d="'+bodyPath(hCx, hCy, headA, g.hR, g.nH, 1, 36)+'" fill="url(#gH'+uid+')" stroke="'+ol+'" stroke-width="3"/>';
    var eye = '<ellipse cx="'+q(hCx+g.hR*0.35)+'" cy="'+q(hCy-g.hR*0.25)+'" rx="'+q(g.eR*0.85)+'" ry="'+q(g.eR)+'" fill="'+dk(pal.dark,0.05)+'" stroke="'+ol+'" stroke-width="1.4"/>'
      + '<circle cx="'+q(hCx+g.hR*0.2)+'" cy="'+q(hCy-g.hR*0.45)+'" r="'+q(g.eR*0.32)+'" fill="#fdfdfa"/>';
    var mand = g.mand ? '<path d="M '+q(hCx+headA*0.85)+' '+q(hCy+g.hR*0.4)+' q 7 3 5 9" fill="none" stroke="'+ol+'" stroke-width="2.4" stroke-linecap="round"/>' : '';

    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="'+size+'" height="'+size+'">'
      + defs + wing + farLegs + abdomen + pat + nearLegs + thorax + hl + antPair + head + eye + mand + '</svg>';
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
    var winged = (t.wing % 5) !== 4;
    var hp  = 40 + (t.bodyLen % 40) + Math.floor((t.bodyW % 30) / 2);
    var atk = 30 + (t.head * 7) % 50 + ((t.head % 2) ? 8 : 0);
    var def = 30 + (t.body * 5) % 45 + ((t.pattern % 5 === 0) ? 6 : 0) + (winged ? 0 : 12);
    var spd = 28 + (winged ? 22 : 0) + (t.leg % 14) * 2;
    var acc = 45 + (t.antenna * 3) % 40;
    var eva = 8 + (winged ? 12 : 0) + (t.leg % 10) * 2;
    var stats = { hp: hp, atk: atk, def: def, spd: spd, acc: acc, eva: eva };
    var power = Math.round(hp * 0.6 + atk * 1.2 + def * 1.0 + spd * 0.9 + acc * 0.5 + eva * 0.7);
    var cls = CLASSES[t.behavior % CLASSES.length];
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
  function bugFromCodeblock(codeblock, size) {
    var id = bugIdentity(codeblock);
    return {
      traits: hashToBugTraits(codeblock),
      name: id.name,          // kept for back-compat
      identity: id,           // { name, species, designation, lore }
      stats: bugStats(codeblock),  // { type, cls, kit, stats, power, rarity, tags }
      svg: _generateBugSVG(codeblock, size || 160)
    };
  }

  // ── Exports (browser + Node). ───────────────────────────────────────
  var _api = {
    sha256Hex: sha256Hex, hb: hb, hc: hc, hexToRGB: hexToRGB,
    hashToBugTraits: hashToBugTraits, _generateBugSVG: _generateBugSVG,
    bugName: bugName, bugSpecies: bugSpecies, bugDesignation: bugDesignation,
    bugLore: bugLore, bugIdentity: bugIdentity, seededRng: seededRng, PALETTES: PALETTES,
    TYPES: TYPES, TYPE_CHART: TYPE_CHART, typeMatchup: typeMatchup,
    typeMatchupDual: typeMatchupDual, CLASSES: CLASSES, bugStats: bugStats,
    WING_BANK: WING_BANK, BODY_BANK: BODY_BANK, HEAD_BANK: HEAD_BANK,
    LEG_BANK: LEG_BANK, ANTENNA_BANK: ANTENNA_BANK, PATTERN_BANK: PATTERN_BANK,
    serializeTrace: serializeTrace, mintCodeblock: mintCodeblock,
    bugFromCodeblock: bugFromCodeblock, breed: breed
  };
  if (typeof module !== "undefined" && module.exports) { module.exports = _api; }
  if (typeof window !== "undefined") {
    window.BUG_ENGINE = _api;
    Object.keys(_api).forEach(function (k) { window[k] = _api[k]; });
  }
})();
