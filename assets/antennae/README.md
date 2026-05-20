# Antennae for Litter Bug

Antennae are **procedural** — two thin bezier curves drawn at render
time from `antennae.json` parameters. No PNG art, no drop folder.

## Entry shape (antennae.json)

```json
{
  "name": "Threadlike",
  "length": 24,
  "curl": 0.4,
  "thickness": 1.5,
  "shape": "straight",
  "spread": 30,
  "rarity": "common"
}
```

| Field | Type | Meaning |
|---|---|---|
| `name` | string | Display name |
| `length` | number | Antenna length in viewBox px (14-40) |
| `curl` | number | 0..1, how much the midpoint pulls back/in |
| `thickness` | number | Stroke width (1-2.5) |
| `shape` | string | `straight` / `curved` / `club-tipped` / `feathered` / `bent` |
| `spread` | number | Angle in degrees between the two antennae (10-50) |
| `rarity` | string | `common` / `uncommon` / `rare` / `epic` |

## Workflow

Same as legs. Edit `antennae.json`, then:

```
npm run antennae
```

## See also

- `assets/legs/README.md` — same procedural pattern
- `scripts/art-layers.js`
