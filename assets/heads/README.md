# Head art for Litter Bug

Bug heads sit on the body's right-end attachment point. PNG silhouettes
tinted to the bug's dark palette color, so eyes and mandibles read as
shadowed accents against the bug's main body color.

## File format the lab expects

| Property | Required | Default |
|---|---|---|
| Format | yes | PNG with alpha channel |
| Dimensions | yes | 96 × 96 (the import script normalizes anything that isn't this) |
| Background | yes | Transparent |
| Fill | yes | White silhouette if you want tinting; full color if not |
| Orientation | yes | Face on the right (head looks +x), neck/attachment on the left |
| Attachment point | yes | (0, 48) — left-middle, where the head meets the body |
| Naming | yes | `head-NN.png` (assigned by import script) |

## Drop-folder workflow

1. Save head art as PNG with transparent background, face pointing right.
2. Drop into `assets/heads/raw/`.
3. `npm run heads`
4. `npm run heads:contact` to review.
5. Smoke and commit.

## AI generation prompts

### FLUX

```
white insect head silhouette on transparent background,
side or three-quarter view, face on the right, neck on the left,
single head only, no body, no shoulders, no antennae,
crisp clean vector edges, 1:1 aspect ratio
--ar 1:1
```

Variation tags:
- shape: `round` / `triangular` / `bulbous` / `squared` / `pointed` / `broad` / `compact` / `heart-shaped`
- features: `compound eyes` / `mandibles` / `proboscis` / `no eyes`
- inspiration: `bee` / `mantis` / `beetle` / `weevil` / `fly`

### Midjourney

```
/imagine insect head silhouette, white on transparent,
face right, neck left, single head, clean vector edges
--ar 1:1 --no body --no antennae --no background
```

### Post-process

Same conventions as wings and bodies: transparent background, optional
white-silhouette threshold for tinting, crop so attachment lands at
(0, 48) of a 96x96 canvas.

## See also

- `assets/wings/README.md`
- `assets/bodies/README.md`
- `scripts/art-layers.js`
