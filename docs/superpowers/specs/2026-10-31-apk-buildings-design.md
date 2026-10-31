# New targets from "Physics Simulation Building Destruction" (#24)

## Intent

The user plays the Android game *Physics Simulation Building Destruction* and wants
its buildings in Barrel Blast. Several of our targets (Spiral Stair, Octagon,
Cylinder, Pyramid, Cards, Bowling, Pole Tower) were already loosely modelled on it.
This adds the ones we don't have yet, and replaces our simplified Spiral Stair with a
faithful one.

The game's APK (v2.1.3, Unity) was unpacked locally. Each building is a prefab of
plain box rigidbodies, all with mass 1. That maps one-to-one onto our `addBlock()`.
The measurements below come from those prefabs. **Nothing from the APK is committed**:
no meshes, textures or block lists. Every building is rebuilt as our own parametric
layout code from the dimensions recorded here.

## Goals

- Add 11 new targets, plus a faithful rebuild of Spiral Stair (12 layouts in all):
  - four frame buildings
  - two brick boxes
  - four gates
  - two spirals: Spiral Stair is rebuilt, Spiral Tower is new
- Every new target stands still at rest: 0 blocks down after 10 s untouched.
- Every new target can be knocked down with the existing weapons.
- Group the target picker (top right) like the ammo picker. It grows from 15 to 26
  buttons and must stay usable.

## Non-goals

- Copying the original game's look:
  - no grey/black-edged materials; new targets use our `stoneMatls`
  - no "weight" slider
  - no "low spec" variants beyond the two spirals
- The original's other buildings (cards, pyramids, pins, cylinders, octagons,
  fortress-like boxes). We already have equivalents.
- i18n. The game is an arcade carve-out with English-only UI.

## Anti-goals

- A building that collapses on its own before the first shot.
- Blocks that start overlapping each other. crashcat pushes overlapping boxes apart
  violently, see the #9 comments in `index.html`.
- Committing extracted APK data (JSON block lists, meshes) to the repo.

## Units

- Measurements below are in **prefab units (u)**. One unit is 0.25 base units in our
  layout code (`APK_UNIT = 0.25`).
- New targets use the default `TSCALE = 2`, so one prefab unit ends up 0.5 m in the
  world.
- The prefabs stand on y = −0.5 u. Our layouts put the ground at y = 0, so a block of
  height h in the bottom course is centred at h/2.

## Layout module (decided)

The layouts live in a new pure module, `targets/apk-layouts.js`, with no THREE and no
physics. Each exported function returns an array of boxes:

```js
{ hx, hy, hz, x, y, z, ry }   // half extents + centre, in base units; ry = yaw in radians
```

- `index.html` turns each box into an `addBlock(...)` call, with the mass from
  `massFor(box)`. The layout code is then unit-testable with `node --test`, and
  nothing about the APK lives in `index.html`.
- **Courses rest on each other:** vertical pitch is height + 0.001, the same rule as
  `brickRowPitch()`.
- **Horizontal neighbours don't overlap:** they keep ≥ 0.001 clearance.

## The buildings

All block sizes are x × y × z in u, listed before rotation.

### Frame buildings (4 targets, one parametric builder)

Posts of 1 × 5 × 1 stand on a square grid with a pitch of 5 u.

Each storey is built from three layers:

1. **Posts.** One per grid point.
2. **Beams along x,** 0.5 high and 1 deep, lying on the post tops along every grid
   line. A beam runs from post centre to post centre (5.0 long). An end bay's beam
   instead reaches the corner post's outer face (5.5 long). With only two bays (3×3
   grid), both bays are end bays.
3. **Beams along z,** the same lengths, lying on the x-beams.

The next storey's posts stand on the z-beams. The storey pitch is 6 u. The building
ends with the top beam layers, with no posts above them.

| Mode id | Button | Source prefab | Grid | Storeys | Blocks |
|---|---|---|---|---|---|
| `frametower` | Frame Tower | `Building1Se` | 3 × 3 | 6 | 126 |
| `frameblock` | Frame Block | `Building4Se` | 4 × 4 | 3 | 120 |
| `framehigh` | Frame High-rise | `BuildingSe` | 4 × 4 | 6 | 240 |
| `framehall` | Frame Hall | `Building3Se` | 5 × 5 | 4 | 260 |

