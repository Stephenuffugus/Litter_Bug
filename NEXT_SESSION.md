# NEXT SESSION — Plan of attack

When you come back and say "let's get started," read this first. It's the
state, the priorities, and the guardrails in one place.
Last updated: 2026-07-18 (end of a long build + art-structure session).

---

## Where things stand

Litter Bug is a **turn-based bug-battler** now (the cozy trash-collector is
gone). The single-player game is **built, polished, and verified end to end**:

- **Smoke: 134 / 0** across all harnesses. Keep it green before every commit.
- **Four playable pages, all live as private artifacts** (same links, phone-ready):
  - Mint Lab — https://claude.ai/code/artifact/c3cb94fc-c613-43c8-947e-025e8d1073e5
  - Bugdex — https://claude.ai/code/artifact/d71e4cb8-b0dc-4ac6-bf06-2d3c34ea9e9a
  - World — https://claude.ai/code/artifact/d5637cee-0da3-4acc-a0e5-249dc345c670
  - Arena — https://claude.ai/code/artifact/3aa20362-f21b-4dcb-95a2-75918f0d08a7
- **The loop:** play a trial -> SHA-256 codeblock -> rolled bug (grows with level)
  -> collect/breed -> place on the map, fight wild + rival cells for territory,
  level up, defend raids. Battles have dual-typing + the Poise/Break tempo layer.
- Verified this session by an adversarial code sweep (clean) and a full visual
  QA pass on a real browser (clean). Nothing is on fire.

---

## THE FOCUS: art structure (this is what you care about most)

You asked for **an exact formula to generate each piece + a prompt to author
each piece of each style.** That exists now:

- **`PART_CATALOG.md`** (repo) / artifact: https://claude.ai/code/artifact/8d92f435-0972-46cb-af19-99797ee97d1e
  For every piece (body, wings, jaws, tail, antennae, eyes, legs, carapace,
  horns, spines, materials) and every style: the exact deterministic formula
  AND a Midjourney/Recraft authoring prompt, on one shared canvas + one locked
  style. **This is the working document — we refine it together.**
- **Art-direction brief** (visual, current-vs-merged): https://claude.ai/code/artifact/b533bc7e-2b91-4582-9c33-f82b7c098009
- The **structure is decided and good:** spine + part-sockets, made
  source-agnostic — each piece is procedural today and can become an authored
  SVG symbol later, per piece, reversibly, without touching determinism.
- Shipped (commit d9c9cef): an off-by-default `opts.merge` flag on the renderer
  that fuses the segments into one silhouette. Default output is byte-identical,
  so the live game is unchanged. It's the first free-fidelity step.

### Bring back with you
1. **The tricks + resources from the other AI you're consulting.** Drop them in
   and I'll fold the good ones into PART_CATALOG.md.
2. **(Optional) mint the ONE `--sref`** from a hero bug you love — that single
   style code is what keeps all authored pieces one family. Paste it into
   ART_STYLE.md (THE GAME STYLE REFERENCE) and PART_CATALOG.md 0.5.
3. **(Optional) author 1-2 wings** with the wing prompts (PART_CATALOG 2).
   Wings are the biggest visual element and the first upgrade candidate.
   256x128, grayscale, root bled to lower-left.

### First actions when you're back (pick the entry point)
- **A. Refine the catalog** — go piece by piece, tighten canvases/pivots + prompt
  wording, merge in your research. (Lowest risk, highest leverage on the plan.)
- **B. See the pipeline work** — I wire the source-agnostic `renderPart` dispatch
  for wings end to end, so the moment you hand me a wing symbol we drop it in and
  compare live against the procedural wing. (Proves the whole architecture.)
- **C. Push procedural to its ceiling** — I do the full free pass (merge + one-
  light shading + rim light + cel bands + size-tier LOD), wire it into the live
  game, show you before/after. This tells us how good "free" gets before you
  spend any Midjourney time.

  My honest rec: **A + C first**, so you can set the fidelity bar with your eye
  on a real comparison; then decide how much B / authored-art we fund.

### Resources worth pulling from (from the research, task wio40nkwz)
- **Recraft** — true editable vector in a locked style (better than Midjourney
  raster for recolorable parts).
- **vtracer + potrace + SVGO** — turn AI raster into tiny inline SVG that rides
  our tint engine.
- **DiceBear** (open source) — a working proof of exactly our architecture
  (seed -> layered SVG -> recolor -> offline); good reference for the slot table.
