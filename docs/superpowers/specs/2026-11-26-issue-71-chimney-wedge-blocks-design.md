# Chimney Wedge Blocks (#71) - Design

**Issue:** #71 `feat(targets): draw chimney blocks as wedges so the ring has no dark gaps`
**Date:** 2026-11-26
**Mode:** quick enrichment (decisions recorded as assumptions, no interview)

## Problem

After #64 the chimney still looks like a checkerboard: dark patches between the blocks of
every ring. The first fix, a mortar tube inside the shaft (PR #73, closed), only closed the
gaps seen head-on. From any other angle the patches stayed.

## Cause

`addRing` (`targets/chimney.js:59-71`) makes each ring block a straight box with
`hx = (radius - wall) * tan(pi/segments) - clearance`. That is exactly the right width at the
inner face only. Neighbouring boxes touch at the inner corners and fan apart towards the
outside, so a V-shaped slit opens between them. From off-axis you see the shaded radial side
faces of the boxes, which are the dark patches.

## Design

Draw each block as a **wedge** (annular-sector prism with flat faces): the inner face keeps
today's width, the outer face is as wide as the outer circumference allows. Neighbours then
meet along their side faces, minus the existing tiny clearance. **Physics stays a box**:
collider, layout, masses and the #58 tuning are untouched. Only the render mesh changes.

### Pure helpers (`targets/chimney.js`)

- `wedgeProfile(box)` returns `{ innerHx, outerHx, hy, hz, taper }`:
  - `innerHx = box.hx` (unchanged),
  - `outerHx = box.hx + 2 * box.hz * tan(pi / segments)`. Derivation: the inner face sits at
    `radius - wall`, the outer at `radius + wall`, `hz = wall`, and
    `hx = (radius - wall) * t - clearance`, so the outer half-width is
    `(radius + wall) * t - clearance = hx + 2 * wall * t`,
  - `taper = outerHx / innerHx` (> 1, depends only on the course).
- `wedgeFaces(taper)` returns flat arrays `{ positions, normals, uvs }`, non-indexed
  (36 vertices, 6 faces x 2 triangles), in the unit frame of the box mesh: x, y, z each in
  [-0.5, 0.5] at the inner face, local z = +0.5 is the outer face with half-width
  `0.5 * taper`. `index.html` scales the mesh by `(2hx, 2hy, 2hz)` exactly as it does for the
  box, so the inner face, height and depth equal the box and the wedge is centred like it.
- Normals are true surface normals of the unit-frame faces (three.js derives the correct
  normals under the non-uniform mesh scale). Faces are wound counter-clockwise seen from
  outside.
- UVs: every face maps the full 0..1 range, as `BoxGeometry` did. The outer face (+z) shows
  the #64 brick texture the same way it did on the box: two courses, running bond by block.
  The inner and the two side faces keep the stretched texture as before (barely visible).

### Wiring (`index.html`)

- `addBlock(..., rz, geo = unitBoxGeo)`: one optional trailing parameter, used as the mesh
  geometry. No other change; mesh-to-body sync is untouched.
- `wedgeGeo(taper)`: builds a `THREE.BufferGeometry` from `wedgeFaces`, cached in a
  module-scope `Map` keyed by `taper.toFixed(4)`. At most 43 geometries (one per course),
  shared by the 12 blocks of a ring.
- `setupChimney` passes `wedgeGeo(wedgeProfile(b).taper)`.
- No dispose: `unitBoxGeo` and all other shared geometries are module-scope and never
  disposed, and `clearTargets` does not dispose block meshes. The cache follows that.

### Collapse

Once blocks fly apart they look like wedge bricks, which is fine. The outer corners of a
wedge stick out of the box collider by `2 * hz * tan(pi/12)` (about 0.2 at the foot) in
tangential direction; this is visual only and sits inside the neighbour's footprint
before the collapse.

## Out of scope

Collider shape, layout, masses, #58 tuning, the brick texture, other targets, the
mortar core of PR #73 (superseded).

## Test plan

- `node --test test/*.test.mjs`: new tests for `wedgeProfile` and `wedgeFaces`.
- Neighbour test: outer corners of adjacent ring blocks of a real layout meet (gap < 0.01).
- Manual: chimney in the browser from the side and from above: no dark checkerboard.

## Outcome (PR #74)

The outer face is about 1.6× wider than the box face, and its UVs still run 0..1, so the
#64 texture is stretched horizontally: drawn bricks are about 6.1:1 at the foot and 3.5:1 at
the top (instead of 3.8 and 2.2), and head joints are a bit wider than bed joints. A headless
screenshot showed this reads as natural, elongated brickwork with no checkerboard, and the
user chose to keep it. `visibleBrickAspect` now measures the drawn outer face, and its tests
pin 6.10 / 3.54.
