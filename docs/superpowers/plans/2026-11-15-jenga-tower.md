# Jenga Tower Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Jenga tower target (18 × 3 wooden blocks). On it, holding a press on a block pushes that block out with a capped force. A Shoot toggle switches back to the weapons. The round ends when the tower falls.

**Architecture:**
- The pure module `targets/jenga.js` holds the layout, the constants and the rule functions (push force, pulled, fallen). It is unit tested without THREE or the DOM.
- A new `jenga` contact material in `physics/materials.js`.
- The browser harness `test/harness/jenga.html` runs the real crashcat backend; the friction and the force cap are tuned with it.
- `index.html` wires the target, the pointer handling, the toggle and the HUD.

**Tech Stack:** buildless vanilla JS (ES modules), three.js 0.160, crashcat through the `phys` facade (`physics/backend-crashcat.js`), `node:test`, Python Playwright for the harness and the screenshots.

**Spec:** `docs/superpowers/specs/2026-11-15-jenga-tower-design.md`

## Global Constraints

- Desktop and every other target behave exactly as before. Jenga code paths run only when `targetMode === 'jenga'`.
- Every push is a force through `phys.applyForce`: no `setPosition`, no `setVelocity` and no kinematic movement on Jenga blocks.
- Jenga blocks use material `jenga`, never `masonry`, and get no `MASONRY_MASS_SCALE`.
- Block size: length 3.0, width 1.0, height 0.6. 18 layers, 0.001 clearance between neighbours.
- HUD texts, verbatim: `Blocks pulled` (score label) and `Tower fell! ${n} blocks pulled`.
- Follow the repo's CLAUDE.md: conventional commits, and a CHANGELOG and README update.
- Headless browser runs use `--use-gl=swiftshader --enable-unsafe-swiftshader`, wrapped in `timeout 180 systemd-run --user --scope -q -p MemoryMax=2G -p MemorySwapMax=0`. Stop the servers with `fuser -k <port>/tcp`.

## Review Focus

1. **A push on a middle block drags the layer above along.** Harness check 2 measures that the layer above moves less than 0.1.
2. **The untouched tower creeps or sags after being woken**, for example by a near miss in shoot mode. Harness check 1 wakes every block on purpose before measuring.
3. **Switching the target away from Jenga while a block is held**, or pressing Reset or starting Auto-Play, leaves a dangling push. Task 4 adds `stopPush()` on each of these paths, and the manual check in Task 4 covers them.
4. **A second finger during a push.** The push stops and the camera gesture takes over (`cancelCharge` path, #37).
5. **A pulled block falls onto the ground** and wrongly ends the round. The unit test `hasFallen_PulledBlockOnGround_False` covers it.

---

### Task 1: Pure Jenga module

**Files:**
- Create: `targets/jenga.js`
- Test: `test/jenga.test.mjs`

**Interfaces:**
- Produces:
  - `JENGA` — `{ length: 3.0, width: 1.0, height: 0.6, layers: 18, clearance: 0.001, mass: 6, pushSpeed: 0.6, gain: 20, maxPushForceFactor: 1.5, pulledFraction: 0.8, groundEps: 0.05 }`. Task 3 may retune `mass`, `pushSpeed`, `gain` and `maxPushForceFactor`; the tests read them from `JENGA`, not as literals.
  - `jengaTower(layers = JENGA.layers) → Array<{hx, hy, hz, x, y, z, ry, layer}>` — centred on x = 0, z = 0, ground at y = 0, `layer` 0-based. Layer k uses `ry = k % 2 ? Math.PI / 2 : 0`. Within a layer the three blocks are offset along the local z axis by `JENGA.width + JENGA.clearance`. Local x is the long axis (`hx = length / 2`).
  - `blockAxis(ry) → [ax, az]` — the long axis in world xz, using the three.js convention `[Math.cos(ry), -Math.sin(ry)]`, the same as `test/layout-geometry.mjs`.
  - `pushSign(axis, center, hit) → 1 | -1` — the sign of `dot(center - hit, axis)` in xz; returns 1 when the dot is 0.
  - `pushForce(vAlong, mass, g = 9.82) → number` — `clamp(JENGA.gain * mass * (JENGA.pushSpeed - vAlong), 0, JENGA.maxPushForceFactor * mass * g)`.
  - `isPulled(home, pos, axis) → boolean` — `|dot(pos - home, axis)| > JENGA.pulledFraction * JENGA.length`, in xz.
  - `hasFallen(blocks, activeIndex) → boolean`. Each block is `{ layer, homeY, y, hy, pulled }`. It returns true when either holds:
    - (a) some block with index ≠ activeIndex, `!pulled` and `layer ≥ 1` has `y - hy < JENGA.groundEps`;
    - (b) the mean `y` of the non-pulled top-layer blocks is below their mean `homeY` by more than `JENGA.height / 2`.

- [ ] **Step 1: Write the failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JENGA, jengaTower, blockAxis, pushSign, pushForce, isPulled, hasFallen } from '../targets/jenga.js';
import { boxesOverlap } from './layout-geometry.mjs';

