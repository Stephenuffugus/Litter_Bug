# LITTER BUG art asset list

Written Sep 05 2026 from the fleet art audit (Sep 04, every game shot at 375x667 and looked at) and
the games pass that followed. This is the ask for the image lane. Finished files go in
`docs/art-lists/litter-bug/` under the names below; say which landed and the code side wires them.

## Conventions, read once
- Sizes in the rows are written at 1x, the size the game shows them at. Deliver full bleed plates at
  900x1600 portrait (a row that says 540x960 means that file at 900x1600) and everything else at twice
  the size the row names. Never a side over 1600 px: the host's image optimizer resizes anything bigger
  on the way out, so a 1080x1920 plate would arrive at 900x1600 anyway, resampled by a stranger.
- PNG with alpha for anything that sits on the game (pieces, parts, tiles, frames, tokens); JPG or
  WebP for full bleed plates. Your master goes in the vault and the web copy is cut under a new
  name; nothing you send is ever overwritten or shrunk in place.
- Style anchors: the midnight greenhouse palette (deep blacks, sage #7ab356, gold #c8a84b, cream
  #e8dcc8) unless the row names its own, one light direction (upper left), no text baked into a
  plate unless the row asks for it, no real trademarks or mascots, generated art is never called
  hand painted.
- The "replaces" column says what is on screen today and what the file unlocks. Rows are in the
  order they change the most.

**Game:** `litter-bug` · satellite · action · audit impact 4/5 · effort M · audit rank 39

Vendored into the arcade at `satellites/litter-bug/` (the copy there is byte identical; edit here and re-vendor).

## Background wanted

bg-alley-540x960.jpg behind every text screen, at a strength you can actually see: brick, dumpster and chain-fence silhouettes, one warm sodium lamp, near-black ground. Turn the existing scrim down so the place is felt instead of erased.

## Files

| file | spec | replaces |
|---|---|---|
| `bg-alley-900x1600.jpg` | 900x1600 painted night alley in the composition the drawn one now sets: brick wall with two lit windows, a green dumpster left with the lid up and a black cat on it, a chain link fence panel right, one sodium lamp top right with a puddle under it, a fire escape at the far left, trash bags and a box, near black ground band across the bottom third so cream copy reads over it | the SVG alley drawn in `alleyMarkup()` that sits behind every screen and on the HOME card; the drawing is honest but flat |
| `trial-chute-988x1480.jpg` | 988x1480 (2x the 494x740 field), a steel sorting chute seen from above: a hopper mouth at the top stencilled RECYCLING, two rails, a ribbed belt running down the middle, brick either side, a lamp glow top right, the belt darkening into three bin mouths at the bottom | `chuteScene()` in Sort the Recycling |
| `trial-heap-988x1480.jpg` | 988x1480, the inside of a dumpster: green steel walls with rust drips, the rim across the top with lamp light spilling under it, two mounds of bags and boxes rising from the bottom, a tyre and a crate half buried, everything in the grey blue heap tones so 56px junk silhouettes and a green grub read on it | `heapScene()` in Grub Hunt |
| `trial-wall-988x1480.jpg` | 988x1480, a brick wall with a junction box top centre (hazard stripe, a small LIVE plate), conduit running across and down both sides, cable clips, a vignette; nothing busy in the middle third where the cables and sockets are drawn | `wallScene()` in Wire Untangle |
| `trial-shelf-988x1480.jpg` | 988x1480, brick wall with a warm lamp pool at the top and a worn pine plank across the bottom 60px with brackets; the middle stays plain for the lid | `shelfScene()` in Pry the Lids |
| `lid-640x640.png` | 640x640 transparent, a tin lid seen from above: steel with a brushed radial sheen, a raised rim, a dark seam groove at 62% of the radius, a printed label ALLEY PRESERVES in the centre; no seam highlight (the code draws the gold arc) | `lidSVG()`, the gradient lid |
| `jar-88x124.png` | 88x124 transparent, an open glass jar with its lid leaning off, a little light in the glass | `jarSVG()`, one per lid levered off on the plank |
| `dumpster-locked-520x360.png` | 520x360 transparent, a closed green dumpster with a padlock and chain on the lid, BUGS ONLY stencilled on the side, wheels, a trash bag beside it, lamp glow top right | `dumpsterLockSVG()` on the locked Dumpster screen |
| `bug-style-hero-1024x1024.png` | ONE painted hero bug in the game palette (rust, moss, spark, ooze, glass, ash) at 1024, cel shaded, flat vector look, facing right: this is the style reference every traced part will follow; not shipped, traced | nothing yet; the bugs are procedural SVG (`_generateBugSVG`) and stay procedural, the hero sets the `--sref` and the part vocabulary (see `PART_CATALOG.md` upstream). The 24 PNGs in assets/heads, bodies, patterns are generated ellipses and are not used by the game |

_9 files._
