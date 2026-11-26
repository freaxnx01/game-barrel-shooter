# Charges Stick Visibly Implementation Plan (#78)

**Goal:** Remote and timed charges stick flush on the visible surface where they hit, stay visible, and do not move any piece until they explode. All #62 behaviour stays: no impact damage, riding along, blasts skip charges, the 6-remote cap, the cull rules.

**Architecture:** There are two root causes, both measured.

- (1) `addFixedJoint` anchors each body at its own centre, so the joint drags the charge into the piece's centre. The fix is one shared world point.
- (2) Charges slip into the seams between the chimney's box colliders, which the wedge meshes hide. The fix: a raycast ahead of each flying charge against the drawn meshes snaps it flush onto the first face it meets, and a stuck charge stops colliding.

Pure helpers go in `weapons/charges.js`. Wiring goes in `index.html` and `physics/backend-crashcat.js`.

**Spec:** `docs/superpowers/specs/2026-11-26-issue-78-charges-stick-visibly-design.md`

Run tests with `node --test test/*.test.mjs`. Make only the commits named below. Do not run Playwright or the browser harness.

### Task 1: Pure surface-stick helpers

**Files:**
- Modify: `weapons/charges.js`
- Modify: `test/charges.test.mjs`

- [ ] **Step 1: Write the failing tests.** In `test/charges.test.mjs`, change the import on line 3 to:

```js
import { CHARGE, chargeLaunch, chargeStickPlan, chargeReach, quatFromUp, flushPose, pieceOf, isFuseDone, blinkPeriod, ledOn, canPlaceRemote, armedRemotes } from '../weapons/charges.js';
```

Then append at the end of the file:

```js
// ---- #78: stick flush on the drawn surface ----
function near(actual, expected, eps = 1e-9) {
  for (const k of Object.keys(expected)) {
    assert.ok(Math.abs(actual[k] - expected[k]) < eps, `${k}: ${actual[k]} vs ${expected[k]}`);
  }
}

// rotates v by the unit quaternion q (v' = q v q*)
function rotate(q, v) {
  const tx = 2 * (q.y * v.z - q.z * v.y), ty = 2 * (q.z * v.x - q.x * v.z), tz = 2 * (q.x * v.y - q.y * v.x);
  return {
    x: v.x + q.w * tx + (q.y * tz - q.z * ty),
    y: v.y + q.w * ty + (q.z * tx - q.x * tz),
    z: v.z + q.w * tz + (q.x * ty - q.y * tx),
  };
}

test('chargeReach_Standing_HalfDiagonal', () => {
  assert.ok(Math.abs(chargeReach(0, 0) - 0.21) < 1e-9);
});

test('chargeReach_FullSpeedOneFrame_FramePlusSubstepPlusHalfDiagonal', () => {
  assert.ok(Math.abs(chargeReach(24, 1 / 30) - 1.11) < 1e-9);   // 24 * (1/30 + 1/240) + 0.21
});

test('quatFromUp_Up_Identity', () => {
  near(quatFromUp({ x: 0, y: 1, z: 0 }), { x: 0, y: 0, z: 0, w: 1 });
});

test('quatFromUp_Down_HalfTurnAboutX', () => {
  near(quatFromUp({ x: 0, y: -1, z: 0 }), { x: 1, y: 0, z: 0, w: 0 });
});

test('quatFromUp_AnyNormal_TurnsUpOntoIt', () => {
  for (const n of [{ x: 0, y: 0, z: 1 }, { x: -1, y: 0, z: 0 }, { x: 0.6, y: 0, z: 0.8 }, { x: 0.48, y: -0.6, z: 0.64 }]) {
    const q = quatFromUp(n);
    assert.ok(Math.abs(Math.hypot(q.x, q.y, q.z, q.w) - 1) < 1e-9);
    near(rotate(q, { x: 0, y: 1, z: 0 }), n);
  }
});

test('flushPose_FaceTowardsPlusZ_CentreHalfThicknessOut', () => {
  const pose = flushPose({ x: 1, y: 2, z: 3 }, { x: 0, y: 0, z: 1 });
  near(pose.position, { x: 1, y: 2, z: 3.08 });
  near(rotate(pose.quaternion, { x: 0, y: 1, z: 0 }), { x: 0, y: 0, z: 1 });
});

test('flushPose_Floor_LiesFlatOnTop', () => {
  const pose = flushPose({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
  near(pose.position, { x: 0, y: 0.08, z: 0 });
  near(pose.quaternion, { x: 0, y: 0, z: 0, w: 1 });
});

test('pieceOf_MeshOrChildOfAPiece_ThatPiece', () => {
  const a = { parent: null }, b = { parent: null };
  const pieces = [{ mesh: a }, { mesh: b }];
  assert.equal(pieceOf(b, pieces), pieces[1]);
  assert.equal(pieceOf({ parent: { parent: a } }, pieces), pieces[0]);
});

test('pieceOf_UnrelatedMesh_Null', () => {
  assert.equal(pieceOf({ parent: { parent: null } }, [{ mesh: {} }]), null);
  assert.equal(pieceOf(null, []), null);
});
```

