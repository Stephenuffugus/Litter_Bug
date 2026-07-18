# LITTER BUG / ASSETS.md
# Asset strategy: what we make, in what order, with which tool, and how it
# drops into the game without ever touching game logic. No timelines.
# Grounded in research (task wspvzsidz) + the current engine. 2026-07-17.

## THE DECISION IN ONE PARAGRAPH
Ship the **procedural SVG bugs** as the baseline. They are deterministic
(SHA-256 to the same bug), recolorable (80 curated palettes), tiny (inline
SVG), and readable at map/battle size, four things AI cannot give us. Richer
art (2D or 3D-baked) is an OPTIONAL upgrade that drops onto the SAME socket
pivots and is recolored by the SAME engine, so it is reversible per layer and
never touches game logic. Meshy is good but NOT the first thing to spend on
(reasons below); the first upgrade, if any, is 2D (Midjourney + ControlNet
over our own SVG silhouettes). We are not rushing the visuals.

## 1. ASSET INVENTORY
Tags: **procedural** (hash->socket->tint), **vector-icon** (hand-authored
design system), **AI-2D** (Midjourney, style-locked), **AI-3D-baked**
(Meshy/Blender, orthographic bake to PNG), **bought** (packs/commission).

### Creatures (the engine's job)
| Asset | Medium | Priority |
|---|---|---|
| Bodies 30, Heads 25 | procedural now; optional AI upgrade | now |
| Wings 40 | procedural now; **first AI upgrade candidate** | now |
| Legs 20, Antennae 15 | **procedural, keep forever** (thin parts = worst for AI-3D) | now |
| Pattern/texture 50 | procedural now; **AI-2D** upgrade (cheapest AI win) | soon |
| Palette schemes 80 | pure data (the recolor engine) | now |

### Non-creature (mostly NOT the engine's job)
| Asset | Medium | Priority |
|---|---|---|
| Typography (1 display + 1 UI face) | bought/licensed, **self-host** | now |
| Action/system icons (~40-80) | vector-icon (retire any inherited emoji) | now |
| UI kit (buttons, panels, bars, 9-slice) | vector-icon design system | now |
| App icon + store art | AI-2D draft -> hand-finalize | drafts now |
| Type/element badges + rarity frames | **vector base recolored via the tint engine** | soon |
| Map markers | **shrink `_generateBugSVG` into a Leaflet divIcon** + small vector pins | soon |
| Territory overlays | procedural polygon tinted by the owning bug's palette | soon |
| Battle VFX (sparks, impacts, status) | bought pack, tinted per element | soon |
| Currency / trash icons | vector-icon (template + recolor for the long tail) | soon/later |
| Biome / battle backgrounds | AI-2D (Midjourney `--sref` locked) | later |
| SFX / music | bought CC0 (Kenney) + Freesound; one music commission | later |
| Hero / legendary showcase render | **AI-3D (Meshy/Rodin), one-off** (determinism irrelevant) | later |

Rule that assigns the tag: anything **interactive or repeated** (UI, icons,
frames, markers) is a fixed hand-authored system; anything **recolored like a
creature** rides the tint engine; **big non-interactive surfaces + marketing**
are where AI is allowed; **VFX + audio are bought**. AI never owns sockets,
pivots, connective geometry, or recolor logic.

## 2. THE BUG ART DECISION
**Baseline = procedural SVG. Nothing below blocks shipping.** `_generateBugSVG`
already gives determinism + recolor + tiny weight + small-size readability,
and it owns all connective geometry.

**Both AI upgrade paths end in the SAME artifact:** a grayscale + ID-mask PNG
on the same socket (body 200x100 [200,50], head 96x96 [0,48], wings 256x128
[24,64], pattern 200x100 [100,50]), recolored by the same engine. So the
choice is per-layer and reversible.

**Honest verdict on Meshy:** genuinely capable in 2026, but not our first
dollar, for structural (not quality) reasons:
- It is **stochastic**, which collides with SHA-256 determinism. Offline
  authoring tool only, never a runtime generator.
- Its **auto-rig is humanoid-only**; docs list insects as unsupported. It
  cannot rig or animate our bugs (the one thing that would justify 3D here).
- It **drifts across generations**, so it must be driven from our own locked
  reference art, never author cohesive parts on its own.
- **Thin insect features (antennae, hair-legs)** are exactly what AI-3D does
  worst and what our procedural rig already nails. Keep those procedural.
- Its textures are **baked PBR**, the enemy of runtime palette-swap. Strip and
  re-bake grayscale + mask our way.

Meshy earns a place later for: (1) a hero/store "legendary bug" render, and
(2) IF animation or a Godot port (open decision D5) lands. Not before.

**Recommendation:** procedural now; when a richer bug bank is wanted, do the
**wings** layer first via 2D (Midjourney + ControlNet), validate the palette
round-trip, then convert layers by demand. Escalate a layer to 3D bake only at
a real trigger (animation / shaded volume / Godot).

## 3. THE PIPELINE
### The render kit (tool-agnostic invariants) — cohesion comes from a frozen
### environment, not hand-matching
- One canvas per socket size (above). Render/bake at the small target size so
  readability survives.
