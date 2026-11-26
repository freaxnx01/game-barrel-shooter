# Charges Fly Straight Implementation Plan (#90)

**Goal:** Remote and timed charges fly fast and straight along the crosshair ray with no gravity until their first contact, and stick where they hit (#78 flush placement).

**Architecture:** Pure helpers in `weapons/charges.js` (launch without lift, speed 40 to 60 m/s, range check). Wiring in `index.html` (`shootBall`, `chargeStick`, the per-frame loop). Docs last.

**Spec:** `docs/superpowers/specs/2026-11-26-issue-90-charges-fly-straight-design.md`

Run tests with `node --test test/*.test.mjs`. Make only the commits named below. Do not run Playwright or the browser harness. Reference functions by name, not line number.

### Task 1: Pure launch changes and tests

**Files:**
- Modify: `weapons/charges.js`
- Modify: `test/charges.test.mjs`

- [ ] **Step 1: Write the failing tests.** In `test/charges.test.mjs` add `chargeOutOfRange` to the import list on the first import line from `../weapons/charges.js`. Replace the three tests `chargeLaunch_PowerRange_Speed12To26`, `chargeLaunch_PowerOutOfRange_Clamped` and `chargeLaunch_FlatAim_LiftedUnitDirection` with:

```js
test('chargeLaunch_PowerRange_Speed40To60', () => {
  assert.equal(chargeLaunch({ x: 0, y: 0, z: -1 }, 0).speed, 40);
  assert.equal(chargeLaunch({ x: 0, y: 0, z: -1 }, 1).speed, 60);
});

test('chargeLaunch_PowerOutOfRange_Clamped', () => {
  assert.equal(chargeLaunch({ x: 0, y: 0, z: -1 }, -1).speed, 40);
  assert.equal(chargeLaunch({ x: 0, y: 0, z: -1 }, 5).speed, 60);
});

test('chargeLaunch_Aim_DirectionIsExactlyTheAim', () => {
  for (const aim of [{ x: 0, y: 0, z: -1 }, { x: 0.6, y: 0.8, z: 0 }, { x: 0, y: -0.6, z: -0.8 }]) {
    for (const power of [0, 0.5, 1]) {
      const { direction: d } = chargeLaunch(aim, power);
      assert.ok(Math.abs(d.x - aim.x) < 1e-9 && Math.abs(d.y - aim.y) < 1e-9 && Math.abs(d.z - aim.z) < 1e-9);
    }
  }
});

test('chargeLaunch_NoLiftTuning_Removed', () => {
  assert.equal(CHARGE.lift, undefined);
});

test('chargeOutOfRange_BeforeAndAtFlightRange_FalseThenTrue', () => {
  const start = { x: 1, y: 2, z: 3 };
  assert.equal(chargeOutOfRange(start, { x: 1, y: 2, z: 3 - 99.9 }), false);
  assert.equal(chargeOutOfRange(start, { x: 1, y: 2, z: 3 - CHARGE.flightRange }), true);
});

test('chargeReach_AtMaxSpeed_CoversOneFrameOfFlight', () => {
  const dt = 1 / 60;
  assert.ok(chargeReach(60, dt) > 60 * dt);
  assert.ok(chargeReach(60, 0.1) > 60 * 0.1);
});
```

- [ ] **Step 2: Run to see them fail.** `node --test test/charges.test.mjs`. Expect failures (speed 12, lift present, `chargeOutOfRange` missing).

- [ ] **Step 3: Implement.** In `weapons/charges.js` change the `CHARGE` fields `speedBase: 12, speedPower: 14,` and the `lift` line to:

```js
  speedBase: 40,       // fast and straight to the crosshair (#90): 40-60 m/s, no gravity until first contact
  speedPower: 20,
  flightRange: 100,    // metres from the muzzle without a contact: gravity comes back (#90)
```

(the `lift` line is deleted). Replace `chargeLaunch` with:

```js
export function chargeLaunch(dir, power) {
  const n = Math.hypot(dir.x, dir.y, dir.z);
  return {
    direction: { x: dir.x / n, y: dir.y / n, z: dir.z / n },   // exactly the crosshair ray (#90)
    speed: CHARGE.speedBase + clamp01(power) * CHARGE.speedPower,
  };
}

// True once a flying charge has gone CHARGE.flightRange from its muzzle (#90): it then falls like a miss.
export function chargeOutOfRange(start, pos) {
  return Math.hypot(pos.x - start.x, pos.y - start.y, pos.z - start.z) >= CHARGE.flightRange;
}
```

Also change the file's header comment line mentioning the #54 numbers by appending: `// Launch tuning changed in #90 (docs/superpowers/specs/2026-11-26-issue-90-charges-fly-straight-design.md).`

- [ ] **Step 4: Run all tests.** `node --test test/*.test.mjs`. Expect all pass.

- [ ] **Step 5: Commit.**

```bash
git add weapons/charges.js test/charges.test.mjs
git commit -m "feat(weapons): charge launch is straight and fast, no lift (#90)"
```

### Task 2: Wire the gravity-free flight in index.html

**Files:**
- Modify: `index.html`

No unit test is possible (DOM and engine); the check is the full test run plus reading the diff.

- [ ] **Step 1: Import.** In the `import { CHARGE, chargeLaunch, ... } from './weapons/charges.js';` line add `chargeOutOfRange` to the list.

- [ ] **Step 2: shootBall, body creation.** In `shootBall` add the two charge types to the `fastProjectiles` set:

```js
  const fastProjectiles = new Set(['cannonball', 'spear', 'f16', 'sniper', 'slingshot', 'catapult', 'harpoon', 'remotecharge', 'timedcharge']);
```

and in the `phys.addBody({...})` call replace `gravityFactor: type === 'sniper' ? 0 : undefined,` with:

```js
    gravityFactor: (type === 'sniper' || type === 'remotecharge' || type === 'timedcharge') ? 0 : undefined,   // straight flight until first contact (#30, #90)
```

- [ ] **Step 3: shootBall, launch comment.** In the `remotecharge`/`timedcharge` branch of the speed chain change the comment `// slight arc, like the grenade` to `// straight along the crosshair, 40-60 m/s (#90)`. Keep the three following lines.

- [ ] **Step 4: chargeStick restores gravity.** In `chargeStick` replace the first line after `const plan = ...` so the function starts:

```js
  const plan = chargeStickPlan(rec.stuck, other, balls.some((b) => b.body === other));
  if (plan === 'ignore') {
    if (!rec.stuck) { rec.hit = true; phys.setGravityFactor(rec.body, 1); }   // touched another projectile: it falls now (#90)
    return;
  }
  rec.hit = true;
  phys.setGravityFactor(rec.body, 1);            // the straight flight ends at the first contact (#90); freeze below sets it back to 0
```

Leave the rest of `chargeStick` as is (the `else phys.setGravityFactor(rec.body, 0)` branch for `freeze` still wins because it runs after).

- [ ] **Step 5: Miss handling in the per-frame loop.** In the "sync balls, cull old ones" loop, directly before the line `const cullTime = b.type === 'wrecking' ? 25000 : 12000;` insert:

```js
    // a charge that flew its whole range without a contact falls like a miss (#90)
    if ((b.type === 'remotecharge' || b.type === 'timedcharge') && !b.hit && !b.stuck && chargeOutOfRange(b.muzzle, b.body.position)) {
      b.hit = true;
      phys.setGravityFactor(b.body, 1);
    }
```

The existing cull rules stay: ground contact sticks it, `y < -5` removes a non-stuck one, an unexploded remote charge is exempt from the 12 s cull, and `canPlaceRemote` caps armed remotes at 6.

- [ ] **Step 6: Run all tests.** `node --test test/*.test.mjs`. Expect all pass. Optional, cheap, only if it takes under 2 minutes: serve the folder and aim a charge at the chimney from the default camera; it should stick at the crosshair. Skip if not trivial.

- [ ] **Step 7: Commit.**

```bash
git add index.html
git commit -m "feat(weapons): charges fly gravity-free to the crosshair until first contact (#90)"
```

### Task 3: README and CHANGELOG

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: README.** In the Explosives line (starts `- *Explosives*`) change `remote charge (lies still until you press K / Boom; up to 6), timed charge (explodes 4 s after the throw, LED blinks faster)` to `remote charge (flies straight to the crosshair and lies still until you press K / Boom; up to 6), timed charge (flies straight to the crosshair, explodes 4 s after the throw, LED blinks faster)`.

- [ ] **Step 2: CHANGELOG.** In `CHANGELOG.md` under `## [Unreleased]` / `### Added`, in the line starting `- Remote charge (key B) that waits until you press K or the 💥 Boom button`, replace `and timed charge (key Z) that explodes 4 s after the throw; both stick flat` with `and timed charge (key Z) that explodes 4 s after the throw; both fly fast and straight to where the crosshair points (no arc, no gravity until they hit) and stick flat`, and replace the trailing `(#54, #62, #78)` with `(#54, #62, #78, #90)`.

- [ ] **Step 3: Run all tests.** `node --test test/*.test.mjs`. Expect all pass.

- [ ] **Step 4: Commit.**

```bash
git add README.md CHANGELOG.md
git commit -m "docs: charges fly straight to the crosshair (#90)"
```