Block count = posts (grid² × storeys) + beams (2 × grid × (grid − 1) × storeys). The
counts above are exact.

### Brick boxes (2 targets, one parametric builder)

Hollow square towers built from bricks of 1.9 × 1 × 0.95, laid lengthwise along their
wall, with 16 or 14 courses. In each course, two opposite walls run full width and
own the corners. The other two fit between them. The owning pair swaps every course,
giving a running bond at the corners.

| Mode id | Button | Source prefab | Wall centre-lines | Bricks per course | Courses | Blocks |
|---|---|---|---|---|---|---|
| `brickbox` | Brick Box | `GameObject1Se` | ±4.5 | 5 + 5 + 4 + 4 = 18 | 16 | 288 |
| `bricktower` | Brick Tower | `GameObjectSe` | ±3.5 | 4 + 4 + 3 + 3 = 14 | 14 | 196 |

- In the owning walls, brick centres sit at a 2 u pitch, symmetric about 0:
  - Brick Box: −4, −2, 0, 2, 4
  - Brick Tower: −3, −1, 1, 3
- The inner walls do the same, one brick fewer.

The counts are exact. There are no openings.

### Spirals (2 targets, one parametric builder)

Spiral Stair replaces today's `setupSpiral()`. Spiral Tower is new.

- **Tread `i`** (i = 0 … N−1):
  - size 2 (tangential) × 1 × 10 (radial)
  - its centre is at radius 4 on angle `i · 30°`, so it reaches from 1 u past the
    axis out to radius 9
  - it sits at height `i` (pitch 1 u)
- The inner ends of the treads stack into the central column, as the current
  `setupSpiral()` already does.
- **Post under tread `i ≥ 1`:**
  - 1 × h × 1, at radius 8 on the same angle
  - h = `i` for i ≤ 11: it stands on the ground
  - h = 11 for i ≥ 12: it stands on tread `i − 12`, directly below
- The 12 posts per turn form the outer ring seen in the user's screenshot (#24).

| Mode id | Button | Source prefab | Treads N | Blocks |
|---|---|---|---|---|
| `spiral` (existing id) | Spiral Stair | `Spiral simple` | 36 (3 turns) | 71 |
| `spiraltower` | Spiral Tower | `Spiral` | 48 (4 turns) | 95 |

### Gates (4 targets)

These are less regular in the prefabs. Rebuild their **structure and size**. Block
counts must land within ±15 % of the original. Crenellation and corbel details are
the builder's call, within the rules under *Layout module*.

**Arch Gate** (`archgate`, source `Gete2`, 311 blocks) and **Double Gate**
(`doublegate`, source `Gete`, 515 blocks):

- **Piers.** Hollow brick piers, about 6 u (x) × 5 u (z) outside, built from bricks
  of 1.8 × 1 × 0.9. Courses 0–8 alternate with half bricks of 0.9 × 1 × 0.9 at the
  corners for the bond.
- **Openings.** Each opening between piers is about 6 u wide.
- **Above the openings:**
  - courses 9–11: slabs of 1.8 × 1 × 3.9 laid across the wall depth bridge each
    opening
  - course 12: a continuous brick course
  - course 13: crenellation slabs of 3.8 × 1 × 1.8
- **Size:**
  - Arch Gate: 2 piers, 1 opening, about 17 × 14 × 5 u
  - Double Gate: 3 piers, 2 openings, about 31 × 14 × 5 u

**Castle Gate** (`castlegate`, source `GateSe`, 352 blocks) and **Small Castle Gate**
(`castlegatesmall`, source `GateSe simple`, 258 blocks):

- **Towers.** Two round towers with ring bricks of 0.95 (radial) × 1 × 1.9
  (tangential), 8 per course, at radius 3. Every other course is rotated by 22.5°.
  Small gaps between ring bricks are part of the look.
- **Wall.** A two-wythe wall runs between the towers:
  - bricks of 1.9 × 1 × 0.95 along x, wythes at z = ±1.5
  - staggered by half a brick per course
  - end caps of 0.95 × 1 × 1.9 across the wall ends, at the towers and at both sides
    of a gate opening about 6 u wide in the middle
