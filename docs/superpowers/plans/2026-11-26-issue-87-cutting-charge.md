# Cutting Charge Implementation Plan (#87)

> For agentic workers: implement task by task, TDD. Spec: `docs/superpowers/specs/2026-11-26-issue-87-cutting-charge-design.md`. Do not use line numbers; find code by the function names given. Test command: `node --test test/*.test.mjs`.

**Goal:** a new weapon `cutcharge` (key Y) that works like the remote charge but blasts only radius 1.2 with no upward kick and shoves the piece it sticks to sideways.

**Architecture:** pure tuning and blast functions in `weapons/charges.js`; `index.html` wires the weapon through two helpers, `isRemoteType` and `isChargeType`, so every place that tests for 'remotecharge' also accepts 'cutcharge'.

**Ordering note (#90):** if #90 has landed, `chargeLaunch` / the charge branch of `shootBall` may differ from what is quoted here. The cutting charge must use the same launch as the remote charge, whatever it is: add `cutcharge` to that same branch via `isChargeType`, never write a second launch.

---

### Task 1: Pure blast functions and constants

**Files:**
- Modify: `weapons/charges.js`
- Test: `test/charges.test.mjs`

- [ ] **Step 1: Write failing tests.** Append to `test/charges.test.mjs`, and add `CUT, BLAST_LIFT, blastImpulse, cutShove, isRemoteType, isChargeType` to its import line from `../weapons/charges.js`.

```js
test('CUT_Tuning_SmallRadiusNoLift', () => {
  assert.equal(CUT.radius, 1.2);
  assert.equal(CUT.lift, 0);
  assert.equal(BLAST_LIFT, 0.3);
});

test('blastImpulse_OutsideRadius_Null', () => {
  assert.equal(blastImpulse({ x: 2, y: 0, z: 0 }, CUT.radius, CUT.strength, CUT.lift), null);
});

test('blastImpulse_Wide_KeepsUpwardKick', () => {
  const i = blastImpulse({ x: 2, y: 0, z: 0 }, 4, 500);   // falloff 0.5 -> 250
  assert.equal(i.x, 250);
  assert.equal(i.y, 250 * BLAST_LIFT);
  assert.equal(i.z, 0);
});

test('blastImpulse_Cut_NoUpwardComponentForSideOffset', () => {
  const i = blastImpulse({ x: 0.8, y: 0, z: 0 }, CUT.radius, CUT.strength, CUT.lift);
  assert.ok(i.x > 0);
  assert.equal(i.y, 0);
});

test('blastImpulse_Cut_FallsOffWithDistance', () => {
  const near = blastImpulse({ x: 0.6, y: 0, z: 0 }, CUT.radius, CUT.strength, CUT.lift);
  const far = blastImpulse({ x: 1.1, y: 0, z: 0 }, CUT.radius, CUT.strength, CUT.lift);
  assert.ok(near.x > far.x);
});

test('blastImpulse_AtCentre_FiniteAndInsideMinDistance', () => {
  const i = blastImpulse({ x: 0, y: 0, z: 0 }, CUT.radius, CUT.strength, CUT.lift);
  assert.ok(Number.isFinite(i.x) && Number.isFinite(i.y) && Number.isFinite(i.z));
});

test('cutShove_PieceToTheRight_HorizontalPushRight', () => {
  const s = cutShove({ x: 3, y: 5, z: 0 });
  assert.equal(s.x, CUT.shove);
  assert.equal(s.y, 0);
  assert.equal(s.z, 0);
});

test('cutShove_DiagonalOffset_UnitDirectionTimesStrength', () => {
  const s = cutShove({ x: 1, y: 2, z: 1 }, 10);
  assert.ok(Math.abs(Math.hypot(s.x, s.z) - 10) < 1e-9);
  assert.equal(s.y, 0);
});

test('cutShove_VerticallyAligned_FallsBackToPlusX', () => {
  assert.deepEqual(cutShove({ x: 0, y: 1, z: 0 }, 7), { x: 7, y: 0, z: 0 });
});

test('isRemoteType_And_isChargeType_Classify', () => {
  assert.ok(isRemoteType('remotecharge') && isRemoteType('cutcharge'));
  assert.ok(!isRemoteType('timedcharge') && !isRemoteType('bomb'));
  assert.ok(isChargeType('timedcharge') && isChargeType('cutcharge') && !isChargeType('dynamite'));
});

test('armedRemotes_CutChargeCountsAsRemote', () => {
  const a = { type: 'cutcharge', exploded: false };
  const b = { type: 'cutcharge', exploded: true };
  assert.deepEqual(armedRemotes([a, b]), [a]);
});
```

- [ ] **Step 2: Run, expect FAIL.** `node --test test/charges.test.mjs` (missing exports).

- [ ] **Step 3: Implement.** In `weapons/charges.js`, after the `CHARGE` object add:

```js
// Cutting charge (#87): a small blast for controlled demolition. It breaks the piece it sits on
// (a strong sideways shove) and barely touches the rest, so the building falls under gravity.
export const CUT = {
  radius: 1.2,
  strength: 260,   // radial impulse at point blank, falls off to 0 at the radius
  lift: 0,         // no upward kick
  shove: 160,      // horizontal impulse on the piece the charge is stuck to (about 20 m/s on an 8 kg piece)
  flashScale: 0.5, // visual flash relative to a normal blast
};
export const BLAST_LIFT = 0.3;   // the upward kick every other blast has: impulse * 0.3

export function isRemoteType(type) {
  return type === 'remotecharge' || type === 'cutcharge';
}

export function isChargeType(type) {
  return isRemoteType(type) || type === 'timedcharge';
}

// Impulse a blast gives a body at `offset` from the charge, or null outside the radius.
// Same maths explode() always had: radial, linear falloff, distance floored at 0.5, plus `lift` * impulse upward.
export function blastImpulse(offset, radius, strength, lift = BLAST_LIFT) {
  const dist = Math.max(Math.hypot(offset.x, offset.y, offset.z), 0.5);
  if (dist > radius) return null;
  const imp = strength * (1 - dist / radius);
  return { x: (offset.x / dist) * imp, y: (offset.y / dist) * imp + imp * lift, z: (offset.z / dist) * imp };
}

// The sideways shove on the piece a cutting charge is stuck to: horizontal, away from the charge.
// A piece straight above or below the charge gets a fixed +x shove.
export function cutShove(offset, strength = CUT.shove) {
  const h = Math.hypot(offset.x, offset.z);
  if (h < 0.05) return { x: strength, y: 0, z: 0 };
  return { x: (offset.x / h) * strength, y: 0, z: (offset.z / h) * strength };
}
```

Change `armedRemotes` to use the helper:

```js
export function armedRemotes(records) {
  return records.filter((r) => isRemoteType(r.type) && !r.exploded);
}
```

- [ ] **Step 4: Run `node --test test/*.test.mjs`, expect all PASS.**

- [ ] **Step 5: Commit.** `git add weapons/charges.js test/charges.test.mjs && git commit -m "feat(weapons): pure cutting-charge blast functions (#87)"`

---

### Task 2: Cutting charge weapon wiring

**Files:**
- Modify: `index.html`

No unit test (DOM/three.js); the check is the existing suite plus a grep. Work through each place below by function name.

- [ ] **Step 1: Import.** In the `import { CHARGE, chargeLaunch, ... } from './weapons/charges.js';` line add `CUT, BLAST_LIFT, blastImpulse, cutShove, isRemoteType, isChargeType`.

- [ ] **Step 2: Picker button.** In the Explosives group, after the `data-type="remotecharge"` button add:

```html
<button data-type="cutcharge"><span class="dot" style="background:#5e6338;border:2px solid #ff7a3c;box-sizing:border-box;border-radius:2px"></span>Cutting charge <span style="opacity:0.5">Y</span></button>
```

- [ ] **Step 3: Key.** In the `keydown` handler after `if (k === 'b') setAmmo('remotecharge');` add `if (k === 'y') setAmmo('cutcharge');` ('y' is free).

- [ ] **Step 4: Mesh.** After `makeRemoteChargeMesh` add (reuses the red LED material that already exists in `chargeLedMatls`; add the band material next to `chargeBoxMatl`):

```js
const cutBandMatl = new THREE.MeshStandardMaterial({ color: '#c2371f', roughness: 0.6 });
const cutBandGeo = new THREE.BoxGeometry(0.05, CHARGE.halfExtents[1] * 2 + 0.01, CHARGE.halfExtents[2] * 2 + 0.01);
// cutting charge (#87): the charge brick with two red bands, like a linear shaped charge; no antenna
function makeCutChargeMesh(number) {
  const g = makeChargeMesh('#ff3b30');
  for (const x of [-0.08, 0.08]) {
    const band = new THREE.Mesh(cutBandGeo, cutBandMatl);
    band.position.x = x;
    g.add(band);
  }
  const label = makeChargeLabel(number);
  g.add(label);
  g.userData.number = number;
  g.userData.label = label;
  return g;
}
```

- [ ] **Step 5: shootBall.** Make these changes in `shootBall` (and `chargeLaunch` stays untouched):
  - cap guard: `if (type === 'remotecharge' && !canPlaceRemote(...)) return;` becomes `if (isRemoteType(type) && !canPlaceRemote(armedRemotes(balls).length)) return;`
  - `cfg` table: add `cutcharge: { mass: CHARGE.mass, r: CHARGE.halfExtents[0] },`
  - `shapeSpec` branch `type === 'remotecharge' || type === 'timedcharge'` becomes `isChargeType(type)`.
  - launch branch `type === 'remotecharge' || type === 'timedcharge'` (the one calling `chargeLaunch`) becomes `isChargeType(type)`.
  - mesh creation: after the `remotecharge` branch add `else if (type === 'cutcharge') { mesh = makeCutChargeMesh(nextChargeNumber(armedRemotes(balls).map((r) => r.number))); }`.
  - the `onCollide` line `(type === 'remotecharge' || type === 'timedcharge') && !rec.exploded` becomes `isChargeType(type) && !rec.exploded`.

- [ ] **Step 6: Other type checks.** Replace by function:
  - `explode`: `chargeBodies` filter `b.type === 'remotecharge' || b.type === 'timedcharge'` becomes `isChargeType(b.type)`.
  - `stickChargesAhead`: `(rec.type !== 'remotecharge' && rec.type !== 'timedcharge')` becomes `!isChargeType(rec.type)`.
  - the ball sync loop: `b.type === 'remotecharge' && !b.exploded` (placeChargeLabel) becomes `isRemoteType(b.type) && !b.exploded`; same for the `timeless` line (`b.stuck || (isRemoteType(b.type) && !b.exploded)`).
  - `chargeStick`: when `plan === 'joint'`, also remember the partner: `if (plan === 'joint') { rec.stickJoint = phys.addFixedJoint(rec.body, other); rec.stickBody = other; }`.
  - Replace `detonateRemoteCharges` / `detonateRemote` bodies with a shared helper (Task 3 fills it in):

```js
// One place that knows how a placed charge goes off
function detonate(rec) {
  explode(rec, CHARGE.blastRadius, CHARGE.blastStrength);
}
function detonateRemoteCharges() {
  for (const rec of armedRemotes(balls)) detonate(rec);
}
function detonateRemote(n) {
  const rec = armedRemotes(balls).find((r) => r.number === n);
  if (rec) detonate(rec);
}
```

- [ ] **Step 7: Verify.** `grep -n "'remotecharge'" index.html` must only show the picker button, key `b`, `cfg` entry, the `remotecharge` mesh branch. Run `node --test test/*.test.mjs`, expect PASS.

- [ ] **Step 8: Commit.** `git add index.html && git commit -m "feat(weapons): cutting charge weapon, key Y, numbered like the remote charge (#87)"`

---

### Task 3: Cutting blast in explode()

**Files:**
- Modify: `index.html`

- [ ] **Step 1: detonate().** Replace the Task 2 `detonate` with:

```js
function detonate(rec) {
  if (rec.type === 'cutcharge') {
    explode(rec, CUT.radius, CUT.strength, { lift: CUT.lift, shove: CUT.shove, flash: CUT.flashScale });
  } else {
    explode(rec, CHARGE.blastRadius, CHARGE.blastStrength);
  }
}
```

Also the timed charge fuse in the ball sync loop keeps calling `explode(b, CHARGE.blastRadius, CHARGE.blastStrength)` unchanged.

- [ ] **Step 2: explode().** Change the signature to `function explode(rec, RADIUS = 3, STRENGTH = 320, opts = {})`, and add `const lift = opts.lift ?? BLAST_LIFT; const flashScale = opts.flash ?? 1;` at the top. Replace the radial loop body and add the shove before it:

```js
  // cutting charge: shove the piece it sits on out of the line of support, even beyond the radius
  const partner = rec.stickBody;
  if (opts.shove && partner && partner.mass > 0) {
    const s = cutShove({ x: partner.position.x - p.x, y: partner.position.y - p.y, z: partner.position.z - p.z }, opts.shove);
    phys.wake(partner);
    phys.applyImpulse(partner, s.x, s.y, s.z);
  }
  for (const body of phys.bodies()) {
    if (body.mass <= 0 || body === rec.body || chargeBodies.has(body) || (opts.shove && body === partner)) continue;   // a 0.1 kg charge would fly off at 20x speed (#62)
    const imp = blastImpulse({ x: body.position.x - p.x, y: body.position.y - p.y, z: body.position.z - p.z }, RADIUS, STRENGTH, lift);
    if (!imp) continue;
    phys.wake(body);
    phys.applyImpulse(body, imp.x, imp.y, imp.z);
  }
```

Visual: `new THREE.SphereGeometry(0.4 * flashScale, 16, 12)`, `const N = Math.round(60 * flashScale);`, and keep the camera shake as `shake = 0.35 * Math.max(flashScale, 0.6);`. Check that the explosion animation code does not assume `N === 60`; if it does, use `pos.length / 3`.

- [ ] **Step 3: Verify the old blasts are unchanged:** the default `lift` is `BLAST_LIFT` (0.3) and `blastImpulse` is the old maths. Run `node --test test/*.test.mjs`, expect PASS.

- [ ] **Step 4 (optional, one cheap check): load the page headlessly only if a harness exists in `test/harness`; otherwise skip.** Do not tune `CUT.strength`/`CUT.shove` here; park tuning as a follow-up issue.

- [ ] **Step 5: Commit.** `git add index.html && git commit -m "feat(weapons): cutting blast without upward kick, shoves the piece it sits on (#87)"`

---

### Task 4: README and CHANGELOG

**Files:**
- Modify: `README.md`, `CHANGELOG.md`

- [ ] **Step 1: README.** In the "Switch ammo" row add ``, `Y` (cutting charge)`` after `` `Z` (timed charge)``. In the Explosives list (line starting `- *Explosives*`) add after the remote charge entry: `cutting charge (like the remote charge, numbered, detonated with K / Boom, but a 1.2 m blast with no upward kick that shoves the piece it sits on sideways, for a controlled demolition; shares the 6-charge limit)`. In both Detonate rows change "remote charges" to "remote and cutting charges".

- [ ] **Step 2: CHANGELOG.** Under `## [Unreleased]` / `### Added`, as the first entry:

```
- Cutting charge (key Y): a remote charge for controlled demolition, numbered and detonated like the others (K, Boom, number buttons, same limit of 6), but with a small 1.2 m blast and no upward kick that knocks the piece it sits on sideways, so the rest of a building falls under gravity; bomb, dynamite, remote and timed charge are unchanged (#87)
```

- [ ] **Step 3: Run `node --test test/*.test.mjs`, expect PASS.**

- [ ] **Step 4: Commit.** `git add README.md CHANGELOG.md && git commit -m "docs: cutting charge in README and CHANGELOG (#87)"`
