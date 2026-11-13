# Sniper bullet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Sniper lens fires a fast, straight, visible tracer round (160-240 m/s, no gravity) that still hits
barrels physically with today's impact strength (#30).

**Architecture:** A pure module `weapons/sniper.js` holds the tuning numbers and the small helpers (speed, cull, tracer
length). The crashcat facade gets one additive option and one method (`gravityFactor`, `setGravityFactor`).
`index.html` wires the sniper branch to them and builds the tracer mesh. Tunnelling is handled by the existing
`LINEAR_CAST` (`fast: true`), proven by a contract case.

**Tech Stack:** Buildless vanilla JS (ES modules), crashcat 0.0.5 via the `phys` facade, `node --test` for pure
modules, the browser contract harness `test/harness/physics-contract.html`.

**Spec:** `docs/superpowers/specs/2026-11-13-sniper-bullet-design.md`

## Global Constraints

- Scope: only the `sniper` ammo type. No change to other weapons, `penetrationSlop`, materials or the FOV 26 lens.
- Game code goes through the `phys` facade only; never touch `body.raw` or crashcat from `index.html` or `weapons/sniper.js`.
- Not hitscan; no per-step ray cast. Tunnelling safety is `fast: true` (LINEAR_CAST), measured: 135/135 hits and a thin
  wall stopped 40/40 at 160-250 m/s.
- Numbers (measured in the spec): mass 1.0, collision radius 0.1, speed `160 + power * 80`, gravity factor 0 until the
  first contact, cull at 150 m from the muzzle.
- Anchor edits in `index.html` by the quoted text, not by line number: issue #28 is being implemented in parallel and
  edits `camCfg`, `buildTargets` and `animate()`. Do not touch those; the only `animate()` edit is the small tracer
  block in Task 4, placed inside the existing `// sync balls, cull old ones` loop.
- Issue #29 (Magneto) may edit `physics/backend-crashcat.js` concurrently. The Task 2 change is purely additive
  (one option line, one new function, one export entry), so a rebase conflict is resolved by keeping both sides.
- No new dependencies, no `package.json`. Tests: `node --test test/*.test.mjs` (not `node --test test/`).
- TDD per repo `CLAUDE.md`: failing test first, never edit a test to make it pass. Test names `function_State_Expected`.

## Review Focus

- **Straight flight:** the round must not drop at all before first contact (contract case, Task 2).
- **Gravity back after contact:** a glancing round must fall, not slide away at 200 m/s (Task 2 + Task 3).
- **Tunnelling:** `sniper` must stay in `fastProjectiles`; the thin-wall contract case guards it (Task 2).
- **Impact strength:** mass and speed stay as in `weapons/sniper.js`; barrel peak speed 19-29 m/s (Task 5 harness).
- **Cull:** a missed round is removed at 150 m, no leak of zero-gravity bodies (Task 1 test, Task 3 wiring).

---

## File Structure

- Create `weapons/sniper.js`: tuning constants and pure helpers.
- Create `test/sniper.test.mjs`: node tests for the helpers.
- Modify `physics/backend-crashcat.js`: `gravityFactor` spec option, `setGravityFactor()`.
- Modify `test/harness/contract.js`: three new cases.
- Modify `index.html`: import, `sniper` cfg, body creation, launch speed, collide callback, mesh, cull, tracer sync.
- Create `test/harness/sniper-flight.html`: headless-checkable flight and hit-strength page.

---

### Task 1: Pure sniper module

**Files:**
- Create: `weapons/sniper.js`
- Test: `test/sniper.test.mjs`

**Interfaces:**

```js
export const SNIPER = { mass: 1.0, radius: 0.1, speedBase: 160, speedPower: 80, cullDistance: 150, streakLength: 3 };
export function sniperSpeed(power)            // -> 160 + clamp(power,0,1) * 80
export function isOutOfRange(start, pos)      // -> true when distance(start,pos) >= SNIPER.cullDistance
export function streakLength(flown)           // -> min(SNIPER.streakLength, max(flown, 0))
```

- [ ] **Step 1: Write the failing test**

