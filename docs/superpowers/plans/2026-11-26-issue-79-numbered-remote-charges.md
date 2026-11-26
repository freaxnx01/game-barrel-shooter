# Numbered Remote Charges Implementation Plan (#79)

**Requires #78 to be merged first** (charges stick visibly). It changes `chargeStick`, `addFixedJoint` and the `charges.js` import line in `index.html`, which this plan also touches. Reference functions by name; line numbers shift.

**Goal:** Boom shows `Boom N`; every remote charge carries a floating number 1-6; a toggle next to Boom opens buttons `1`..`6` (armed ones only) that each detonate a single charge. Boom and K still detonate all. Cap of 6, autoplay and Cut unchanged.

**Architecture:** Pure helpers in `weapons/charges.js` and `ui/actions.js`. The 3D label is a shared-texture `THREE.Sprite` child of the charge mesh. UI lives inside `#act-bar` in `index.html`.

**Spec:** `docs/superpowers/specs/2026-11-26-issue-79-numbered-remote-charges-design.md`

Run tests with `node --test test/*.test.mjs`. Make only the commits named below. Do not run Playwright or the browser harness.

### Task 1: Pure helpers and tests

**Files:**
- Modify: `weapons/charges.js`
- Modify: `ui/actions.js`
- Create: `test/remote-numbers.test.mjs`

- [ ] **Step 1: Write the failing tests.** Create `test/remote-numbers.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { nextChargeNumber, chargeLabelScale } from '../weapons/charges.js';
import { shownNumbers, numberRowShown } from '../ui/actions.js';

test('nextChargeNumber_NoneUsed_One', () => {
  assert.equal(nextChargeNumber([]), 1);
});
test('nextChargeNumber_LowestFreeGap', () => {
  assert.equal(nextChargeNumber([1, 3]), 2);
  assert.equal(nextChargeNumber([2, 3]), 1);
});
test('nextChargeNumber_ReusesNumberAfterItWentOff', () => {
  assert.equal(nextChargeNumber([1, 2, 3, 4, 5, 6].filter((n) => n !== 4)), 4);
});
test('nextChargeNumber_AllSixUsed_Zero', () => {
  assert.equal(nextChargeNumber([1, 2, 3, 4, 5, 6]), 0);
});
test('chargeLabelScale_GameDistance_ReadableSize', () => {
  assert.ok(Math.abs(chargeLabelScale(52) - 1.82) < 1e-9);
});
test('chargeLabelScale_ClampedBothWays', () => {
  assert.equal(chargeLabelScale(1), 0.5);
  assert.equal(chargeLabelScale(500), 2);
});
test('shownNumbers_SortedUniqueAndValidOnly', () => {
  assert.deepEqual(shownNumbers([3, 1, 3, 0, 7, 2.5, undefined]), [1, 3]);
  assert.deepEqual(shownNumbers([]), []);
});
test('numberRowShown_NeedsOpenAndArmed', () => {
  assert.equal(numberRowShown(true, 2), true);
  assert.equal(numberRowShown(true, 0), false);
  assert.equal(numberRowShown(false, 3), false);
});
```

- [ ] **Step 2: Run to verify failure.** `node --test test/remote-numbers.test.mjs` fails: the exports do not exist.

- [ ] **Step 3: Implement.** Append to `weapons/charges.js`:

```js
// The number a new remote charge gets (#79): the lowest free one of 1..maxRemote among `used`
// (the numbers of the armed remotes). 0 only if all are taken, which the cap prevents.
export function nextChargeNumber(used) {
  for (let n = 1; n <= CHARGE.maxRemote; n++) if (!used.includes(n)) return n;
  return 0;
}

// World size of a charge's number sprite (#79): grows with the camera distance so the digit stays
// readable from the chimney camera (about 52 units away) without being huge up close.
export function chargeLabelScale(dist) {
  return Math.min(Math.max(dist * 0.035, 0.5), 2);
}
```

In `ui/actions.js`, add as the first line `import { CHARGE } from '../weapons/charges.js';` (after the leading comment) and append:

```js

// The number buttons to show (#79): the armed charges' numbers, valid ones only, sorted, no duplicates.
export function shownNumbers(numbers) {
  return [...new Set(numbers)].filter((n) => Number.isInteger(n) && n >= 1 && n <= CHARGE.maxRemote).sort((a, b) => a - b);
}

// The number row shows while the toggle is open and at least one charge is armed (#79).
export function numberRowShown(open, count) {
  return Boolean(open) && count > 0;
}
```

- [ ] **Step 4: Run to verify pass.** `node --test test/*.test.mjs` passes.

- [ ] **Step 5: Commit.** `git add weapons/charges.js ui/actions.js test/remote-numbers.test.mjs && git commit -m "feat(weapons): number assignment and label scale for remote charges (#79)"`

