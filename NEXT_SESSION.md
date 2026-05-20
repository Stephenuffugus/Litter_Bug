# NEXT SESSION — Plan of attack

When you come back and say "let's get started," this is the first thing
I should read. It's the priority list, the prep checklist, and the
guardrails — in one place.

State of the repo at session close (2026-05-20):

- **Smoke: 55 / 0** across three harnesses (index 15, lab 32, preview 8)
- **Art banks:** 8 placeholders per layer (48 PNGs + 16 procedural JSON entries)
- **Pages:** `bug-lab.html` (one-at-a-time), `preview.html` (grid of 60+)
- **Pipeline:** drop-folder → `npm run art` → catalogs + both pages patched
- **Docs:** `ROADMAP.md` (everything to make), `STATUS.md` (live snapshot)

---

## Before you come back — what to bring

The most useful prep is **one layer of real art**. I recommend **wings**
for three reasons:

1. Wings are the biggest visual element on the bug. If they read well,
   the whole bug reads well.
2. Wings exercise the most complex part of the pipeline (tinting +
   rotation + mirroring). Validating wings validates everything.
3. One wing PNG = one production unit. Cheap to iterate.

**Goal:** 4 to 8 PNGs in `assets/wings/raw/`. Naming becomes display
name: `dragonfly-iridescent.png` → "Dragonfly Iridescent."

Use the AI prompts in `assets/wings/README.md` if you want a starting
point. Or hand-draw. Or commission. Convention recap:

- 256×128 PNG, transparent background
- Wing root (attachment) at the left edge, around x=24 y=64
- White silhouette if you want palette tinting
- Full color art if you want it as-authored (set `tintable: false` in
  `wings.json` after import)

If you have extra time, drop 2 to 4 body silhouettes into
`assets/bodies/raw/` too (200×100, head end on the right).

**Do NOT try to do all layers at once.** Validate one layer first, then
the next. Surprises in the pipeline are easier to debug a layer at a
time.

---

## First 10 minutes when you sign back on

You say "let's get started." I do this:

1. `ls assets/*/raw/` — see what you dropped
2. `npm run art` — import every layer that has new files
3. `npm run art:contact` — regenerate the visual review sheets
4. `npm run status` — refresh STATUS.md and the lab's status strip
5. `npm run smoke` — green check
6. You open `preview.html` on your phone
7. You tell me what's right and what's broken

If you dropped nothing, we skip to picking an item from the priority list.

---

## Priority list (do these in order)

### 1. Make the art land cleanly
The first time real art goes through the pipeline, things will break in
small ways. The likely failures:
- Your PNG isn't quite 256×128 → sharp normalizes it but might letterbox weird
- Attachment point isn't at (24, 64) → wings sit off-center on bugs
- Your art has fine detail that disappears at small render size
- Tinting wipes color you wanted to keep

I fix these as you find them. Smoke gates every fix.

### 2. Validate variety
Open `preview.html` and bump to 120 bugs. Look at the grid as a whole:
- Are bugs reading as distinct?
- Is the palette doing real work (different bugs feel different colors)?
- Any combinations look identical? Any "dead zone" where the body and
  wing don't visually agree?

This is where I'd add a hash inspector if we hit "why does THIS bug
look like THAT" questions repeatedly.

### 3. Tune metadata, not code
For small fixes (a wing attaches a few pixels off, a body should be
non-tintable, a head needs a different rarity tier):
- Edit `assets/<layer>/<layer>.json`
- Run `npm run <layer>`
- Reload preview.html

No code change. Sentinels do the work.

### 4. Move to bodies (then heads, then patterns)
Same workflow. Drop art in `raw/`, run `npm run <layer>`, validate. Each
layer in isolation. Don't fan out to multiple layers in parallel until
each one is dialed.

### 5. Tune legs and antennae
These are JSON-only. Edit `assets/legs/legs.json` and
`assets/antennae/antennae.json` directly to tune shape parameters
(count, length, thickness, curl, spread). Run `npm run legs` /
`npm run antennae` to push to the pages.

### 6. Palette decision
Once real art is in, we need to decide if 16 flat hex colors is enough
or if we move to 80 structured palettes (HANDOFF §3.2). Big visual
impact but bigger change. Decide AFTER you see real art.

### 7. Hash inspector (debug tool)
Tiny build. Paste a hash, see decoded traits + chosen bank entry per
layer + the rendered SVG. Useful when you want to understand a specific
bug's anatomy choices.

### 8. Decide what's next after the art pipeline feels solid
Three real candidates:
- Structured palette (item 6)
- Trash catalog v0 (set up TRASH_ITEMS data structure from HANDOFF §11)
- First piece of real game shell (incubator UI — combine two trash items)

---

## Open decisions (still parked)

These block deeper game-shell work. Pick when you're ready, not before:

| Decision | Status | Recommendation if you ask |
|---|---|---|
| D1 Platform priority | Open | PWA / web first; ports later |
| D2 Ecology infra | Open | Per-player with social peeks (cheap, can grow) |
| D3 NFT layer | Open | OUT for v1 (cozy audience fit) |
| D4 Geo-play | Open | Optional with bonus rarity |
| Palette structure | Open | Decide after real art tests |
| Save backend | Open | localStorage v0, real backend in phase 2 |

---

## If something breaks

- Smoke is the contract. `npm run smoke` must be green before any
  commit. If it's red, we fix it first.
- Banks out of sync (lab shows different wings than wings.json):
  `npm run wings` re-patches. Same for any layer.
- If you can't see bugs at all in the lab, browser console first. The
  status pill row will also show `smoke ✗` if catalog and bank drifted.
- Don't commit half-broken art. Run smoke locally first.

---

## What I will NOT do without you

- Make any of the D1-D4 architecture decisions
- Touch payment / Stripe code (parked under `deferred/`, stays parked)
- Add features outside the priority list above
- Rewrite the renderer or do a "shared engine" refactor (we extract
  `bug-engine.js` only when a third page consumes it)
- Push uncommitted work as a force-push
- Skip smoke

---

## What I WILL do without you, autonomously

If you say "go" without specifics, I'll:

1. Read this file
2. Look at `assets/*/raw/` for new art
3. Run the import pipeline if there's anything new
4. Otherwise pick the top unblocked item from the priority list and ask
   before I start

---

## Commit log this session (2026-05-20)

For reference when you come back:

```
e2b8a76  add preview.html: 60-bug stable-seed grid for eyeballing variety
caf6448  add ROADMAP.md, status script, and live status strip in bug-lab
2396f42  add patterns layer: PNG overlay between body and head
ec37c01  add legs + antennae as procedural (JSON-only) banks
9d865c8  add heads layer: PNG silhouettes, dark-tinted, HEAD_BANK in lab
8177007  add bodies layer: PNG silhouettes, primary-tinted, BODY_BANK in lab
3650720  refactor: generalize art pipeline so every layer uses the same workflow
c63a5d2  wing pipeline: drop folder, catalog, contact sheet, AI prompts
53a59c5  bug-lab: render wings as PNG sprites tinted per palette
03ebea5  add bug-lab.html: first procedural bug renderer (placeholder)
0f93112  park Stripe tip-jar PHP under deferred/v1.1-web-tipjar/
3d4d354  CLAUDE.md: rewrite for Litter Bug as its own game
5e04dc4  kickoff: rename Lucid Winds artifacts, scaffold scripts/, smoke 15/15
7be6dcb  Initial commit
```

13 commits this session. Foundation is solid. Pipeline is real. Now
we put real art through it and see what holds.

See you when you're back.
