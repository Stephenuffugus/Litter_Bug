# Litter Bug — Project Handoff (v0.1)

> A cozy collection game where players forage real and virtual trash, run it through generative mini-games, and incubate procedurally unique insects that live, breed, and spread in a shared world map.

This document is the kickoff brief for the Claude Code instance picking up this project. It assumes you already have access to the **prior NFT-creation game engine** (touch-input → SHA-256 → layered procedural art). Most of that engine is being **reskinned and repurposed** — you are not starting from scratch.

---

## 0. TL;DR

**What this is:** *Bugsnax × Pokémon GO × Little Alchemy*, with a cozy eco theme. Players collect trash (digitally, by walking, or by scanning real-world labels), combine it in an incubator, and hatch procedurally-generated insects from a quintillion-combination layered art system. Bugs are released into a real-world map overlay where they form territories and breed.

**Critical reuse from the existing engine:**
- Touch-input → SHA-256 hash → deterministic procedural output pipeline
- Layered art compositor (was used for NFT art; now produces insect anatomy)
- Territory / breeding / spread simulation (was used for plants; now used for bugs)
- Map overlay system (Leaflet-based)

**Critical *new* systems to build:**
- Trash inventory + incubator UI (cozy field-journal aesthetic — see attached prototype)
- Label scanner (camera-based real-world item ingestion, with abuse-resistance)
- Mini-games that generate the seed codes (twin-stick / touchscreen joystick)
- Bug catalogue / "Bugdex" with signature + procedural species

**Critical decision still open:** Whether to ship with on-chain tokens or leave that subsystem dormant. See §9.

---

## 1. Game Vision

**Tagline:** *Make little lives out of what people threw away.*

**Pillars:**
1. **Cozy & tactile.** No timers, no fail states. Slow, generous, satisfying.
2. **Endlessly discoverable.** The combinatorial space is effectively infinite — players who play 500 hours still find new species.
3. **Quietly social.** You play solo, but other players' bugs drift through your map. Optional gifting, no PvP.
4. **Built for short and long sessions.** A 90-second forage on the bus is a complete loop; a 2-hour session is also a complete loop.

**Audience:** Stardew Valley / Bugsnax / Cozy Grove / Pokémon Sleep players. The TikTok / streamer demographic that made *Spiritfarer* and *A Short Hike* go wide.

**Distinguishing hook:** Real-world inputs (walking, scanning) become permanent unique creatures in your collection — every bug a player makes is *theirs*, derived deterministically from a moment in their actual life.

---

## 2. Core Game Loop

```
[Acquire trash]  →  [Generate seed code]  →  [Incubate]  →  [Hatch bug]  →  [Release to world]  →  [Bug breeds, spreads]  →  [New finds appear on map]
```

**Trash acquisition (three parallel paths, player choice):**
- **A. Forage at home** — open the game, tap to scrounge through procedurally-generated trash piles. Fastest, lowest reward.
- **B. Geo-walk** — visit real-world locations on the Leaflet map. Different neighborhoods produce different trash types. Medium speed, themed rewards.
- **C. Scan** — point your camera at a real-world product label / barcode / wrapper. Highest-quality, rate-limited.

**Seed code generation:**
- Each piece of trash carries a partial seed.
- To finalize a bug, the player completes a **mini-game** that takes touch input (or analog stick on console). The path/gesture/timing become the rest of the seed.
- Reuses the existing engine's `touchInput → SHA-256 → layeredArt` pipeline.

**Incubation:**
- Combine 2+ trash items in the incubator UI.
- Engine returns a deterministic bug: anatomy layers + color palette + behavior tags.
- Bug enters the player's **Bugdex** (collection book).

