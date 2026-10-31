# APK Building Targets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 11 new destructible targets, rebuild Spiral Stair faithfully, and group
the target picker. The new targets are 4 frame buildings, 2 brick boxes, 4 gates and
Spiral Tower.

**Architecture:**

- Layouts are pure functions in a new ES module, `targets/apk-layouts.js`. Each returns
  an array of boxes `{ hx, hy, hz, x, y, z, ry }` in base units, with the ground at
  y = 0 and the building centred on x = 0, z = 0.
- `index.html` imports them and places each box with the existing `addBlock()`,
  offset to z = −6.
- `node --test` covers the geometry: block counts, no overlaps, and every block
  resting on something.

**Tech Stack:** vanilla ES modules, three.js 0.160 and crashcat through the `phys`
facade (existing), `node:test`. Buildless.

**Spec:** `docs/superpowers/specs/2026-10-31-apk-buildings-design.md`. The building
dimensions are there; read the section of the task you're on.

## Global Constraints

- **Units:**
  - Spec sizes are prefab units (u).
  - `APK_UNIT = 0.25` base units per u.
  - New modes use `TSCALE = 2`, the default branch in `buildTargets()`.
- **Resting and clearance:**
  - Courses rest with a vertical pitch of height + 0.001 (the same rule as
    `brickRowPitch()`).
  - Horizontal neighbours keep ≥ 0.001 clearance.
  - Beams meeting at a post centre are each shortened by 0.001.
- **Mass:** `massFor(box) = 170 * 8 * hx * hy * hz`. `addBlock()` applies
  `MASONRY_MASS_SCALE` itself; don't apply it twice.
- **Placement:**
  - Every new target is centred at x = 0, z = −6, with `plat: false`.
  - The whole building must be in view at the start; the `camCfg` values are your
    call.
- **Exact block counts:**

  | Target | Blocks |
  |---|---|
  | frameTower | 126 |
  | frameBlock | 120 |
  | frameHigh | 240 |
  | frameHall | 260 |
  | brickBox | 288 |
  | brickTower | 196 |
  | spiral | 71 |
  | spiralTower | 95 |

  - If a layout must be adjusted to stand (≤ 10 % size change, spec *Calls*), these
    counts may drift ≤ 5 %. Update the test with a comment saying why.
  - Gates must land within ±15 % of their reference: archGate 311, doubleGate 515,
    castleGate 352, castleGateSmall 258.
- **No new dependencies.** No bundler, no `package.json`.
- **Nothing from the APK** (JSON, meshes, images) is committed.
- **Run all tests with:** `node --test test/*.test.mjs`
- **Commits:**
  - Conventional Commits that end with `Closes #24` on the last one.
  - Never `--no-verify`.

## Review Focus

1. **Self-collapse at rest.** A frame's top storeys or a corbel can slide off by
   itself on crashcat. The geometry test only proves contact, so the manual playtest
   in Task 6 must watch each target for 10 s untouched.
2. **Rotated ring bricks** on the castle-gate towers (22.5° offsets) must not overlap
   their neighbours. Because they are yawed, the overlap check must be oriented (SAT),
   not axis-aligned. `boxesOverlap` in Task 1 handles that, and Task 4's no-overlap
   test exercises it.
3. **Switching modes** between a 500-block gate and a small target must leave no stray
   bodies behind. `clearTargets()` already removes everything in `barrels`, and every
   block goes through `addBlock()`, which keeps that true. Task 6's playtest switches
   through all 26 modes.
4. **Target picker** at 1280 × 720 must not overlap the version badge or the ammo
   picker. This is checked in the Task 5 playtest.
5. **Spiral id reuse.** Old `setupSpiral()` code that is left behind would double-build
   the stair. Task 5 deletes the old function body completely, and the playtest counts
   71 blocks on Spiral Stair in the HUD.

---

### Task 1: Geometry test helpers and frame buildings

**Files:**
- Create: `targets/apk-layouts.js`
- Create: `test/layout-geometry.mjs` (test helpers, not a test file)
- Create: `test/apk-layouts.test.mjs`

**Interfaces:**
- Produces in `targets/apk-layouts.js`:
  - `export const APK_UNIT = 0.25;`
  - `export function massFor(box) -> number`
  - `export function frameBuilding(grid: number, storeys: number) -> Box[]`
  - `export const LAYOUTS = { frameTower: () => frameBuilding(3, 6), frameBlock: () => frameBuilding(4, 3), frameHigh: () => frameBuilding(4, 6), frameHall: () => frameBuilding(5, 4) }`. Later tasks add keys to this object.
