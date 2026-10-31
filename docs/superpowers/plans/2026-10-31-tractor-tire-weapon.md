# Tractor Tire Weapon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new ammo type, **Tractor tire** (key T). It rolls along the ground into
the target, slows down, tips over and lies flat.

**Architecture:**
- The launch, rolling-resistance and tip math live in a new pure ES module,
  `weapons/tire.js`. It has no THREE and no physics, so `node --test` can test it.
- `index.html` adds the following and calls the module:
  - the picker button and the key binding
  - the spawn branch in `shootBall()`
  - a procedural mesh
  - a per-frame step in the ball loop
  - a rumble sound

**Tech Stack:**
- vanilla ES modules
- three.js 0.160
- crashcat through the existing `phys` facade, which has `getVelocity`,
  `setVelocity`, `getAngularVelocity`, `setAngularVelocity` and `setQuaternion`
- `node:test`
- buildless

**Spec:** `docs/superpowers/specs/2026-10-31-tractor-tire-weapon-design.md`

## Global Constraints

- **Tire:**
  - radius 0.8 m, width 0.55 m, mass 40
  - material `'heavy'`
  - collider `{ kind: 'cylinder', radiusTop: 0.8, radiusBottom: 0.8, height: 0.55 }`
- **Spawn:**
  - 2.5 m ahead of the camera along the horizontal aim, at y = 0.81
  - if the aim's horizontal length is < 0.1, use the camera's horizontal forward
- **Speed:** `8 + 12 * power` m/s, horizontal. Spin `ω = (up × v) / r`, no slip.
- **Rolling resistance:** 2.0 m/s², applied each frame only while upright and not yet
  tipped. ω is scaled by the same factor.
- **Tip:**
  - Trigger: horizontal speed < 2.5 m/s and the axle within 30° of horizontal.
  - Effect: ω set to `rollDir * 1.5 * (rand < 0.5 ? -1 : 1)`.
  - At most once per tire.
- **Cull:** the existing 12 s `cullTime`.
- **Rumble:** stops on cull, on `reset()` and when the tire has tipped and come to
  rest.
- **No new dependencies.** No `package.json`.
- **Tests:** `node --test test/*.test.mjs`
- **Commits:**
  - Conventional Commits; the last one ends with `Closes #8`.
  - Never `--no-verify`.

## Review Focus

1. **Aiming straight down** (horizontal aim ≈ 0) must not give a NaN velocity. This is
   covered by `tireLaunch_VerticalAim_FallsBackToCameraForward` in Task 1.
2. **A tire stopping hard against a wall** at near-zero speed must not divide by zero
   when ω is rescaled. This is covered by `rollingStep_SpeedBelowDecel_StopsAtZero` in
   Task 1.
3. **Reset (R) while a tire is rolling** must leave no rumble playing. Check it in the
   Task 3 playtest. `removeProjectile()` must stop the rumble.
4. **Autoplay** must keep working. It doesn't pick the tire. Check that the tire isn't
   accidentally added to any autoplay ammo list.
5. **A tire launched from a steep camera angle** spawns on the ground, not under it.
   `y = radius + 0.01` is independent of camera height. This is asserted in
   `tireLaunch_FlatAim_SpawnsOnGroundAhead`.

---

### Task 1: Pure tire module

**Files:**
- Create: `weapons/tire.js`
- Create: `test/tire.test.mjs`

**Interfaces (produces):**
- `export const TIRE`, with these fields:

  | Field | Value |
  |---|---|
  | `radius` | 0.8 |
  | `width` | 0.55 |
  | `mass` | 40 |
  | `spawnAhead` | 2.5 |
  | `baseSpeed` | 8 |
  | `speedRange` | 12 |
  | `resist` | 2.0 |
  | `tipSpeed` | 2.5 |
  | `tipAxleMax` | `Math.PI / 6` |
  | `tipSpin` | 1.5 |

- `export function tireLaunch(camPos, aim, camForward, power) -> { position, velocity, angularVelocity, quaternion }`
  - Vectors are `{x,y,z}`; the quaternion is `{x,y,z,w}` and turns local +Y (the
    cylinder axle) onto the horizontal axis perpendicular to the velocity.
- `export function rollingStep(velocity, angularVelocity, dt) -> { velocity, angularVelocity }`
  - Reduces the horizontal speed by `resist * dt`, not below 0.
  - Keeps `velocity.y`.
  - Scales ω by the same factor; ω is zero when the speed reaches 0.
- `export function axleTilt(quaternion) -> number`: the angle in radians between the
  rotated local +Y and the horizontal plane.
- `export function shouldTip(velocity, quaternion, alreadyTipped) -> boolean`
- `export function tipSpin(velocity, rand) -> {x,y,z}`

