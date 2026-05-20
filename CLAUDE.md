
# LUCID WINDS — CLAUDE.md
# Claude Code reads this file automatically on startup. THIS IS THE SOURCE OF TRUTH.
# Last updated: May 01, 2026 — Variant G rarity (live, doc-aligned), STEM bank 24→28 + FLOWER bank 71→73 (doubled top-tier anchors so no single-point-of-failure)

---

## IDENTITY
You are the Lead Developer for Lucid Winds (formerly Petal Walk, originally Focus Grove during early development).
The Director is Stephen. You report directly to him. He makes all design and economy decisions.
The game is Lucid Winds with the domain lucidwinds.com.
All references to "stevieweedseed" or "Stevie" are from the old parent company — NEVER use them.
All references to "Petal Walk" or "Focus Grove" in visible UI are DEAD — the game is LUCID WINDS.
There is no mascot. There is no age gate. General-audience botanical game.

## WHAT LUCID WINDS IS
A single-file vanilla JS/HTML5 game (ES5-compatible, no frameworks) where players earn unique procedural plants by playing pattern-matching games. Plants are one-of-one SVG artworks generated deterministically from SHA-256 hashes. Every plant has a unique procedural haiku. Uses Firebase Auth + Firestore for cloud sync and Pi Network for cryptocurrency payments. Launching on Pi Network ecosystem targeting ~47M registered users.

## THE FOUR TABS
- **GAME** — Pattern matching (SET rules) → earns attention hashes → mints procedural plants
- **GREENHOUSE** — Plant collection, composting, substrate badges, Terra Grade scoring, flippable cards
- **NURSERY** — Growing seeds, breeding, seasonal mortality, cryo chamber
- **WILD** — Real-world Leaflet map, GPS planting, feral seed collection, pheno hunting, Field Pouch

---

## NON-NEGOTIABLE TECHNICAL RULES
1. Single-file vanilla JS/HTML5, ES5-compatible, NO frameworks EVER
2. All functions inside IIFEs except window-exposed ones
3. Any function called from inline onclick MUST be on window
4. `window._generatePlantSVG` is the plant renderer (note the underscore)
5. `window.hashToTraits` resolves traits from SHA-256 hashes
6. `window.getTerraGrade` returns rarity grade from traits
7. `_e()` is the ONLY hash-earning function for mini-games
8. 30 hashes = 1 plant (economic anchor — NEVER change)
9. str_replace preferred over sed for multi-line JS substitutions
10. Never implement multiple major changes simultaneously — single-variable testing
11. 48px minimum touch targets
12. Firebase project: focus-grove-fffa8 (Auth + Firestore at vaults/{uid})
13. Midnight greenhouse aesthetic: deep blacks, sage greens, gold accents, cream text
14. ES5 ONLY — no const, no let, no arrow functions
15. Always run `node --check index.html` (or extract script blocks) before committing
16. GA4 Measurement ID: G-XE58S4X6RX

---

## WORKFLOW (LOCKED)
- **Claude Code** (this CLI) owns the codebase. All edits to index.html happen here.
- **Claude Chat** (browser) writes specs and saves them to Google Drive. Claude Code reads specs and implements.
- Claude Chat does NOT edit index.html anymore.
- Hostinger auto-deploys from this repo's main branch.

---

## ASSETS (/assets/)
15 FLUX-generated images deployed to /assets/ on Hostinger and committed to repo:
```
bg-game-540x960-1.jpg          — Game tab background
bg-greenhouse-540x960-1.jpg    — Greenhouse tab background
bg-menu-540x960-1.jpg          — Menu/settings background
bg-nursery-540x960-1.jpg       — Nursery tab background
bg-wild-540x960.jpg            — Wild tab background
splash-seed-540x960.jpg        — Splash/loading screen
cinema-beat1-weight-540x960-1.jpg  — Onboarding beat 1
cinema-beat2-glint-540x960-1.jpg   — Onboarding beat 2
cinema-beat3-tendril-540x960-1.jpg — Onboarding beat 3
hash-mint-moment-540x540.jpg   — Hash minting moment
card-back-540x540-1.jpg        — Plant card back
empty-pot-540x540.jpg          — Empty greenhouse slot
menu-frame-540x540.jpg         — Menu frame/border
backpack-64x64-2.png           — Backpack icon (64px)
corner-ornament-128x128-1.png  — Corner ornament (128px)
```

---

## ANALYTICS (GA4)
- Measurement ID: G-XE58S4X6RX
- 35 events wired including:
  - game_complete, tab_switch, onboarding_complete
  - feral_collected, wild_plant_drop, session_start_lw
  - plant_minted, plant_composted, breed_executed
  - And others — see gtag() calls in index.html

---

## ECONOMY (LOCKED — Do NOT change without Director approval)