- Produces in `test/layout-geometry.mjs`:
  - `export function boxesOverlap(a, b, eps = 1e-6) -> boolean`: true if the interiors
    intersect. It tests the y-interval plus a 2D separating-axis test on the
    yaw-rotated xz rectangles. Touching faces don't count as overlap.
  - `export function isSupported(box, boxes, eps = 0.0015) -> boolean`: true if the
    bottom is within `eps` of y = 0, or if some other box's top is within `eps` of
    this bottom and their xz rectangles intersect with positive area.
  - `export function overlappingPairs(boxes) -> Array<[i, j]>`
  - `export function unsupported(boxes) -> number[]`

- [ ] **Step 1: Write the failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAYOUTS, frameBuilding, massFor, APK_UNIT } from '../targets/apk-layouts.js';
import { boxesOverlap, overlappingPairs, unsupported } from './layout-geometry.mjs';

const box = (x, y, z, ry = 0) => ({ hx: 0.5, hy: 0.5, hz: 0.5, x, y, z, ry });

test('boxesOverlap_TouchingFaces_False', () => {
  assert.equal(boxesOverlap(box(0, 0.5, 0), box(1, 0.5, 0)), false);
});
test('boxesOverlap_RotatedCornerIntoNeighbour_True', () => {
  assert.equal(boxesOverlap(box(0, 0.5, 0), box(1.1, 0.5, 0, Math.PI / 4)), true);
});

