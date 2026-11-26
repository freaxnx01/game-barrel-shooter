# Chimney Mortar Core (#71) — Design

**Issue:** #71 `feat(targets): chimney mortar core so the ring gaps read as joints`
**Date:** 2026-11-26
**Mode:** quick enrichment (decisions recorded as assumptions, no interview)

## Problem

After #64 each chimney block shows two long bricks, but the chimney still looks like a
checkerboard: dark patches between the blocks of every ring.

## Confirmed cause

Checked with one 1280x720 screenshot (swiftshader, chimney, zoomed in) and the layout code.

`addRing()` in `targets/chimney.js` gives every block a constant half width
`hx = (radius - wall) * tan(step/2) - clearance`, i.e. the blocks touch at their
**inner** corners. The ring is a 12-gon, so toward the outside the blocks fan apart: the
open wedge between two neighbours is `4 * wall * tan(15 deg)` wide on the outer face.
That is about **0.40 base units at the foot (blocks 0.67 long)** and about 0.24 at the top
(blocks 0.38 long). The wedge is a real see-through slot into the hollow shaft, and the
shaft interior is in shade, so it renders near-black. It is not shadow acne, not the side
faces (the boxes are lit like the front faces), and not the texture (mortar frame is
light `#bfb5a3`). The soot courses at the top are darkest because the gaps there sit
between already dark bricks.

So the issue's idea is right: close the wedge visually with a mortar-coloured surface.

## Design

A visual-only **mortar core**: open tapered cylinders (no physics body) inside the shaft.

- **Radius at mid-wall, not at the inner face.** The wedge is open outward and narrows
  inward. A tube at the inner face would sit 0.2-0.4 deep and look shaded. A tube at the
  mid-wall radius `shaftRadius(course)` is hidden inside the blocks (they are solid
  there) and shows through the wedge at about half depth, where the wedge is still
  `2 * wall * tan(15 deg)` wide. The mortar then reads as a joint filling the slot.
- **Two tubes**, split at the soot boundary: a brick-mortar tube (`#bfb5a3`, the colour
  `makeBrickTexture` uses for brick faces) from the ground to course 37, and a soot-mortar
  tube (`#6a625a`, the soot mortar colour) for the top `sootCourses` courses. So the soot
  band keeps its dark look but the gaps match their neighbours.
- Radius is the linear shaft radius extrapolated to the tube ends (`shaftRadius` is linear
  in the course index), pure helper `chimneyCore()` in `targets/chimney.js`.
- `CylinderGeometry(rTop, rBottom, height, 24, 1, true)`, `MeshStandardMaterial`
  `{ color, roughness: 0.9, side: DoubleSide }`, no shadows cast or received
  (cheap; the blocks already cast the shadows).
- Open top: the gaps in the top face stay dark from directly above. Accepted, the camera
  looks at the chimney from the side and slightly above, and the top view shows the
  hollow shaft, which is what a chimney is.

### Wiring (`index.html`)

- `setupChimney()` builds the two meshes after the blocks, scaled by `TSCALE`, centred at
  `z = -6 * TSCALE`, and stores them in `let chimneyCore = []`.
- `clearTargets()` removes them from the scene and disposes their geometry (the material
  objects are shared module constants, not disposed), then empties the array. The
  meshes are not in `barrels`, so they are not counted as pieces, not synced to a body, not
  picked by weapons or the net.

### Collapse

The wall is hidden as soon as **12 blocks are down** (`CHIMNEY.segments`, one ring's
worth), checked in the existing `if (changed) updateHud()` spot of the frame loop using
the blocks-down count. Reset and target change rebuild everything through `buildTargets()`.
One stray knocked-off brick does not remove the core; a topple always passes 12 within
the first moments, and after that the gaps are dark again, which is the pre-#71 look of
a ruin and fine. Fade-out and per-course splitting were rejected as extra moving parts for
a 30-minute unattended run.

## Not changing

`chimneyLayout()`, `addRing()`, masses, `CHIMNEY` existing constants, `addBlock`, physics,
camera config and `test/harness/chimney.html`. Body count stays 516. No harness runs.

## Tests

Unit tests in `test/chimney.test.mjs` for `chimneyCore()`; the wiring in `index.html` is
checked by one optional screenshot.