```js
// test/sniper.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { SNIPER, sniperSpeed, isOutOfRange, streakLength } from '../weapons/sniper.js';

test('sniperSpeed_PowerRange_Between160And240', () => {
  assert.equal(sniperSpeed(0), 160);
  assert.equal(sniperSpeed(1), 240);
  assert.equal(sniperSpeed(0.5), 200);
});

test('sniperSpeed_PowerOutOfRange_Clamped', () => {
  assert.equal(sniperSpeed(-1), 160);
  assert.equal(sniperSpeed(5), 240);
});

test('isOutOfRange_Under150m_False', () => {
  assert.equal(isOutOfRange({ x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: -149 }), false);
});

test('isOutOfRange_At150m_True', () => {
  assert.equal(isOutOfRange({ x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: -150 }), true);
});

test('streakLength_JustFired_CappedToDistanceFlown', () => {
  assert.equal(streakLength(0), 0);
  assert.equal(streakLength(1.5), 1.5);
  assert.equal(streakLength(40), SNIPER.streakLength);
});

test('SNIPER_Tuning_MatchesSpec', () => {
  assert.equal(SNIPER.mass, 1.0);
  assert.equal(SNIPER.radius, 0.1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/sniper.test.mjs`
Expected: FAIL, module `weapons/sniper.js` not found.

- [ ] **Step 3: Write the module**

```js
// Sniper tracer round: tuning and pure helpers. No engine, no DOM.
// Numbers measured in docs/superpowers/specs/2026-11-13-sniper-bullet-design.md:
// mass 1.0 at 160-240 m/s gives the same barrel response (19-29 m/s) as the old 6 kg round at 42-60 m/s.

export const SNIPER = { mass: 1.0, radius: 0.1, speedBase: 160, speedPower: 80, cullDistance: 150, streakLength: 3 };

export function sniperSpeed(power) {
  const p = Math.min(Math.max(power, 0), 1);
  return SNIPER.speedBase + p * SNIPER.speedPower;
}

export function isOutOfRange(start, pos) {
  return Math.hypot(pos.x - start.x, pos.y - start.y, pos.z - start.z) >= SNIPER.cullDistance;
}

export function streakLength(flown) {
  return Math.min(SNIPER.streakLength, Math.max(flown, 0));
}
```

- [ ] **Step 4: Run tests**

Run: `node --test test/*.test.mjs`
Expected: all pass, including the existing ones.

- [ ] **Step 5: Commit**

`git add weapons/sniper.js test/sniper.test.mjs && git commit -m "feat(weapons): sniper tuning and helpers (#30)"`

---

### Task 2: Facade gravity factor and contract cases

**Files:**
- Modify: `physics/backend-crashcat.js`
- Modify: `test/harness/contract.js`

**Interfaces:** `phys.addBody({ ..., gravityFactor })` (optional number, default 1); `phys.setGravityFactor(handle, factor)`.

- [ ] **Step 1: Write the failing contract cases**

Add to the `cases` array in `runContract` (after `unsupportedSleeperFalls`) and define them next to the others, using
the file's existing `step`, `cleanup` and `box` helpers:

```js
    zeroGravityFliesStraight,
    setGravityFactorRestoresFall,
    fastSphereDoesNotTunnelThinWall,
```

```js
function zeroGravityFliesStraight(phys) {
  const b = phys.addBody({ shape: { kind: 'sphere', radius: 0.1 }, mass: 1, material: 'heavy',
    position: { x: 0, y: 5, z: 0 }, fast: true, gravityFactor: 0 });
  phys.setVelocity(b, 0, 0, -200);
  step(phys, 0.1);
  const y = b.position.y, z = b.position.z;
  cleanup(phys, [b]);
  const pass = Math.abs(y - 5) < 0.001 && z < -19 && z > -21;
  return { name: 'zeroGravityFliesStraight', pass, detail: `y=${y.toFixed(4)} z=${z.toFixed(2)} expected y=5, z~-20` };
}

function setGravityFactorRestoresFall(phys) {
  const b = phys.addBody({ shape: { kind: 'sphere', radius: 0.1 }, mass: 1, material: 'heavy',
    position: { x: 0, y: 50, z: 0 }, gravityFactor: 0 });
  step(phys, 0.5);
  const hovered = b.position.y;
  phys.setGravityFactor(b, 1);
  step(phys, 0.5);
  const fell = b.position.y;
  cleanup(phys, [b]);
  const pass = Math.abs(hovered - 50) < 0.001 && fell < 50 - 1;
  return { name: 'setGravityFactorRestoresFall', pass, detail: `hover y=${hovered.toFixed(3)}, after y=${fell.toFixed(3)}` };
}

function fastSphereDoesNotTunnelThinWall(phys) {
  // 240 m/s moves 1 m per 1/240 s step; the wall is 0.1 m thick. Sweep the start phase over one step.
  let stopped = 0, n = 0;
  for (let d = 8; d < 8.84; d += 0.021) {
    n++;
    const wall = phys.addBody({ shape: { kind: 'box', halfExtents: [3, 3, 0.05] }, mass: 0, isStatic: true,
      material: 'stone', position: { x: 0, y: 1, z: -d } });
    const b = phys.addBody({ shape: { kind: 'sphere', radius: 0.14 }, mass: 1.2, material: 'heavy',
      position: { x: 0, y: 1, z: 0 }, fast: true, gravityFactor: 0 });
    phys.setVelocity(b, 0, 0, -240);
    step(phys, 0.5);
    if (b.position.z > -d) stopped++;
    cleanup(phys, [b, wall]);
  }
  return { name: 'fastSphereDoesNotTunnelThinWall', pass: stopped === n, detail: `stopped ${stopped}/${n}` };
}
```

