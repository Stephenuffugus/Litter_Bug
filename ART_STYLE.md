# LITTER BUG / ART_STYLE.md
# The art bible. Every bug part obeys this so mix-and-match stays cohesive.
# Style locked 2026-07-17: clean flat vector / mascot. Director: Stephen.

## STATUS (2026-07-17): art is now PROCEDURAL by default
Stephen has Midjourney + ChatGPT but no easy way to run the AI-art pipeline,
so we pivoted: the bugs are now drawn fully in code, in SVG, as outlined
cel-shaded flat-vector mascots (`_generateBugSVG` in `bug-engine.js`). Shapes
come from the trait indices, colors from the palette scheme. It looks good,
needs ZERO art production, stays deterministic + recolorable, and ships today.

The Midjourney/PNG pipeline below is NOT dead. It is the OPTIONAL higher-
fidelity path: the PNG banks + attachment points still exist in the engine, so
if we ever want richer hand/AI art we can drop it in and composite it over (or
instead of) the procedural parts. Everything below still applies to that path.
Until then, improving the look = improving the procedural drawing code.

---


## THE ONE RULE
Every part in the game is authored in ONE locked style, with ONE light
direction, ONE outline treatment, on its exact canvas, with its connection
point bled to the pivot edge. Break any of these and the set fractures back
into "blobs." Parts are authored in GRAYSCALE (see "Grayscale masters"); the
engine recolors them per bug via the tint filter. Do NOT deliver flat white
(that is what made the old parts look like blobs) and do NOT deliver full
color (it fights the 28-to-80 palette recolor).

## STYLE: clean flat vector / mascot
Bold uniform dark outline, two flat shaded tone bands (base + shadow) plus a
small highlight, minimal/no gradients, matte. Reads well tiny, recolors
cleanest, easiest to keep consistent across 130+ AI parts. Facing RIGHT.

## THE GAME STYLE REFERENCE (--sref) — mint once, reuse forever
The single most important asset. All parts share one Midjourney style code.
1. In Midjourney, generate one hero bug you love in this flat-vector style.
2. Lock it: append its image URL as `--sref <url>`, OR use the Style Creator
   / Style Tuner on midjourney.com to mint a numeric code, OR `--sref random`
   and save the code it prints.
3. Record it below. Every prompt for the rest of the game carries it.

    GAME SREF:  <not yet minted — paste the code/url here once you have it>
    MJ version notes: V7 default is --sv 6; codes minted before 2025-06-16
    need --sv 4. Keep --sw around 150-250 (higher = stricter but flatter).

## SOCKET CONTRACT (the "skeleton")
Bug faces RIGHT. These canvases + pivots are the real values the engine uses
(`scripts/art-layers.js`, `bug-engine.js`). Author to them exactly.

| Layer   | Canvas px | Pivot px | Pivot meaning                    | Bank target |
|---------|-----------|----------|----------------------------------|-------------|
| Body    | 200 x 100 | [200,50] | right-edge middle (head bolts on)| 30          |
| Head    | 96 x 96   | [0,48]   | left-edge middle (sits on body)  | 25          |
| Wings   | 256 x 128 | [24,64]  | left-middle (wing root)          | 40          |
| Pattern | 200 x 100 | [100,50] | center; overlays the body 1:1    | 50          |
| Legs    | procedural (SVG line art, not PNG)          | 20          |
| Antennae| procedural (SVG line art, not PNG)          | 15          |

Rules every part must obey:
1. Exact canvas size, transparent background, PNG-32 STRAIGHT alpha (not
   premultiplied — premultiplied shows dark edges when the engine draws it).
2. Connection point sits ON the pivot pixel, bled to that edge with NO
   transparent margin on the connect side. The importer resizes with
   `fit: contain` which CENTERS by bounding box, so slack on the socket edge
   floats the part off its joint.
3. ONE light direction for the whole game: UPPER-LEFT. Highlights top-left,
   shadow bottom-right, on every part in every bank. Mismatched light is the
   fastest "these assets don't belong together" tell.
4. ONE outline color + weight. Match the PNG outline's FINAL rendered width to
   the ~2.5px procedural leg strokes so drawn lines and procedural lines read
   as one pen. Because layers render at different scales, author thicker:
     - Body  renders ~0.8x  -> author outline ~3px
     - Wings render ~0.55x  -> author outline ~4.5px
     - Head  renders ~0.48x -> author outline ~5px
5. Outline is near-black in the grayscale master (~8-12% gray), not pure #000.
6. Silhouette test: view each part as a solid black shape at ~64px. If two
   bodies collapse to the same blob, redesign one. Keep a few px of overlap
   at each seam so swaps never gap.