- **ControlNet lineart** — pins authored parts to our existing silhouettes so
  pivots can't drift (needs a GPU/Colab).
- **game-icons.net + Lucide** — single-path SVG for type badges / rarity / icons
  that recolor through the same engine.

Note: `ART_STYLE.md` + `ASSETS.md` describe the OLDER PNG-layer socket
(body/head/wings/pattern). `PART_CATALOG.md` is the current source of truth;
update those two docs once the fidelity path is chosen.

---

## Parked — decisions that are yours, waiting on you (not blocking art)

- **Playtest-tune Poise/Break + types.** I balanced by simulation; your thumbs
  will find what a sim won't. Tell me what feels off and I tune the numbers.
- **Multiplayer (Firestore).** The real version of the rival raids. Needs your
  infra calls (D1/D2). You've said "easy and fast, we'll get there."
- **Combat design forks** (I'm holding these so I don't stack balance changes
  before you've felt Poise/Break): coverage-move riders, status synergies, a
  shared-charge ultimate, switching, arena-uses-your-collection.

---

## Guardrails (unchanged)

- Smoke green before every commit. Push and report the hash (you test on phone).
- Determinism is sacred: same codeblock (+level, +battle seed) -> identical
  output. Any NEW renderer roll is appended LAST so existing bugs don't shift.
- No em-dashes in UI copy. Warm but honest. One change at a time. Ask when it's
  a real design/economy call (those are yours).

## Handy tooling (in scratchpad, for me)
- `qa-bugs.js` — render a bug variety + growth PNG (eyeball art via sharp).
- `shoot*.js` — screenshot the live pages/modals at phone width (real browser QA;
  chromium apt-deps are installed).
- `build-art-brief.js` — regenerate the art-direction brief artifact.

See you when you're back.

---

## 2026-07-27 (from the lucid-winds codespace session)

GitHub Pages is now ENABLED on this repo (main branch, root). Everything is
live without artifacts:

- Hub: https://stephenuffugus.github.io/Litter_Bug/
- Mint Lab: https://stephenuffugus.github.io/Litter_Bug/mint-lab.html
- Bugdex: https://stephenuffugus.github.io/Litter_Bug/bugdex.html
- World: https://stephenuffugus.github.io/Litter_Bug/world.html
- Arena: https://stephenuffugus.github.io/Litter_Bug/battle-lab.html

The inherited Lucid Winds engine was squatting on `index.html` (6.8MB, broke
the bare URL with 100+ asset 404s). Renamed to `inherited-engine.html`, and
`index.html` is now a small hub page linking the labs, styled to match them.
CLAUDE.md file layout updated. All five pages verified live headless: zero JS
errors, zero blanks.

---

## 2026-07-29 (from the lucid-winds codespace session)

Stephen unparked the project ("litter bugs needs worked on"), so plan C from
this file is now DONE: **the fx pass is the live default everywhere.** One
line flips it back (`FX_LIVE = false` in bug-engine.js). No new rolls, pure
seeded shading, so every existing bug keeps its identity - the 200-roll
determinism gate now exercises the fx path and stays green.

- Before/after for your eye: `FX_BEFORE_AFTER.png` in the repo root
  (8 bugs, flat above, fx below - same codeblocks, upgraded look).
- Two new smoke guards: fx is the default (rim+cel emitted), and the
  `{fx:false}` flat opt-out still works and differs.
- Also fixed: `scripts/smoke.js` still loaded `index.html` after the 07-27
  rename to `inherited-engine.html`, so the first suite was failing 0/15 at
  HEAD. Pointer updated; full suite is now 136/0.

Plan A (refining PART_CATALOG.md together) still wants your session. Plan B
(authored wing drop-in) still waits on your sref + first wings.

**Same day, later:** plan B is ALSO done. `registerPart('wing', idx, svgInner)`
/ `clearParts('wing')` on the engine: register an authored wing symbol
(256x128, root at 0,128, currentColor - the contract is written at the
PART_SOURCES block) and every membrane-winged bug wears it on the same
thorax anchor, hindwing echo included; elytra and wingless bugs untouched;
clear it and output is byte-identical procedural again. Proven by
`WING_DROPIN_PROOF.png` (four bugs, procedural vs a stand-in test wing -
NOT art direction, just the pipeline) and a new smoke guard
(switch/untouched/deterministic/revert all asserted). Suite 137/0.
The moment your real sref wings land: paste path data into a register call,
done.