const EXACT = { frameTower: 126, frameBlock: 120, frameHigh: 240, frameHall: 260 };
for (const [name, n] of Object.entries(EXACT)) {
  test(`${name}_Layout_HasPrefabBlockCount`, () => assert.equal(LAYOUTS[name]().length, n));
  test(`${name}_Layout_NoOverlaps`, () => assert.deepEqual(overlappingPairs(LAYOUTS[name]()), []));
  test(`${name}_Layout_EveryBlockRests`, () => assert.deepEqual(unsupported(LAYOUTS[name]()), []));
}
test('frameBuilding_Grid4_PostsAre1x5x1AtPitch5', () => {
  const posts = frameBuilding(4, 1).filter(b => b.hy > b.hx);
  assert.equal(posts.length, 16);
  assert.ok(posts.every(p => Math.abs(p.hy - 2.5 * APK_UNIT) < 1e-9 && Math.abs(p.hx - 0.5 * APK_UNIT) < 1e-9));
  const xs = [...new Set(posts.map(p => +(p.x / APK_UNIT).toFixed(3)))].sort((a, b) => a - b);
  assert.deepEqual(xs, [-7.5, -2.5, 2.5, 7.5]);
});
test('massFor_UnitCube_Is170TimesVolume', () => {
  assert.equal(massFor({ hx: 0.5, hy: 0.5, hz: 0.5 }), 170);
});
```

- [ ] **Step 2: Run the tests and confirm they fail.**
  Run: `node --test test/apk-layouts.test.mjs`
  Expected: FAIL with "Cannot find module '../targets/apk-layouts.js'".

- [ ] **Step 3: Implement the helpers in `test/layout-geometry.mjs`**, as specified
  under Interfaces.

- [ ] **Step 4: Implement `APK_UNIT`, `massFor`, `frameBuilding` and `LAYOUTS` in
  `targets/apk-layouts.js`.**
  - Follow the spec section *Frame buildings*.
  - Work in u internally and multiply by `APK_UNIT` once when emitting boxes.
  - Storey pitch is 6 u plus the 0.001 rest gaps.
  - The ground is y = 0.

- [ ] **Step 5: Run the tests and confirm they pass.**
  Run: `node --test test/*.test.mjs`
  Expected: all pass, including the existing `materials.test.mjs`.

- [ ] **Step 6: Commit**

```bash
git add targets/apk-layouts.js test/layout-geometry.mjs test/apk-layouts.test.mjs
git commit -m "feat(targets): add frame building layouts (#24)"
```

### Task 2: Brick boxes

**Files:**
- Modify: `targets/apk-layouts.js`
- Modify: `test/apk-layouts.test.mjs`

**Interfaces:**
- Produces:
  - `export function brickBox(wallOffset: number, ownBricks: number, courses: number) -> Box[]`,
    with all arguments in u. `ownBricks` is the brick count of a corner-owning wall;
    the inner walls get one fewer.
  - `LAYOUTS.brickBox = () => brickBox(4.5, 5, 16)`
  - `LAYOUTS.brickTower = () => brickBox(3.5, 4, 14)`

- [ ] **Step 1: Write the failing tests.** Extend `EXACT` with
  `brickBox: 288, brickTower: 196`. Then add:

```js
test('brickBox_Course0And1_SwapCornerOwnership', () => {
  const b = brickBox(4.5, 5, 2);
  const c0 = b.filter(x => x.y < 0.5 * APK_UNIT + 1e-6), c1 = b.filter(x => x.y > 0.5 * APK_UNIT + 1e-6);
  const owners = c => c.filter(x => Math.abs(Math.abs(x.x) - 4.5 * APK_UNIT) < 1e-6).length;
  assert.equal(owners(c0), 10);  // x-walls own corners in course 0
  assert.equal(owners(c1), 8);   // and not in course 1
});
```

- [ ] **Step 2: Run** `node --test test/apk-layouts.test.mjs`. Expected: the new
  tests fail.
- [ ] **Step 3: Implement `brickBox`** following the spec section *Brick boxes*.
  Bricks are 1.9 × 1 × 0.95 u, long side along their wall (use `ry = π/2` for walls
  running along z).
- [ ] **Step 4: Run** `node --test test/*.test.mjs`. Expected: all pass.
- [ ] **Step 5: Commit** `feat(targets): add brick box layouts (#24)`

### Task 3: Spirals

**Files:**
- Modify: `targets/apk-layouts.js`
- Modify: `test/apk-layouts.test.mjs`

**Interfaces:**
- Produces:
  - `export function spiralStair(treads: number) -> Box[]`
  - `LAYOUTS.spiral = () => spiralStair(36)`
  - `LAYOUTS.spiralTower = () => spiralStair(48)`

- [ ] **Step 1: Write the failing tests.** Extend `EXACT` with
  `spiral: 71, spiralTower: 95`. Then add:

```js
test('spiralStair_36Treads_Has35PostsOf25FullHeight', () => {
  const thin = v => Math.abs(v - 0.5 * APK_UNIT) < 1e-9;
  const posts = spiralStair(36).filter(b => thin(b.hx) && thin(b.hz));
  assert.equal(posts.length, 35);   // one under every tread i >= 1
  assert.equal(posts.filter(p => Math.abs(p.hy * 2 - 11 * APK_UNIT) < 1e-6).length, 25); // i = 11..35
});
test('spiralStair_Tread0_BottomOnGround', () => {
  const t0 = spiralStair(36).reduce((a, b) => (b.y < a.y ? b : a));
  assert.ok(Math.abs(t0.y - t0.hy) < 1e-6);
});
```

- [ ] **Step 2: Run** `node --test test/apk-layouts.test.mjs`. Expected: the new
  tests fail.
- [ ] **Step 3: Implement `spiralStair`** following the spec section *Spirals* and
  the spiral conventions under *Calls made after the builder check*:
  - tread bottom at i u
  - position from `cos(a), sin(a)`, yaw `-a`
- [ ] **Step 4: Run** `node --test test/*.test.mjs`. Expected: all pass.
- [ ] **Step 5: Commit** `feat(targets): add faithful spiral layouts (#24)`

### Task 4: Gates

**Files:**
- Modify: `targets/apk-layouts.js`
- Modify: `test/apk-layouts.test.mjs`

**Interfaces:**
- Produces:
  - `export function pierGate(piers: number) -> Box[]`, for 2 or 3 piers
  - `export function castleGate(towerX: number, towerCourses: number, wallCourses: number) -> Box[]`
  - `LAYOUTS.archGate = () => pierGate(2)`
  - `LAYOUTS.doubleGate = () => pierGate(3)`
  - `LAYOUTS.castleGate = () => castleGate(13.5, 12, 10)`
  - `LAYOUTS.castleGateSmall = () => castleGate(11.5, 10, 8)`

- [ ] **Step 1: Write the failing tests**

```js
const APPROX = { archGate: 311, doubleGate: 515, castleGate: 352, castleGateSmall: 258 };
for (const [name, ref] of Object.entries(APPROX)) {
  test(`${name}_Layout_CountWithin15Percent`, () => {
    const n = LAYOUTS[name]().length;
    assert.ok(n >= ref * 0.85 && n <= ref * 1.15, `${n} vs ${ref}`);
  });
  test(`${name}_Layout_NoOverlaps`, () => assert.deepEqual(overlappingPairs(LAYOUTS[name]()), []));
  test(`${name}_Layout_EveryBlockRests`, () => assert.deepEqual(unsupported(LAYOUTS[name]()), []));
}
test('pierGate_ThreePiers_HasTwoOpenings', () => {
  const g = pierGate(3), low = g.filter(b => b.y < 1.5 * APK_UNIT);
  const covered = x => low.some(b => Math.abs(b.x - x) < b.hx + b.hz);
  assert.equal(covered(0), true);  // centre pier
  const openings = [-1, 1].map(s => s * 6 * APK_UNIT).filter(x => !covered(x)); // piers at 0, ±12 u
  assert.equal(openings.length, 2);
});
test('castleGate_GateOpening_ClearAtGroundLevel', () => {
  const low = LAYOUTS.castleGate().filter(b => b.y < 1.5 * APK_UNIT);
  assert.ok(!low.some(b => Math.abs(b.x) < 2 * APK_UNIT && Math.abs(b.z) < 1.5 * APK_UNIT));
});
```

- [ ] **Step 2: Run** `node --test test/apk-layouts.test.mjs`. Expected: the new
  tests fail.
- [ ] **Step 3: Implement `pierGate` and `castleGate`** following the spec section
  *Gates*. The crenellation and corbel steps are your call. Every corbel must overlap
  the block below it (the `EveryBlockRests` test enforces this).
- [ ] **Step 4: Run** `node --test test/*.test.mjs`. Expected: all pass.
- [ ] **Step 5: Commit** `feat(targets): add gate layouts (#24)`

### Task 5: Wire the layouts into the game and group the picker

**Files:**
- Modify: `index.html`. The parts touched:
  - the `.target` CSS (around line 39)
  - the target buttons (around lines 115–129)
  - the module imports (around line 141)
  - `setupSpiral()` (around line 661)
  - `camCfg` (around line 915)

**Interfaces:**
- Consumes: `LAYOUTS` and `massFor` from Tasks 1–4.
- Produces:
  - `function placeLayout(boxes, zC)` in `index.html`. It calls
    `addBlock(b.hx, b.hy, b.hz, m(), massFor(b), b.x, b.y, b.z + zC, b.ry, 0)` for each
    box, with the usual cycling `stoneMatls` picker.
  - Mode ids:

    | Mode id | Layout |
    |---|---|
    | `frametower` | `frameTower` |
    | `frameblock` | `frameBlock` |
    | `framehigh` | `frameHigh` |
    | `framehall` | `frameHall` |
    | `brickbox` | `brickBox` |
    | `bricktower` | `brickTower` |
    | `spiral` | `spiral` |
    | `spiraltower` | `spiralTower` |
    | `archgate` | `archGate` |
    | `doublegate` | `doubleGate` |
    | `castlegate` | `castleGate` |
    | `castlegatesmall` | `castleGateSmall` |

- [ ] **Step 1: Import the layouts.** Add
  `import { LAYOUTS, massFor } from './targets/apk-layouts.js';` next to the physics
  imports.
- [ ] **Step 2: Add `placeLayout`.**
  - Replace the body of `setupSpiral()` with `placeLayout(LAYOUTS.spiral(), -6)`, and
    delete the old treads, posts and beams code.
  - Add one `camCfg` entry per new mode id, with `build: () => placeLayout(LAYOUTS.<key>(), -6)`.
- [ ] **Step 3: Group the target buttons** as in the spec section *Target picker*:
  - four wrappers, each with a `.glabel` heading styled like `.ammo-group .glabel`
  - keep `data-mode` on every button
  - keep the click handler on `#target`, which uses `closest('button')`
  - adjust the `.target` CSS so the groups stack vertically, right-aligned
- [ ] **Step 4: Run** `node --test test/*.test.mjs`. Expected: all pass. The tests
  don't load `index.html`, but this guards the module.
- [ ] **Step 5: Manual check.** Serve with `python3 -m http.server 8000` and open
  `http://localhost:8000/`. Expected:
  - the console is empty
  - all 26 buttons show in 4 groups
  - there is no overlap with the version badge or the ammo picker at 1280 × 720
  - clicking each new button builds its building fully in view
  - the Spiral Stair HUD total reads 71
- [ ] **Step 6: Commit** `feat(targets): add APK buildings as targets and group the picker (#24)`

### Task 6: Playtest and docs

**Files:**
- Modify: `README.md`, specifically the *Switch target* row and the *Targets*
  paragraph.
- Modify: `CHANGELOG.md`, under `[Unreleased]` → `### Added`.

- [ ] **Step 1: Playtest each of the 12 layouts.** Leave each one untouched for 10 s.
  Expected: "Blocks down" stays at 0.
  - If one sags, adjust that layout within the spec's 10 % allowance.
  - Then rerun `node --test test/*.test.mjs`.
- [ ] **Step 2: Knock-down check.** For each of the 12 layouts, fire three bombs or
  swing the wrecking ball. Expected: at least a quarter of the blocks go down.
  - Note the numbers in the PR body.
  - If one stays below a quarter, note it rather than retuning global constants.
- [ ] **Step 3: Update the README.**
  - Add the new target names.
  - Add one credit line: building designs adapted from the Android game *Physics
    Simulation Building Destruction*.
- [ ] **Step 4: Update the CHANGELOG** with this entry: "New targets: four frame
  buildings, two brick towers, four gates and a Spiral Tower; Spiral Stair rebuilt;
  target picker grouped (#24)".
- [ ] **Step 5: Run** `node --test test/*.test.mjs`. Expected: all pass.
- [ ] **Step 6: Commit** with `docs: document APK building targets` and the footer
  `Closes #24`.
