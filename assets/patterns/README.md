# Pattern art for Litter Bug

Patterns are surface-texture overlays that sit on top of the body
silhouette. White on transparent at 200x100, tinted to the bug's dark
palette color so markings read as shadows on the body. Same drop-folder
pipeline as wings, bodies, heads.

## File format the lab expects

| Property | Required | Default |
|---|---|---|
| Format | yes | PNG with alpha channel |
| Dimensions | yes | 200 × 100 (matches body) |
| Background | yes | Transparent |
| Fill | yes | White marks if you want tinting; full color if not |
| Coverage | recommended | Stay inside roughly x=30..170, y=20..80 so the pattern doesn't spill past typical body silhouettes |
| Naming | yes | `pattern-NN.png` (assigned by import script) |

## Drop-folder workflow

1. Save pattern PNG with transparent background.
2. Drop into `assets/patterns/raw/`.
3. `npm run patterns`
4. `npm run patterns:contact` to review.
5. Smoke and commit.

## AI generation prompts

### FLUX

```
white insect surface pattern on transparent background,
top-down view, decorative markings inside body bounds,
stripes / spots / chevrons / swirls,
no body silhouette, only the markings,
crisp vector edges, 2:1 aspect ratio
--ar 2:1
```

Variation tags:
- pattern: `stripes` / `spots` / `bands` / `eyespots` / `speckles` / `dashes` / `swirls` / `chevrons`
- density: `sparse` / `dense` / `clustered`
- inspiration: `ladybug` / `tiger moth` / `cicada` / `dragonfly`

### Midjourney

```
/imagine insect surface markings, white on transparent,
top-down, 2:1 --no body --no silhouette --no background
```

### Post-process

Same as the other layers: transparent background, threshold to white
for tinting if you want palette-driven color, crop to 200x100 with
markings inside the safe zone (30..170 horizontal, 20..80 vertical).

## Layer ordering note

Patterns render between the body and the head in `_generateBugSVG`:

```
defs → wings → legs → body → pattern → head → antennae
```

So the pattern sits on the body but the head covers it. Keep
markings in the body interior, not the head area, or they'll be
hidden.

## See also

- `assets/bodies/README.md` — patterns overlay onto this
- `scripts/art-layers.js`