| Parameter | Value |
|-----------|-------|
| Hashes per plant | 30 |
| Greenhouse starting slots | 10 |
| Max greenhouse slots | 60 |
| Slot expansion cost | 1 Pi each |
| Field Pouch slots | 3 base / 5 upgraded (Pi per slot) |
| Emergency pouch slot | 10 Pi, ONE-TIME per day |
| Fertilizer from composting | Common=1, Uncommon=1, Rare=2, Epic=2, Legendary=3, Mythic=4, Cosmic=5 |
| Max fertilizer per seed | 25 at 1% each |
| Nursery skip cost | 21 Dew = skip 1 day (post-Dew-split rework) |
| Plants per Wild zone | 3 max with EA-weakest eviction via dice roll |
| Per-player wild radius cap | 3 plants within 700m (Wild v3 spread rule) |
| Chimera EA penalty | -2 per generation |
| Chimera immunity bonus | 2x climate |
| Marketplace fee | 1% to platform, 99% to seller |
| Wild drops per day | 3 (removes from greenhouse) |
| Feral seeds per 500m | max 2, daily reset |
| Feral collection range | 75m (~250 feet) |
| Cross-pollinate reward | 60% pollen / 30% dew / 10% hashes |
| Harvest reward by rarity | Common:3, Uncommon:5, Rare:8, Epic:12, Legendary:18, Mythic:25, Cosmic:40 hashes |
| Difficulty multipliers | Easy:1.0, Medium:1.5, Hard:2.0, Expert:2.5 |
| No companion rerolls | No Pi-to-pollen conversion |
| Ferals are SEALED | Cannot be trashed once collected |

---

## FIREBASE

- **Project:** focus-grove-fffa8
- **Auth:** Email/Password (createUserWithEmailAndPassword / signInWithEmailAndPassword)
- **Firestore collections:**
  - `vaults/{uid}` — private player data (greenhouse, nursery, wild plants, ferals, pollen, backpack, records)
  - `vaults/{uid}/meta/state` — slot caps + persisted state (NOT hashLedger anymore — May 06 H4 fix)
  - `vaults/{uid}/pendingRewards/{rewardId}` — server-issued rewards (consolation Dew, witness fees)
  - `vaults/{uid}/gameNonces/{nonce}` — proof-of-play nonces (planned, see migration plan)
  - `wildDrops/{ownerUid_hashPrefix}` — shared wild plants visible to all players
  - `mintLog/{uid}/mints/{plantHash}` — server-issued mint proofs (admin-write only) — chain-extraction anchor
  - `compostLog/{uid}/composts/{plantHash}` — burn-on-extract primitive (planned)
  - `meta/accountCounter` — Pioneer badge sequencing
  - `piTransactions/{paymentId}` — Pi payment lifecycle
  - `friends/{uid}/connections/{friendUid}` + `friends/{uid}/inbox/{giftId}` — social
  - `nftMints/{plantHash}` — Polygon NFT mint records (legacy nftSignMint path)
- **Rules:** `firestore-rules-7.txt` in repo. Stephen deploys via Firebase Console → Firestore → Rules. Recent updates (2026-05-06) tighten validMetaState (deny hashLedger), pendingRewards (require harvesterUid==auth.uid), accountCounter (allow next==1||2 bootstrap).
- **Legacy path REMOVED:** Old code tried reading `users/{emailDocId}` — no permission rule. Removed.

## CLOUD FUNCTIONS

- **Location:** `/workspaces/lucid-winds/functions/` (in this repo)
- **Deployed:** `firebase deploy --only functions` from that directory
- **Region:** us-central1
- **Required secrets:** `PI_SERVER_KEY` (set via `firebase functions:secrets:set PI_SERVER_KEY`); `NFT_SIGNER_KEY` + `NFT_CHAIN_ID` only if nftSignMint re-enabled
- **Live exports** (`functions/index.js`):
  - `piApprove` — v2 onCall, Pi payment approval handler. Auth check + Pi server lookup + Firestore record before approve. Excellent quality.
  - `piComplete` — v2 onCall, Pi payment completion + entitlement grant. Re-fetches Pi metadata server-side, atomic transaction, idempotent on `alreadyCompleted`. Cap enforcement on slots/pouches.
  - `mintPlant` — v2 onCall, server-authoritative plant mint. Server-generated hash from uid + serverNow + crypto random + counter. 60s min interval, 30/day cap. Writes mintLog/{uid}/{plantHash}.
  - `earnHashes` — v2 onCall, atomic hashLedger.earned increment. 200/call, 300/min, 5000/day caps.
- **Parked exports:**
  - `nftSignMint` — Polygon mint voucher signer (commented out in index.js). Re-enable + extend per `project_cloud_function_migration_plan.md` for chain extraction.
- **Planned migrations** (see `project_cloud_function_migration_plan.md`):
  - `startGame` + `earnHashes`-with-nonce (proof-of-play)
  - `breedPlant`, `compostPlant`, `dropToWild`, `harvestWildPlant`, `spendSunbeams`, `nftExtract`

---

## SCRIPT BLOCK MAP (~26 script blocks)