- [ ] **Step 1: Write the failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TIRE, tireLaunch, rollingStep, axleTilt, shouldTip, tipSpin } from '../weapons/tire.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const rotY = (q) => { // rotate (0,1,0) by q
  const { x, y, z, w } = q;
  return { x: 2 * (x * y - w * z), y: 1 - 2 * (x * x + z * z), z: 2 * (y * z + w * x) };
};
const cam = { x: 0, y: 5, z: 10 }, fwd = { x: 0, y: 0, z: -1 };
const upright = tireLaunch(cam, fwd, fwd, 0).quaternion;

test('tireLaunch_FlatAim_SpawnsOnGroundAhead', () => {
  const { position } = tireLaunch(cam, fwd, fwd, 0);
  close(position.x, 0); close(position.y, TIRE.radius + 0.01); close(position.z, 7.5);
});
test('tireLaunch_Power0And1_Speed8And20Horizontal', () => {
  const v0 = tireLaunch(cam, { x: 0, y: -0.3, z: -1 }, fwd, 0).velocity;
  close(Math.hypot(v0.x, v0.z), 8); close(v0.y, 0);
  const v1 = tireLaunch(cam, fwd, fwd, 1).velocity;
  close(v1.z, -20);
});
test('tireLaunch_RollsWithoutSlip', () => {
  const { angularVelocity: w } = tireLaunch(cam, fwd, fwd, 0);
  close(w.x, -8 / TIRE.radius); close(w.y, 0); close(w.z, 0);
});
test('tireLaunch_AxleHorizontalAndPerpendicularToVelocity', () => {
  const { quaternion, velocity } = tireLaunch(cam, { x: 0.6, y: 0, z: -0.8 }, fwd, 0.5);
  const a = rotY(quaternion);
  close(a.y, 0); close(a.x * velocity.x + a.z * velocity.z, 0);
});
test('tireLaunch_VerticalAim_FallsBackToCameraForward', () => {
  const { velocity } = tireLaunch(cam, { x: 0, y: -1, z: 0 }, { x: 1, y: -0.5, z: 0 }, 0);
  close(velocity.x, 8); close(velocity.z, 0);
  assert.ok(Object.values(velocity).every(Number.isFinite));
});
test('rollingStep_HalfSecond_LosesOneMetrePerSecond', () => {
  const r = rollingStep({ x: 0, y: -0.2, z: -8 }, { x: -10, y: 0, z: 0 }, 0.5);
  close(r.velocity.z, -7); close(r.velocity.y, -0.2); close(r.angularVelocity.x, -8.75);
});
test('rollingStep_SpeedBelowDecel_StopsAtZero', () => {
  const r = rollingStep({ x: 0, y: 0, z: -0.5 }, { x: -0.625, y: 0, z: 0 }, 0.5);
  close(r.velocity.z, 0); close(r.angularVelocity.x, 0);
  const z = rollingStep({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 0.5);
  assert.ok(Object.values(z.angularVelocity).every(Number.isFinite));
});
test('axleTilt_UprightTire_Zero', () => close(axleTilt(upright), 0));
test('shouldTip_SlowAndUpright_True', () => {
  assert.equal(shouldTip({ x: 0, y: 0, z: -2 }, upright, false), true);
});
test('shouldTip_FastOrTippedOrLeaning_False', () => {
  assert.equal(shouldTip({ x: 0, y: 0, z: -3 }, upright, false), false);
  assert.equal(shouldTip({ x: 0, y: 0, z: -2 }, upright, true), false);
  const lean = { x: 0, y: 0, z: Math.sin(Math.PI / 8), w: Math.cos(Math.PI / 8) }; // axle 45° up
  assert.equal(shouldTip({ x: 0, y: 0, z: -2 }, lean, false), false);
});
test('tipSpin_AboutRollDirection_SignFromRand', () => {
  const w = tipSpin({ x: 0, y: 0, z: -2 }, 0.2);
  close(w.x, 0); close(w.y, 0); close(w.z, 1.5);
  close(tipSpin({ x: 0, y: 0, z: -2 }, 0.8).z, -1.5);
});
```

- [ ] **Step 2: Run the tests and confirm they fail.**
  Run: `node --test test/tire.test.mjs`
  Expected: FAIL with "Cannot find module '../weapons/tire.js'".
- [ ] **Step 3: Implement `weapons/tire.js`** to the interfaces and Global
  Constraints.
  - The horizontal direction is `normalize(aim.x, 0, aim.z)`. Fall back to
    `normalize(camForward.x, 0, camForward.z)`.
  - ω is `(v.z, 0, -v.x) / radius`.
  - The quaternion rotates (0,1,0) onto `normalize(v.z, 0, -v.x)`.
- [ ] **Step 4: Run** `node --test test/*.test.mjs`. Expected: all pass.
- [ ] **Step 5: Commit**

```bash
git add weapons/tire.js test/tire.test.mjs
git commit -m "feat(ammo): add tractor tire launch and rolling math (#8)"
```

### Task 2: Tire in the game

**Files:**
- Modify: `index.html`. The parts touched:
  - the *Heavy & melee* ammo group (around line 87–90): add the button after Spear
  - the module imports (around line 141)
  - `shootBall()` (around lines 1064–1330): add the tire branch
  - the keydown handler (around line 1885): add `if (k === 't') setAmmo('tire');`
  - the ball loop in `animate()` (around line 2136): add the per-frame tire step
  - `removeProjectile()` (around line 1857): stop the rumble
  - the audio section (around line 1689): add the rumble

**Interfaces:**
- Consumes `TIRE`, `tireLaunch`, `rollingStep`, `shouldTip` and `tipSpin` from
  Task 1.
- Produces:
  - the ammo id `'tire'`
  - `rec.tipped` (boolean) and `rec.rumble` (a handle with `setSpeed(mps)` and
    `stop()`) on the tire's ball record
  - `function startRumble() -> { setSpeed(mps), stop() }`

- [ ] **Step 1: Add the button.**
  - Add `<button data-type="tire">` with a dark `.dot` with a yellow border, the
    label "Tractor tire" and the key hint `T`.
  - Add the `t` key binding.
- [ ] **Step 2: Add the tire branch in `shootBall()`**, handled before the generic
  spawn so the 1.2 m `start` is not used:
  1. Call `tireLaunch(camera.position, aimDir, cameraForwardXZ, power)`.
  2. Create the body with the Global Constraints collider, mass and material.
  3. Set the velocity, angular velocity and quaternion from the result.
  4. Build the procedural mesh as a `THREE.Group`:
     - a black rubber torus or cylinder
     - about 20–28 chunky tread boxes around the circumference
     - a yellow rim disc on both faces and a hub
     - the axle along the group's local +Y, so the body quaternion maps directly
  5. Push the record with `type: 'tire'`, `tipped: false` and
     `rumble: startRumble()`.
  6. Keep the existing `phys.onCollide` → `playBounce` behaviour.
- [ ] **Step 3: Add the per-frame step.** For `b.type === 'tire'`:
  1. Read v and ω.
  2. If `shouldTip(v, b.body.quaternion, b.tipped)`, set ω to `tipSpin(v, Math.random())`
     and `b.tipped = true`.
  3. Otherwise, if not tipped, apply `rollingStep(v, ω, dt)` back to the body.
  4. Call `b.rumble.setSpeed(Math.hypot(v.x, v.z))`.
  5. Once tipped and slower than 0.3 m/s, call `b.rumble.stop()`.
- [ ] **Step 4: Stop the rumble on removal.** In `removeProjectile(b)`, call
  `b.rumble?.stop()`.
- [ ] **Step 5: Run** `node --test test/*.test.mjs`. Expected: all pass.
- [ ] **Step 6: Manual check.** Serve with `python3 -m http.server 8000`.
  - Press T and fire at the Fortress at low and at full charge.
  - Expected:
    - the tire appears upright on the ground and rolls toward the aim
    - a full charge rolls visibly faster
    - it pushes blocks over
    - it slows, wobbles, falls flat and disappears about 12 s after launch
    - the rumble fades and stops
    - the console is empty
- [ ] **Step 7: Commit** `feat(ammo): add rolling tractor tire weapon (#8)`

### Task 3: Playtest and docs

**Files:**
- Modify: `README.md`. Add `T` (tractor tire) to the *Switch ammo* row, and add the
  tire to the *Heavy & melee* list.
- Modify: `CHANGELOG.md`, under `[Unreleased]` → `### Added`.

- [ ] **Step 1: Playtest.**
  - Fire one tire at each of Barrels, Fortress, Pyramid and Bowling.
  - Expected:
    - no tire flies
    - every tire ends lying flat
    - pressing R mid-roll silences the rumble immediately
    - Auto-Play still runs
  - Note the results in the PR body.
- [ ] **Step 2: Update the README**, as listed under Files.
- [ ] **Step 3: Update the CHANGELOG** with this entry: "Tractor tire weapon (key T):
  rolls into the target, then tips over and lies flat (#8)".
- [ ] **Step 4: Run** `node --test test/*.test.mjs`. Expected: all pass.
- [ ] **Step 5: Commit** with `docs: document tractor tire weapon` and the footer
  `Closes #8`.