Check the signatures of `step`, `cleanup` and `box` in `contract.js` first and adapt the calls if they differ.

- [ ] **Step 2: Run the harness to verify it fails**

Serve and open the page headless (Python Playwright with the user site, no `-I`; serve with `python3 -m http.server`
on a free port, kill it by port afterwards; cap with `systemd-run --user --scope -q -p MemoryMax=2G -p MemorySwapMax=0`):
`test/harness/physics-contract.html`. Expected: the first two new cases FAIL (`setGravityFactor` is not a function,
gravity not applied as requested); the thin-wall case may fail on `gravityFactor` being ignored.

- [ ] **Step 3: Implement in the facade**

In `addBody`, after the `if (spec.fast) opts.motionQuality = ...` line:

```js
    if (spec.gravityFactor != null) opts.gravityFactor = spec.gravityFactor;
```

Next to `wake` / `isSleeping`:

```js
  function setGravityFactor(h, factor) { h.raw.motionProperties.gravityFactor = factor; }
```

Add `setGravityFactor` to the returned object (next to `wake, isSleeping`).

- [ ] **Step 4: Run the harness**

Expected: every case passes, including the 15 existing ones; thin-wall reports `stopped 40/40`-style full count.

- [ ] **Step 5: Commit**

`git add physics/backend-crashcat.js test/harness/contract.js && git commit -m "feat(physics): gravityFactor option and setGravityFactor on the facade (#30)"`

---

### Task 3: Wire the physics body in index.html

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Import** next to the existing module imports (search for `import { createCrashcatBackend }`):

```js
import { SNIPER, sniperSpeed, isOutOfRange } from './weapons/sniper.js';
```

- [ ] **Step 2: Config.** In the `cfg` table of `shootBall()` replace `sniper:      { mass: 6,   r: 0.14 },` with:

```js
    sniper:      { mass: SNIPER.mass, r: SNIPER.radius },
```

- [ ] **Step 3: Body creation.** In the `phys.addBody({...})` call of `shootBall()`, after the `fast:` line add:

```js
    gravityFactor: type === 'sniper' ? 0 : undefined,
```

- [ ] **Step 4: Speed.** Replace `speed = 42 + power * 18;   // fast, flat precision round` with:

```js
    speed = sniperSpeed(power);   // 160-240 m/s tracer, no gravity until first contact (#30)
```

Also, for the sniper, skip the random angular velocity (a spinning invisible sphere is harmless, but the mesh is
oriented by velocity): leave the `else` branch as is.

- [ ] **Step 5: Gravity back on first contact and muzzle point.** In the `rec` creation add `muzzle: { x: start.x, y: start.y, z: start.z }`.
At the top of the `phys.onCollide(body, (other, impactSpeed) => {` callback of `shootBall()` add:

```js
    if (type === 'sniper' && !rec.hit) { rec.hit = true; rec.hitAt = performance.now(); phys.setGravityFactor(body, 1); }
```

- [ ] **Step 6: Cull.** In the `// sync balls, cull old ones` loop, before `const cullTime`, add:

```js
    if (b.type === 'sniper' && !b.hit && isOutOfRange(b.muzzle, b.body.position)) { removeProjectile(b); balls.splice(i, 1); continue; }
```

- [ ] **Step 7: Verify** with Task 5's harness once it exists; for now `node --test test/*.test.mjs` still passes and the page loads without console errors (serve, open headless, read console).

- [ ] **Step 8: Commit**