```
Block 1-3:    Error catcher, diagnostics
Block 4:      Firebase config + init
Block 5:      hashToTraits, SEASON_DATA, getSeasonInfo, computeEA, getTerraGrade,
              FG_Data, Nursery data
Block 6:      FG_Audio
Block 7:      MAIN IIFE (~11,000 lines) — games, greenhouse, renderGreenhouse, carousel,
              _populateSlot (flip card), renderDNALedger, nursery UI, binder, vault,
              Firestore sync, switchTab, openCarousel, openPlantActionDrawer,
              _throttledSave, _haptic, setGHGrid, compost, share, download
Block 8:      FG_Wild IIFE — Leaflet map, GPS, drops, ferals, territory,
              _crossPollinate, _doCrossPollination, pollen particles, vignette,
              backpack wiring
Block 9:      Dev panel + chimera toggle
Block 10-11:  Swipe nav helpers
Block 12:     Game engine — _e(), _play(), 27 game implementations, growth strip,
              win overlay
Block 13:     Social/UI module
Block 14:     XP/Level + PW_Social
Block 15:     PW_Onboard — cinematic (4 beats) + auth + skip + gift plant
Block 16:     FG_Challenge — 6 feral challenge types (SET, Memory, Spot, Color,
              Math, Word)
Block 17:     Backpack (BP) module — hold-to-release, seed-to-nursery
Block 18:     Service worker registration
Block 19+:    Breeding comparison module (openBreedScreen, forecast meters,
              confirm dialog)
```

## CRITICAL ARCHITECTURE RULES
- Functions inside one IIFE CANNOT call functions in another IIFE unless exposed on `window`
- A syntax error in ANY script block kills ALL functions in that block
- Inline SVG data URIs in CSS contain `{` `}` `(` `)` that confuse simple brace counters — use `require('vm').createScript()` in Node to verify actual JS syntax
- `overflow:visible` is required on `.greenhouse-plant` for corner knots and EA badge
- Always verify all script blocks parse clean after any edit

---

## WINDOW-EXPOSED FUNCTIONS (must stay exposed)

```
window.mintPlant                    window.renderGreenhouse
window.loadGreenhouse               window.earnHashes
window.getTotalHashes                window.updateDashboard
window.buildAttentionPayload         window.updateFocusPlant
window._e                           window._play
window._playWin                     window._dismissWin
window._restartCurrentGame           window._openGamePicker
window.switchTab                    window.openCarousel
window.closePlantGallery             window.downloadPlantCard
window.openPlantActionDrawer         window.closePlantActionDrawer
window.confirmCompost                window.shareDrawerPlant
window.viewPlantDetails              window.selectCPPlant
window.confirmCrossPollinateSelection
window.openBreedScreen               window.closeBreedScreen
window.bsSwipe                       window.bsConfirmBreed
window.bsExecuteBreed
window._doCrossPollination           window.FG_Wild
window.FG_Backpack                   window.PW_Onboard
window.FG_Data                       window.hashToTraits
window.getTerraGrade                 window.getSeasonInfo
window.computeEA                     window._generatePlantSVG
window.getHaiku                      window.getPlantName
window.setGHGrid                     window._padGHPlants
window._reRenderAll                  window._fgDeviceId
```

---

## CSS VARIABLES
```css
--bg: #0d100c;  --sage: #7ab356;  --gold: #c8a84b;
--cream: #e8dcc8;  --muted: #8a9178;
--nav-h: 58px;  --sb: env(safe-area-inset-bottom, 0px);
```

---

