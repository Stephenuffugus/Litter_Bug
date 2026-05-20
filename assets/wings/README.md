# Wing art for Litter Bug

This is the bug wing bank. Every bug in the game picks one of these
PNGs by hash, then the lab tints it to match the bug's palette. You can
add new wings two ways: drop art into `raw/`, or wire procedural
silhouettes into `scripts/gen-wings.js`. Either way, the pipeline that
ships the wing to the lab is the same.

## File format the lab expects

| Property | Required | Default |
|---|---|---|
| Format | yes | PNG with alpha channel |
| Dimensions | yes | 256 × 128 (the import script normalizes anything that isn't this) |
| Background | yes | Transparent |
| Body fill | yes | Solid white if you want the in-game tint to work, full color if you don't |
| Attachment point | yes | (24, 64) in PNG pixels: where the wing meets the body |
| Naming | yes | Filename in `assets/wings/` is always `wing-NN.png` (assigned by import script) |

If your art uses a non-default attachment point, edit `wings.json`
after import and set `attachment: [x, y]`.

If your art is already colored (i.e. NOT a white silhouette), set
`tintable: false` in `wings.json` so the lab doesn't tint it. Otherwise
the in-game color tint will overwrite your colors.

## The drop-folder workflow

1. Save your wing as a PNG with transparent background. White silhouette
   if you want palette tinting; colored art if you want it as-authored.
2. Drop the PNG into `assets/wings/raw/`. Filename becomes the wing's
   display name: `dragonfly-iridescent.png` → "Dragonfly Iridescent".
3. From the repo root:
   ```
   node scripts/import-art.js wings
   ```
4. The script:
   - normalizes the PNG to 256×128 transparent
   - assigns the next available `wing-NN.png` slot
   - moves the file from `raw/` into `assets/wings/`
   - updates `wings.json` with default metadata
   - patches the `WING_BANK` array in `bug-lab.html`
5. Visually review:
   ```
   node scripts/contact-sheet.js
   ```
   This writes `assets/wings/contact-sheet.png` showing every wing
   labeled with its filename, rarity, and tintable flag.
6. Run smoke:
   ```
   npm run smoke
   ```
7. Commit. Show the bug-lab on your phone.

## The procedural-placeholder workflow

If you want to add a stand-in wing that's not real art yet (an SVG
silhouette you write by hand), edit `scripts/gen-wings.js`, add an
entry to its `WINGS` array, then run:

```
node scripts/gen-wings.js && node scripts/import-art.js wings
```

That regenerates the placeholder PNG and refreshes the catalog.

## AI generation: FLUX, Midjourney, etc.

The fastest way to get real-looking wing art is to generate it with an
image model, then post-process. Tested prompts that produce
lab-compatible silhouettes:

### FLUX (Schnell or Dev)

```
white insect wing silhouette on transparent background,
side view, body attachment at left edge,
single wing, no body or head, no shadow, no background,
crisp clean vector edges, centered, 2:1 aspect ratio
--ar 2:1
```

Variations by adding one tag from each row:
- shape: `rounded` / `pointed` / `lobed` / `triangular` / `crescent` / `swept` / `compound`
- texture: `smooth` / `veined` / `feathered` / `serrated`
- mood: `moth` / `dragonfly` / `cicada` / `mayfly` / `beetle elytron`

### Midjourney

```
/imagine insect wing silhouette, white on transparent,
side view, attachment at left, single wing,
clean vector edges, 2:1 aspect --no body --no head --no background
```

### Post-process

Whatever tool you use, the output usually needs three things before it
goes in `raw/`:

1. **Background removal.** If the tool didn't deliver true transparency,
   use rembg, Photoshop > Magic Wand, or Photopea's auto-remove. The
   lab will composite incorrectly on non-transparent input.
2. **Crop to wing bounds.** Trim away whitespace so the attachment
   point sits near `x=24, y=64` of the cropped image.
3. **Convert to white silhouette** (if you want tinting). Threshold the
   alpha channel: any non-transparent pixel becomes `#FFFFFF`, alpha
   preserved. ImageMagick:
   ```
   magick input.png -fuzz 0% -fill white -opaque '#000000' -channel A -threshold 1% output.png
   ```
   Or in Photoshop: lock alpha → fill white.

If you skip step 3, set `tintable: false` in `wings.json` after import
and the wing will render at its authored colors.

## Licensing

Everything in `assets/wings/` ships with the game. Only commit art you
have the right to ship. AI-generated art is fine if the tool's TOS
allows commercial use (FLUX permissive, Midjourney requires paid tier
for commercial). Hand-drawn art: assume you own it. Art commissioned
from someone else: keep the receipt.

## Conventions for future reviewers

- `name` field is what shows up in UI. Capitalize Like This.
- `rarity` field: `common` / `uncommon` / `rare` / `epic` for v1. Add
  more tiers only when the game economy actually uses them.
- Don't manually rename `wing-NN.png` files. The import script assigns
  slots; renaming will desync `wings.json` and `bug-lab.html`.
- `wings.json` is the source of truth for metadata. The lab's
  `WING_BANK` is generated from it. Edit `wings.json`, then run
  `node scripts/import-art.js wings` (or `npm run wings`) to re-patch
  the lab.

## See also

The same drop-folder pipeline applies to other PNG layers:

- `assets/bodies/` — bug body silhouettes
- `assets/heads/` — head silhouettes
- `assets/patterns/` — surface texture overlays

Each has its own README. The mechanics (drop in `raw/`, run
`npm run <layer>`, review `contact-sheet.png`, commit) are identical.
Run `npm run art` to import all layers at once.