`git add index.html && git commit -m "feat(weapons): sniper round flies straight at 160-240 m/s with 1 kg (#30)"`

---

### Task 4: Tracer mesh

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Mesh.** Replace the sniper branch of the mesh builder (`} else if (type === 'sniper') { mesh = new THREE.Mesh(ballGeo, ...` through its `mesh.scale.setScalar(0.14 / BALL_R);`) with:

```js
  } else if (type === 'sniper') {
    // tracer: bright capsule core + additive streak behind it; +Y is the flight direction (like the spear)
    mesh = new THREE.Group();
    const core = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.5, 4, 8),
      new THREE.MeshBasicMaterial({ color: '#fff1b0' }));
    mesh.add(core);
    const streakMat = new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false });
    const streak = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.07, 1, 8, 1, true), streakMat);
    streak.userData.isStreak = true;
    mesh.add(streak);
    mesh.userData.streak = streak;
```

Keep the generic `mesh.castShadow = true;` after the chain but guard it: `mesh.castShadow = type !== 'sniper';`.

- [ ] **Step 2: Orientation, streak length and fade.** In the `// sync balls, cull old ones` loop, right after `b.mesh.quaternion.copy(b.body.quaternion);` add:

```js
    if (b.type === 'sniper') {
      const sv = phys.getVelocity(b.body);
      const sl = Math.hypot(sv.x, sv.y, sv.z);
      if (sl > 5 && !b.hit) {
        b.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(sv.x / sl, sv.y / sl, sv.z / sl));
      }
      const flown = Math.hypot(b.body.position.x - b.muzzle.x, b.body.position.y - b.muzzle.y, b.body.position.z - b.muzzle.z);
      const len = streakLength(flown);
      const st = b.mesh.userData.streak;
      st.scale.set(1, Math.max(len, 0.001), 1);
      st.position.y = -(0.25 + len / 2);
      st.material.opacity = b.hit ? Math.max(0, 0.55 * (1 - (now - b.hitAt) / 120)) : 0.55;
    }
```

Extend the Task 3 import to include `streakLength`. After a hit the body tumbles under the physics quaternion
(the `copy` line above), which is intended.

- [ ] **Step 2b: Lens check.** The round starts 1.2 m ahead of the camera; with `len` capped to distance flown the streak never reaches the camera. Confirm by a headless screenshot in Task 5.

- [ ] **Step 3: Commit**

`git add index.html && git commit -m "feat(weapons): sniper tracer mesh with streak (#30)"`

---

### Task 5: Flight and hit-strength harness, final check

**Files:**
- Create: `test/harness/sniper-flight.html`

- [ ] **Step 1: Write the page.** Model it on `test/harness/physics-contract.html` (same importmap, same `createCrashcatBackend` + `import('https://esm.sh/crashcat@0.0.5')` bootstrap). It builds a ground plane and one barrel (cylinder r `0.45*1.05`, h 1.1, mass 8, material `barrel`) 20 m away at z = -20, fires a sniper round built from `SNIPER` at `sniperSpeed(0.5)` from (0, 0.56, 0) with `fast: true, gravityFactor: 0`, steps 120 x 1/60 s via `phys.step`, and prints PASS/FAIL lines to `#out`, setting `document.title = 'DONE'` at the end:

  1. `straight`: with no barrel placed, after 0.1 s the round's y differs from 0.56 by < 1 mm.
  2. `hitsBarrel`: with the barrel, the collide callback fires.
  3. `peakBarrelSpeed`: the peak barrel speed over the run is between 19 and 29 m/s for power 0 to 1 (run power 0, 0.5, 1; 19.2 / 24.3 / 29.2 expected, allow 17-31).
  4. `culled`: with no barrel, `isOutOfRange(muzzle, position)` becomes true within 1.2 s of flight.

- [ ] **Step 2: Run it headless** (Python Playwright, user site, no `-I`; `python3 -m http.server <port>`, kill by port afterwards; capped with `systemd-run --user --scope -q -p MemoryMax=2G -p MemorySwapMax=0`). Expected: all four PASS. Also load `index.html`, press `Q`, fire once, take a screenshot a few frames after the shot and check the tracer is visible and the console is clean.

- [ ] **Step 3: Full suite.** `node --test test/*.test.mjs` passes; the contract harness passes.

- [ ] **Step 4: Commit**

`git add test/harness/sniper-flight.html && git commit -m "test(weapons): sniper flight and hit-strength harness (#30)"`
