# Body art for Litter Bug

Bug bodies are PNG silhouettes that get tinted to each bug's primary
palette color at render time. Same drop-folder pipeline as wings;
different dimensions and a different default attachment point.

## File format the lab expects

| Property | Required | Default |
|---|---|---|
| Format | yes | PNG with alpha channel |
| Dimensions | yes | 200 × 100 (the import script normalizes anything that isn't this) |
| Background | yes | Transparent |
| Body fill | yes | Solid white if you want palette tinting; full color if not |
| Orientation | yes | Head end on the right (x = 200), tail end on the left (x = 0) |
| Attachment point | yes | (200, 50) by default — right edge, vertical center, where the head bolts on |
| Naming | yes | `body-NN.png` (assigned by import script) |

If your body has a non-default attachment point (e.g. the head sits
mid-body for some weird design), edit `bodies.json` after import and
set `attachment: [x, y]`.

If your art is already colored, set `tintable: false` in `bodies.json`.

## Drop-folder workflow

1. Save your body as a PNG with transparent background, head on the
   right.
2. Drop the PNG into `assets/bodies/raw/`. Filename becomes the
   display name: `weevil-armored.png` → "Weevil Armored".
3. From repo root:
   ```
   npm run bodies
   ```
4. Then preview:
   ```
   npm run bodies:contact
   ```
5. Smoke and commit.

## Procedural placeholder workflow

Edit `scripts/gen-bodies.js` to add or change inline SVG silhouettes,
then:

```
npm run bodies:gen
```

That regenerates the placeholder PNGs and refreshes the catalog.

## AI generation prompts

### FLUX (Schnell or Dev)

```
white insect body silhouette on transparent background,
top-down view, head end on the right, tail end on the left,
single body only, no head, no legs, no wings, no shadow,
crisp clean vector edges, centered, 2:1 aspect ratio
--ar 2:1
```

Variation tags (combine one from each row):
- shape: `oval` / `slender` / `plump` / `segmented` / `tapered` / `round` / `elongated` / `compact`
- texture: `smooth` / `chitinous` / `furry` / `armored`
- inspiration: `moth` / `beetle` / `mantis` / `bee` / `dragonfly` / `weevil` / `cicada`

### Midjourney

```
/imagine insect body silhouette top-down, white on transparent,
head right, tail left, single body, clean vector edges, 2:1 aspect
--no head --no legs --no wings --no background
```

### Post-process (same as wings)

1. Background removal if not already transparent (rembg, Photoshop).
2. Crop so the head attachment sits near x = 200, y = 50 of a 200x100
   canvas.
3. Threshold to white silhouette for tinting:
   ```
   magick input.png -fuzz 0% -fill white -opaque '#000000' -channel A -threshold 1% output.png
   ```

If you skip step 3, set `tintable: false` after import.

## See also

- `assets/wings/README.md` — same pipeline, different layer
- `scripts/art-layers.js` — registry of every layer's dimensions and attachment
