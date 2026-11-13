# Barrel Support Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a barrel in the oil or wooden barrel pyramid loses its footing, it tips into the gap
instead of hanging in place, and the stack slumps from the gap upward (#28).

**Architecture:** A new module `targets/barrel-support.js` holds the pure geometry (support test,
push direction) plus a small controller `createBarrelSupport()` that only talks to the `phys`
facade. `index.html` creates one controller, calls `tick()` from `animate()` in the two barrel
modes and `reset()` when targets are rebuilt. A browser harness page proves the acceptance
scenarios on the real crashcat backend.

**Tech Stack:** Buildless vanilla JS (ES modules), crashcat via the `phys` facade, `node --test`
for pure modules, browser harness pages under `test/harness/`.

**Spec:** `docs/superpowers/specs/2026-11-13-barrel-support-check-design.md`

## Global Constraints

- Scope: only the `barrels` and `woodbarrels` modes; pieces with `material === 'barrel'`. No change in any other mode.
- No engine or physics-material retuning; no change to `wakeAroundMovers()` in `physics/backend-crashcat.js`.
- Game code goes through the `phys` facade only; never touch `body.raw` or crashcat from `targets/barrel-support.js`.
- No new dependencies, no `package.json`. Tests: `node --test test/*.test.mjs` (not `node --test test/`).
- TDD per repo `CLAUDE.md`: failing test first, never edit a test to make it pass. Test names `function_State_Expected`.
- Geometry (from `index.html`): `BARREL_R = 0.45`, physics radius `BARREL_R * 1.05 = 0.4725`, `BARREL_H = 1.1`, mass `8`, row spacing `BARREL_R * 2.3`, platform top `platH = 0.5`, ground top `0`.
- Tolerances (agent's calls in the spec): COM margin `0.015` m (must stay well under the 4.5 cm #28 overhang), check period `120` ms.
- "No pop" is a hard limit: the check never applies an upward impulse and never pushes a barrel that passes the support test. Realism beats "push once": repeat the same small push, bounded.

## Review Focus

- **Barrel resting on a tilted or fallen barrel:** a non-upright barrel is not a flat support; the upright barrel above must be judged by its other supports only. Test in Task 1 (`supportPatches_TiltedNeighbour_Ignored`).
- **Barrel pushed but held by the rows above:** after `repushMs` it must be pushed again with the same small push, at most `maxPushes` times. Test in Task 2 (`selectPushes_StillUnsupportedAfterRepushDelay_PushedAgain`, `..._AfterMaxPushes_NotPushed`).
- **Mode switch mid-collapse:** push bookkeeping must not leak into the next build. Test in Task 2 (`reset_ClearsPushLogAndDisturbed`).
- **Untouched pyramid:** the check must not even run before the structure is disturbed. Test in Task 2 (`tick_NeverDisturbed_NoPushes`).
- **Harpoon/magneto/earthquake moving barrels:** these count as disturbance and are fine; the check must not fight them (it only pushes upright, slow, unsupported barrels). Covered by the upright/slow filter test in Task 2.

---

## File Structure

- Create `targets/barrel-support.js`: pure geometry plus the `createBarrelSupport` controller.
- Create `test/barrel-support.test.mjs`: unit tests for the module.
- Create `test/harness/barrel-support.html`: browser harness for the acceptance scenarios on real crashcat.
- Modify `index.html`: import, `support: true` flags in `camCfg`, `tick()` in `animate()`, `reset()` in `buildTargets()`.
- Modify `README.md` (one line next to the existing Tests paragraph) and `CHANGELOG.md` (`[Unreleased]` entry, written by hand, never `git cliff`).

---

### Task 1: Support geometry

**Files:**
- Create: `targets/barrel-support.js`
- Test: `test/barrel-support.test.mjs`

**Interfaces:**
- Produces:
  - `export const SUPPORT = { r: 0.4725, h: 1.1, comMargin: 0.015, contactGap: 0.06, uprightCos: 0.99, maxSpeed: 0.3, periodMs: 120, pushSpeed: 0.35, tipSpin: 0.8, repushMs: 600, maxPushes: 4, activeMs: 2000 }`. `pushSpeed`, `tipSpin` and `contactGap` are starting values to tune in Task 4; the rest are fixed by the spec.
  - Snapshot shape used everywhere: `{ id, x, y, z, upright: boolean, speed: number }` (centre of the cylinder, world metres).
  - `supportPatches(piece, others, floors, cfg = SUPPORT) -> { onFloor: boolean, points: Array<{x,z}> }`. `floors` is an array of top heights (`[0, 0.5]`).
  - `isSupported(piece, others, floors, cfg = SUPPORT) -> boolean`
  - `pushFor(piece, others, floors, mass, cfg = SUPPORT) -> { impulse: {x,y,z}, spin: {x,y,z} } | null`

- [ ] **Step 1: Write the failing tests**

Test helpers at the top of the file: `close(a, b, eps = 1e-6)` as in `test/tire.test.mjs`;
`pyramid({ without } = {})` returns the full 6-5-4-3-2-1 snapshot list with ids `r<row>c<i>` (row 0
= bottom), minus the id in `without`; `gapWith(overrides)` = `pyramid({ without: 'r1c2' })` with
the listed fields merged into the named snapshots. Build snapshots with a helper `up(id, x, y)` → `{ id, x, y, z: -6, upright: true, speed: 0 }`. `ROW = 0.45 * 2.3`, row centre heights `y0 = 0.5 + 0.55 + 0.01`, `y1 = y0 + 1.12`.

```js
test('isSupported_OnPlatform_True', () => assert.equal(isSupported(up(1, 0, y0), [], [0, 0.5]), true));
test('isSupported_BetweenTwoBarrels_True', () => {
  const a = up(1, -ROW / 2, y0), b = up(2, ROW / 2, y0), top = up(3, 0, y1);
  assert.equal(isSupported(top, [a, b], [0, 0.5]), true);
});
test('isSupported_OneSupportGone_Issue28_False', () => {   // COM 4.5 cm past the rim
  const a = up(1, -ROW / 2, y0), top = up(3, 0, y1);
  assert.equal(isSupported(top, [a], [0, 0.5]), false);
});
test('isSupported_CentredOnOneBarrel_True', () => {
  assert.equal(isSupported(up(3, 0.1, y1), [up(1, 0, y0)], [0, 0.5]), true);
});
test('isSupported_COMJustInsideMargin_True', () => {      // 1 cm past the lens edge, margin 1.5 cm
  const a = up(1, 0, y0), top = up(3, 0.4725 + 0.01, y1);
  assert.equal(isSupported(top, [a], [0, 0.5]), true);
});
test('supportPatches_BarrelTooFarBelow_NotASupport', () => {
  const p = supportPatches(up(3, 0, y1), [up(1, 0, y0 - 0.2)], [0, 0.5]);
  assert.equal(p.points.length, 0);
});
test('supportPatches_TiltedNeighbour_Ignored', () => {
  const tilted = { ...up(1, 0, y0), upright: false };
  assert.equal(supportPatches(up(3, 0, y1), [tilted], [0, 0.5]).points.length, 0);
});
test('pushFor_Supported_Null', () => {
  assert.equal(pushFor(up(1, 0, y0), [], [0, 0.5], 8), null);
});
test('pushFor_OverhangToPlusX_PushesPlusXNeverUp', () => {
  const a = up(1, -ROW / 2, y0), top = up(3, 0, y1);
  const { impulse, spin } = pushFor(top, [a], [0, 0.5], 8);
  assert.ok(impulse.x > 0); assert.equal(impulse.y, 0); assert.ok(Math.abs(impulse.z) < 1e-9);
  close(Math.hypot(impulse.x, impulse.z), 8 * SUPPORT.pushSpeed);
  // spin axis = cross(up, dir) = (dir.z, 0, -dir.x): tips the top toward +x
  assert.ok(spin.z < 0); close(Math.hypot(spin.x, spin.z), SUPPORT.tipSpin); assert.equal(spin.y, 0);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/barrel-support.test.mjs`
Expected: FAIL, cannot find module `../targets/barrel-support.js`.

- [ ] **Step 3: Implement `SUPPORT`, `supportPatches`, `isSupported`, `pushFor` in `targets/barrel-support.js`**

- A barrel is "on the floor" when its bottom (`y - h/2`) is within `contactGap` of any value in `floors`; then it is supported (the platform and ground are wider than any barrel).
- Another snapshot is a support only when it is `upright`, its top (`y + h/2`) is within `contactGap` of the piece's bottom, and the horizontal centre distance `d < 2r`.
- Patch points of one support: sample 24 points on each of the two circles (radius `r`, centres = the two barrels' x/z) and keep those inside the other circle (`<= r + 1e-9`). If `d < 1e-6` use the full circle.
- `isSupported`: true if on the floor; false if there are no patch points; otherwise true when the COM (x, z) is inside the convex hull of all patch points, or outside it by at most `comMargin`.
- `pushFor`: null when supported. Otherwise `dir` = unit vector from the nearest hull point (or the single patch centroid) to the COM in x/z; `impulse = mass * pushSpeed * dir` with `y = 0`; `spin = tipSpin * (dir.z, 0, -dir.x)`. If the piece has no supports at all (free fall), return null: physics already moves it.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/barrel-support.test.mjs`
Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add targets/barrel-support.js test/barrel-support.test.mjs
git commit -m "feat(targets): add barrel support geometry (#28)"
```

---

### Task 2: Controller (when to check, whom to push, waking)

**Files:**
- Modify: `targets/barrel-support.js`
- Test: `test/barrel-support.test.mjs`

**Interfaces:**
- Consumes: `SUPPORT`, `isSupported`, `pushFor` from Task 1.
- Produces:
  - `selectPushes(snaps, floors, now, log, cfg = SUPPORT) -> Array<{ id, impulse, spin, wake: id[] }>`. Pure. `log` is a `Map<id, { count, lastAt }>` that the function updates for each returned push. `wake` lists the pushed barrel's id plus every barrel resting on it.
  - `createBarrelSupport({ phys, floors, cfg = SUPPORT }) -> { reset(), tick(now, pieces) }`. `pieces` is the game's `barrels` array (items have `.body`; only `body.material === 'barrel'` are used). `tick` returns the number of pushes applied.

- [ ] **Step 1: Write the failing tests**

```js
test('selectPushes_IntactPyramid_None', () => { /* full 6-5-4-3-2-1 snapshot built from ROW, y rows */
  assert.deepEqual(selectPushes(pyramid(), [0, 0.5], 0, new Map()), []);
});
test('selectPushes_Row2MiddleRemoved_PushesBothRow3BarrelsAboveGap', () => {
  const ids = selectPushes(pyramid({ without: 'r1c2' }), [0, 0.5], 0, new Map()).map(p => p.id).sort();
  assert.deepEqual(ids, ['r2c1', 'r2c2']);
});
test('selectPushes_TopBarrelRemoved_None', () => {
  assert.deepEqual(selectPushes(pyramid({ without: 'r5c0' }), [0, 0.5], 0, new Map()), []);
});
test('selectPushes_PushIncludesBarrelsRestingOnIt_InWake', () => {
  const p = selectPushes(pyramid({ without: 'r1c2' }), [0, 0.5], 0, new Map()).find(x => x.id === 'r2c1');
  assert.ok(p.wake.includes('r2c1') && p.wake.includes('r3c0') && p.wake.includes('r3c1'));
});
test('selectPushes_FastOrTiltedPiece_Skipped', () => { /* same gap, r2c1 speed 1.0, r2c2 upright:false */
  assert.deepEqual(selectPushes(gapWith({ r2c1: { speed: 1 }, r2c2: { upright: false } }), [0, 0.5], 0, new Map()), []);
});
test('selectPushes_WithinRepushDelay_NotPushedAgain', () => {
  const log = new Map(); const s = pyramid({ without: 'r1c2' });
  selectPushes(s, [0, 0.5], 0, log);
  assert.deepEqual(selectPushes(s, [0, 0.5], SUPPORT.repushMs - 1, log), []);
});
test('selectPushes_StillUnsupportedAfterRepushDelay_PushedAgain', () => {
  const log = new Map(); const s = pyramid({ without: 'r1c2' });
  selectPushes(s, [0, 0.5], 0, log);
  assert.equal(selectPushes(s, [0, 0.5], SUPPORT.repushMs, log).length, 2);
  assert.equal(log.get('r2c1').count, 2);
});
test('selectPushes_AfterMaxPushes_NotPushed', () => {
  const log = new Map([['r2c1', { count: SUPPORT.maxPushes, lastAt: 0 }], ['r2c2', { count: SUPPORT.maxPushes, lastAt: 0 }]]);
  assert.deepEqual(selectPushes(pyramid({ without: 'r1c2' }), [0, 0.5], 10_000, log), []);
});
```

Controller tests use a fake `phys` that records calls (`wake`, `applyImpulse`, `getVelocity`, `getAngularVelocity`, `setAngularVelocity`) over fake bodies `{ material, position, quaternion }`:

```js
test('tick_NeverDisturbed_NoPushes', () => { /* intact pyramid, all speeds 0, tick at 0..5000 ms */ assert.equal(totalPushes, 0); assert.equal(fake.calls.applyImpulse.length, 0); });
test('tick_AfterMotionAndGap_PushesAndWakes', () => { /* one body speed 2 at t=0, then r1c2 removed; tick at 150 */ assert.equal(pushes, 2); assert.ok(fake.calls.wake.length >= 4); });
test('tick_CalledFasterThanPeriod_ChecksOncePerPeriod', () => { /* ticks at 0,10,20..110 after disturbance */ assert.equal(checks, 1); });
test('tick_QuietLongerThanActiveMs_StopsChecking', () => { /* no motion for activeMs+1 */ assert.equal(pushesAfter, 0); });
test('tick_NonBarrelMaterial_Ignored', () => { /* pieces with material 'stone' only */ assert.equal(fake.calls.applyImpulse.length, 0); });
test('reset_ClearsPushLogAndDisturbed', () => { /* push once, reset, same gap at t=0 without new motion */ assert.equal(pushesAfterReset, 0); });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/barrel-support.test.mjs`
Expected: FAIL, `selectPushes` / `createBarrelSupport` not exported.

- [ ] **Step 3: Implement `selectPushes` and `createBarrelSupport`**

- `selectPushes`: candidates are `upright && speed <= maxSpeed`; skip if `log` says `count >= maxPushes` or `now - lastAt < repushMs`; push those where `pushFor` is non-null; `wake` = the id plus all candidates whose supports include it (reuse `supportPatches`).
- `createBarrelSupport`: keep `lastMotionAt` (set whenever any barrel's speed > `maxSpeed`, or after the controller pushes), `lastCheckAt`, `disturbed`, and a push `log`. Each `tick`: build snapshots from `body.position`, `body.quaternion` (`upright` when `1 - 2(qx² + qz²) >= uprightCos`), `|getVelocity|`; first motion sets `disturbed`. Run `selectPushes` only when `disturbed`, `now - lastMotionAt <= activeMs`, and `now - lastCheckAt >= periodMs`. For each push: `wake` every id in `wake`, `applyImpulse(body, impulse)`, `setAngularVelocity(body, current + spin)`.

- [ ] **Step 4: Run all tests**

Run: `node --test test/*.test.mjs`
Expected: PASS, including the existing materials, tire and apk-layouts tests.

- [ ] **Step 5: Commit**

```bash
git add targets/barrel-support.js test/barrel-support.test.mjs
git commit -m "feat(targets): add barrel support controller (#28)"
```

---

### Task 3: Wire it into the game

**Files:**
- Modify: `index.html` (import block near `import { createCrashcatBackend }` ~line 181; `camCfg` ~line 941; `buildTargets()` ~line 968; `animate()` after the "sync barrels + detect knocked-over" loop ~line 2172)

**Interfaces:**
- Consumes: `createBarrelSupport({ phys, floors })` → `{ reset(), tick(now, pieces) }` from Task 2.

- [ ] **Step 1: Add `support: true` to the `barrels` and `woodbarrels` entries of `camCfg`**, create `const barrelSupport = createBarrelSupport({ phys, floors: [0, platH] });` after `phys` exists, call `barrelSupport.reset()` at the start of `buildTargets()`, and in `animate()` call `if (camCfg[targetMode].support) barrelSupport.tick(now, barrels);` right after the sync loop.

- [ ] **Step 2: Verify the game still loads and other modes are unaffected**

Run: `python3 -m http.server 8000` and open `http://localhost:8000/` (headless Chromium is fine). Expected: no console errors in the barrel pyramid, the wooden pyramid, and one stone mode (for example `fortress`); the untouched pyramid stays still for 10 s.

- [ ] **Step 3: Run all tests**

Run: `node --test test/*.test.mjs`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(targets): topple barrels that lost their support (#28)"
```

---

### Task 4: Acceptance harness on real physics, tune the push

**Files:**
- Create: `test/harness/barrel-support.html`
- Modify: `targets/barrel-support.js` (`SUPPORT.pushSpeed`, `tipSpin`, `contactGap` only, if tuning is needed)
- Modify: `README.md` (Tests paragraph, one sentence), `CHANGELOG.md` (`[Unreleased]` → `### Fixed`)

**Interfaces:**
- Consumes: `createCrashcatBackend` (`../../physics/backend-crashcat.js`, crashcat from `https://esm.sh/crashcat@0.0.5` as in `test/harness/physics-contract.html`), `createBarrelSupport` from Task 2.

- [ ] **Step 1: Write the harness (the failing test)**

The page builds the platform (`halfExtents [4, 0.25, 1.5]` at `y 0.25, z -6`, static, material `ground`) and the 6-5-4-3-2-1 pyramid exactly like `setupBarrels()` (cylinder `radiusTop/Bottom 0.4725`, `height 1.1`, mass 8, material `barrel`, `x0 + i * 0.45 * 2.3`, `y = 0.5 + 0.55 + 0.01 + row * 1.12`, `z -6`). It steps at 1/60 s and calls `support.tick(t_ms, pieces)` every frame. Scenarios, each on a fresh backend, each logging `[PASS]`/`[FAIL] name: detail`; `document.title` becomes `SUPPORT PASS` or `SUPPORT FAIL`:

- `atRest_10s_NothingMoves`: no removal; after 10 s every barrel within 0.05 m of home and tilt < 3°.
- `issue28_Row2MiddleKnockedOut_Row3PairTips`: after 3 s settle, give row 2 middle (row index 1, i = 2) velocity `(0, 0, -6)`; within 3 s both row-3 barrels at i = 1 and 2 have tilt > 15° or moved > 0.45 m.
- `issue28_Removed_Row3PairTips`: same, but `removeBody` instead of the push.
- `chain_SupportedBarrelsStay`: after the issue-28 scenario settles (6 s), every barrel that is still upright passes `isSupported`.
- `topRemoved_OthersStay`: remove the single top barrel; after 3 s no other barrel moved > 0.05 m.
- `noPop_MaxUpwardSpeed`: across both issue-28 scenarios, no barrel other than the knocked-out one exceeds an upward speed of 1.0 m/s.

The wooden pyramid has the same body spec as the oil one (`createWoodBarrel()`), so the oil scenarios also cover it. State that in the page's header comment.

- [ ] **Step 2: Run the harness**

Run: `python3 -m http.server 8000`, open `http://localhost:8000/test/harness/barrel-support.html` (headless Chromium is fine), read the title and log.
Expected before tuning: at least `atRest` and `topRemoved` PASS. Any FAIL in the issue-28 or noPop scenarios is the tuning signal.

- [ ] **Step 3: Tune only `pushSpeed`, `tipSpin` (and `contactGap` if supports aren't found) until the page title is `SUPPORT PASS`**

Keep `noPop` passing. Never raise the push past what noPop allows; if the issue-28 scenarios still fail at that limit, raise `maxPushes` instead (realism beats push-once, no-pop is hard). Update the matching unit-test expectations only where they reference `SUPPORT` values symbolically (they do), never hardcoded numbers.

- [ ] **Step 4: Run everything**

Run: `node --test test/*.test.mjs`, then reload `test/harness/barrel-support.html` and `test/harness/physics-contract.html`.
Expected: all node tests PASS; titles `SUPPORT PASS` and `CONTRACT PASS`.

- [ ] **Step 5: Docs and commit**

Add to `README.md` after the contract sentence: "`test/harness/barrel-support.html` checks that barrels which lose their support topple (title `SUPPORT PASS`/`FAIL`)." Add a `CHANGELOG.md` `[Unreleased]` → `### Fixed` line: "Barrels that lose their support now tip into the gap instead of hanging in mid-air (#28)." Write the entry by hand; never run `git cliff`.

```bash
git add test/harness/barrel-support.html targets/barrel-support.js README.md CHANGELOG.md
git commit -m "test(targets): harness for the barrel support check (#28)"
```
