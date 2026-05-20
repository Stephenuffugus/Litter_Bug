# Legs for Litter Bug

Legs are **procedural** — they're drawn as inline SVG line strokes at
render time, not PNG art. Six (or eight) thin lines emerging from the
body's underside. No drop-folder workflow; you edit `legs.json`.

## Why procedural

Line art (1-3px strokes) doesn't rasterize cleanly at the lab's
display sizes. PNG legs would look blurry on phones. Inline SVG keeps
crisp at any zoom and lets the in-game palette drive color.

## Entry shape (legs.json)

```json
{
  "name": "Sprinter",
  "count": 6,
  "length": 22,
  "segments": 2,
  "thickness": 2.5,
  "pose": "spread",
  "rarity": "common"
}
```

| Field | Type | Meaning |
|---|---|---|
| `name` | string | Display name. Capitalize Like This. |
| `count` | number | 6 for insects, 8 for arachnid-style |
| `length` | number | Leg length in viewBox px (12-30) |
| `segments` | number | 1 = straight, 2 = one joint, 3 = two joints |
| `thickness` | number | Stroke width (1.5-3.5) |
| `pose` | string | `spread` / `forward` / `low` / `splayed` — how legs angle from body |
| `rarity` | string | `common` / `uncommon` / `rare` / `epic` |

## Workflow

To add a new leg-set, edit `legs.json` directly (or add an entry to
`scripts/gen-legs.js` and re-run). Then:

```
npm run legs
```

That re-patches `LEG_BANK` in `bug-lab.html` from the JSON. Smoke
covers the catalog↔bank alignment.

To regenerate placeholders (destroys user edits to the placeholder
entries; preserves any new entries you added):

```
npm run legs:gen
```

## See also

- `assets/antennae/README.md` — same procedural pattern for antennae
- `scripts/art-layers.js` — layer config (legs marked `kind: 'procedural'`)
