# Elongated Chimney Bricks (#64) — Design

**Issue:** #64 `feat(targets): elongated chimney bricks`
**Date:** 2026-11-25
**Mode:** quick enrichment (decisions recorded as assumptions, no interview)

## Problem

Playtest feedback: "Die Ziegelsteine beim Kamin sollen natürlicher sein, also länglich."

Each physics body of the chimney (#55, reshaped in #58) is drawn as one brick. The body is
`2·hx` long and `courseHeight` = 0.35 high (base units). Measured from `chimneyLayout()`:

| Position | Body length `2·hx` | Height | Visible length : height |
|---|---|---|---|
| Foot (course 0) | 0.666 | 0.35 | 1.90 |
| Top (course 42) | 0.378 | 0.35 | 1.08 |

The top bricks are almost square. A real stretcher face is about 3 : 1 (215 × 65 mm).

The texture is `makeBrickTexture()` in `index.html:889-904`: a 128 × 64 canvas, one brick
rectangle inside a 5 px mortar frame. `addBlock()` (`index.html:688-709`) draws every block
with the shared `unitBoxGeo` (`index.html:679`) scaled per body, so each face maps the full
texture once (UV 0..1), whatever the body size.

## Options weighed

1. **More segments per ring.** Makes bricks *shorter*, not longer (16 segments: foot length
   about 0.50). Rejected.
2. **Fewer segments per ring** (e.g. 8). Longer bricks, but a coarse octagonal shaft and a
   change to the geometry #58 tuned (segments 10 and 13 were tried there and did not help
   the topple check). Rejected.
3. **Lower courses** (0.175 instead of 0.35, 86 courses). Doubles the body count from 516
   to 1032, and the #58 stability and topple checks would have to be re-tuned. On phones
   and under swiftshader (the pipeline's harness runs) that is the expensive path; the #58
   run already hit the 30-minute wall-clock cap with 516 bodies. Rejected.
4. **Visual only (chosen).** Keep all 516 bodies and the tuned physics unchanged. Draw each
   body's texture as **two courses of bricks** with a horizontal mortar joint in the
   middle. Visible brick ratio becomes 3.80 : 1 at the foot and 2.16 : 1 at the top.

Three courses per body was also considered: 5.7 : 1 at the foot is longer than any real
brick, so two it is.

## Design

### Layout module (`targets/chimney.js`, pure, no DOM)

- New constant `CHIMNEY.faceRows: 2` — brick courses drawn on one body's face.
- New pure function `brickFaceRects(width, height, rows, joint)` returns the brick
  rectangles `{ x, y, w, h }` (canvas pixels) of one texture:
  - a mortar frame of `joint / 2` on every edge (two bodies side by side then show one
    full `joint` between them, the same as the joint inside a body),
  - `rows` bricks of equal height, separated by full `joint` gaps,
  - each brick spans the full width minus the frame (head joints stay at the body edges,
    so the running bond between courses is unchanged).
- New pure function `visibleBrickAspect(box)` = `2·hx / (2·hy / faceRows)`.

### Texture (`index.html`)

`makeBrickTexture(brick, mortar)` draws on a 256 × 128 canvas (double resolution, so the
thinner joints stay crisp): mortar fill, then one fill per rect from
`brickFaceRects(256, 128, CHIMNEY.faceRows, 8)`. Every second row gets a light dark overlay
(`rgba(0,0,0,0.07)`) so the two bricks in one body read as separate bricks. The speckle
noise stays (seeded, scaled to the new canvas, kept inside the brick rects).
Tints, soot materials and `chimneyMatl()` stay as they are.

On the top and bottom faces the middle joint runs along the brick length; it reads as a
wall of two wythes, which is acceptable for a chimney.

### Unchanged

`CHIMNEY` geometry constants, `chimneyLayout()`, body count 516, `addBlock`, physics
materials, damping, sleep values, camera, harness. `test/harness/chimney.html` imports
only the layout and does not use the texture, so its result cannot change; no harness run
is needed.

## Acceptance

- Unit tests: rect count = `faceRows`, equal row heights, frame `joint / 2`, inner gaps
  `joint`, rects inside the canvas; visible aspect between 2.0 and 4.0 for every body;
  all existing chimney tests (516 bodies, no overlaps, support, height 15.05) still pass.
- The chimney in the game shows two brick courses per body (visual check of one screenshot).
- CHANGELOG `[Unreleased]` entry.

## Risks

- Mesh UVs: `BoxGeometry` maps each face 0..1 with `v` along local y on the four side
  faces, so the middle joint is horizontal on the outer, inner and head faces.
- Texture memory: 6 textures of 256 × 128 instead of 128 × 64, negligible.