### Task 2: Number labels in the scene

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Import.** In the `import { CHARGE, ... } from './weapons/charges.js';` line add `nextChargeNumber, chargeLabelScale` inside the braces (keep everything #78 put there). Change the line `import { visibleActions, CUT_KEY } from './ui/actions.js';` to `import { visibleActions, CUT_KEY, shownNumbers, numberRowShown } from './ui/actions.js';`.

- [ ] **Step 2: Label textures and mesh.** Replace the whole function `makeRemoteChargeMesh` with:

```js
// One canvas texture per number, built on first use and shared by all labels (#79)
const chargeLabelMaps = [];
function chargeLabelMap(n) {
  if (!chargeLabelMaps[n]) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.beginPath(); g.arc(32, 32, 28, 0, Math.PI * 2);
    g.fillStyle = 'rgba(26,22,17,0.85)'; g.fill();
    g.lineWidth = 4; g.strokeStyle = '#3fd16a'; g.stroke();
    g.fillStyle = '#f5efe4'; g.font = 'bold 40px sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(n), 32, 34);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    chargeLabelMaps[n] = t;
  }
  return chargeLabelMaps[n];
}
const chargeLabelMatls = [];
function makeChargeLabel(n) {
  if (!chargeLabelMatls[n]) {
    // depthTest off: the number is never hidden inside the chimney or the ground
    chargeLabelMatls[n] = new THREE.SpriteMaterial({ map: chargeLabelMap(n), depthTest: false, depthWrite: false, transparent: true });
  }
  const s = new THREE.Sprite(chargeLabelMatls[n]);
  s.renderOrder = 10;
  return s;
}
function makeRemoteChargeMesh(number) {
  const g = makeChargeMesh('#3fd16a');
  const antenna = new THREE.Mesh(antennaGeo, chargeBoxMatl);
  antenna.position.set(-0.04, CHARGE.halfExtents[1] + 0.16, 0);
  g.add(antenna);
  const label = makeChargeLabel(number);
  g.add(label);
  g.userData.number = number;
  g.userData.label = label;
  return g;
}
```

- [ ] **Step 3: Give each new remote charge its number.** In the shooting code, replace `    mesh = makeRemoteChargeMesh();` with

```js
    mesh = makeRemoteChargeMesh(nextChargeNumber(armedRemotes(balls).map((r) => r.number)));   // the new rec is not in balls yet (#79)
```

and in the line `const rec = { body, mesh, born: performance.now(), type, exploded: false, constraint, chainMesh, anchorPos,` add `number: mesh.userData.number,` right after `anchorPos,`.

- [ ] **Step 4: Place the label each frame.** In `animate()`, in the loop `// sync balls, cull old ones`, directly after the `if (b.type === 'timedcharge' && !b.exploded) { ... }` block, add:

```js
    if (b.type === 'remotecharge' && !b.exploded) placeChargeLabel(b);
```

Above `function animate()` add:

```js
// The number floats 0.7 above the charge in world space (the charge may lie tilted on a face) and
// grows with the camera distance, so it stays readable from the chimney camera (#79).
const labelWorld = new THREE.Vector3();
function placeChargeLabel(b) {
  const label = b.mesh.userData.label;
  const p = b.body.position;
  labelWorld.set(p.x, p.y + 0.7, p.z);
  const s = chargeLabelScale(camera.position.distanceTo(labelWorld));
  label.scale.set(s, s, 1);
  label.position.copy(b.mesh.worldToLocal(labelWorld));
}
```

- [ ] **Step 5: Verify.** `node --test test/*.test.mjs` passes. `grep -n "placeChargeLabel\|nextChargeNumber\|makeChargeLabel" index.html` shows the import, the three definitions and the calls.

- [ ] **Step 6: Commit.** `git add index.html && git commit -m "feat(weapons): floating number above each remote charge (#79)"`

### Task 3: Boom count, toggle, number row and single detonation

**Files:**
- Modify: `index.html`

- [ ] **Step 1: CSS.** After the rule `#act-bar button.held { ... }` add:

```css
  /* #79: toggle next to Boom and the row of per-charge buttons, floating above the bar */
  #act-bar #act-boom-more { width: 28px; font-size: 16px; }
  #act-nums { position: absolute; right: 0; bottom: 100%; margin-bottom: 8px; display: flex; gap: 6px; }
  #act-nums[hidden] { display: none; }
  #act-bar #act-nums button { width: 44px; height: 44px; font-size: 18px; font-weight: bold; }
```

In the mobile block, after the line `#act-bar { left: calc(12px + var(--sa-l)); right: auto; bottom: calc(46px + var(--sa-b)); }` add `#act-nums { left: 0; right: auto; }`.

- [ ] **Step 2: Markup.** In `#act-bar`, replace the `act-boom` line with:

```html
  <button id="act-boom" title="Detonate all remote charges (K)" hidden>💥<span>Boom</span></button>
  <button id="act-boom-more" title="Detonate a single remote charge" aria-expanded="false" hidden>▸</button>
  <div id="act-nums" hidden>
    <button data-n="1" title="Detonate charge 1">1</button>
    <button data-n="2" title="Detonate charge 2">2</button>
    <button data-n="3" title="Detonate charge 3">3</button>
    <button data-n="4" title="Detonate charge 4">4</button>
    <button data-n="5" title="Detonate charge 5">5</button>
    <button data-n="6" title="Detonate charge 6">6</button>
  </div>
```

- [ ] **Step 3: Single detonation.** Replace `detonateRemoteCharges` with:

```js
function detonateRemoteCharges() {
  for (const rec of armedRemotes(balls)) explode(rec, CHARGE.blastRadius, CHARGE.blastStrength);
}
// just the armed remote charge with this number (#79); nothing happens if there is none
function detonateRemote(n) {
  const rec = armedRemotes(balls).find((r) => r.number === n);
  if (rec) explode(rec, CHARGE.blastRadius, CHARGE.blastStrength);
}
```

- [ ] **Step 4: Sync the bar.** Next to `const boomBtn = document.getElementById('act-boom');` add:

```js
const boomMoreBtn = document.getElementById('act-boom-more');
const boomLabel = boomBtn.querySelector('span');
const numsRow = document.getElementById('act-nums');
const numBtns = [...numsRow.querySelectorAll('button')];
let numsOpen = false;
let boomKey = '';
```

These consts must be declared before the first `syncActionBar()` call (they sit with the other button consts, which precede it). In `syncActionBar`, replace

```js
  setHidden(boomBtn, !v.boom);
```

with

```js
  setHidden(boomBtn, !v.boom);
  setHidden(boomMoreBtn, !v.boom);
  const nums = shownNumbers(armedRemotes(balls).map((r) => r.number));
  if (!nums.length) numsOpen = false;
  const key = nums.join(',') + (numsOpen ? 'o' : 'c');
  if (key !== boomKey) {                      // touch the DOM only when something changed
    boomKey = key;
    boomLabel.textContent = nums.length ? 'Boom ' + nums.length : 'Boom';
    boomMoreBtn.textContent = numsOpen ? '▾' : '▸';
    boomMoreBtn.setAttribute('aria-expanded', String(numsOpen));
    for (const b of numBtns) setHidden(b, !nums.includes(Number(b.dataset.n)));
    setHidden(numsRow, !numberRowShown(numsOpen, nums.length));
  }
```

- [ ] **Step 5: Handlers.** After the line `boomBtn.addEventListener('pointerdown', ...)` add:

```js
boomMoreBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); numsOpen = !numsOpen; syncActionBar(); });
numsRow.addEventListener('pointerdown', (e) => {
  const b = e.target.closest('button[data-n]');
  if (!b) return;
  e.preventDefault();
  if (!autoPlay) detonateRemote(Number(b.dataset.n));
});
```

Leave the K key, Boom handler and the autoplay call to `detonateRemoteCharges()` as they are.

- [ ] **Step 6: Verify.** `node --test test/*.test.mjs` passes. `grep -n "detonateRemote\b\|act-boom-more\|act-nums" index.html` shows the definition, markup, CSS and handlers.

- [ ] **Step 7: Commit.** `git add index.html && git commit -m "feat(ui): Boom count, toggle and per-charge detonate buttons (#79)"`

### Task 4: README and changelog

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: README desktop.** Replace the table row starting with `| **Detonate** | \`K\` or the 💥 Boom button` with:

```markdown
| **Detonate** | `K` or the 💥 Boom button (bottom right, shown while remote charges are placed, with their count) blows up all placed remote charges. The small ▸ next to it opens buttons `1`..`6` that blow up just that charge; each placed charge shows its number floating above it |
```

- [ ] **Step 2: README mobile.** Replace the row starting with `| **Detonate** | Tap the 💥 Boom button bottom-left` with:

```markdown
| **Detonate** | Tap the 💥 Boom button bottom-left (shown while remote charges are placed, with their count) to blow up all of them; tap the ▸ next to it, then a number `1`..`6`, to blow up just that charge |
```

- [ ] **Step 3: CHANGELOG.** Under `## [Unreleased]` → `### Added`, add as the first line:

```markdown
- Numbered remote charges: every placed remote charge shows a number (1-6) above it, the 💥 Boom button shows how many are armed, and a ▸ toggle next to it opens buttons `1`..`6` that detonate a single charge; Boom and K still detonate all (#79)
```

- [ ] **Step 4: Verify and commit.** `node --test test/*.test.mjs` passes. `git add README.md CHANGELOG.md && git commit -m "docs: numbered remote charges in the controls and changelog (#79)"`

### Optional headless check (not part of the pipeline)

On a scratch copy, expose `balls, shootBall, setAmmo, detonateRemote, armedRemotes` on `window.__dbg`, place three remote charges, and confirm: the Boom span reads `BOOM 3`, `#act-nums` opens via `#act-boom-more` showing buttons 1-3, `detonateRemote(2)` leaves charges 1 and 3 armed, and the next placed charge gets number 2.
