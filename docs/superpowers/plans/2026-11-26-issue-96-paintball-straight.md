# Paintball flies straight to the crosshair (#96) Implementation Plan

**Goal:** The paintball flies fast and straight to the crosshair without gravity until it hits something; on a 100 m miss it falls.

**Files:** `weapons/paintball.js`, `test/paintball.test.mjs`, `index.html`, `README.md`, `CHANGELOG.md`. Work by function names; other issues may have touched `index.html`.

### Task 1: Pure launch helpers

- [ ] **Step 1: Failing tests.** Append to `test/paintball.test.mjs` and add `paintballSpeed, paintballOutOfRange` to its import from `../weapons/paintball.js`:

```js
test('paintballSpeed_PowerRange_FortyToSixty', () => {
  assert.equal(paintballSpeed(0), 40);
  assert.equal(paintballSpeed(1), 60);
  assert.equal(paintballSpeed(2), 60);   // power is clamped
});
test('paintballOutOfRange_BeforeAndAtRange_FalseThenTrue', () => {
  const o = { x: 0, y: 1, z: 0 };
  assert.equal(paintballOutOfRange(o, { x: 0, y: 1, z: -(PAINTBALL.flightRange - 0.1) }), false);
  assert.equal(paintballOutOfRange(o, { x: 0, y: 1, z: -PAINTBALL.flightRange }), true);
});
```

Also add `PAINTBALL` to the import if it is not there. Run `node --test test/paintball.test.mjs`: FAIL (not exported).

- [ ] **Step 2: Implement.** In `weapons/paintball.js`, replace the `PAINTBALL` constant line with:

```js
// Nearly massless: a paintball only colours what it hits and must not knock stone over (#82).
// It flies straight to the crosshair, gravity-free until its first contact, like the charges (#90, #96).
export const PAINTBALL = { mass: 0.01, radius: 0.15, speedBase: 40, speedPower: 20, flightRange: 100 };

export function paintballSpeed(power) {
  const p = Math.min(Math.max(power, 0), 1);
  return PAINTBALL.speedBase + p * PAINTBALL.speedPower;
}

// True once a flying paintball has gone PAINTBALL.flightRange from its muzzle: it then falls like a miss.
export function paintballOutOfRange(start, pos) {
  return Math.hypot(pos.x - start.x, pos.y - start.y, pos.z - start.z) >= PAINTBALL.flightRange;
}
```

Run `node --test test/*.test.mjs`: all pass.

- [ ] **Step 3: Commit and push.** `git commit -m "feat(weapons): paintball straight-flight helpers (#96)"`

### Task 2: Wiring in index.html

- [ ] **Step 1:** Add `paintballSpeed, paintballOutOfRange` to the import from `./weapons/paintball.js`.
- [ ] **Step 2:** In `shootBall`, add `'paintball'` to the `fastProjectiles` set, and extend the `gravityFactor` option so the paintball also starts at 0:
  `gravityFactor: (type === 'sniper' || type === 'paintball' || isChargeType(type)) ? 0 : undefined,`
  and update its trailing comment to `// straight flight until first contact (#30, #90, #96)`.
- [ ] **Step 3:** In the speed branch chain after `let speed = 18 + power * 22;`, add before the `isChargeType` branch:

```js
  } else if (type === 'paintball') {
    speed = paintballSpeed(power);   // straight along the crosshair, 40-60 m/s (#96)
```

- [ ] **Step 4:** In `animate()`'s per-ball loop, right after the charge range check (`chargeOutOfRange(...)` block), add:

```js
    // a paintball that flew its whole range without a contact falls like a miss (#96)
    if (b.type === 'paintball' && !b.hit && paintballOutOfRange(b.muzzle, b.body.position)) {
      b.hit = true;
      phys.setGravityFactor(b.body, 1);
    }
```

  `paintSplat()` already sets `rec.hit = true` on contact, so a ball that hit is never touched here.
- [ ] **Step 5:** `node --test test/*.test.mjs` passes. Commit and push: `git commit -m "feat(weapons): paintball flies straight to the crosshair (#96)"`

### Task 3: Docs

- [ ] **Step 1:** `README.md` Explosives line: replace `paintball (colours the piece it hits without moving it;` with `paintball (flies straight to the crosshair and colours the piece it hits without moving it;`.
- [ ] **Step 2:** `CHANGELOG.md` under `## [Unreleased]`, in the line starting `- Paintball colours:`, replace `A paintball only colours the piece it hits` with `A paintball flies straight to the crosshair and only colours the piece it hits` and the closing `(#54, #82)` with `(#54, #82, #96)`.
- [ ] **Step 3:** Commit and push: `git commit -m "docs: paintball flies straight (#96)"`

Optional visual check: on the chimney, fire paintballs at the crown; they hit where the crosshair points.