**Release & ecology:**
- Players can release bugs to a chosen geographic territory.
- Bugs breed with nearby bugs (player's own + others), spreading along the map.
- New "wild" bugs appear in the player's foraging spots over time, derived from local ecology.

---

## 3. The Bug Generation Engine

### 3.1 Reuse from existing engine

Pull these subsystems verbatim or with minor modification:

| Existing engine module | Reuse as |
|---|---|
| Touch-input recorder | Mini-game seed capture |
| SHA-256 hasher | Same — unchanged |
| Layered art compositor | Insect anatomy compositor |
| Trait rarity weighting | Bug rarity tiers |
| Output cache / dedup | Same — unchanged |

### 3.2 New layer schema (replacing NFT trait set)

Define insect parts as ordered layers, each pulling from a sprite/model table:

```
Layer 1: Body shape (thorax + abdomen silhouette)  [~30 variants at launch, expandable]
Layer 2: Head / mandibles                          [~25 variants]
Layer 3: Wing pair (or none)                       [~40 variants — biggest visual variety]
Layer 4: Legs                                      [~20 variants]
Layer 5: Antennae                                  [~15 variants]
Layer 6: Surface pattern / texture                 [~50 variants]
Layer 7: Color palette                             [~80 palettes, possibly procedural]
Layer 8: Behavior tag (affects map/breeding sim)   [~12 tags]
```

At those launch counts: **30 × 25 × 40 × 20 × 15 × 50 × 80 × 12 ≈ 2.16 × 10¹²** unique bugs (~2 trillion). Plenty.

Adding even 5 variants to a single layer scales the space exponentially — content drops are cheap.

### 3.3 Signature vs procedural bugs

- **Signature bugs (~50-150 hand-crafted)** have explicit input recipes, named species, custom lore, hero art. These are what streamers screenshot.
- **Procedural bugs (everything else)** auto-generate name + lore from input tags. Deterministic — same inputs always produce the same bug — so they feel like discovery, not noise.

See attached prototype (`LitterBug.jsx`) for working examples of both, including the `TAG_PREFIXES + BUG_SUFFIXES` procedural naming approach.

---

## 4. Input Systems (the three trash-acquisition paths)

### 4.1 Forage (basic tap)

Lowest-friction loop. Player taps "Scrounge" → 1–3 trash items appear from a weighted random table. Already implemented in the prototype. Good for short sessions and bad-weather days.

### 4.2 Geo-walk (Leaflet map)

- Real-world map overlay using **Leaflet.js** + **OpenStreetMap** tiles (free, no API key).
- Trash piles spawn at points of interest pulled from OSM tags (cafes, parks, transit stops, etc.).
- Player walks within ~30m of a pile to collect it.
- **Spawn types are themed to OSM categories** — coffee shops yield coffee cups, parks yield organic waste, transit stops yield tickets/wrappers. This is the writers' room for free.

**Anti-spoof + safety considerations:** see §9.

### 4.3 Scanner (camera input)

Player opens the in-game scanner, points at a real-world label or barcode.

**Recommended pipeline:**
1. Use device camera + `@zxing/library` or `quagga2` for barcode reading (lightweight, runs on-device).
2. Optionally OCR with `tesseract.js` for text labels (heavier — defer to v2).
3. Hash the scanned string → seed code → trash item assignment.
4. **Server-side dedup:** Each unique barcode can be scanned by a player **once per 24h**, globally once per "session economy."

The scanner is the **highest-quality** trash source — give it the best rewards.

### 4.4 Mini-games (seed finalization)

Triggered when the player commits trash to the incubator. The mini-game's output (a touch path, a rhythm timing, a drawn shape) feeds the SHA-256 hasher to finalize the bug.

**Suggested mini-game types** (build one first, expand):
- **Sift** — drag finger through a trash pile to "uncover" the bug. Path becomes seed.
- **Pin** — tap-to-pin moths in a flutter pattern. Timing becomes seed.
- **Hatch** — trace a spiral over the incubator. Curve fidelity becomes seed.

Mini-games are also where **controller/analog-stick play** lives, which means console ports don't need to rework the whole UI — just the mini-games.

---

## 5. World & Ecology Systems

### 5.1 Map overlay

- **Leaflet.js** + OSM base tiles
- Custom marker layer for: trash piles, the player's released bugs, sightings of other players' bugs
- Server-driven: spawns and bug positions come from a backend (see §7)

### 5.2 Bug ecology (reusing plant simulation from prior game)

Each released bug has:
- **Territory** — a polygon on the map (initial radius ~200m)
- **Lifespan** — soft cap, ~7-30 real-world days
- **Diet/affinity tags** — derived from layers 7-8
- **Reproduction rules** — same as the plant breeding logic in the previous game, with affinity-tag matching instead of pollination

**Open question (see §8):** Does the ecology run on a shared global server (every player sees every bug) or per-player with limited cross-pollination? This is the single largest infra decision in the project.

### 5.3 The "leave trash for friends" idea

Optional async-social hook: a player can leave a trash pile at a real-world coordinate for friends or strangers to find. Adds emergent multiplayer with zero realtime infra. **Defer to v1.1.**

---

## 6. Trash Catalogue & Recipe System

### 6.1 Data structure (already prototyped — see `LitterBug.jsx`)

Three flat tables drive the whole crafting system:

```js
TRASH_ITEMS        // { id, name, icon, tags[] } — appendable forever
SIGNATURE_RECIPES  // [{ inputs: [id, id], bug: bugId }] — hand-crafted "hero" combos
SIGNATURE_BUGS     // { id, name, icon, rarity, desc } — the lore-rich species
```

### 6.2 Procedural recipe fallback (the scalability trick)

Any item pair without an explicit recipe gets a procedurally-generated bug via `generateProceduralBug(id1, id2)`. Inputs are sorted and hashed deterministically, so the same pair always produces the same bug — preserving the "discovery" feeling.

**Implication:** Writing 1,000 trash items requires **zero** new recipe lines. The game scales with item count, not with recipe count.

### 6.3 Content scaling plan

| Phase | Trash items | Signature recipes | Notes |
|---|---|---|---|
| Prototype | 20 | 12 | Done (in prototype) |
| Alpha | 100 | 40 | Hand-author |
| Beta | 300 | 100 | Hand-author + community submission pipeline |
| Launch | 1,000+ | 150 | Procedural items from OSM categories |

---

## 7. Tech Stack Recommendation

| Layer | Pick | Why |
|---|---|---|
| Engine (3D mini-games) | **Godot 4** | Free, MIT, great mobile + desktop export, controller-friendly |
| Main UI (cozy 2D screens) | Same Godot project, 2D scene tree | Avoid context-switching engines |
| Map | **Leaflet.js** in a `WebView` node, or native via `godot-leaflet` community port | Free tiles, no API costs |
| Scanner | `@zxing/library` for barcodes, `tesseract.js` for OCR (v2) | On-device, no per-scan API cost |
| Backend (ecology + dedup) | **Supabase** (Postgres + auth + edge functions) | Cheap to start, scales reasonably, no vendor lock |
| Reused engine | Wrap as a Godot GDExtension or run as a side service the client calls | Depends on the engine's current host language |

**Why Godot over Unity:** No per-install fee, no licensing drama, faster iteration, smaller binary, and the cozy/indie scene has rallied around it post-2023.

**Why not pure web:** The scanner + camera + offline play are smoother native. A web companion can still exist for the map (see §8 decision).

---

## 8. Critical Decisions Still Open (priority order)

These need answers before deep architecture. Listed by blocking impact.

### D1. Platform & form factor
- Mobile-first (iOS/Android, F2P-ish, short sessions)?
- Steam-first (paid $15-20, longer sessions, controller)?
- Cross-play from day one?

*Cascades into:* engine config, monetization, save sync, audience.

### D2. Ecology infra model
- **(a) Shared global world** — every player sees every bug. Massive social potential, real server cost (~$200-2000/mo at scale).
- **(b) Per-player worlds with social peeks** — your bugs are yours; you occasionally see ghost-images of others'. Cheap. Less viral.
- **(c) Regional shards** — players in the same ~city share a world. Middle ground.

### D3. NFT / token layer
- **Keep:** rich provenance story, optional player ownership, but **Steam will reject the build** and indie/cozy audience will be vocally hostile. Marketing becomes harder.
- **Drop:** smoother launch, broader audience, but you lose the "true ownership" angle.
- **Hybrid:** ship without it, add later as opt-in for collectors. (Recommended.)

### D4. Geo-play required or optional?
- **Required** — strong identity, but excludes housebound players, kids, rural areas with sparse OSM data.
- **Optional** — broader audience, but the map can feel empty if most players ignore it.

*Recommend:* optional, but with strong incentives. Forage-from-home is always available; geo-walk grants bonus rarity.

### D5. Reused engine integration shape
- Is the existing NFT engine in JS, Python, Rust, something else?
- Can it run as a Godot GDExtension, a local microservice, or does it need to be reimplemented in GDScript?
- The answer changes the timeline by weeks.

---

## 9. Risks & Considerations

### Safety / legal (high priority)
- **Location-based games have caused real injuries.** Lockable design choices: no spawns in roads, on water, on private property; explicit warnings; no nighttime bonus; minor-safe defaults.
- **COPPA / GDPR-K** if any users under 13 — geo data triggers strict rules.
- **Camera & location permissions** require clear in-app justifications on iOS / Play.

### Scanner abuse
- People will scan the same coke can 10,000 times.
- Mitigations: per-barcode global cooldown, per-player daily cap, server-side validation, increasing rarity decay for over-scanned items.

### Marketing risk: NFT association
- Even if the on-chain layer is dormant or removed, prior association with an NFT project will be brought up in coverage.
- Recommend a clear public narrative: "We learned a lot building [previous game]; Litter Bug is a cozy game first, with optional ownership features down the line if the community wants them."

### Scope creep
- The conversation has already touched: 3D scavenging, twin-stick, scanner, real-world map, ecology sim, breeding, social drops, NFTs, mini-games.
- **Recommended cuts for v1:** no PvP, no social drops, no NFT layer, no OCR (barcodes only).
- See phase plan §10.

---

## 10. Suggested Build Phases

### Phase 0 — Foundation (1-2 weeks)
- Stand up Godot 4 project, configure mobile + desktop targets
- Port the existing engine's generator into the new project (D5)
- Get a single bug rendering from a hard-coded seed
- Set up Supabase project with auth + a `bugs` table

### Phase 1 — Solo cozy loop (3-4 weeks)
- Forage button + inventory (port from prototype)
- Incubator UI + signature recipes
- Procedural bug generation pipeline end-to-end
- Bugdex / collection screen
- **Milestone:** A friend can play it solo and want to keep playing.

### Phase 2 — First input variety (2-3 weeks)
- Build one mini-game (suggest "Sift")
- Touch-path → SHA-256 → seed wired up
- One alternative seed source = real player choice

### Phase 3 — World layer (4-6 weeks)
- Leaflet map embed, OSM POI spawning
- Geo-walk collection (with safety constraints)
- Per-player bug ecology (simplest version of D2)
- **Milestone:** Soft launch on TestFlight / Play closed beta.

### Phase 4 — Scanner (2-3 weeks)
- Barcode scanner via zxing
- Abuse-prevention layer in Supabase edge functions
- Themed reward tables

### Phase 5 — Ecology depth (ongoing)
- Cross-player bug visibility
- Territory/breeding sim (port from plant engine)
- Content drops at 100 / 300 / 1,000 trash items

### Phase 6+ — Optional layers
- Social trash drops
- OCR scanner
- (Maybe) on-chain ownership for opt-in collectors
- Console ports (controller already works via mini-games)

---

## 11. Reference Materials

- **`LitterBug.jsx`** — working web prototype demonstrating the trash → incubator → bug loop and the tag-based procedural recipe system. Treat as a spec for the UI/UX feel, not the final tech.
- **Previous game's repo** — pull the layered art compositor, the SHA-256 input pipeline, and the breeding/territory simulation from here.
- **Aesthetic reference** — "Cryptid Naturalist's Field Journal": warm paper tones, handwritten accents, sketched borders. See the prototype's CSS for the palette and font pairing (Fraunces + Caveat + Nunito).

---

## 12. Open Questions for the Project Owner

Things the human needs to answer before Claude Code can go too far:

1. **Platform priority?** (D1)
2. **Ecology infra model preference?** (D2)
3. **NFT layer in or out for v1?** (D3)
4. **What language is the existing engine in?** (D5)
5. **Is there an existing brand / art direction from the previous game to inherit, or do we start fresh visually?**
6. **Timeline — is there a target ship date or is this an open-ended project?**
7. **Solo dev or team?** (Affects scope guidance significantly.)
8. **Monetization model preference?** (Premium / F2P with cosmetics / pay-to-expand-Bugdex / patron model?)

---

*End of handoff v0.1. This document is intended to be a living spec — update sections as decisions firm up, and version-bump the file when major direction changes.*