## GRAYSCALE MASTERS (why it stops looking flat)
The engine tint is a per-channel MULTIPLY. Multiply preserves shading only if
the source has light-to-dark variation. So author each part as a grayscale
value study, then the SAME engine outputs a shaded, outlined, colored part.
Target values for the current multiply path (leave headroom, multiply darkens):
    outline  ~10% gray  (#1a1a1a)
    shadow   ~55% gray  (#8c8c8c)
    base     ~85% gray  (#d9d9d9)   <- keep base HIGH so multiply(base,tint)~tint
    highlight~98% gray  (#fafafa)
Convert a color render to master (ImageMagick):
    convert in.png -colorspace Gray -alpha copy master.png   # then a levels pass
Held in reserve (engine change, I do it, not you): a gradient-map tint that
gives colored shadows instead of just dimming. We validate the plain multiply
on the first wing set first; if shadows go muddy on the PALE palettes (Wax
Paper, Bone, Crushed Foil), that is the signal to switch me on to it.

## TOOL ROLES
- ChatGPT (text): art director + prompt engine. Holds the style block, emits
  prompts, and can write the palette work. All offline.
- Midjourney: style lock (--sref) + the painterly source.
- gpt-image (inside ChatGPT): transparent PNG export + single-part fixes.
  GOTCHA: gpt-image-2 (2026-04-21) dropped transparency; use gpt-image-1/1.5
  or chatgpt-image-latest. Trust the DOWNLOADED png, not the UI checkerboard.

## STYLE BLOCK (paste into ChatGPT / reuse verbatim)
> "Clean flat vector insect part, strict side profile facing right, bold
> uniform dark outline, two flat shaded tone bands plus a small highlight, no
> gradients, single light source upper-left, matte, centered, isolated
> object, solid flat neutral-grey background, no scene, no text, no drop
> shadow, no cast shadow, grayscale value study."

## COPY-PASTEABLE MIDJOURNEY PROMPTS
Replace SREF with the game code. Keep SREF, --sw, --style raw, --stylize
IDENTICAL across the whole game; change only the noun and --seed.

Wing (256x128 = 2:1):
```
a single insect wing, side profile facing right, isolated object, centered, solid grey background, clean flat vector mascot style, bold uniform dark outline, two flat tone bands plus small highlight, no gradients, single light upper-left, grayscale value study --ar 2:1 --sref SREF --sw 200 --stylize 60 --style raw --seed 4001 --no insect body, head, legs, antennae, shadow, drop shadow, text, watermark, grid, multiple wings, color
```
Body / thorax+abdomen (200x100 = 2:1):
```
a single beetle thorax and abdomen, no head, no legs, no wings, side profile facing right, isolated, centered, solid grey background, clean flat vector mascot style, bold uniform dark outline, two flat tone bands plus small highlight, no gradients, single light upper-left, grayscale value study --ar 2:1 --sref SREF --sw 200 --stylize 60 --style raw --seed 4002 --no head, legs, wings, antennae, shadow, drop shadow, text, color
```
Head / mandibles (96x96 = 1:1):
```
a single insect head with mandibles, side profile facing right, isolated, centered, solid grey background, clean flat vector mascot style, bold uniform dark outline, two flat tone bands plus small highlight, no gradients, single light upper-left, grayscale value study --ar 1:1 --sref SREF --sw 200 --stylize 60 --style raw --seed 4003 --no body, legs, wings, antennae, shadow, text, color
```
Pattern (200x100 = 2:1, markings only, thinner lines):
```
surface markings for an insect back, spots and bands, side view, isolated on solid grey, clean flat vector, dark marks only, no outline box, no gradients, grayscale --ar 2:1 --sref SREF --sw 200 --stylize 60 --style raw --seed 4004 --no insect, body, legs, wings, head, text, color
```
Consistency tricks: ONE --sref for the whole game (never mix codes between
banks); --style raw + low --stylize to stop MJ auto-beautifying; aggressive
--no shadow/color; generate a bank in one session. To extend a bank later,
reuse the identical code.

## PROCESS PER PART
1. Generate with the prompt above (contact sheet to find shapes fast, then
   re-generate winners individually for clean isolated parts; do NOT slice a
   contact sheet straight onto the fixed canvas).
2. Transparent export via gpt-image ("output each part on transparent
   background, same line weight and shading as the reference"), or rembg, or
   Midjourney Editor Smart Select + Erase Background.
3. Convert to grayscale master (values above).
4. Normalize onto the fixed canvas with the connection point bled to the pivot
   edge, no margin on that side.
5. Drop into `assets/<layer>/raw/` and run `npm run <layer>` (wings/bodies/
   heads/patterns), or `npm run art` for all. Then `npm run <layer>:contact`
   and open the preview. Then `npm run smoke`.
6. Frozen and deterministic from there: hash -> index -> file.

## FIRST STEP (this week — de-risk before mass production)
Produce ONE cohesive WING set of 6-8 grayscale masters and run it end to end.
Wings first: most visible, most varied, worst current offenders. If the fix
reads on wings, it reads everywhere.
1. Mint the game --sref and save it above. Getting this right is the week's
   real deliverable.
2. Generate 6-8 wings with the wing prompt, grayscale, facing right, isolated.
3. Transparent-export, convert to masters, normalize to 256x128 @ root [24,64].
4. Drop in `assets/wings/raw/`, `npm run wings`, judge across a PALETTE SWEEP
   (I will build a phone view that shows one wing under all 28 schemes).
5. If it reads as drawn/shaded/cohesive across the sweep, scale to bodies,
   heads, patterns. If not, you spent one bank's effort, not the whole game's.

## ENGINE TODOs (mine, triggered by real art landing)
- Re-tune per-layer tint assignment: head is currently tinted by the palette
  DARK color, which crushes a shaded head to mud. Reassign once parts shade.
- Extend the un-tinted highlight layer (the fixed eye-shine dot already proves
  it) for veins/specular the multiply can never brighten.
- Add a smoke guard that master PNGs are non-flat (grayscale variance above a
  threshold) so nobody reintroduces white silhouettes. (Can only add once real
  masters replace the flat placeholders.)
- Optional: gradient-map tint for colored shadows (the reserve upgrade above).
