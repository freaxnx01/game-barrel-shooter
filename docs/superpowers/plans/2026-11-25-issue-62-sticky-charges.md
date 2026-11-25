# Sticky Charges Implementation Plan (#62)

**Goal:** Thrown remote and timed charges stick to the first thing they hit, move with it, and do no impact damage. They explode as before.

**Architecture:** Pure helpers in `weapons/charges.js` (tiny mass, momentum guard, stick decision), wiring in `index.html` modelled on `harpoonStick`. The collision callback runs after the step, so the knock cannot be undone there; the charge is therefore made nearly massless instead.

**Spec:** `docs/superpowers/specs/2026-11-25-issue-62-sticky-charges-design.md`

Run tests with `node --test test/*.test.mjs`. Do not touch git beyond the commits named below. Do not run Playwright except in Task 4.

### Task 1: Tiny charge mass and momentum guard

**Files:**
- Modify: `weapons/charges.js`
- Modify: `test/charges.test.mjs`

- [ ] **Step 1: Write the failing tests.** In `test/charges.test.mjs` add `chargeMomentum` to the import from `'../weapons/charges.js'`, change the line `assert.equal(CHARGE.mass, 2);` to `assert.equal(CHARGE.mass, 0.1);`, and append:

```js
test('chargeMomentum_FullPower_StaysBelowThreeNewtonSeconds', () => {
  assert.ok(chargeMomentum(1) <= 3);
  assert.ok(Math.abs(chargeMomentum(1) - 2.6) < 1e-9);
});

test('chargeMomentum_NoPower_IsBaseSpeedTimesMass', () => {
  assert.ok(Math.abs(chargeMomentum(0) - 1.2) < 1e-9);
});
```

- [ ] **Step 2: Run to verify failure.** `node --test test/charges.test.mjs` fails (`chargeMomentum` not exported, mass is 2).

- [ ] **Step 3: Implement.** In `weapons/charges.js` set `mass: 0.1,` with the comment `// nearly massless: a stuck charge must not knock pieces over (#62)`, and add below `chargeLaunch`:

```js
// Momentum (N*s) a charge carries into its first contact; kept tiny so it does no impact damage.
export function chargeMomentum(power) {
  return CHARGE.mass * (CHARGE.speedBase + clamp01(power) * CHARGE.speedPower);
}
```

- [ ] **Step 4: Run to verify pass.** `node --test test/*.test.mjs` passes.

- [ ] **Step 5: Commit.**

```
feat(weapons): make charges nearly massless so they do no impact damage (#62)
```

### Task 2: Pure stick decision

**Files:**
- Modify: `weapons/charges.js`
- Modify: `test/charges.test.mjs`

- [ ] **Step 1: Write the failing tests.** Add `chargeStickPlan` to the import and append:

```js
test('chargeStickPlan_AlreadyStuck_Ignore', () => {
  assert.equal(chargeStickPlan(true, { mass: 5 }), 'ignore');
});

test('chargeStickPlan_FirstContactWithPiece_Joint', () => {
  assert.equal(chargeStickPlan(false, { mass: 5 }), 'joint');
});

test('chargeStickPlan_FirstContactWithStaticBody_Joint', () => {
  assert.equal(chargeStickPlan(false, { mass: 0 }), 'joint');
});

test('chargeStickPlan_NoOtherBody_Freeze', () => {
  assert.equal(chargeStickPlan(false, null), 'freeze');
  assert.equal(chargeStickPlan(false, undefined), 'freeze');
});
```

- [ ] **Step 2: Run to verify failure.** `node --test test/charges.test.mjs` fails (`chargeStickPlan` not exported).

- [ ] **Step 3: Implement.** Append to `weapons/charges.js`:

```js
// What a charge does on a contact: 'ignore' once stuck, 'freeze' in place when there is no
// body handle to join, otherwise 'joint' (static bodies such as the ground count too).
export function chargeStickPlan(stuck, other) {
  if (stuck) return 'ignore';
  return other ? 'joint' : 'freeze';
}
```

- [ ] **Step 4: Run to verify pass.** `node --test test/*.test.mjs` passes.

- [ ] **Step 5: Commit.**

```
feat(weapons): add chargeStickPlan decision helper (#62)
```

### Task 3: Wire sticking into index.html

**Files:**
- Modify: `index.html`

No new unit test is possible here (DOM and engine code). The pure logic is covered by Tasks 1 and 2.

- [ ] **Step 1: Import.** In the line `import { CHARGE, chargeLaunch, isFuseDone, ledOn, canPlaceRemote, armedRemotes } from './weapons/charges.js';` add `chargeStickPlan`.

- [ ] **Step 2: Add `chargeStick` next to `harpoonStick`** (above the `// ---------- Heavy net` comment):

```js
// ---------- Remote and timed charges: stick to the first thing they hit, no impact damage (#62) ----------
function chargeStick(rec, other) {
  const plan = chargeStickPlan(rec.stuck, other);
  if (plan === 'ignore') return;
  rec.stuck = true;                              // exempts it from the 12 s and y < -5 culls
  phys.setVelocity(rec.body, 0, 0, 0);
  phys.setAngularVelocity(rec.body, 0, 0, 0);
  if (plan === 'joint') rec.stickJoint = phys.addFixedJoint(rec.body, other);
  else phys.setGravityFactor(rec.body, 0);       // no body to join: hang where it is
  playBounce(4);
}
```

- [ ] **Step 3: Call it from the charge's collision callback.** In the `phys.onCollide(body, (other, impactSpeed) => {` block of `shootBall`, directly after the line `if (type === 'harpoon' && !rec.hit) harpoonStick(rec, other);` add:

```js
    if ((type === 'remotecharge' || type === 'timedcharge') && !rec.exploded) chargeStick(rec, other);
```

- [ ] **Step 4: Remove the joint on explosion.** In `explode()`, inside the `setTimeout(() => {` block, add as the first statement:

```js
    if (rec.stickJoint) { phys.removeJoint(rec.stickJoint); rec.stickJoint = null; }
```

- [ ] **Step 5: Remove the joint on cleanup.** In `removeProjectile(b)` add as the first statement:

```js
  if (b.stickJoint) { phys.removeJoint(b.stickJoint); b.stickJoint = null; }
```

- [ ] **Step 6: Check.** `node --test test/*.test.mjs` passes. Confirm by reading that `armedRemotes`, the `timeless` expression in the cull line and the timed-fuse check were not changed.

- [ ] **Step 7: Commit.**

```
feat(weapons): remote and timed charges stick to what they hit (#62)
```

### Task 4: One cheap headless check (optional, skip if it takes long)

**Files:** none (no new files committed).

- [ ] **Step 1:** Serve the repo with `python3 -m http.server <port>` in the background and load the page headlessly. Slow the page clock first (headless runs at about 5 fps, so the 12 s cleanup would cull a shot before it lands). Select `remotecharge`, fire one shot at the barrel tower, wait a few frames.

- [ ] **Step 2:** Assert in `page.evaluate` that the charge record has `stuck === true` and `stickJoint` set, and that the struck barrel's speed after contact is below 1 m/s. Kill the server by port afterwards.

- [ ] **Step 3:** If the page cannot be driven within a few minutes, stop and report it in the PR instead of retrying. No commit for this task.