test('jengaTower_Default_18LayersOf3', () => {
  const t = jengaTower();
  assert.equal(t.length, 54);
  for (let k = 0; k < 18; k++) assert.equal(t.filter(b => b.layer === k).length, 3);
});
test('jengaTower_LayersAlternateCrosswise', () => {
  const t = jengaTower();
  assert.equal(t.find(b => b.layer === 0).ry, 0);
  assert.equal(t.find(b => b.layer === 1).ry, Math.PI / 2);
});
test('jengaTower_BlocksRestOnLayerBelow', () => {
  for (const b of jengaTower()) assert.ok(Math.abs((b.y - b.hy) - b.layer * JENGA.height) < 1e-9);
});
test('jengaTower_NoOverlaps', () => {
  const t = jengaTower();
  for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) assert.equal(boxesOverlap(t[i], t[j]), false, `${i}/${j}`);
});
test('jengaTower_CentredAndSized', () => {
  const t = jengaTower();
  const b = t[0];
  assert.deepEqual([b.hx, b.hy, b.hz], [1.5, 0.3, 0.5]);
  assert.ok(Math.abs(t.filter(b => b.layer === 0).reduce((s, b) => s + b.z, 0)) < 1e-9);
});
test('blockAxis_ZeroAndQuarterTurn', () => {
  assert.deepEqual(blockAxis(0), [1, -0]);
  const [ax, az] = blockAxis(Math.PI / 2);
  assert.ok(Math.abs(ax) < 1e-9 && Math.abs(az + 1) < 1e-9);
});
test('pushSign_TouchAtPlusEnd_PushesMinus', () => {
  assert.equal(pushSign([1, 0], { x: 0, z: 0 }, { x: 1.5, z: 0.2 }), -1);
  assert.equal(pushSign([1, 0], { x: 0, z: 0 }, { x: -1.5, z: 0 }), 1);
  assert.equal(pushSign([1, 0], { x: 0, z: 0 }, { x: 0, z: 0.5 }), 1);
});
test('pushForce_AtRest_PositiveAndCapped', () => {
  const cap = JENGA.maxPushForceFactor * JENGA.mass * 9.82;
  assert.equal(pushForce(0, JENGA.mass), Math.min(JENGA.gain * JENGA.mass * JENGA.pushSpeed, cap));
  assert.ok(pushForce(-100, JENGA.mass) <= cap + 1e-9);
});
test('pushForce_AtOrAboveTargetSpeed_Zero', () => {
  assert.equal(pushForce(JENGA.pushSpeed, JENGA.mass), 0);
  assert.equal(pushForce(5, JENGA.mass), 0);
});
test('isPulled_Threshold', () => {
  const home = { x: 0, z: 0 }, ax = [1, 0];
  assert.equal(isPulled(home, { x: 0.8 * 3.0 - 0.01, z: 0 }, ax), false);
  assert.equal(isPulled(home, { x: -(0.8 * 3.0 + 0.01), z: 0 }, ax), true);
  assert.equal(isPulled(home, { x: 0, z: 5 }, ax), false);
});
const blk = (layer, dy = 0, extra = {}) => ({ layer, homeY: layer * 0.6 + 0.3, y: layer * 0.6 + 0.3 + dy, hy: 0.3, pulled: false, ...extra });
test('hasFallen_IntactTower_False', () => {
  const bs = []; for (let k = 0; k < 18; k++) for (let i = 0; i < 3; i++) bs.push(blk(k));
  assert.equal(hasFallen(bs, -1), false);
});
test('hasFallen_ForeignBlockOnGround_True', () => {
  const bs = [blk(0), blk(5, -5 * 0.6), blk(17)];
  assert.equal(hasFallen(bs, -1), true);
});
test('hasFallen_ActiveOrPulledBlockOnGround_False', () => {
  assert.equal(hasFallen([blk(0), blk(5, -3), blk(17)], 1), false);
});
test('hasFallen_PulledBlockOnGround_False', () => {
  assert.equal(hasFallen([blk(0), blk(5, -3, { pulled: true }), blk(17)], -1), false);
});
test('hasFallen_TopLayerSinksHalfBlock_True', () => {
  assert.equal(hasFallen([blk(0), blk(17, -0.31), blk(17, -0.31), blk(17, -0.31)], -1), true);
  assert.equal(hasFallen([blk(0), blk(17, -0.29), blk(17, -0.29), blk(17, -0.29)], -1), false);
});
```

- [ ] **Step 2: Run the tests and check that they fail**

Run: `node --test test/jenga.test.mjs`
Expected: FAIL with "Cannot find module ... targets/jenga.js".

- [ ] **Step 3: Implement `targets/jenga.js` with the exports from the Interfaces block**

Match the header comment style of `targets/apk-layouts.js` (spec path, units). The top layer in `hasFallen` is the maximum `layer` present among the blocks passed in.

- [ ] **Step 4: Run the tests and check that they pass**

Run: `node --test test/*.test.mjs`
Expected: all pass, with 15 new tests.

- [ ] **Step 5: Commit**

`git add targets/jenga.js test/jenga.test.mjs && git commit -m "feat(targets): Jenga layout and push rules (#34)"`

### Task 2: Jenga contact material

**Files:**
- Modify: `physics/materials.js` (the `MATERIALS` array and `CONTACT_PAIRS`)
- Test: `test/materials.test.mjs`

**Interfaces:**
- Produces: the material name `'jenga'` and the pairs `jenga|jenga {0.06, 0}`, `jenga|ground {0.5, 0}`, `jenga|ball {0.4, 0.2}`, `jenga|heavy {0.5, 0.05}` and `jenga|barrel {0.4, 0.1}`. Task 3 may retune `jenga|jenga` and must then update this test.

- [ ] **Step 1: Write the failing test**

```js
test('contactFor_Jenga_SlipperyWood', () => {
  assert.deepEqual(contactFor('jenga', 'jenga'), { friction: 0.06, restitution: 0.0 });
  assert.deepEqual(contactFor('jenga', 'ground'), { friction: 0.5, restitution: 0.0 });
  assert.deepEqual(contactFor('ball', 'jenga'), { friction: 0.4, restitution: 0.2 });
});
```

Change `CONTACT_PAIRS_HasSeventeenPairs` to `CONTACT_PAIRS_HasTwentyTwoPairs`, asserting 22.

- [ ] **Step 2: Run it and check that it fails**

Run: `node --test test/materials.test.mjs`
Expected: FAIL in the Jenga test and in the count test.

- [ ] **Step 3: Add `'jenga'` to `MATERIALS` and the 5 pairs, with a short comment pointing to #34**

- [ ] **Step 4: Run it and check that it passes**

Run: `node --test test/*.test.mjs`
Expected: all pass.

- [ ] **Step 5: Commit**

`git commit -am "feat(physics): slippery wood material for Jenga blocks (#34)"`

### Task 3: Jenga physics harness and tuning

**Files:**
- Create: `test/harness/jenga.html`
- Modify, when the tuning requires it: `targets/jenga.js` (`JENGA` values), `physics/materials.js` (`jenga|jenga`), `test/materials.test.mjs`

**Interfaces:**
- Consumes:
  - from Task 1: `jengaTower`, `blockAxis`, `pushSign`, `pushForce`, `isPulled`, `hasFallen`, `JENGA`;
  - from Task 2: the material `jenga`;
  - the `phys` facade: `createCrashcatBackend`, `addBody`, `step`, `getVelocity`, `applyForce`, `wake`.
- Produces: the harness title `JENGA PASS` / `JENGA FAIL`, and the tuned values that Task 4 uses through `JENGA` and the material table.

The harness follows the structure of `test/harness/barrel-support.html`: the import map, `row(pass, name, detail)`, and the title set at the end.

- Build the static ground and the 54 blocks the way Task 4 does in the game:
  - box shape, `mass: JENGA.mass`, `material: 'jenga'`, `startAsleep: true`;
  - `linearDamping: 0.15`, `angularDamping: 0.3`, `sleepSpeedLimit: 0.3`, `sleepTimeLimit: 0.5`;
  - the quaternion from `ry`.
- Step at 1/60 s.
- `holdPush(i, seconds)` applies, every frame, the force `pushSign × pushForce(vAlong)` along `blockAxis(ry)` with `phys.applyForce`. `vAlong` is the body's velocity projected on the axis times the sign. The hit point is the +x end of the block, which mimics a touch on that end.
- After every push the harness counts a block as pulled with `isPulled` and checks `hasFallen` on the full tower.

- [ ] **Step 1: Write the harness with these 5 checks** (layers 1-based here, as in the spec, so layer 9 is `layer === 8`):
  1. `stable` — wake every block, run 5 s, and expect a maximum displacement from home below 0.02.
  2. `push-middle` — on a fresh tower, hold the push on the middle block of layer 9. Expect it pulled within 6 s, the blocks of layer 10 moved less than 0.1, and `hasFallen` false.
  3. `push-side` — on a fresh tower, push a side block of layer 9. Expect it pulled within 6 s and `hasFallen` false.
  4. `stuck-bottom` — on a fresh tower, hold the push on the middle block of layer 1 for 3 s. Expect it not pulled.
  5. `collapse` — on a fresh tower, push out both side blocks of layer 9, then the middle one, until all three are pulled or 15 s have passed. Then run 3 s more and expect `hasFallen` true.

  Print the measured values in each detail string (displacement, seconds until pulled, movement of layer 10).

- [ ] **Step 2: Run it and record the baseline**

Serve the repo with `python3 -m http.server <port>`, open `test/harness/jenga.html` in Playwright, and wait for `/(PASS|FAIL)$/` in the title (timeout 120 s). Expected at first: some checks FAIL, with their measurements.

- [ ] **Step 3: Tune `jenga|jenga` friction, `JENGA.maxPushForceFactor`, `gain` and `pushSpeed` until all 5 pass**

The spec gives the friction window 0.043 < μ < 0.079 at a cap of 1.5 × the block's weight. If no combination passes checks 2 and 4 together, keep check 2. Record the measured window in the harness comment and in the PR, and mark check 4 as `info` rather than FAIL. Update the literals in `test/materials.test.mjs` to the tuned friction.

- [ ] **Step 4: Run the harness and all unit tests**

Run the harness: expected `JENGA PASS`. Run `node --test test/*.test.mjs`: expected all pass. Run the other three harnesses: expected PASS each.

- [ ] **Step 5: Commit**

`git add test/harness/jenga.html targets/jenga.js physics/materials.js test/materials.test.mjs && git commit -m "test(harness): Jenga push and collapse harness with tuned friction (#34)"`

### Task 4: Wire the Jenga target into the game

**Files:**
- Modify: `index.html`:
  - target picker `.target` "Towers" group (~line 262): add `<button data-mode="jenga">Jenga</button>`;
  - `camCfg` (~line 1060): add `jenga: { r: 26, ty: 5.5, tz: -6, plat: false, build: setupJenga }`, tuned so the tower is framed at 1280×720;
  - a new `setupJenga()` next to `placeLayout` (~line 826);
  - the pointer handlers (canvas `pointerdown` ~line 1980, `pointerup`);
  - the animate loop (next to the "down" detection ~line 2436);
  - `updateHud()` (~line 2202) and `reset()`;
  - the mobile `#mob-bar` (~line 213) and the desktop buttons next to `#autoplay`.

**Interfaces:**
- Consumes: everything from Task 1, the material `jenga`, and the `raycaster`/`mouseNDC` pattern already used at ~line 1664.
- Produces, inside index.html:
  - `setupJenga()` adds the 54 blocks to `barrels` with `{ body, mesh, home, homeQ, down, jenga: { layer, axis, hy, pulled } }`, at `zC = -6` (z offset). It uses `TSCALE` 1 (add `'jenga'` to the TSCALE 1 list in `buildTargets`) and light wood `MeshStandardMaterial`s.
  - `jengaShoot` (boolean, default false), toggled by `#jenga-shoot` (desktop) and `#mob-jenga-shoot` (mobile). Both are visible only when `targetMode === 'jenga'`. Their label reads `🔫 Shoot` in push mode and `✋ Push` in shoot mode.
  - `pushState` is `null` or `{ index, sign }`, with `startPush(e)` and `stopPush()`.
  - `jengaOver` (boolean).

- [ ] **Step 1: Add the target button, `camCfg`, `setupJenga()` and the toggle buttons with their CSS**

Match the existing buttons. In `.target` and in mobile mode, put the toggle in `#mob-bar`. On desktop, put it under `#autoplay`.

- [ ] **Step 2: Add push mode to the pointer handlers**

On a left press or one finger, when `targetMode === 'jenga' && !jengaShoot && !autoPlay && !jengaOver`, call `startPush(e)` and `return` before the charge or Magneto code:
- raycast against the Jenga meshes;
- on a hit, set `pushState = { index, sign: pushSign(axis, body.position, hit.point) }`;
- on a miss, do nothing.

`stopPush()` runs on `pointerup`, on `pointercancel`, inside `cancelCharge()` (the second finger, #37), in `buildTargets()`, in `reset()` and when Auto-Play starts.

- [ ] **Step 3: Apply the push and the rules in the animate loop**

While `pushState` is set, before `phys.step`, apply `sign × pushForce(vAlong, mass)` along the axis with `phys.applyForce`, as in the harness. After the mesh sync:
- For each Jenga block not yet pulled where `isPulled` holds: set `pulled = true` and `down = true`, then call `updateHud()`.
- If `!jengaOver && hasFallen(...)` (activeIndex = `pushState?.index ?? -1`): set `jengaOver = true`, call `stopPush()`, call `updateHud()`.
- Skip the generic orientation/displacement "down" check for Jenga blocks. On Jenga, `down` means pulled.

- [ ] **Step 4: Update the HUD for Jenga**

In `updateHud()`, when `targetMode === 'jenga'`:
- set `#scoreLabel` to `Blocks pulled` and the score to the pulled count without `/total`;
- when `jengaOver`, set the label to `Tower fell! ${n} blocks pulled` and the score colour to red `oklch(0.65 0.2 25)`.

`reset()` clears `jengaOver` and the colour. Other targets are unchanged. Also add the Jenga line to the `scoreLabel` mapping in `buildTargets`.

- [ ] **Step 5: Verify in the browser**

Use Playwright with screenshots, and look at each one with the Read tool:
- 1280×720: the full tower is visible and the toggle shows only on Jenga.
- 390×844 (mobile, touch): the tower fits and the toggle is in `#mob-bar`.

Drive a push with `page.mouse.down()`, hold 6 s, then `up()` on the middle block of a middle layer (find its screen position by projecting `body.position` through `page.evaluate`). Expect the HUD to show `1`. Then:
- switch to Barrels during a hold: no errors, and no push is left running;
- Shoot toggle on: a click fires a ball.

Run `node --test test/*.test.mjs` and all 4 harnesses: expected all pass.

- [ ] **Step 6: Commit**

`git commit -am "feat(targets): Jenga tower with hold-to-push mode (#34)"`

### Task 5: Docs

**Files:**
- Modify: `README.md` (targets list and controls), `CHANGELOG.md` (Unreleased → Added)

- [ ] **Step 1: Add the Jenga target, the hold-to-push control and the Shoot toggle to the README. Add a CHANGELOG line: "Jenga tower: hold a block to push it out; the round ends when the tower falls (#34)"**

- [ ] **Step 2: Commit**

`git commit -am "docs: Jenga tower in README and CHANGELOG (#34)"`