- **Corbelled arch.** Over the opening, blocks of 1.9 × 1 × 1.9 each step about 1 u
  further into the opening until it closes. Each corbel must rest at least partly on
  the block below.
- **Wall top.** A walkway of slabs 1.9 × 1 × 3.9 laid across both wythes.
- **Tower top.** One slab of 6.9 × 1 × 1.9 across each tower, two courses below its
  top. The remaining courses of ring bricks form the parapet.
- **Size:**

  | Target | Tower centres | Tower courses | Wall courses | Overall |
  |---|---|---|---|---|
  | Castle Gate | x = ±13.5 | 12 | 10 | 33 × 12 × 6 u |
  | Small Castle Gate | x = ±11.5 | 10 | 8 | 29 × 10 × 6 u |

## Mass (builder's call, recorded)

The prefabs give every block mass 1, regardless of size. We use mass proportional to
volume instead, so a tread outweighs a brick:

```js
massFor(box) = 170 * (2*hx) * (2*hy) * (2*hz)   // in base units
```

170 matches the density of the existing Tower Gate bricks (30 / 0.18). `addBlock()`
still applies `MASONRY_MASS_SCALE` afterwards (#22).

## Target picker (decided by the user)

- Group the target buttons under small headings, styled exactly like `.ammo-group
  .glabel`. Order of groups and buttons:
  - **STACKS:** Barrels, Wooden Barrels, Cards, Bowling
  - **STONE:** Fortress, Colosseum, Pyramid, Gate, Tower Gate, Arch Gate, Double Gate,
    Castle Gate, Small Castle Gate
  - **TOWERS:** Cylinder, Octagon, Pole Tower, Brick Box, Brick Tower
  - **FRAMES:** Spiral Stair, Spiral Tower, Frame Tower, Frame Block, Frame High-rise,
    Frame Hall, Crosses, Eiffel
- Selection, the `sel` highlight and the click handler work unchanged (they key on
  `data-mode`).
- The picker must not overlap the version badge or the ammo picker at 1280 × 720.

## Camera

Each new mode gets a `camCfg` entry. Radius and target height are the builder's call,
with one constraint: the whole building is in view at the start.

## Docs

- **README:** add the new targets to *Switch target* and *Targets*, and credit the
  original game for the building designs.
- **CHANGELOG:** add an `[Unreleased] → Added` entry.

## Calls made after the builder check (mine, not the user's)

- **Placement.**
  - Every new building is centred at x = 0, z = −6 (base units), like the existing
    targets.
  - No platform (`plat: false`). The ground at y = 0.
- **Spiral conventions.**
  - "Height i" means the tread's **bottom** sits at y = i u.
  - Treads turn the same way as today's `setupSpiral()`: the position uses
    `cos(a), sin(a)` and the yaw is `-a`.
  - The old spiral is removed completely: its 20 treads, 4 corner posts and top frame
    beams. The `spiral` mode id stays.
- **The APK numbers are a reference, not a contract.** If a layout won't stand at
  rest, the builder may change sizes or offsets by up to 10 %, for example a slightly
  longer beam bearing on a post. The no-overlap and resting rules may not be dropped.
  Block counts may then differ:
  - frames, brick boxes and spirals: within 5 %
  - gates: still within ±15 %
- **Joints.** Beams in one line meet at a post centre. Shorten each beam by 0.001 so
  they keep the clearance rule.
- **How "stands at rest" is checked.**
  - Automated, in `node --test`: no two boxes overlap, and every box rests on the
    ground or overlaps the top face of a box below it.
  - The physical check, 0 blocks down after 10 s untouched, is part of the manual
    in-browser playtest from the stack overlay.
- **How "can be knocked down" is checked.** Also in that manual playtest: three bombs
  or the wrecking ball bring at least a quarter of each building down. This is the
  same yardstick #22 used to measure the stone buildings.
- **Performance.** There is no body budget. Double Gate (≈ 515) is the largest target.
  If it visibly stutters when it collapses, the builder uses the lower end of the
  ±15 % range.
- **Reference images.** Gate pictures from the APK are not committed. The structure
  description above is the reference.

## Left to the builder

- Exact crenellation and corbel steps on the four gates, within ±15 % block count.
- Camera radius and height per mode.
- How `index.html` maps a layout to `addBlock` calls. One shared helper is expected.