- One orientation: side view, facing right.
- One light direction for the whole bank (a single MatCap/light rig for 3D; a
  single Midjourney `--sref` code for 2D). Never change more than the geometry
  between renders.
- **Never bake final color.** Output three passes: grayscale luminance, AO,
  and a flat material-ID mask (pure R/G/B zones, one per recolorable region).
  This is what keeps the 80 schemes working.

### Path A — 2D (Midjourney + ControlNet), the cheaper first upgrade
1. Rasterize the existing SVG part silhouette as the ControlNet control image
   (pins geometry; AI cannot move the socket or scale).
2. Generate with one locked `--sref` style code.
3. Desaturate to grayscale luminance, derive a flat ID mask, export at socket
   size.
4. Drop into `assets/<layer>/`, run `import-art.js`, set
   `source: "midjourney-controlnet"` in the catalog JSON.

### Path B — 3D bake (Meshy -> Blender), adopt at a trigger
1. Meshy base mesh (Low Poly + Smart Remesh), driven by our rasterized SVG as
   image reference so style is pinned; export GLB/BLEND; strip its texture.
2. One `render_kit.blend`: single ortho camera, single MatCap/light, world
   origin locked, empties at the four socket coords. Parent each part to its
   socket empty; normalize scale into our master-scale/ratio bands so
   head<thorax<abdomen holds.
3. Headless bake: `blender --background render_kit.blend --python bake.py`,
   loop parts, render grayscale + AO + ID-mask (optional normal pass) at socket
   size.
4. Drop into `assets/<layer>/`, `import-art.js`, `source: "meshy-bake"`.

### Runtime recolor (identical for procedural, A, and B)
The SHA-256 still only selects **part IDs + a palette index**. At draw time we
gradient-map the grayscale through the chosen scheme, routing each region to a
palette slot via the ID mask. One bake per part serves all 80 schemes.

## 4. THE COHESION GUARANTEE ("any roll still fits")
The guarantees live in the **rig + render kit, not the pixels**. Four locks,
the same ones that make the procedural set cohesive today:
1. **The socket contract is fixed and shared** (the four pivots). A part cannot
   land off-model because the pivot is defined outside the art.
2. **One light, one style code.** Style drift (AI's weak point) is defeated by
   never changing more than the geometry between renders.
3. **The scale ladder is enforced at bake time,** not by the generator. AI
   never sets scale, pivots, or connective geometry.
4. **Palette roles are engine-side** (grayscale + ID mask + 80 schemes at
   runtime; never bake final color).
A bank can be **half procedural, half baked at once** and still read as one
set, because cohesion depends on obeying the four locks, not on a shared origin.

## 5. NON-RUSHED ROADMAP (each phase shippable, reversible, never blocks the game)
- **Phase 0 — Procedural baseline.** Done. `_generateBugSVG` is v1 bug art.
- **Phase 1 — Retire launch blockers (no bug art):** self-host typography,
  author the vector icon set, build the 9-slice UI kit, draft the app icon.
- **Phase 2 — Prove the palette round-trip on ONE layer (wings):** run it
  through Path A, bake grayscale + ID mask, verify all 80 schemes round-trip
  and the socket aligns. This de-risks everything after it. Keep procedural
  wings as fallback in the same bank.
- **Phase 3 — Type badges + rarity frames** through the tint engine.
- **Phase 4 — Map markers + territory overlays** (bug marker = shrunk
  `_generateBugSVG` divIcon; polygons tinted by owning-bug palette).
- **Phase 5 — Buy VFX + SFX packs,** tinted per element.
- **Phase 6 — Convert remaining banks by demand, layer by layer** (patterns via
  2D; bodies/heads via 2D first; 3D only at a trigger).
- **Phase 7 — Hero + store polish** (one Meshy/Rodin hero render; music;
  onboarding).
Invariant: each layer's bank can be any mix of procedural + baked at any time.
Never forced to finish a bank before shipping; roll a layer back to procedural
if a bake disappoints, because the socket contract + recolor never change.

## 6. WHAT THE ENGINE NEEDS TO RECEIVE PRO ART (buildable now, no art)
Most of this scaffolding already exists and needs generalizing, not inventing:
1. **Asset manifest provenance.** `scripts/art-layers.js` now carries a
   per-layer `source` + `passes` field so the manifest declares what each layer
   ships (procedural today; the baked swap-slot documented).
2. **A per-layer loader** that composites procedural OR baked PNG per layer
   behind a flag (the PNG attach/compositing math already exists in the dormant
   bank path). Build when the first real part set exists (Phase 2), not before.
3. **A Blender `render_kit.blend` + `bake.py` stub** (ortho camera, four socket
   empties, MatCap, grayscale/AO/ID passes) to freeze the environment.
4. **A recolor round-trip smoke** (a baked grayscale+ID sample recolors
   identically per seed; all 80 schemes distinct + in-palette).
5. **A mixed-source contact sheet** (same roll, procedural vs baked per layer,
   side by side) + a `source` coverage line in `status.json`.
6. **The ingest guard:** `import-art.js` must stamp `source`/`attachment` and
   refuse a PNG whose dimensions do not match `art-layers.js` (that one check
   is what stops a baked part from breaking the socket).
Items 2-5 are built at Phase 2 (validate one part set first, per the roadmap);
items 1 and 6 are cheap to do now.
