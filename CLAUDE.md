# LITTER BUG / CLAUDE.md
# Claude Code reads this file on startup. Source of truth for rules.
# Last updated: 2026-05-20 (kickoff)

## IDENTITY
You are working on Litter Bug. Stephen is director. All design and economy
decisions are his. Read HANDOFF.md for the game vision.

Stephen also built Lucid Winds. We inherit some of that engine here, but
**Litter Bug is its own game.** Treat the Lucid Winds code as a kit of
useful parts, not a template. Don't drag Lucid Winds's economy,
vocabulary, or feature scope over by default.

## WORKING STYLE (Stephen, verbatim from kickoff)
- Smoke must be green before you commit. Add new assertions as you ship new behavior.
- Push your commits and tell me the hash. I test on my phone.
- Only touch what I ask you to touch. No "while I'm in here" cleanups.
- If something's ambiguous, ask. Don't invent. Don't sugarcoat.
- Be warm but honest. No marketing voice. No em-dashes.
- Don't promise timelines. Just fix things.
- One change at a time. str_replace style edits over sed.

## WHAT LITTER BUG IS
Cozy collection game. Players forage trash (tap, geo-walk, scan), combine
items in an incubator, and hatch a SHA-256-derived insect. Bugs live on a
shared Leaflet map, breed, and drift. Full vision lives in HANDOFF.md.

## WHAT WE TAKE FROM LUCID WINDS
From a 2026-05-20 audit of the inherited engine (101,525 lines; renamed `index.html` -> `inherited-engine.html` on 2026-07-27 when GitHub Pages went live):

Useful kit of parts:
- `hashToTraits` (around line 11334). Hash bytes 0..22 to trait indices.
  We keep the ladder; we swap the TRAIT_BANK contents for insect anatomy.
  Climate bytes 23..27 become unused.
- `getTerraGrade` rarity scoring and tier thresholds. Reusable, possibly
  renamed for Litter Bug's tone.
- `_generatePlantSVG` render harness (around line 15983): progress
  animation, SVG cache, mutation filter wrapper, gradient/filter defs.
  Body-agnostic; per-layer draw functions get swapped.
- Mini-game engine `_e` / `_play` and the 27 inherited games. Reskinnable.
- Leaflet map, GPS, and territory logic from `FG_Wild`.
- Firestore, auth, service worker plumbing.

Things we are NOT bringing forward by default (cut from v1 unless director
decides otherwise):
- Climate damage system
- Composting
- Items + LW_BOXES
- Keeper tree, prestige system, class system
- Plant haiku engine (replaced by a procedural insect name generator)

These were good Lucid Winds features. They are not Litter Bug features
unless we explicitly add them later.

## ART PIPELINE (decided 2026-05-20)
Hybrid. Inline SVG for body, head, legs, antennae (procedural and friendly
to the mutation filter wrapper). PNG sprites for wings (high-detail
texture, palette-tinted via feColorMatrix). Cuts wing-system code from
~3000 lines to ~600 and ~50 to 80 KB of asset weight. Revisit only if a
Godot port lands (see D5).

## INSECT ANATOMY LAYERS (HANDOFF §3.2)
Target bank sizes for launch:
- Body shape (thorax + abdomen): 30
- Head / mandibles: 25
- Wings (or none): 40
- Legs: 20
- Antennae: 15
- Surface pattern / texture: 50
- Color palette: 80
- Behavior tag: 12

Combinatorial space about 2.16e12. Plenty.

## OPEN DECISIONS (still need Stephen)
- D1 Platform priority: mobile, Steam, or cross-play from day one
- D2 Ecology infra: shared global world, per-player, or regional shards
- D3 NFT / token layer in or out for v1 (handoff §8 recommends out)
- D4 Geo-play required or optional (handoff recommends optional with bonus)
- D5 Engine substrate: stay on single-file HTML/JS (current working
  artifact) or port to Godot per handoff §7. Godot is a multi-week
  direction change and should wait until D1 is decided.

## SMOKE HARNESS
- Run: `npm install && npm run smoke`
- 15 checks live. Add assertions when you ship new behavior.
- Pre-existing boot warnings (`db.enablePersistence`, one undefined
  `onAuthStateChanged`) are jsdom stub limitations carried over from
  Lucid Winds, not real engine bugs. Fix when convenient, not blocking.

## FILE LAYOUT
- `/inherited-engine.html` — the inherited Lucid Winds engine (will be reshaped, not preserved; was `/index.html` until 2026-07-27)
- `/index.html` — hub landing page for GitHub Pages (links the four playable labs)
- `/HANDOFF.md` — game vision
- `/CLAUDE.md` — this file
- `/README.md` — public one-liner
- `/scripts/smoke.js` — jsdom harness
- `/package.json` + `/package-lock.json` — committed so smoke runs from clone
- `/deferred/` — work parked for later, not v1 scope

## COMMON PITFALLS (inherited from Lucid Winds incidents)
1. IIFE scoping: functions inside one IIFE are invisible to other IIFEs
   unless exposed on `window`. Don't break window exposures.
2. A syntax error in any script block kills every function in that block.
   Verify with `node --check` (or vm.createScript on extracted JS) before
   committing.
3. Inline SVG data URIs in CSS contain `{ } ( )` that fool naive brace
   counters. Don't rely on regex for JS syntax checks.
4. The mutation filter wrapper sits between body and FX overlays. Moving
   aura or base layers inside it wrecks atmospheric color.

## DEAD NAMES (do not use in new code or UI)
Lucid Winds. Petal Walk. Focus Grove. Stevie. stevieweedseed.
The game is Litter Bug.
