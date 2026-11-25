# Brick industrial chimney (#55)

## Intent

A tall factory chimney of red brick as a new destructible target in Barrel Blast: a square
stone footing, a round shaft that tapers toward the top, a soot-blackened crown with a
corbelled rim. It stands twice as high as the Cylinder tower and reads as brickwork from
the first glance: running-bond courses, visible mortar joints, slightly varied brick tints.

When it is hit low, the shaft above should lean and come down the way real chimneys do in
demolition films: the column tips sideways and breaks into pieces on the way, instead of
telescoping straight down or bursting from a light touch. That behaviour emerges from the
bricks being individual rigid bodies with the existing masonry friction, so the chimney
needs no new physics, no new material and no constraints.

## Goals

- A **Chimney** entry in the target picker under **Towers**, after Jenga. The mobile sheet
  shows the same list, so nothing else is needed there.
- Built from the existing `addBlock` path (box bodies, material `masonry`,
  `MASONRY_MASS_SCALE`, stone impact sound), at `TSCALE` 2 like every other brick building.
- Looks: brick-red tints with light mortar joints drawn as a texture frame on each brick,
  a grey stone plinth, a soot band and a two-course corbelled crown on top.
- Collapse: a cannonball or two at the foot brings the chimney down; a light ball on the
  shaft only knocks a few bricks. An untouched chimney stands still. These three hold on the
  real crashcat backend and are checked by a browser harness.
- Pure layout module `targets/chimney.js` with unit tests (`node --test test/*.test.mjs`).

## Non-goals

- No smoke plume, no particles, no lightning rod or iron bands.
- No new physics material, no change to `physics/materials.js`, no constraints or glue.
- No new interaction mode (unlike Jenga), no scoring change: the HUD counts `Blocks down`.
- No change to any other target, weapon or the camera code.

## Anti-goals (a failure even if it technically works)