## SEASON SYSTEM
- Derived from `hb(22) % 4` in hashToTraits
- `0=Spring` (🌸 #E8A0BF), `1=Summer` (☀️ #D4A843), `2=Autumn` (🍂 #D4842A), `3=Winter` (❄️ #A0C4E8)
- SEASON_DATA array at line ~4818
- Peak season: +2 EA, -50% stress, 1.5x pollen
- Opposite season: +0 EA, +50% stress, 0.5x pollen
- Adjacent season: +1 EA, normal stress, 1x pollen

### Seasonal Card Borders (set-51)
- Each season has a unique Celtic knot in the corners:
  - Spring = Trefoil (trinity knot) — rose pink + warm gold
  - Summer = Shield knot — rich gold + sage
  - Autumn = Triskelion (triple spiral) — copper + burnt gold
  - Winter = Diamond lattice — ice blue + silver
- Double-line border: inner line (border) → dark gap (box-shadow) → outer line (box-shadow)
- Corner knots are SVG data URIs in ::before pseudo-elements
- Knots should be 30-32px on grid, 36px on detail view
- EA knot badge: top-right corner, frosted glass pill (backdrop-filter:blur), season-tinted border
- EA 15+ gets a glow on the frost pill

---

## TERRA GRADE SYSTEM (7 tiers — Variant G, 2026-05-01)

Computed from trait rarity score. The grade is the PLANT'S OVERALL rarity. Each layer has its own tier score that adds to the total.

### Variant G scoring (live in index.html:10449, 10419)
```
_TIER_SCORE = { common:0, uncommon:0, rare:1, epic:3, legendary:5, mythic:7, cosmic:10 }
_TERRA_GRADES thresholds = [ 0, 5, 10, 15, 21, 27, 34 ]
```

### Verified first-mint distribution (sim N=100k, post-bank-expansion 2026-05-01)
```
Common     26.6%
Uncommon   36.5%
Rare       24.4%
Epic       10.4%
Legendary   1.85%
Mythic      0.23%
Cosmic      0.01%
```

### History
- Variant D (mid-Apr): too tight, Common only 8%
- Variant F (late-Apr): Common 36%, Epic 4.8%, Legendary 0.7%, Mythic 0.07% — felt thin on the high end (very few Epic+ drops, almost zero Mythic)
- **Variant G (Apr 30 + May 01 fragility fix)**: Stephen ruling: keep G. "It's okay to be a little generous." Player retention research said the Variant F Epic+ rate was too punishing for an audience that already walks every day. Variant G doubles the Epic+ rate without making Common feel cheap. **2026-05-01 fragility fix:** STEM bank expanded 24→28 (added Petrified Heart Epic, Thunderscarred Legendary, Mirrorwood Mythic, Worldspine Cosmic). FLOWER bank expanded 71→73 (added Reverie Mythic, Worldbloom Cosmic). Eliminates single-point-of-failure at top tiers (every top tier now has 2 anchors). Slight upward distribution shift (~7% Epic → 10.4%) is intentional — more lore-fit high-tier entries means more chances to hit them.

### Bugs in scoring still parked (not blocking)
- Mythic-byte spike still REPLACES companion-tier score (`if (compT && t.mythic < 0xD0)` at line 10478). A Beholder gets +8 spike OR +10 cosmic-tier, never both. Cosmetic; Beholder still grades Cosmic via spike alone.
- VESSEL/FOLIAGE/AURA banks still contribute ~25-28% epic-or-better at the layer level (vs ~13-15% on STEM/SUBSTRATE/COMPANION/MUTATION). Under Variant G the wider thresholds absorb this; players don't perceive per-layer imbalance, only the aggregate. Audit memo: `project_rarity_engine_audit_may01.md`.

---

## TERMINOLOGY GLOSSARY (read carefully — these words collide)

| Word | Meaning |
|---|---|
| **Grade** | A plant's OVERALL rarity label (Common / Uncommon / … / Cosmic). Computed by `getTerraGrade`. One grade per plant. |
| **Tier** | A LAYER'S own rarity level (common-tier / uncommon-tier / … / cosmic-tier). Each layer has its own. Computed by `_layerTier`. |
| **Score** | The total integer `getTerraGrade` computes from summing layer tier scores + spike + breed layers. Drives grade. |
| **Layer** | A trait category: VESSEL, SUBSTRATE, FOLIAGE, FLOWER, AURA, COMPANION, MUTATION, GROWTH PATH. 8 layers. `MYTHIC` is NOT a layer — removed long ago. |
| **Mythic byte** | Hash byte 18 (`hb(18)`). Values ≥ 0xD0 override the COMPANION slot with creature indices 32-38 and add a "spike" to score. |
| **Spike** | The +4 to +8 score bonus for high `mythic byte` values. Wires mythic creatures into score without needing a MYTHIC layer. |
| **Mythic creature** | The Toad (0xD0+) or The Cicada (0xE0+). Render via COMPANION layer at mythic-tier. |
| **Mythic-tier** | Any LAYER at mythic rarity (e.g., a mythic-tier substrate like Phoenix Ash, a mythic-tier companion). Not the same as Mythic grade. |
| **Mythic grade** | A PLANT graded Mythic (score 20+). A plant can have mythic-tier layers without being Mythic grade if score is insufficient. |
| **Mutation byte** | Hash byte 16 (`hb(16)`). Values ≥ 0xE1 produce visible mutations (Fossil, Albino, Wireframe, … Constellation). Effective fire rate ≈ 12.1% of mints. Rendered via MUTATION layer. |
| **Sunbeams** | Hash-earning currency. 30 Sunbeams = 1 ready-to-mint plant. Player clicks ☀️ to convert queue into plant. |
| **Dew** | Secondary currency earned from wild tending. Spent on: slot machine, mystery box, nursery skip, weather summon. |

When you see "mythic" in code, figure out which of the above it means. Byte? Creature? Layer tier? Grade? They are NOT interchangeable.

---

## EVOLUTIONARY ADVANTAGE (EA)
- Composite score from ALL trait layers
- Each layer's power value must be logically consistent with the trait's physical nature:
  - Glass Stem: rare but -1 EA (fragile)
  - Braided Stem: less rare but +2 EA (strong)
  - Meteorite Substrate: rare and +2 EA (dense)
- Season bonus: 0-2 based on current real-world month
- Age bonus: Day 0-6: +0, Day 7-29: +1, Day 30-89: +2, Day 90+: +3

---

## TRAIT SYSTEM (hashToTraits)
Derived deterministically from 64-char hex hash:
```
pot:         hb(0) % 60          — 60 pot types (TRAIT_BANK.pots)
potColor:    _PAL[hc(1)]
stem:        hb(2) % 28           — 28 stem patterns (was 24; expanded May 01 with 4 top-tier anchors)
stemHeight:  22 + hc(3) * 2.5
leafType:    hb(4) % 71           — 71 leaf types (TRAIT_BANK.leaves)
leafCount:   5 + (hc(5) % 6)
leafSize:    8 + (hc(6) % 7)
leafColors:  [_PAL[hc(7)], _PAL[hc(8)], _PAL[hc(9)]]
hasFlower:   hc(10) > 4
flower:      hb(11) % 73          — 73 flower types (was 71; +Reverie Mythic 71, +Worldbloom Cosmic 72)
flowerColor: _PAL[hc(12)]
flowerSize:  6 + (hc(13) % 7)
chimerGen:   1 (default; breeding sets to parent max + 1)
leafSpread:  7 + (hc(14) % 6)
aura:        hb(15) % 36          — 36 aura slots (0-4 = none)
base:        hb(20) % 71          — 71 substrate types
companion:   hb(21) % 82 or mythic override from hb(18)
mutation:    hb(16)               — mythic byte, see hashToTraits
mythic:      hb(18)               — see override table below
season:      hb(22) % 4
```

### Companion/Mythic Override Table
Source of truth: `hashToTraits` in index.html (search for `mythByte ===`).
Last verified against code: 2026-04-18.
```
hb(18) === 0xFF              → The Beholder       (idx 38)   COSMIC-tier      0.39%
hb(18) >= 0xFE               → Garden Spider     (idx 37)   LEGENDARY-tier   0.39%
hb(18) >= 0xFC               → Great Blue Heron  (idx 36)   LEGENDARY-tier   0.78%
hb(18) >= 0xF8               → Raccoon           (idx 35)   LEGENDARY-tier   1.56%
hb(18) >= 0xF4               → Baby Mammoth      (idx 34)   LEGENDARY-tier   1.56%
hb(18) === 0xEE || 0xEF      → The Cicada        (idx 33)   MYTHIC-tier      0.78%  (tightened 2026-05-13 from 7.81%)
hb(18) === 0xDE || 0xDF      → The Toad          (idx 32)   MYTHIC-tier      0.78%  (tightened 2026-05-13 from 6.25%)
else                         → hb(21) % 82                  93.8% base creature rate
```

Dead names / retired creatures (never reference these in new UI):
- Starfall, Storm Wraith, Ancient Rune Field, Bioluminescent Pulse → these became AURAS, not companions
- The Capybara → never existed
- Phoenix → retired 2026-04-14, Cicada took its slot
- (Mammoth idx 34 is Baby Mammoth — Stephen ruling 2026-04-30; older notes that said "Woolly Mammoth" are incorrect)

---

## CARD SYSTEM (set-51)

### Greenhouse Grid Cards
- Tap → opens full-screen carousel (openCarousel)
- Front only in grid: plant SVG, name, season emblem, EA knot badge, corner knots
- Seasonal double-line Celtic border with corner knots
- Classes: `.greenhouse-plant.season-spring`, `.season-summer`, `.season-autumn`, `.season-winter`

### Carousel Detail View (Inspect)
- Full-screen overlay with 3-slot track, swipe left/right between plants
- Each card is a FLIP CARD (tap to flip):
  - **Front:** Terra Grade label, plant name, haiku, plant SVG (140px), season emblem, EA knot
  - **Back:** Small thumbnail + name + stats header, full DNA Ledger, hash, mint date
- Flip: CSS perspective + rotateY(180deg) + backface-visibility:hidden
- `.cs-flip-wrap.flipped .cs-flip-inner { transform: rotateY(180deg); }`
- onclick: `this.classList.toggle('flipped')`

### Action Drawer
- Opens from carousel via ACTIONS button or greenhouse long-press
- Buttons: DOWNLOAD, INSPECT, SHARE, COMPOST, BREED
- BREED opens breeding comparison screen

---

## BREEDING COMPARISON SCREEN (set-51)

### Architecture
- Full-screen overlay: `#breed-screen`
- Two card backs side by side: your plant (locked) + partner (swipeable)
- Arrow nav to cycle through greenhouse partners
- Each card shows all DNA layers with inheritable traits glowing
- DOM/MIX/RISK tags on inheritable rows
- Offspring Forecast: EA Range, Rare+ chance, Mutation pass, Chimera gen, Season odds
- Confirmation dialog before executing breed
- Sends seed to nursery via FG_Data.addSeed

### Breeding Mechanics
- Offspring hash: parentA.hash + parentB.hash + Date.now() → deterministic 64-char hex
- Chimera generation: max(parentA.gen, parentB.gen) + 1
- Each generation: -2 EA penalty, 2x climate immunity
- Chimera veins visible on offspring leaves
- Nursery limit: 3 seeds max

### Key Functions
```
window.openBreedScreen(plant, context)  — opens overlay
window.closeBreedScreen()               — closes it
window.bsSwipe(direction)              — cycles partner
window.bsConfirmBreed()                — shows confirm dialog
window.bsExecuteBreed()               — executes breed
window._doCrossPollination(wild, mate) — Wild tab breed execution
```

---

## WILD TAB ARCHITECTURE

### Map Stack
- Leaflet.js + CartoDB Dark Matter tiles
- CSS filter: brightness(1.5) on tiles for botanical feel
- GPS geolocation with fallback to demo coordinates
- Vignette overlay + glass highlight overlay (toggled by switchTab)
- Pollen particles floating (started/stopped by switchTab)

### Field Pouch / Backpack
- 3 base slots, harvest wild plants into pouch, auto-delivers to greenhouse
- Hold-to-release: long press on backpack plant to drop into wild
- Seed-to-nursery: feral seeds go to nursery via CustomEvent
- Module: FG_Backpack / BP (Block 17)
- Midnight reset: auto-delivers backpack plants/seeds on tab switch (BUILT)

### Wild Plant Rules
- 3 drops per day from greenhouse (removes permanently)
- Drop is permanent — no recall
- No self-harvest
- Water only if GPS-proximate
- 1 plant per zone (H3 hex, ~105m2)

### Feral Seeds
- Max 2 per 500m radius, daily reset, 75m collection range
- 6 challenge types: Quick SET, Pattern Memory, Spot the Difference, Color Match, Math Sprout, Word Unscramble
- 2 minute cooldown on failure
- Difficulty scales with seed rarity

### Territory System
- EA-based auto-takeover: challenger EA > defender EA wins
- Displaced planter gets harvest reward (hashes by rarity)
- Defender's Game: player picks mini-game to protect their plant
- Challengers must beat that game to harvest

### Step Counting
- Haversine distance between GPS updates (code exists, needs testing)

---

## NURSERY MECHANICS
- Water once per day for 3 days → bloom
- FG_Data.addSeed({ seedHash, parentAHash, parentBHash, nonce })
- Water via waterLog array — each entry is a date string
- When waterLog.length >= 3 and 3 unique days, bloom button appears
- Bloom mints plant into greenhouse
- Max 3 seeds at once
- Fertilizer: max 25 per seed at 1% boost each (composting only)
- Nursery acceleration skip: 21 Dew = skip 1 day

---

## HAIKU ENGINE
- 7-5-7 syllable structure (strict, verified)
- 1,038-word bank (v4.1)
- Every plant gets a unique procedural haiku from its hash
- `window.getHaiku(hash)` returns `{ line1, line2, line3 }`

---

## ONBOARDING (PW_Onboard — Block 15)
- 4-beat cinematic with FLUX background images (img tags, not inline SVGs)
- Beat images: cinema-beat1, cinema-beat2, cinema-beat3 from /assets/
- Line-by-line text, swipe navigation, crossfade transitions, rain audio
- Beat 4: blurred gift plant + auth form (email/password)
- Skip button at 6 seconds → jumps to beat 4, does NOT bypass signup
- Gift plant: guaranteed Uncommon+ (min score 3)
- After signup: gift plant minted, cloud sync, enters greenhouse

---

## PLANT RENDERING (_generatePlantSVG — Block 7)
- Renders complete plant SVG from hash traits
- Layers: pot → stem → leaves (phyllotaxis spiral) → bloom → aura → companion
- Leaf-to-stem connection: bark swell → petiole bezier → leaf body → tip
- Crispness stack: every leaf gets midrib vein, specular highlight, secondary veins
- Bloom emphasis: leaves dim to 72-82% opacity when flower present
- Chimera veins: Gen 1=0.35px, Gen 2=0.55px, capped, glow at gen 5+
- Stipe bridge for clamped exotic blooms
- Mandala halo: 6-second breathe cycle
- 71 substrates, 71 leaf types, 71 bloom cases (verify via TRAIT_BANK array lengths)

---

## COMPOST SYSTEM
- Permanently removes plant from greenhouse
- Returns fertilizer by rarity: Common=1 through Cosmic=5
- Confirmation dialog required

---

## DOWNLOAD / SHARE
- Canvas renderer: 640x960 card
- SVG → Image → Canvas via Blob URL
- navigator.share with fallback to download

---

## DEV PANEL
- **Unlock workflow changed 2026-05-06 (Audit 5 C1):** `window.PW_Dev` is no longer auto-attached. To enable on a fresh browser run in DevTools console:
  ```
  localStorage.setItem('lw_dev_unlocked','1'); location.reload();
  ```
  After that, the BETA badge 5-tap opens the dev panel. The literal `lucid2026` password is gone from source. See `reference_dev_mode_unlock.md` in memory.
- `accelClimate` — fires synthetic extreme weather (50°C/100mm/80kmh) on every local wild plant. Bypassed if `lw_weather_off=1`.
- `accelKillOldest` — kills + prunes oldest local wild plant

---

## ITEMS SYSTEM (SHIPPED v1 — 18 items, all wired)

Module: `window.LW_ITEMS` (index.html:83168). Catalog: `window.LW_ITEMS_CATALOG`.

### Catalog structure
Each item has: `key, name, category, rarity, art, icon, desc, lore, usage, wired`. Hidden from UI if `wired:false`.

### Active items by category
- **Foraging:** foragersLens (C), compassShard (U), tetherMoss (R), divinersGlass (E)
- **Defense:** moonwake (U), mulchWard (R), brambleThicket (R), shellgourd (E)
- **Offense:** uprootCharm (U), foragersTorch (R), dustStorm (R), pollenStorm (E)
- **Remote:** whisperVine (C), scryingStone (U), slowArrow (R), ravenEye (R), wanderersMap (E), lanternPath (E)
- delegateToken removed 2026-05-01 (replaced by lanternPath). pollenStorm added same date.

### Drop sources
- Mystery boxes (LW_BOXES) — weighted roll
- Daily login milestones — specific item per day
- Whisper Vine daily ping — +1 Compass Shard
- Perfect-month login — Wanderer's Map
- Cocoon rewards
- Seasonal hunt completion

### Art
Each item references `assets/items/<name>.png`. ART SHIPPED 2026-04-24 — 19 PNGs in `/assets/items/` (17 catalog + lantern-path + pollen-storm extras). Emoji fallback via `onerror` handler still wired as safety net.

---

## MYSTERY BOXES vs SLOT MACHINE vs MYSTERY BOX HOME BUTTON

Three DIFFERENT systems. Don't confuse:

| System | Entry | Cost | Pays out |
|---|---|---|---|
| **`_openMystery`** (home button "MYSTERY BOX") | kb-mystery button (line 6060) | 25 Dew/pull | Fertilizer / Sunbeams / Dew / DNA — **NEVER items** |
| **`_openSlots`** (home button "SLOTS") | kb-slots button | 15 Dew/pull | Dew + Fertilizer — **NEVER items** |
| **`LW_BOXES`** (backpack → BOXES) | earned | free (spends 1 box) | LW_ITEMS with pity timer (8→Rare, 25→Epic) |

LW_BOXES is the items path. The first two are pure Dew sinks.

### LW_BOXES weights
`Common 48% / Uncommon 30% / Rare 15% / Epic 6% / Legendary 1%`. Pity: 8th box → Rare+ guaranteed, 25th → Epic+ guaranteed, 60th → Legendary guaranteed. Unwired items (`wired:false`) excluded from pool. As of May 02 audit, LW_BOXES.openOne calls LW_ITEMS.add({silent:true}) so the pouch cap (25/40) is respected — direct localStorage write that previously bypassed cap is removed.

---

## CLIMATE DAMAGE SYSTEM (SHIPPED v2)

`_wildClimateTick(weather)` at index.html:37805. Runs once per day from `_doReproduction`. Kills plants over time when real weather breaches per-plant hash tolerances.

### 5 vectors wired
- Heat — `weather.temp > t.heatMax` (28-40°C range)
- Cold — `weather.temp < t.coldMin` (-5 to +12°C)
- Flood — `weather.rain > t.floodMm` (20-64mm/day)
- Wind — `windMph > t.windMax` (18-45mph, converted from km/h)
- Drought — `dryDays > t.droughtDays` (3-10 consecutive dry days)

### Per-plant tolerances
Derived from hash bytes 23-27 in `hashToTraits`. Each plant has a unique climate profile.

### Damage math
- 6h decay shave per breach magnitude, capped 24h per vector
- Season modifier: peak ×0.5, opposite ×1.5
- Chimera gen 2+ takes half damage (immunity shipped 2026-04-18)
- Daily cap: 36h total
- Kill switch: `localStorage.lw_weather_off='1'` disables Mastermind tilt AND climate damage

### Real weather feed
Open-Meteo (no API key), 1h cache. Silent fallback: temp=20, rain=0, wind=0 on fetch failure.

### Stress visibility
`#wtp-climate` in trait panel (line 39179). Shows icon + label + damage hours. 26h visibility window. Colors: ≥18h red, ≥8h gold, else muted.

### Companion protection (SHIPPED 2026-05-01, audit #14)
Single-vector ×0.5 climate damage halve, applied per-plant by companion idx:
- **Heat**: Scorpion (48), Cicada (33)
- **Cold**: Baby Mammoth (34)
- **Flood**: Koi (71), Toad (32), Great Blue Heron (36)
- **Wind**: Pangolin (43)
- **Drought**: Worm (52)

A plant has one companion, so halving applies once per plant per relevant vector. Stacks multiplicatively with chimera gen 2+ (×0.5) and Tardigrade Cryptobiosis (×0.5 across all vectors when LW_KEEPER equipped). Hardy keyword still rolls a 50% weekly dodge on top.

---

## PRESTIGE SYSTEM (SHIPPED Apr 16 — P4 + P6 wired)

L100 prestige loop. Player ascends at L100, resets progress, keeps prestige levels. `project_prestige_system.md` for full spec.

- **P4** — +1 greenhouse slot per prestige level (WIRED)
- **P6** — +1 wild drop per day per prestige level (WIRED)
- **P1/2/3/5/7/8/9/10** — narrative strings only, no game logic (see `project_prestige_placeholders_parked.md`)

Unlock tiers + boosters documented in the prestige_system memory note.

---

## KEEPER'S TREE (SHIPPED Apr 15)

100-point passive skill tree. 5 branches × 4 nodes × 5 pts/node = 100. **No respec** — `_LW_treeCanRespec` returns false permanently ("no respec, no regret" — design call). Older docs claimed "free once per 24h"; the code never shipped that.

### Branches
- **Forager** (🍂) — feralRange, rareOdds, feralCd, harvestHash
- **Breeder** (🧬) — breedReward, chimeraPurity, pollenFlow, compostReturn
- **Cartographer** (🧭) — stepBonus, biomeXp, toolXp, toolCd
- **Tender** (💧) — plantLongevity, dewRate, waterStreak, massWater
- **Keeper** (🌿) — classXp, defenseEa, pollenRate, nurseryGrow
- **Tools** (🔧) unlocks at class max
- **Heartwood** (🌳) unlocks at L40
- **The Bower** (🌿) unlocks at L60
- **The Long Watch** (🌙) unlocks at L80

### Milestones (gated on PLAYER LEVEL, not tree-pts)

The "10/25/50/75/100" thresholds below refer to **player keeper level**, not tree points spent. Easy to misread because the tree pool is also 100 — but every milestone gate in code reads `canSee.currentLevel()`. Stephen audit 2026-05-01 #8 confirmed this is the design (consistent with Second Bloom at `lvl<25`, Near Horizon at `lvl>=75`).

- L10: Path Opened (+5 bonus tree points)
- L25: Second Bloom (guaranteed 1 feral/day)
- L50: The Gilding (1hr/day all bonuses ×2)
- L75: Near Horizon (equip 2nd companion)
- L100: The Long Watch (biome match applies everywhere)

### Reading tree bonus
`window._LW_treeBonus(kind)` returns multiplier. Folded into `_LW_classBonus` for transparent consumption.

---

## SUNBEAM QUEUE (SHIPPED Apr 16)

Auto-mint removed. Player manually converts ready Sunbeams into plants via ☀️ modal.

- Ready-hash queue stored in localStorage + Firestore
- 30 Sunbeams = 1 ready hash
- Player clicks ☀️ to mint
- Onboarding tutorial steps 16-17 gate on this

---

## CLASS SYSTEM (SHIPPED Apr 13 v1)

5 classes, 3 levels each. Pick at L7.

### Classes
- **Forager** (🍂) — +25% feral range L1, +15% rare odds L2, Master: all tools +50% effect in biome match
- **Breeder** (🧬) — +1 nursery slot L1, +20% chimera purity L2, Master: 2× pollen on breed action
- **Cartographer** (🧭) — +25% step XP L1, biome reveal L2, Master: compass bearing points to pinned treasure
- **Tender** (💧) — 2× plant longevity L1, +20% Dew rate L2, Master: 2.5× longevity (was Phoenix Bloom, retired)
- **Keeper/Steward** (🌿) — Attuned: +5% per level stacks with all class bonuses. L2: Versatile (-10% tool cooldown). L3: Polymath (full XP)

### Reading class bonus
`window._LW_classBonus(kind)` returns multiplier. Consumers throughout code.

### Class-bound companions (L3 Master synergy)
Each class has a companion family. Holding any plant with matching companion unlocks T3 ritual.

---

## ANTI-FARMING (BUILT — set-39+)
- Guard system: min play time, progress caps, completion cooldown
- Daily harvest reward cap via Wild tab
- Diminishing returns (80% decay per harvest)
- Server-side economy protection in Firestore

## PI NETWORK INTEGRATION (NEEDS BUILDING)
- Pi SDK for all payments — never custody user funds
- Slot upgrades, emergency pouch, public greenhouse, marketplace
- RESEARCH NEEDED: Pi SDK payment flow, submission requirements

---

## REMAINING BUILD PRIORITIES (live list — see STATE.md in memory for most current)

### Active work
- ~~Items art~~ ✅ DONE 2026-04-24 — 19 PNGs live in `/assets/items/`
- ~~Balance pass on items~~ ✅ DONE — Mulch Ward (R, 1 charge, 24h) and Shellgourd (E, 1 charge, 48h) are different tiers with different fuse lengths. Audit #4 (commit 2bedec3) rebalanced Shellgourd from "no-op consume" to "Epic single-use ward with a long fuse" — defense ladder is intentional.
- **Pi SDK integration** — ALL payments through Pi
- **First-mint Common %** — currently 36% (Variant F), spec 42%. Closing the gap re-grades every plant. Defer until post-Pi-launch unless director calls otherwise.

### Parked design (see memory index)
- EA Takeover spec (15-min async vote)
- Hex Badge scanner (4-cat overlay)
- Hex Flag idea (sanctuary flag)
- Treasure compass / scratch game
- Companion game-help system
- Biome system (10 biomes)
- Wild foraging signature game
- Social features + friendship levels
- Music station (DAW lite)
- Public greenhouse (post-MVP)

---

## WHAT THE DIRECTOR EXPECTS
1. Honest assessments — NEVER sugarcoat
2. Complete deliverables with clear next actions
3. Production-ready code
4. Explain the "why" before the "how"
5. Design sprint approval before major coding
6. One change at a time
7. str_replace over sed
8. 48px minimum touch targets
9. Fresh chat sessions for major build phases

---

## COMMON PITFALLS (LEARN FROM THESE)
1. **IIFE scoping:** Block 7 functions invisible to Block 8/12 unless on window. This caused silent failures across the entire app.
2. **Syntax errors kill blocks:** Calendly dead code had stray `);` that killed all 11,000 lines of the main IIFE. switchTab, renderGreenhouse, everything undefined. ALWAYS verify syntax.
3. **SVG in CSS:** Inline SVG data URIs contain braces/parens. Use vm.createScript() not regex to verify JS.
4. **overflow:visible:** Required on .greenhouse-plant for knots/EA badge to show outside card.
5. **Onboarding skip:** Must jump to beat 4 (auth form), never bypass signup.
6. **Never rewrite switchTab:** Only add to it.
7. **Never remove window exposures:** Other IIFEs depend on them silently.
8. **Test on Pixel 9:** Real device testing is non-negotiable.
9. **Corner knots:** ::before pseudo-elements with SVG backgrounds. background-size controls their rendered size. If they disappear, check overflow and inset values.
10. **EA badge position:** right: -6px to -8px puts it at the actual corner. More negative clips it.