- [ ] **Step 2: Run to verify failure.** Run `node --test test/charges.test.mjs`. It fails because `chargeReach`, `quatFromUp`, `flushPose` and `pieceOf` are not exported.

- [ ] **Step 3: Implement.** Append to `weapons/charges.js`:

```js
// How far ahead of a flying charge to look for a drawn surface this frame (#78): one frame of
// flight plus one physics substep, plus the charge's half diagonal, so it sticks to the face it
// is about to reach before any corner slips into a gap behind the drawn mesh.
export function chargeReach(speed, dtSec) {
  const [x, y, z] = CHARGE.halfExtents;
  return speed * (dtSec + 1 / 240) + Math.hypot(x, y, z);
}

// Shortest rotation that turns local +Y onto the unit vector n, as a quaternion {x, y, z, w}.
export function quatFromUp(n) {
  const w = 1 + n.y;
  if (w < 1e-9) return { x: 1, y: 0, z: 0, w: 0 };   // n = -Y: half turn about X
  const len = Math.hypot(n.z, n.x, w);
  return { x: n.z / len, y: 0, z: -n.x / len, w: w / len };
}

// Pose of a charge lying flush on a drawn face (#78): its flat underside on the face at `point`,
// the detonator box (local +Y) along the face's outward unit `normal`.
export function flushPose(point, normal) {
  const t = CHARGE.halfExtents[1];
  return {
    position: { x: point.x + normal.x * t, y: point.y + normal.y * t, z: point.z + normal.z * t },
    quaternion: quatFromUp(normal),
  };
}

// The target piece whose drawn mesh is `object` or one of its ancestors, or null (#78).
// pieces: [{ mesh, ... }] (the game's `barrels`); a raycast hit can land on a child mesh of a group.
export function pieceOf(object, pieces) {
  for (let o = object; o; o = o.parent) {
    const piece = pieces.find((p) => p.mesh === o);
    if (piece) return piece;
  }
  return null;
}
```

- [ ] **Step 4: Run to verify pass.** Run `node --test test/*.test.mjs`. All tests pass.

- [ ] **Step 5: Commit.** `git add weapons/charges.js test/charges.test.mjs && git commit -m "fix(weapons): helpers to stick charges flush on a drawn face (#78)"`

### Task 2: Fixed joint keeps the relative pose; bodies can stop colliding

**Files:**
- Modify: `physics/backend-crashcat.js`

The backend runs only in the browser against crashcat from esm.sh, so there is no node test for it. These are two small, exact edits.

- [ ] **Step 1: Anchor both bodies at one point.** In `addFixedJoint(a, b)` (around line 248), replace

```js
    const pa = [a.position.x, a.position.y, a.position.z];
    const pb = [b.position.x, b.position.y, b.position.z];
    const j = cc.fixedConstraint.create(world, {
      bodyIdA: a.raw.id, bodyIdB: b.raw.id,
      point1: pa, point2: pb,
```

with

```js
    // one shared world point: crashcat stores each point relative to its own body's centre, so
    // a's and b's own positions would pull the two centres together (#78)
    const pa = [a.position.x, a.position.y, a.position.z];
    const j = cc.fixedConstraint.create(world, {
      bodyIdA: a.raw.id, bodyIdB: b.raw.id,
      point1: pa, point2: pa,
```

Leave `addDistanceJoint` unchanged.

- [ ] **Step 2: Add `setCollides`.** Below the line `function onCollide(h, cb) { collideCbs.set(h, cb); }`, add:

```js

  // A body that collides with nothing (a stuck charge, #78): crashcat filters every pair by
  // (groupsA & maskB) && (groupsB & maskA) on each step, so a zero mask drops all its contacts.
  function setCollides(h, on) { h.raw.collisionMask = on ? 0xffffffff : 0; }
```

In the returned object, change the line `    onCollide,` to `    onCollide, setCollides,`.

- [ ] **Step 3: Verify.** `node --check physics/backend-crashcat.js` prints nothing. `node --test test/*.test.mjs` still passes.

- [ ] **Step 4: Commit.** `git add physics/backend-crashcat.js && git commit -m "fix(physics): fixed joint holds the pose it was made at, add setCollides (#78)"`

### Task 3: Wire the surface stick into the game

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Import the helpers.** Replace the import line (around line 366)

```js
import { CHARGE, chargeLaunch, chargeStickPlan, isFuseDone, ledOn, canPlaceRemote, armedRemotes } from './weapons/charges.js';
```

with

```js
import { CHARGE, chargeLaunch, chargeStickPlan, chargeReach, flushPose, pieceOf, isFuseDone, ledOn, canPlaceRemote, armedRemotes } from './weapons/charges.js';
```

- [ ] **Step 2: A stuck charge stops colliding.** In `function chargeStick(rec, other)` (around line 2239), after the line `  else phys.setGravityFactor(rec.body, 0);       // no body to join: hang where it is`, add:

