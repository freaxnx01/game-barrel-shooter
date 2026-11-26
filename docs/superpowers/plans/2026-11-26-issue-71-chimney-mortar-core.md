# Chimney Mortar Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (this plan is dispatched through the issue pipeline). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the dark wedge gaps between the chimney ring blocks with a visual-only mortar-coloured tube inside the shaft, so they read as mortar joints.

**Architecture:** A pure helper `chimneyCore()` in `targets/chimney.js` returns the tube dimensions; `index.html` builds two open cylinder meshes in `setupChimney()`, removes them in `clearTargets()` and hides them once 12 blocks are down. Physics, layout and harness stay unchanged.

**Tech Stack:** buildless vanilla JS (ES modules), three.js 0.160, `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-26-issue-71-chimney-mortar-core-design.md`

## Global Constraints

- Do **not** change `chimneyLayout()`, `addRing()`, the existing `CHIMNEY` constants, `addBlock`, `physics/`, camera config or `test/harness/chimney.html`. Body count stays 516.
- Do **not** run any harness. Unit tests only.
- Never modify an existing test to make it green.
- Tests run with `node --test test/*.test.mjs` (no `package.json`).
- The core meshes must NOT be pushed to `barrels` and must have no physics body.
- No screenshot is required; skip it if the headless browser is slow.

## Review Focus

1. The tube radius is the mid-wall radius (`shaftRadius`), not the inner face.
2. The core is removed and its geometry disposed in `clearTargets()`.
3. No physics value or chimney geometry changed.

### Task 1: `chimneyCore()` pure helper

**Files:**
- Modify: `targets/chimney.js`
- Modify: `test/chimney.test.mjs`

- [ ] **Step 1: Write the failing tests**

Add `chimneyCore` to the import line of `test/chimney.test.mjs`, then append:

```js
test('chimneyCore_TwoTubes_BrickThenSoot', () => {
  const core = chimneyCore();
  assert.deepEqual(core.map(t => t.part), ['brick', 'soot']);
});
test('chimneyCore_TubesCoverGroundToTopCourse', () => {
  const [brick, soot] = chimneyCore();
  const top = CHIMNEY.shaftCourses * coursePitch();
  assert.equal(brick.y0, 0);
  assert.ok(Math.abs(brick.y0 + brick.height - soot.y0) < 1e-9);
  assert.ok(Math.abs(soot.y0 + soot.height - top) < 1e-9);
});
test('chimneyCore_SootTubeStartsAtSootCourses', () => {
  const soot = chimneyCore()[1];
  assert.ok(Math.abs(soot.y0 - (CHIMNEY.shaftCourses - CHIMNEY.sootCourses) * coursePitch()) < 1e-9);
});
test('chimneyCore_RadiusIsMidWallAndContinuous', () => {
  const [brick, soot] = chimneyCore();
  assert.ok(Math.abs(brick.radiusTop - soot.radiusBottom) < 1e-9);
  assert.ok(brick.radiusBottom > brick.radiusTop && soot.radiusBottom > soot.radiusTop);
  // at a course centre the tube radius equals the shaft radius of that course
  const c = 10;
  const y = c * coursePitch() + CHIMNEY.courseHeight / 2;
  const r = brick.radiusBottom + (brick.radiusTop - brick.radiusBottom) * (y - brick.y0) / brick.height;
  assert.ok(Math.abs(r - shaftRadius(c)) < 1e-9, `r ${r}`);
});
test('chimneyCore_StaysInsideBlocks_NeverOutsideOuterFace', () => {
  const [brick, soot] = chimneyCore();
  for (const t of [brick, soot]) {
    assert.ok(t.radiusBottom < shaftRadius(0) + shaftWall(0));
    assert.ok(t.radiusTop > 0.5);
  }
});
```

- [ ] **Step 2: Run, expect failure**

Run: `node --test test/chimney.test.mjs`
Expected: FAIL (`chimneyCore` is not exported).

- [ ] **Step 3: Implement**

Append to `targets/chimney.js`:

```js
// Visual mortar core (#71): the ring blocks touch at their inner corners, so an open wedge
// (about 4 * wall * tan 15 deg wide on the outer face) shows the dark hollow shaft. Two open
// tapered tubes at the mid-wall radius fill it with mortar colour: brick-mortar up to the soot
// courses, soot-mortar above. Visual only, no body. Radius is linear in y (shaftRadius is
// linear in the course), taken at course centres and extended to the tube ends.
// Returns [{ part, y0, height, radiusBottom, radiusTop }] in base units.
export function chimneyCore() {
  const pitch = coursePitch();
  const slope = (CHIMNEY.radiusTop - CHIMNEY.radiusBottom) / ((CHIMNEY.shaftCourses - 1) * pitch);
  const radiusAt = (y) => CHIMNEY.radiusBottom + slope * (y - CHIMNEY.courseHeight / 2);
  const top = CHIMNEY.shaftCourses * pitch;
  const split = (CHIMNEY.shaftCourses - CHIMNEY.sootCourses) * pitch;
  const tube = (part, y0, y1) => ({ part, y0, height: y1 - y0, radiusBottom: radiusAt(y0), radiusTop: radiusAt(y1) });
  return [tube('brick', 0, split), tube('soot', split, top)];
}
```

- [ ] **Step 4: Run, expect pass**

Run: `node --test test/*.test.mjs`
Expected: all PASS, including the existing 516-block and layout tests.

- [ ] **Step 5: Commit**

```bash
git add targets/chimney.js test/chimney.test.mjs
git commit -m "feat(targets): chimneyCore helper for a visual mortar tube (#71)"
```

### Task 2: Build, remove and hide the mortar core in `index.html`

**Files:**
- Modify: `index.html` (import line ~363, `setupChimney` ~941, `clearTargets` ~1201, frame loop `if (changed) updateHud();` ~3139)

- [ ] **Step 1: Import**

Change the import at `index.html:363` to also import `chimneyCore`:

```js
import { CHIMNEY, chimneyLayout, isSoot, brickFaceRects, chimneyCore } from './targets/chimney.js';
```

- [ ] **Step 2: Build the core in `setupChimney()`**

Replace `setupChimney` and add the materials and state above it:

```js
// Mortar core (#71): visual-only tubes behind the ring gaps; no body, not in `barrels`.
const coreMatls = { brick: new THREE.MeshStandardMaterial({ color: '#bfb5a3', roughness: 0.9, side: THREE.DoubleSide }),
                    soot:  new THREE.MeshStandardMaterial({ color: '#6a625a', roughness: 0.9, side: THREE.DoubleSide }) };
let chimneyCoreMeshes = [];
function setupChimney() {
  const zC = -6;
  chimneyLayout().forEach((b, i) => addBlock(b.hx, b.hy, b.hz, chimneyMatl(b, i), massFor(b), b.x, b.y, b.z + zC, b.ry, 0));
  chimneyCoreMeshes = chimneyCore().map(t => {
    const geo = new THREE.CylinderGeometry(t.radiusTop * TSCALE, t.radiusBottom * TSCALE, t.height * TSCALE, 24, 1, true);
    const mesh = new THREE.Mesh(geo, coreMatls[t.part]);
    mesh.position.set(0, (t.y0 + t.height / 2) * TSCALE, zC * TSCALE);
    scene.add(mesh);
    return mesh;
  });
}
```

- [ ] **Step 3: Remove and dispose in `clearTargets()`**

Add at the start of the function body (the function is declared after `setupChimney`, which is fine for a `let` read at call time):

```js
  for (const m of chimneyCoreMeshes) { scene.remove(m); m.geometry.dispose(); }
  chimneyCoreMeshes.length = 0;
```

Do not dispose the shared materials.

- [ ] **Step 4: Hide once the chimney topples**

In the frame loop replace `if (changed) updateHud();` with:

```js
  if (changed) {
    updateHud();
    // the mortar core would stand alone once the chimney topples (#71)
    if (chimneyCoreMeshes.length && chimneyCoreMeshes[0].visible &&
        barrels.filter(b => b.down).length >= CHIMNEY.segments) {
      for (const m of chimneyCoreMeshes) m.visible = false;
    }
  }
```

(`buildTargets()` rebuilds new visible meshes on reset, so no re-show code is needed.)

- [ ] **Step 5: Verify**

Run: `node --test test/*.test.mjs`
Expected: PASS. Optional: serve with `python3 -m http.server 8776`, pick Chimney, confirm the gaps look light, shoot it down, confirm the tube disappears; kill the server afterwards.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat(targets): mortar core inside the chimney shaft (#71)"
```

### Task 3: CHANGELOG

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Amend the existing #64 line, no new contradicting entry**

In `## [Unreleased]`, replace the line starting `- Chimney bricks look elongated:` with:

```
- Chimney bricks look elongated: every brick block now shows two courses of long bricks, and a mortar-coloured core fills the gaps between the blocks so they read as joints; the chimney's size and how it falls are unchanged (#64, #71)
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): chimney mortar core (#71)"
```