- The chimney sags, creeps or sheds bricks on its own while nobody shoots.
- One tennis ball flattens the whole chimney.
- The shaft stays standing on a single remaining brick, or hangs in mid-air after its base
  is gone (the #9 / #28 class of bugs).

## Shape (decided, builder must follow)

All values in **base units**; `addBlock` multiplies them by `TSCALE` = 2 in the game, so
the world chimney is about 20 m high with 1.3 m bricks at the foot. Constants live in an
exported `CHIMNEY` object; the layout function reads them, the tests read them from there.

| Constant | Value | Meaning |
|---|---|---|
| `segments` | 10 | bricks per ring, constant from bottom to top |
| `shaftCourses` | 24 | ring courses of the shaft |
| `courseHeight` | 0.35 | brick height; course pitch is `courseHeight` exactly (no row gap; see the note below the table) |
| `radiusBottom` / `radiusTop` | 1.3 / 0.75 | centre-line radius of the first and last shaft course; linear in between |
| `wallBottom` / `wallTop` | 0.30 / 0.18 | half wall depth (`hz`) of the first and last shaft course; linear in between |
| `plinthCourses` / `plinthBlock` / `plinthHeight` | 2 / 1.1 / 0.45 | a solid 3×3 grid of stone blocks per course, block pitch `plinthBlock + 0.001` |
| `crownCourses` | 2 | corbelled rim: ring radii `radiusTop + 0.12` and `+ 0.24`, half depths 0.30 and 0.34 |
| `sootCourses` | 3 | the top 3 shaft courses are soot-tinted; the crown always is |
| `clearance` | 0.002 | tangential clearance subtracted from each ring brick's half length |

**Row gap changed in implementation (PR #56).** This spec first set the course pitch to
`courseHeight + 0.001`, like `brickRowPitch`. With 26 stacked courses that gap let the woken
stack settle about 24 mm, which failed the harness's stable check (< 0.02). Courses
now touch exactly (`ROW_GAP = 0` in `targets/chimney.js`), which makes the chimney the only
stacked target without a vertical gap.

Ring brick geometry, copied from `setupCylinder` in `index.html`: course `c` has
`step = 2π / segments`, bricks at angles `a = j·step + (c % 2)·step/2` (running bond), centre
`(R·sin a, y, R·cos a)`, yaw `ry = a`, half length `hx = (R − hz)·tan(step/2) − clearance`,
half height `hy = courseHeight / 2`, half depth `hz`. Local x is tangential, local z radial,
matching the three.js yaw convention used by `test/layout-geometry.mjs`.

The stack, bottom to top: plinth course 0 and 1 (y from 0), then shaft courses 0–23, then
crown courses 0–1, every course resting on the one below (bottom face on the top face of the
course below, within `test/layout-geometry.mjs`'s `isSupported` tolerance). The taper per
course (0.024 in radius, 0.005 in half depth) is far smaller than the wall depth, so each ring
brick overlaps the ring below. The plinth's half width (1.65) exceeds the first ring's outer
radius (1.6), so every brick of shaft course 0 rests on the plinth.

Body count: 18 + 240 + 20 = **278**, below Brick Box (288), the largest existing target.

Each layout box is `{ hx, hy, hz, x, y, z, ry, part, course }` with `part` one of
`'plinth' | 'shaft' | 'crown'` and `course` the 0-based course index within that part.
Mass comes from `massFor(box)` of `targets/apk-layouts.js`, as for every layout building.

## Look (decided)

- **Brick materials:** six `MeshStandardMaterial`s with `roughness` 0.9 and a `map` from
  `makeBrickTexture(brick, mortar)`, a cached 128×64 `CanvasTexture`: the canvas is filled
  with the mortar colour, an inner rectangle inset by 5 px is filled with the brick colour
  and speckled with about 60 small darker and lighter dots at low alpha. Because every face of
  `BoxGeometry` maps the full texture, each brick face gets a mortar frame and the courses
  read as mortar joints, including on the end faces.
  - Shaft tints (mortar `#bfb5a3`): `#9b4a35`, `#a85a40`, `#8c3f2d`, `#b0654a`.
  - Soot tints (mortar `#6a625a`): `#4a3a34`, `#5a4640`.
  - Pick the tint by `(index * 7 + course) % n` so no stripes form, as `setupJenga` does.
- **Plinth:** the existing grey `stoneMatls`, cycled, so the stone footing contrasts with the
  brick shaft.
- **Camera:** `camCfg.chimney = { r: 30, ty: 5, tz: -6, plat: false, build: setupChimney }`.
  The builder checks at 1280×720 that the whole chimney, plinth to crown, is in view with
  some sky above, and adjusts `r`/`ty` if not. The portrait fit (#39) applies on its own.

## Collapse (decided)

No glue, no segment bodies: the bricks are ordinary `addBlock` bodies on `masonry`
contacts. A base hit removes bricks on the near side, the shaft above loses support on that
side, leans toward the shooter and tears apart along the tension side as it falls. That is
the segmented tip-over; the engine produces it, the harness measures it.

Harness `test/harness/chimney.html`, title `CHIMNEY PASS` / `CHIMNEY FAIL`, built like
`test/harness/jenga.html` on the real crashcat backend and the real material table, with the
chimney built exactly as the game builds it (world units: layout × 2, `massFor × 0.25`,
material `masonry`, `startAsleep`, the `addBlock` damping and sleep values), centred at
z = −6, stepping at 1/60 s:

1. **Stable:** wake every brick, run 5 s, expect the largest displacement from home below
   0.02 (world units).
2. **Base hit brings it down:** fire a sphere (material `ball`, mass 9, radius 0.29, the
   cannonball) from z = +12 relative to the chimney centre toward −z at 40 m/s, aimed at the
   height of shaft course 1. One second later fire a second one the same way. Within 12 s of
   the second shot, the mean y of the crown bricks is below 50 % of its home value.
3. **Light hit stays up:** on a fresh chimney, fire a sphere (material `ball`, mass 0.6,
   radius 0.33) at 25 m/s at mid-shaft height. After 6 s the crown's mean y is above 80 % of
   home and fewer than 28 bricks (10 %) have moved more than 0.45 from home (the game's
   `down` threshold).
4. **Tip-over signature (INFO, not required):** during check 2, record the crown's mean
   horizontal distance from the axis at the moment its mean y first drops below 90 % of home.
   Print it. Above 2.0 means the top went sideways (toppled) rather than straight down.

If check 1 or 2 fails, the builder may change only the geometry constants, in this order,
and must re-run the unit tests after each change: `wallBottom`/`wallTop` (thicker walls for
stability, thinner for an easier collapse), then `shaftCourses` (20–26), then `segments`
(8–12). Materials, damping and sleep values stay as they are. If check 3 fails, the chimney
is too flimsy: thicken the wall. Record the final values and the measured numbers in the
harness header comment and in the PR.

## Verification

- `node --test test/*.test.mjs` is green, with the new `test/chimney.test.mjs`: block count
  278, part counts 18/240/20, no overlapping pairs, every block supported, shaft radius
  strictly decreasing course by course, crown wider than the last shaft course, running bond
  (odd courses rotated by half a step), and the top face of the crown at
  `2 × 0.45 + 26 × 0.35 = 10.0` (base units, ±0.01).
- `test/harness/chimney.html` shows `CHIMNEY PASS`; the existing harnesses still pass.
- Screenshots at 1280×720 and 390×844 of the standing chimney, and one mid-collapse after
  two cannonballs at the foot, looked at with the Read tool.
- README targets list and the controls table mention the chimney; CHANGELOG `[Unreleased]`
  → `Added` has a line.

## Left to the builder

- Fine-tuning of the tint hex values and the speckle density, within the texture scheme
  above.
- Camera `r`/`ty` within the framing rule.
- The exact geometry values if the harness forces a change, inside the ranges given.