```js
  phys.setCollides(rec.body, false);             // a stuck charge never pushes the pieces around it (#78)
```

- [ ] **Step 3: Add the look-ahead stick.** Directly after the end of `chargeStick` and before the line `// ---------- Heavy net: catch the pieces around the first contact; the player then drags them in ----------`, insert:

```js
// Flying charges stick where their path first meets a drawn piece (#78): the chimney's wedge
// meshes cover the gaps between its box colliders, so waiting for a physics contact let charges
// slip into a gap and stick there, hidden. Runs before phys.step; the contact stays the fallback.
const chargeRay = new THREE.Raycaster();
const chargeRayFrom = new THREE.Vector3();
const chargeRayDir = new THREE.Vector3();
const chargeNormal = new THREE.Vector3();
const chargeNormalMatrix = new THREE.Matrix3();
function stickChargesAhead(dt) {
  for (const rec of balls) {
    if ((rec.type !== 'remotecharge' && rec.type !== 'timedcharge') || rec.stuck || rec.exploded) continue;
    const v = phys.getVelocity(rec.body);
    const speed = Math.hypot(v.x, v.y, v.z);
    if (speed < 0.5) continue;
    const p = rec.body.position;
    chargeRay.set(chargeRayFrom.set(p.x, p.y, p.z), chargeRayDir.set(v.x / speed, v.y / speed, v.z / speed));
    chargeRay.far = chargeReach(speed, dt);
    const hit = chargeRay.intersectObjects(barrels.map((b) => b.mesh), true)[0];
    const piece = hit && hit.face ? pieceOf(hit.object, barrels) : null;
    if (piece) stickChargeOnFace(rec, piece, hit);
  }
}
// meshes are scaled non-uniformly (addBlock), so the face normal goes to world space by the normal matrix
function stickChargeOnFace(rec, piece, hit) {
  chargeNormal.copy(hit.face.normal).applyMatrix3(chargeNormalMatrix.getNormalMatrix(hit.object.matrixWorld)).normalize();
  const { position: at, quaternion: q } = flushPose(hit.point, chargeNormal);
  phys.setPosition(rec.body, at.x, at.y, at.z);
  phys.setQuaternion(rec.body, q.x, q.y, q.z, q.w);
  chargeStick(rec, piece.body);
}

```

- [ ] **Step 4: Call it every frame before the physics step.** In `function animate()`, replace

```js
  applyJengaPush();
  phys.step(dt); // fixed 1/240 internal step (≤10 substeps) so fast projectiles don't tunnel through
```

with

```js
  applyJengaPush();
  stickChargesAhead(dt);   // before the step: stick on the drawn face, not in a gap behind it (#78)
  phys.step(dt); // fixed 1/240 internal step (≤10 substeps) so fast projectiles don't tunnel through
```

- [ ] **Step 5: Verify.** `node --test test/*.test.mjs` passes. `grep -n "stickChargesAhead\|setCollides\|pieceOf" index.html` shows the import, the call in `animate`, the definition and the `setCollides` line in `chargeStick`.

- [ ] **Step 6: Commit.** `git add index.html && git commit -m "fix(weapons): charges stick flush on the visible surface and stop colliding (#78)"`

### Task 4: Changelog

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Amend the existing unreleased charge line.** Under `## [Unreleased]` → `### Added`, replace the line that starts with `- Remote charge (key B)` with:

```markdown
- Remote charge (key B) that waits until you press K or the 💥 Boom button, and timed charge (key Z) that explodes 4 s after the throw; both stick flat on the visible surface of the first piece or the ground they hit, ride along with it, do no impact damage and never push the pieces around them before they go off (#54, #62, #78)
```

- [ ] **Step 2: Commit.** `git add CHANGELOG.md && git commit -m "docs(changelog): charges stick visibly and leave the structure alone (#78)"`

### Optional headless check (not part of the pipeline)

Make a scratch copy, not the repo. In it, add `window.__dbg = { balls, barrels, phys, shootBall, setAmmo, detonateRemoteCharges, stickChargesAhead, THREE };` above `function animate()`, and in `chargeStick` record `rec.stickOther = other;`. Serve the copy with `python3 -m http.server`. With Playwright (`--use-gl=swiftshader`), click `button[data-mode=chimney]`, set `window.__pause` (guard `phys.step` in `animate` with it), and run these steps:

1. Fire six remote charges. For each one, call `shootBall`, then `setPosition` 2 m outside the drawn face at the foot and at course 21, both on a block and 0.5-1° beside a seam, with `setVelocity` 15 m/s inward.
2. Loop `stickChargesAhead(1/60); phys.step(1/60)` until the charge is stuck.
3. Step 10 s.

Expected:

- In the partner block's frame, each charge has local z = hz + 0.08 (foot 0.83, course 21 0.68).
- No block has moved more than 0.1 m.
- After `detonateRemoteCharges()` and 3 s, most blocks have moved and no charges are left.

Before the fix, the charges end at the block's centre (local 0, ±0.12, 0), and six charges on courses 36-42 throw 56 blocks around without any detonation.
