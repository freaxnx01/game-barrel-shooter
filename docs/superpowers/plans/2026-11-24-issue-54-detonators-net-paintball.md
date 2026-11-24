# Remote/Timed Charges, Heavy Net, Paintball Colours Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three weapons (Remote charge `B` + detonate `K`, Timed charge `Z`, Heavy net `N`) and a paintball colour choice with a random mode to Barrel Blast (#54).

**Architecture:**
- Tuning and decision logic live in three new pure ES modules, `weapons/charges.js`,
  `weapons/net.js` and `weapons/paintball.js`. They have no THREE, no DOM and no
  physics, so `node --test` can test them, like `weapons/tire.js`.
- `index.html` adds the picker buttons, swatches, keys, spawn branches in
  `shootBall()`, per-frame work in `animate()`, the mobile 💥 Boom button and the net
  tether. Harpoon and net share two small extracted helpers, `launcherPoint()` and
  `drawRope()`.

**Tech Stack:**
- vanilla ES modules, buildless
- three.js 0.160 (import map)
- crashcat through the existing `phys` facade (`addBody`, `applyForce`,
  `applyImpulse`, `getVelocity`, `setVelocity`, `wake`, `removeBody`); no facade change
- `node:test`

**Spec:** `docs/superpowers/specs/2026-11-24-issue-54-detonators-net-paintball-design.md`

## Global Constraints

- **No new dependencies.** No `package.json`. No build step.
- **Tests:** `node --test test/*.test.mjs` (`node --test test/` does not work on Node 24).
- **Test names:** `function_State_Expected`, as in `test/sniper.test.mjs`.
- **Ammo ids:** `'remotecharge'`, `'timedcharge'`, `'net'`. Keys: `B`, `Z`, `N`; `K`
  detonates all armed remote charges; `P` on an already selected Paintball cycles the
  colour.
- **Charges:** box half extents `[0.16, 0.08, 0.11]`, mass 2, material `'heavy'`;
  launch direction `normalize(dir + (0, 0.28, 0))`, speed `12 + 14 * power`; no
  contact explosion; blast `explode(rec, 4, 500)`.
- **Timed fuse:** 4000 ms from launch; blink period `600 → 100 ms` linear over the fuse;
  LED on in the first half of each period.
- **Remote cap:** 6 armed charges; a 7th shot does nothing and counts no shot.
- **Net:** sphere r 0.3, mass 6, material `'heavy'`; direction
  `normalize(dir + (0, 0.3, 0))`, speed `12 + 12 * power`; catch radius 1.6 m, at most
  6 pieces with mass > 0, nearest first; pull `160 * m` toward the launcher point plus
  `9.82 * m` up, velocity × 0.92 per frame; release within 4 m of the launcher point.
- **Paint colours (ball / splat):** red `#e23b3b`/`#d62828` (default), orange
  `#f28c28`/`#d9731a`, yellow `#f2d02b`/`#d6b41c`, green `#3bb54a`/`#2e9a3c`, blue
  `#2f7de1`/`#2266c2`, purple `#9b4fd1`/`#8038b8`, pink `#ff5fa2`/`#e2448a`, then
  🎲 random. Not persisted.
- **UI language:** English, like the rest of the game.
- **Commits:** Conventional Commits, scope `weapons`; the last one has the footer
  `Closes #54`. Never `--no-verify`.

## Review Focus

1. **A paint swatch click** must not change the weapon, must not close the mobile
   weapon sheet and must not become the weapon name in the mobile top bar (swatches use
   class `on`, never `sel`). Pinned by the manual check in Task 4 Step 7 (the repo has
   no DOM test runner).
2. **Random paint mode** must never give two equal colours in a row. Pinned by
   `paintIndexForShot_RandomEveryPrevAndRng_NeverRepeats` in Task 3.
3. **Armed remote charges** must survive the 12 s cull but vanish on reset, on falling
   off the world and on detonation, and the Boom button must hide when none are left.
   Pinned by `armedRemotes_MixedRecords_OnlyUnexplodedRemotes` (Task 1) and the manual
   check in Task 5 Step 8.
4. **Switching target or resetting while a net holds pieces** must drop the net
   (no rope to removed bodies, no NaN). Pinned by `pullForce_SamePoint_NoNaN` and
   `selectCaught_NoPieces_Empty` (Task 2) and the manual check in Task 6 Step 8.
5. **Auto-Play with the remote charge selected** must keep going: it detonates armed
   charges before the next throw. Pinned by the manual check in Task 5 Step 8.

## File Structure

| File | Responsibility |
|---|---|
| `weapons/charges.js` (new) | charge tuning, launch, fuse, blink, remote cap, armed filter |
| `weapons/net.js` (new) | net tuning, launch, catch selection, centroid/spread, pull force, release |
| `weapons/paintball.js` (new) | paint palette, choice cycle, per-shot colour |
| `test/charges.test.mjs`, `test/net.test.mjs`, `test/paintball.test.mjs` (new) | unit tests |
| `index.html` | buttons, swatches, CSS, keys, spawn, per-frame, Boom button, net tether |
| `README.md`, `CHANGELOG.md` | docs |

---

### Task 1: Pure charges module

**Files:**
- Create: `weapons/charges.js`
- Create: `test/charges.test.mjs`

**Interfaces (produces):**
- `export const CHARGE` with `mass 2`, `halfExtents [0.16, 0.08, 0.11]`, `speedBase 12`,
  `speedPower 14`, `lift 0.28`, `blastRadius 4`, `blastStrength 500`, `fuseMs 4000`,
  `blinkSlowMs 600`, `blinkFastMs 100`, `maxRemote 6`
- `chargeLaunch(dir, power) -> { direction: {x,y,z} (unit), speed: number }`
- `isFuseDone(bornMs, nowMs) -> boolean`
- `blinkPeriod(elapsedMs) -> number` (ms)
- `ledOn(elapsedMs) -> boolean`
- `canPlaceRemote(armedCount) -> boolean`
- `armedRemotes(records) -> records[]` (those with `type === 'remotecharge'` and not `exploded`)

- [ ] **Step 1: Write the failing test** `test/charges.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARGE, chargeLaunch, isFuseDone, blinkPeriod, ledOn, canPlaceRemote, armedRemotes } from '../weapons/charges.js';

test('chargeLaunch_PowerRange_Speed12To26', () => {
  assert.equal(chargeLaunch({ x: 0, y: 0, z: -1 }, 0).speed, 12);
  assert.equal(chargeLaunch({ x: 0, y: 0, z: -1 }, 1).speed, 26);
});

test('chargeLaunch_PowerOutOfRange_Clamped', () => {
  assert.equal(chargeLaunch({ x: 0, y: 0, z: -1 }, -1).speed, 12);
  assert.equal(chargeLaunch({ x: 0, y: 0, z: -1 }, 5).speed, 26);
});

test('chargeLaunch_FlatAim_LiftedUnitDirection', () => {
  const { direction: d } = chargeLaunch({ x: 0, y: 0, z: -1 }, 0.5);
  assert.ok(Math.abs(Math.hypot(d.x, d.y, d.z) - 1) < 1e-9);
  assert.ok(Math.abs(d.y - 0.28 / Math.hypot(0.28, 1)) < 1e-9);
  assert.ok(d.z < 0);
  assert.equal(d.x, 0);
});

test('isFuseDone_BeforeAndAtFuse_FalseThenTrue', () => {
  assert.equal(isFuseDone(1000, 4999), false);
  assert.equal(isFuseDone(1000, 5000), true);
});

test('blinkPeriod_OverTheFuse_SlowsToFast', () => {
  assert.equal(blinkPeriod(0), 600);
  assert.equal(blinkPeriod(2000), 350);
  assert.equal(blinkPeriod(4000), 100);
});

test('blinkPeriod_OutsideTheFuse_Clamped', () => {
  assert.equal(blinkPeriod(-100), 600);
  assert.equal(blinkPeriod(9000), 100);
});

test('ledOn_FirstAndSecondHalfOfPeriod_OnThenOff', () => {
  assert.equal(ledOn(0), true);
  assert.equal(ledOn(100), true);    // period 587.5, first half
  assert.equal(ledOn(400), false);   // period 550, second half
});

test('canPlaceRemote_BelowAndAtCap_TrueThenFalse', () => {
  assert.equal(canPlaceRemote(CHARGE.maxRemote - 1), true);
  assert.equal(canPlaceRemote(CHARGE.maxRemote), false);
});

test('armedRemotes_MixedRecords_OnlyUnexplodedRemotes', () => {
  const a = { type: 'remotecharge', exploded: false };
  const b = { type: 'remotecharge', exploded: true };
  const c = { type: 'timedcharge', exploded: false };
  const d = { type: 'bomb', exploded: false };
  assert.deepEqual(armedRemotes([a, b, c, d]), [a]);
  assert.deepEqual(armedRemotes([]), []);
});

test('CHARGE_Tuning_MatchesSpec', () => {
  assert.equal(CHARGE.mass, 2);
  assert.deepEqual(CHARGE.halfExtents, [0.16, 0.08, 0.11]);
  assert.equal(CHARGE.blastRadius, 4);
  assert.equal(CHARGE.blastStrength, 500);
  assert.equal(CHARGE.fuseMs, 4000);
  assert.equal(CHARGE.maxRemote, 6);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test test/charges.test.mjs`
Expected: FAIL, `Cannot find module '../weapons/charges.js'`.

- [ ] **Step 3: Write the implementation** `weapons/charges.js`

```js
// Remote and timed demolition charges (#54): tuning and pure helpers. No engine, no DOM.
// Numbers from docs/superpowers/specs/2026-11-24-issue-54-detonators-net-paintball-design.md.

export const CHARGE = {
  mass: 2,
  halfExtents: [0.16, 0.08, 0.11],
  speedBase: 12,
  speedPower: 14,
  lift: 0.28,          // tossed with a slight arc, like the grenade
  blastRadius: 4,      // between bomb (3/320) and dynamite (4.5/600)
  blastStrength: 500,
  fuseMs: 4000,
  blinkSlowMs: 600,
  blinkFastMs: 100,
  maxRemote: 6,
};

function clamp01(v) {
  return Math.min(Math.max(v, 0), 1);
}

export function chargeLaunch(dir, power) {
  const x = dir.x, y = dir.y + CHARGE.lift, z = dir.z;
  const n = Math.hypot(x, y, z);
  return {
    direction: { x: x / n, y: y / n, z: z / n },
    speed: CHARGE.speedBase + clamp01(power) * CHARGE.speedPower,
  };
}

export function isFuseDone(bornMs, nowMs) {
  return nowMs - bornMs >= CHARGE.fuseMs;
}

export function blinkPeriod(elapsedMs) {
  const t = clamp01(elapsedMs / CHARGE.fuseMs);
  return CHARGE.blinkSlowMs - (CHARGE.blinkSlowMs - CHARGE.blinkFastMs) * t;
}

export function ledOn(elapsedMs) {
  const period = blinkPeriod(elapsedMs);
  return Math.max(elapsedMs, 0) % period < period / 2;
}

export function canPlaceRemote(armedCount) {
  return armedCount < CHARGE.maxRemote;
}

export function armedRemotes(records) {
  return records.filter((r) => r.type === 'remotecharge' && !r.exploded);
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node --test test/charges.test.mjs`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add weapons/charges.js test/charges.test.mjs
git commit -m "feat(weapons): add charge launch, fuse and remote-cap math (#54)"
```

---

### Task 2: Pure net module

**Files:**
- Create: `weapons/net.js`
- Create: `test/net.test.mjs`

**Interfaces (produces):**
- `export const NET` with `mass 6`, `radius 0.3`, `speedBase 12`, `speedPower 12`,
  `lift 0.3`, `captureRadius 1.6`, `maxCatch 6`, `pullPerKg 160`, `gravity 9.82`,
  `releaseDistance 4`
- `netLaunch(dir, power) -> { direction: {x,y,z} (unit), speed }`
- `selectCaught(pieces, point) -> pieces[]` — `pieces` are objects with
  `position: {x,y,z}` and `mass` (crashcat bodies qualify); returns at most 6 with
  mass > 0 within 1.6 m, nearest first
- `centroid(points) -> {x,y,z} | null` (null for an empty list)
- `spread(points, centre) -> number` (largest distance, 0 for an empty list)
- `pullForce(from, pos, mass) -> {x,y,z}`
- `isReeledIn(from, centre) -> boolean`

- [ ] **Step 1: Write the failing test** `test/net.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { NET, netLaunch, selectCaught, centroid, spread, pullForce, isReeledIn } from '../weapons/net.js';

const piece = (x, mass = 8) => ({ position: { x, y: 0, z: 0 }, mass });
const origin = { x: 0, y: 0, z: 0 };

test('netLaunch_PowerRange_Speed12To24', () => {
  assert.equal(netLaunch({ x: 0, y: 0, z: -1 }, 0).speed, 12);
  assert.equal(netLaunch({ x: 0, y: 0, z: -1 }, 1).speed, 24);
  assert.equal(netLaunch({ x: 0, y: 0, z: -1 }, 7).speed, 24);
});

test('netLaunch_FlatAim_LiftedUnitDirection', () => {
  const { direction: d } = netLaunch({ x: 0, y: 0, z: -1 }, 0.5);
  assert.ok(Math.abs(Math.hypot(d.x, d.y, d.z) - 1) < 1e-9);
  assert.ok(Math.abs(d.y - 0.3 / Math.hypot(0.3, 1)) < 1e-9);
});

test('selectCaught_InAndOutOfRadius_OnlyNearOnes', () => {
  const near = piece(1), far = piece(2);
  assert.deepEqual(selectCaught([far, near], origin), [near]);
});

test('selectCaught_StaticPiece_Ignored', () => {
  assert.deepEqual(selectCaught([piece(0.5, 0)], origin), []);
});

test('selectCaught_NoPieces_Empty', () => {
  assert.deepEqual(selectCaught([], origin), []);
});

test('selectCaught_MoreThanMax_NearestSixInOrder', () => {
  const pieces = [0.8, 0.3, 0.1, 0.7, 0.5, 0.2, 0.6, 0.4].map((x) => piece(x));
  const caught = selectCaught(pieces, origin);
  assert.equal(caught.length, NET.maxCatch);
  assert.deepEqual(caught.map((p) => p.position.x), [0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
});

test('centroid_TwoPoints_Midpoint', () => {
  assert.deepEqual(centroid([{ x: 0, y: 0, z: 0 }, { x: 2, y: 4, z: 6 }]), { x: 1, y: 2, z: 3 });
});

test('centroid_Empty_Null', () => {
  assert.equal(centroid([]), null);
});

test('spread_TwoPoints_LargestDistanceFromCentre', () => {
  const pts = [{ x: 0, y: 0, z: 0 }, { x: 2, y: 4, z: 6 }];
  assert.ok(Math.abs(spread(pts, { x: 1, y: 2, z: 3 }) - Math.sqrt(14)) < 1e-9);
  assert.equal(spread([], origin), 0);
});

test('pullForce_TowardLauncher_ScaledByMassPlusGravity', () => {
  const f = pullForce({ x: 0, y: 0, z: 10 }, origin, 2);
  assert.equal(f.x, 0);
  assert.ok(Math.abs(f.y - 9.82 * 2) < 1e-9);
  assert.ok(Math.abs(f.z - 160 * 2) < 1e-9);
});

test('pullForce_SamePoint_NoNaN', () => {
  const f = pullForce(origin, origin, 2);
  assert.ok(Number.isFinite(f.x) && Number.isFinite(f.y) && Number.isFinite(f.z));
  assert.ok(Math.abs(f.y - 9.82 * 2) < 1e-9);
});

test('isReeledIn_InsideAndAtReleaseDistance_TrueThenFalse', () => {
  assert.equal(isReeledIn(origin, { x: 0, y: 0, z: 3.9 }), true);
  assert.equal(isReeledIn(origin, { x: 0, y: 0, z: 4 }), false);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test test/net.test.mjs`
Expected: FAIL, `Cannot find module '../weapons/net.js'`.

- [ ] **Step 3: Write the implementation** `weapons/net.js`

```js
// Heavy net (#54): thrown with an arc, catches nearby target pieces, then is pulled in.
// Tuning and pure helpers. No engine, no DOM.

export const NET = {
  mass: 6,
  radius: 0.3,
  speedBase: 12,
  speedPower: 12,
  lift: 0.3,
  captureRadius: 1.6,
  maxCatch: 6,
  pullPerKg: 160,      // weaker than the harpoon's 220: it drags several pieces at once
  gravity: 9.82,
  releaseDistance: 4,
};

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function netLaunch(dir, power) {
  const p = Math.min(Math.max(power, 0), 1);
  const x = dir.x, y = dir.y + NET.lift, z = dir.z;
  const n = Math.hypot(x, y, z);
  return { direction: { x: x / n, y: y / n, z: z / n }, speed: NET.speedBase + p * NET.speedPower };
}

export function selectCaught(pieces, point) {
  return pieces
    .filter((p) => p.mass > 0)
    .map((p) => ({ p, d: distance(p.position, point) }))
    .filter((e) => e.d <= NET.captureRadius)
    .sort((a, b) => a.d - b.d)
    .slice(0, NET.maxCatch)
    .map((e) => e.p);
}

export function centroid(points) {
  if (!points.length) return null;
  const sum = points.reduce((s, p) => ({ x: s.x + p.x, y: s.y + p.y, z: s.z + p.z }), { x: 0, y: 0, z: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length, z: sum.z / points.length };
}

export function spread(points, centre) {
  return points.reduce((m, p) => Math.max(m, distance(p, centre)), 0);
}

export function pullForce(from, pos, mass) {
  const dx = from.x - pos.x, dy = from.y - pos.y, dz = from.z - pos.z;
  const dist = Math.hypot(dx, dy, dz) || 1;
  const f = NET.pullPerKg * mass;
  return { x: (dx / dist) * f, y: (dy / dist) * f + NET.gravity * mass, z: (dz / dist) * f };
}

export function isReeledIn(from, centre) {
  return distance(from, centre) < NET.releaseDistance;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node --test test/net.test.mjs`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add weapons/net.js test/net.test.mjs
git commit -m "feat(weapons): add heavy net catch and pull math (#54)"
```

---

### Task 3: Pure paintball module

**Files:**
- Create: `weapons/paintball.js`
- Create: `test/paintball.test.mjs`

**Interfaces (produces):**
- `export const PAINT_COLORS` — array of `{ name, ball, splat }`, 7 entries, index 0 red
- `export const RANDOM_PAINT = 'random'`
- `nextPaintChoice(choice) -> number | 'random'` (0 → 1 → … → 6 → `'random'` → 0)
- `paintIndexForShot(choice, prevIndex, rng) -> number` — `choice` is an index or
  `'random'`; `prevIndex` is the last shot's index or `null`; `rng` returns `[0, 1)`

- [ ] **Step 1: Write the failing test** `test/paintball.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { PAINT_COLORS, RANDOM_PAINT, nextPaintChoice, paintIndexForShot } from '../weapons/paintball.js';

test('PAINT_COLORS_Palette_SevenWithRedFirst', () => {
  assert.equal(PAINT_COLORS.length, 7);
  assert.deepEqual(PAINT_COLORS[0], { name: 'Red', ball: '#e23b3b', splat: '#d62828' });
  assert.deepEqual(PAINT_COLORS.map((c) => c.name), ['Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple', 'Pink']);
});

test('nextPaintChoice_Cycle_ColoursThenRandomThenRed', () => {
  assert.equal(nextPaintChoice(0), 1);
  assert.equal(nextPaintChoice(5), 6);
  assert.equal(nextPaintChoice(6), RANDOM_PAINT);
  assert.equal(nextPaintChoice(RANDOM_PAINT), 0);
});

test('paintIndexForShot_FixedChoice_ThatColour', () => {
  assert.equal(paintIndexForShot(3, 1, () => 0.9), 3);
  assert.equal(paintIndexForShot(0, null, () => 0.5), 0);
});

test('paintIndexForShot_RandomFirstShot_AnyColour', () => {
  assert.equal(paintIndexForShot(RANDOM_PAINT, null, () => 0), 0);
  assert.equal(paintIndexForShot(RANDOM_PAINT, null, () => 0.999), 6);
});

test('paintIndexForShot_RandomAfterAShot_SkipsPrevious', () => {
  assert.equal(paintIndexForShot(RANDOM_PAINT, 0, () => 0), 1);
  assert.equal(paintIndexForShot(RANDOM_PAINT, 3, () => 0.5), 4);
  assert.equal(paintIndexForShot(RANDOM_PAINT, 6, () => 0.999), 5);
});

test('paintIndexForShot_RandomEveryPrevAndRng_NeverRepeats', () => {
  for (let prev = 0; prev < PAINT_COLORS.length; prev++) {
    for (let i = 0; i < 1000; i++) {
      const idx = paintIndexForShot(RANDOM_PAINT, prev, () => i / 1000);
      assert.notEqual(idx, prev);
      assert.ok(Number.isInteger(idx) && idx >= 0 && idx < PAINT_COLORS.length);
    }
  }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test test/paintball.test.mjs`
Expected: FAIL, `Cannot find module '../weapons/paintball.js'`.

- [ ] **Step 3: Write the implementation** `weapons/paintball.js`

```js
// Paintball colours (#54): the palette, the picker cycle and the per-shot colour.
// No engine, no DOM. Index 0 keeps the original red.

export const PAINT_COLORS = [
  { name: 'Red', ball: '#e23b3b', splat: '#d62828' },
  { name: 'Orange', ball: '#f28c28', splat: '#d9731a' },
  { name: 'Yellow', ball: '#f2d02b', splat: '#d6b41c' },
  { name: 'Green', ball: '#3bb54a', splat: '#2e9a3c' },
  { name: 'Blue', ball: '#2f7de1', splat: '#2266c2' },
  { name: 'Purple', ball: '#9b4fd1', splat: '#8038b8' },
  { name: 'Pink', ball: '#ff5fa2', splat: '#e2448a' },
];

export const RANDOM_PAINT = 'random';

export function nextPaintChoice(choice) {
  if (choice === RANDOM_PAINT) return 0;
  return choice + 1 < PAINT_COLORS.length ? choice + 1 : RANDOM_PAINT;
}

// Random mode: uniform over the colours other than the previous shot's.
export function paintIndexForShot(choice, prevIndex, rng) {
  if (choice !== RANDOM_PAINT) return choice;
  const n = PAINT_COLORS.length;
  if (prevIndex === null) return Math.floor(rng() * n);
  const k = Math.floor(rng() * (n - 1));
  return k >= prevIndex ? k + 1 : k;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node --test test/paintball.test.mjs`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add weapons/paintball.js test/paintball.test.mjs
git commit -m "feat(weapons): add paintball palette and random colour choice (#54)"
```

---

### Task 4: Paintball colours in the game

**Files:**
- Modify: `index.html`:
  - CSS after `.ammo .dot` (around line 75) and in the mobile block after
    `.ammo.open button { width: 100%; }` (around line 165)
  - the *Explosives* group (around line 209): swatch row after the Paintball button
  - module imports (around line 329)
  - `paintMatl` / `paintSplatMatl` (around lines 1239–1240)
  - `setAmmo()` and the ammo click handler (around lines 1253–1264)
  - `shootBall()` paintball mesh branch (around line 1577) and the `rec` literal
    (around line 1679)
  - `paintSplat()` (around line 1754)
  - keydown `p` (around line 2560)
  - the sheet close listener in the mobile section (around line 2608)

**Interfaces:**
- Consumes `PAINT_COLORS`, `RANDOM_PAINT`, `nextPaintChoice`, `paintIndexForShot`
  from Task 3.
- Produces: `rec.paintIndex` on paintball records; `setPaintChoice(choice)`;
  element `#paint-colors`.

- [ ] **Step 1: Run the suite to confirm a green baseline**

Run: `node --test test/*.test.mjs`
Expected: PASS (all, including Tasks 1–3).

- [ ] **Step 2: Markup and CSS.** Directly after the Paintball button add:

```html
    <div class="paint-colors" id="paint-colors" hidden></div>
```

Add after the `.ammo .dot` rule:

```css
  .paint-colors { display: flex; flex-wrap: wrap; gap: 5px; padding: 1px 0 3px 3px; max-width: 150px; }
  .paint-colors[hidden] { display: none; }
  .ammo .paint-colors .swatch {
    width: 20px; height: 20px; padding: 0; border-radius: 50%; justify-content: center;
    font-size: 11px; border: 2px solid rgba(245,239,228,0.25);
  }
  .ammo .paint-colors .swatch.on { border-color: #f5efe4; box-shadow: 0 0 0 1px #f5efe4; }
```

Inside the mobile media block, after `.ammo.open button { width: 100%; }`:

```css
    .ammo.open .paint-colors .swatch { width: 28px; height: 28px; }
```

- [ ] **Step 3: Materials and state.** Add the import:

```js
import { PAINT_COLORS, RANDOM_PAINT, nextPaintChoice, paintIndexForShot } from './weapons/paintball.js';
```

Replace the two lines `const paintMatl = …` and `const paintSplatMatl = …` with:

```js
const paintBallMatls = PAINT_COLORS.map((c) => new THREE.MeshStandardMaterial({ color: c.ball, roughness: 0.55 }));
const paintSplatMatls = PAINT_COLORS.map((c) => new THREE.MeshStandardMaterial({ color: c.splat, roughness: 0.7 }));
let paintChoice = 0;         // index into PAINT_COLORS, or RANDOM_PAINT
let lastPaintIndex = null;   // colour of the previous paintball, so random mode never repeats it
```

Run `grep -n "paintMatl\|paintSplatMatl" index.html` afterwards: the only remaining
hits must be the two you change in Steps 4–5.

- [ ] **Step 4: Per-shot colour.** In `shootBall()` declare `let paintIndex = null;`
  right before `let mesh;`, and replace the paintball mesh branch with:

```js
  } else if (type === 'paintball') {
    paintIndex = paintIndexForShot(paintChoice, lastPaintIndex, Math.random);
    lastPaintIndex = paintIndex;
    mesh = new THREE.Mesh(ballGeo, paintBallMatls[paintIndex]);
    mesh.scale.setScalar(0.15 / BALL_R);
```

Add `paintIndex` to the record literal:

```js
  const rec = { body, mesh, born: performance.now(), type, exploded: false, constraint, chainMesh, anchorPos,
    muzzle: { x: start.x, y: start.y, z: start.z }, paintIndex };
```

In `paintSplat()` replace `o.material = paintMatl` with
`o.material = paintBallMatls[rec.paintIndex]` and
`new THREE.Mesh(splatGeo, paintSplatMatl)` with
`new THREE.Mesh(splatGeo, paintSplatMatls[rec.paintIndex])`.

- [ ] **Step 5: Swatches and picking.** After `const ammoEl = …`, add:

```js
const paintColorsEl = document.getElementById('paint-colors');
function buildPaintSwatches() {
  const choices = [...PAINT_COLORS.keys(), RANDOM_PAINT];
  for (const choice of choices) {
    const s = document.createElement('button');
    s.type = 'button';
    s.className = 'swatch';
    s.dataset.paint = String(choice);
    if (choice === RANDOM_PAINT) { s.textContent = '🎲'; s.title = 'Random: every shot a different colour'; }
    else { s.style.background = PAINT_COLORS[choice].ball; s.title = PAINT_COLORS[choice].name; }
    paintColorsEl.append(s);
  }
}
function setPaintChoice(choice) {
  paintChoice = choice;
  for (const s of paintColorsEl.children) s.classList.toggle('on', s.dataset.paint === String(choice));
}
buildPaintSwatches();
setPaintChoice(0);
paintColorsEl.addEventListener('click', (e) => {
  const s = e.target.closest('.swatch');
  if (!s || autoPlay) return;
  setPaintChoice(s.dataset.paint === RANDOM_PAINT ? RANDOM_PAINT : Number(s.dataset.paint));
});
```

Change `setAmmo()` to only touch weapon buttons and to show the swatches:

```js
  for (const b of ammoEl.querySelectorAll('button[data-type]')) b.classList.toggle('sel', b.dataset.type === type);
  paintColorsEl.hidden = type !== 'paintball';
```

Note: `setAmmo` is a function declaration (hoisted) but `paintColorsEl` is a `const`;
make sure `setAmmo` is not called before the `const paintColorsEl` line runs (grep
for `setAmmo(` calls at top level; there are none today).

In the ammo click handler change `e.target.closest('button')` to
`e.target.closest('button[data-type]')`.

In the mobile section change the sheet listener so swatches keep the sheet open:

```js
  el.addEventListener('click', (e) => { if (e.target.closest('button:not(.swatch)')) closeSheets(); });
```

- [ ] **Step 6: Key P cycles.** Replace `if (k === 'p') setAmmo('paintball');` with:

```js
  if (k === 'p') { if (ammoType === 'paintball') setPaintChoice(nextPaintChoice(paintChoice)); else setAmmo('paintball'); }
```

In the desktop hint (`.hint-desk`, around line 238) add ` · P again changes the paint colour`
before ` · R to reset`.

- [ ] **Step 7: Run tests and check by hand.**

Run: `node --test test/*.test.mjs` — Expected: PASS.

Serve with `python3 -m http.server 8000` and open `http://localhost:8000/`:
- Swatches are hidden until Paintball is picked, then a row of 7 colours + 🎲 shows
  under it with red marked.
- Each colour paints ball, splat and the hit barrel in that colour.
- 🎲: ten quick shots never give the same colour twice in a row.
- P with Paintball selected steps red → … → pink → 🎲 → red.
- Mobile (DevTools device mode, e.g. iPhone 12): open 💥, pick Paintball (sheet
  closes), reopen, tap a swatch: the sheet stays open, the top bar still says
  "Paintball", the selected weapon is unchanged.
- The console is empty.

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "feat(weapons): choose the paintball colour or a random colour per shot (#54)"
```

---

### Task 5: Remote and timed charges in the game

**Files:**
- Modify: `index.html`:
  - the *Explosives* group: two buttons after Dynamite
  - `#act-bar` (around line 246): the Boom button
  - module imports
  - materials (around line 1240) and new mesh helpers next to `makeFootballMesh` or
    before `shootBall()`
  - `shootBall()`: cap check, `cfg`, `shapeSpec`, launch, mesh
  - the ball loop in `animate()` (around lines 2855–2935): fuse/LED, cull rule, Boom
    visibility
  - keydown (around line 2550), `updateAutoPlay()` (around line 2674)
  - hints (around line 238)

**Interfaces:**
- Consumes `CHARGE`, `chargeLaunch`, `isFuseDone`, `ledOn`, `canPlaceRemote`,
  `armedRemotes` from Task 1.
- Produces: ammo ids `'remotecharge'`, `'timedcharge'`; `detonateRemoteCharges()`;
  `rec.mesh.userData.led` on charge records; element `#act-boom`.

- [ ] **Step 1: Run the suite to confirm a green baseline**

Run: `node --test test/*.test.mjs` — Expected: PASS.

- [ ] **Step 2: Markup.** After the Dynamite button:

```html
    <button data-type="remotecharge"><span class="dot" style="background:#5e6338;border:2px solid #3fd16a;box-sizing:border-box;border-radius:2px"></span>Remote charge <span style="opacity:0.5">B</span></button>
    <button data-type="timedcharge"><span class="dot" style="background:#5e6338;border:2px solid #e0483a;box-sizing:border-box;border-radius:2px"></span>Timed charge <span style="opacity:0.5">Z</span></button>
```

In `#act-bar`, after the Pull button:

```html
  <button id="act-boom" title="Detonate the remote charges" hidden>💥<span>Boom</span></button>
```

- [ ] **Step 3: Import, materials, meshes.**

```js
import { CHARGE, chargeLaunch, isFuseDone, ledOn, canPlaceRemote, armedRemotes } from './weapons/charges.js';
```

Next to the other ammo materials:

```js
const chargeMatl = new THREE.MeshStandardMaterial({ color: '#5e6338', roughness: 0.85 });
const chargeBoxMatl = new THREE.MeshStandardMaterial({ color: '#1c1c20', roughness: 0.5, metalness: 0.3 });
```

Before `shootBall()`:

```js
// olive-drab brick with a black detonator box and a small LED on top
function makeChargeMesh(ledColor) {
  const g = new THREE.Group();
  const [hx, hy, hz] = CHARGE.halfExtents;
  const brick = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2), chargeMatl);
  brick.castShadow = true;
  g.add(brick);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.09), chargeBoxMatl);
  box.position.y = hy + 0.025;
  g.add(box);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), new THREE.MeshBasicMaterial({ color: ledColor }));
  led.position.set(0.035, hy + 0.055, 0);
  g.add(led);
  g.userData.led = led;
  return g;
}
function makeRemoteChargeMesh() {
  const g = makeChargeMesh('#3fd16a');
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.22, 6), chargeBoxMatl);
  antenna.position.set(-0.04, CHARGE.halfExtents[1] + 0.16, 0);
  g.add(antenna);
  return g;
}
function makeTimedChargeMesh() {
  return makeChargeMesh('#ff3b30');
}
```

- [ ] **Step 4: Spawn in `shootBall()`.**
  1. After the `tire` early return:

     ```js
     if (type === 'remotecharge' && !canPlaceRemote(armedRemotes(balls).length)) return;   // cap: 6 armed
     ```
  2. In the `cfg` table:

     ```js
         remotecharge: { mass: CHARGE.mass, r: CHARGE.halfExtents[0] },
         timedcharge:  { mass: CHARGE.mass, r: CHARGE.halfExtents[0] },
     ```
  3. In the `shapeSpec` chain, before the final `else`:

     ```js
       } else if (type === 'remotecharge' || type === 'timedcharge') {
         shapeSpec = { kind: 'box', halfExtents: CHARGE.halfExtents };
     ```
  4. In the speed chain, before `phys.setVelocity(...)`:

     ```js
       } else if (type === 'remotecharge' || type === 'timedcharge') {
         const launch = chargeLaunch(dir, power);   // slight arc, like the grenade
         vdir = launch.direction;
         speed = launch.speed;
     ```
  5. In the mesh chain, before the final `else`:

     ```js
       } else if (type === 'remotecharge') {
         mesh = makeRemoteChargeMesh();
       } else if (type === 'timedcharge') {
         mesh = makeTimedChargeMesh();
     ```
  No `onCollide` change: charges never explode on contact; the default bounce/clank
  sounds apply.

- [ ] **Step 5: Fuse, LED and cull in the ball loop.** After the grenade line
  (`if (b.type === 'grenade' && …`):

```js
    if (b.type === 'timedcharge' && !b.exploded) {
      if (isFuseDone(b.born, now)) { explode(b, CHARGE.blastRadius, CHARGE.blastStrength); continue; }
      b.mesh.userData.led.visible = ledOn(now - b.born);
    }
```

Replace the cull condition

```js
    if (!b.stuck && (now - b.born > cullTime || b.body.position.y < -5)) {
```

with

```js
    const timeless = b.stuck || (b.type === 'remotecharge' && !b.exploded);   // armed charges wait for K / Boom
    if ((!timeless && now - b.born > cullTime) || (!b.stuck && b.body.position.y < -5)) {
```

- [ ] **Step 6: Detonation, Boom button, keys, Auto-Play.** Next to `explode()`:

```js
function detonateRemoteCharges() {
  for (const rec of armedRemotes(balls)) explode(rec, CHARGE.blastRadius, CHARGE.blastStrength);
}
```

Next to `holdButton(pullBtn, …)`:

```js
const boomBtn = document.getElementById('act-boom');   // mobile Boom button, shown while remote charges are armed
boomBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); if (!autoPlay) detonateRemoteCharges(); });
```

In `animate()`, right after the ball loop:

```js
  const armed = armedRemotes(balls).length > 0;
  if (boomBtn.hidden === armed) boomBtn.hidden = !armed;
```

Keydown, next to the other ammo keys:

```js
  if (k === 'b') setAmmo('remotecharge');
  if (k === 'z') setAmmo('timedcharge');
  if (k === 'k') detonateRemoteCharges();
```

In `updateAutoPlay()`, replace `if (autoPlayState === 'aiming') autoPlayFireNext();` with:

```js
  if (autoPlayState === 'aiming') {
    if (armedRemotes(balls).length) {        // remote charges would never go off on their own
      detonateRemoteCharges();
      autoPlayState = 'settling';
      autoPlayShotAt = now;
      return;
    }
    autoPlayFireNext();
  }
```

Hints: in `.hint-desk` add ` · K detonates remote charges` before ` · R to reset`; in
`.hint-touch` add ` · Boom detonates remote charges` after the Pull sentence.

- [ ] **Step 7: Run tests.**

Run: `node --test test/*.test.mjs` — Expected: PASS.

- [ ] **Step 8: Check by hand** (`python3 -m http.server 8000`):
- B: throw 3 charges at the barrel pyramid; none explodes on contact; they stay past
  15 s; K blows all three at once, harder than a bomb, softer than dynamite.
- Throw 7 remote charges: only 6 appear and the shot counter rises by 6.
- Z: the charge lands, its red LED blinks faster and it explodes ~4 s after the throw.
- R with armed charges: all gone; K afterwards does nothing.
- Mobile mode: 💥 Boom appears after the first remote charge, detonates, then hides.
- Auto-Play with Remote charge selected: it alternates throw → detonate and does not
  stall.
- The console is empty.

- [ ] **Step 9: Commit**

```bash
git add index.html
git commit -m "feat(weapons): add remote charge (K to detonate) and timed charge (#54)"
```

---

### Task 6: Heavy net in the game

**Files:**
- Modify: `index.html`:
  - the *Launchers* group: button after Harpoon
  - `#act-pull` title (around line 248)
  - module imports; materials
  - `shootBall()`: `cfg`, launch, mesh, `onCollide`
  - harpoon helpers (around lines 1918–1948): extract `makeRopeMesh()`,
    `disposeRope()`, `drawRope()`, `launcherPoint()`, `syncPullButton()`
  - the harpoon block in `animate()` (around lines 2713–2740)
  - `let harpoonLink = null, pulling = false;` (around line 2308)
  - `buildTargets()` (around line 1162) and `reset()` (around line 2533)
  - keydown Space and the Pull `holdButton` (around lines 2577, 2627)
  - hints (around line 238)

**Interfaces:**
- Consumes `NET`, `netLaunch`, `selectCaught`, `centroid`, `spread`, `pullForce`,
  `isReeledIn` from Task 2.
- Produces: ammo id `'net'`; `netLink = { bodies, drape, rope } | null`;
  `netCatch(rec)`, `detachNet()`, `updateNet()`, `launcherPoint() -> THREE.Vector3`,
  `drawRope(rope, from, to)`, `makeRopeMesh()`, `disposeRope(rope)`, `syncPullButton()`.

- [ ] **Step 1: Run the suite to confirm a green baseline**

Run: `node --test test/*.test.mjs` — Expected: PASS.

- [ ] **Step 2: Markup.** After the Harpoon button:

```html
    <button data-type="net"><span class="dot" style="background:#3c4a2e;border:2px dashed #b9a77a;box-sizing:border-box"></span>Heavy net <span style="opacity:0.5">N</span></button>
```

Change the Pull button's title to `Hold to reel the harpoon or net in`.

- [ ] **Step 3: Extract the shared rope helpers (refactor, harpoon unchanged).** Add
  before `harpoonStick()`:

```js
// braided rope: a unit-height cylinder that drawRope() repositions every frame.
// Each rope clones the texture so harpoon and net ropes keep their own repeat.
function makeRopeMesh() {
  const map = makeRopeTexture().clone();
  map.needsUpdate = true;
  return new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 1, 8, 1, true),
    new THREE.MeshStandardMaterial({ map, roughness: 0.95, metalness: 0.0, side: THREE.DoubleSide }));
}
function disposeRope(rope) {
  scene.remove(rope);
  rope.geometry.dispose();
  rope.material.map.dispose();
  rope.material.dispose();
}
function drawRope(rope, from, to) {
  const seg = to.clone().sub(from);
  const len = seg.length();
  rope.position.copy(from).add(to).multiplyScalar(0.5);
  if (len > 1e-6) rope.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), seg.clone().normalize());
  rope.scale.set(1, len, 1);
  rope.material.map.repeat.set(1, Math.max(1, Math.round(len * 2)));  // braid stays fine-grained, doesn't stretch
}
// ropes start at a launcher point low-right in view — from the camera itself they're edge-on and invisible
function launcherPoint() {
  return new THREE.Vector3(0.6, -0.55, -1.4).applyMatrix4(camera.matrixWorld);
}
function syncPullButton() {
  const tethered = Boolean(harpoonLink || netLink);
  pullBtn.hidden = !tethered;
  if (!tethered) pulling = false;
}
```

In `harpoonStick()`: replace the `const rope = new THREE.Mesh(…)` statement with
`const rope = makeRopeMesh();` and `pullBtn.hidden = false;` with `syncPullButton();`
(after `harpoonLink = …`).

In `detachHarpoon()`: replace the three rope lines (`scene.remove`,
`geometry.dispose`, `material.dispose`) with `disposeRope(harpoonLink.rope);`, and the
two lines `pulling = false; pullBtn.hidden = true;` with `syncPullButton();` (after
`harpoonLink = null;`).

In `animate()`'s harpoon block, replace the lines from `const from = …` through
`harpoonLink.rope.material.map.repeat.set(…)` with:

```js
    const from = launcherPoint();
    drawRope(harpoonLink.rope, from, new THREE.Vector3(rec.body.position.x, rec.body.position.y, rec.body.position.z));
```

The pull code below it keeps using `from`.

Change `let harpoonLink = null, pulling = false;` to:

```js
let harpoonLink = null, netLink = null, pulling = false;   // harpoon / heavy net tethers; hold Space to reel in
```

Run `node --test test/*.test.mjs` and fire a harpoon by hand: rope, Pull button and
reeling behave exactly as before.

- [ ] **Step 4: Net spawn.** Import:

```js
import { NET, netLaunch, selectCaught, centroid, spread, pullForce, isReeledIn } from './weapons/net.js';
```

Materials and mesh, next to the charge helpers:

```js
const netMatl = new THREE.MeshStandardMaterial({ color: '#3c4a2e', roughness: 0.9, wireframe: true });
const netWeightMatl = new THREE.MeshStandardMaterial({ color: '#55585e', roughness: 0.4, metalness: 0.8 });
// a bundled net with four lead weights, as thrown
function makeNetBundleMesh() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(NET.radius, 1), netMatl));
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), netWeightMatl);
    w.position.set(x * 0.24, -0.1, z * 0.24);
    g.add(w);
  }
  return g;
}
```

In `shootBall()`:
  1. `cfg`: `net: { mass: NET.mass, r: NET.radius },` (the default sphere shape applies).
  2. Speed chain:

     ```js
       } else if (type === 'net') {
         const launch = netLaunch(dir, power);   // heavy: slow, with an arc
         vdir = launch.direction;
         speed = launch.speed;
     ```
  3. Mesh chain: `} else if (type === 'net') { mesh = makeNetBundleMesh();`
  4. `onCollide`, after the paintball line:

     ```js
         if (type === 'net' && !rec.hit) { netCatch(rec); return; }
     ```

- [ ] **Step 5: Catch, update, detach.** After `detachHarpoon()`:

```js
// ---------- Heavy net: catch the pieces around the first contact; the player then drags them in ----------
function netCatch(rec) {
  rec.hit = true;
  const caught = selectCaught(barrels.map((b) => b.body), rec.body.position);
  if (!caught.length) return;                 // missed: the net lies where it fell and is culled later
  detachNet();                                // one net at a time: a new catch replaces the old one
  for (const body of caught) phys.wake(body);
  const drape = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), netMatl);
  const rope = makeRopeMesh();
  scene.add(drape);
  scene.add(rope);
  netLink = { bodies: caught, drape, rope };
  // the bundled net is replaced by the drape — removed out of the collide callback, like paintSplat()
  setTimeout(() => {
    phys.removeBody(rec.body);
    scene.remove(rec.mesh);
    const i = balls.indexOf(rec);
    if (i >= 0) balls.splice(i, 1);
  }, 0);
  syncPullButton();
  playBounce(4);
}

function detachNet() {
  if (!netLink) return;
  scene.remove(netLink.drape);
  netLink.drape.geometry.dispose();
  disposeRope(netLink.rope);
  netLink = null;
  syncPullButton();
}

function updateNet() {
  netLink.bodies = netLink.bodies.filter((body) => body.position.y >= -5);   // pieces off the world drop out
  if (!netLink.bodies.length) { detachNet(); return; }
  const from = launcherPoint();
  const points = netLink.bodies.map((body) => body.position);
  const centre = centroid(points);
  const c = new THREE.Vector3(centre.x, centre.y, centre.z);
  drawRope(netLink.rope, from, c);
  netLink.drape.position.copy(c);
  netLink.drape.scale.setScalar(spread(points, centre) + 0.6);
  if (!pulling) return;
  if (isReeledIn(from, centre)) { detachNet(); return; }
  for (const body of netLink.bodies) pullNetPiece(body, from);
}

function pullNetPiece(body, from) {
  const f = pullForce(from, body.position, body.mass || 1);
  phys.wake(body);
  phys.applyForce(body, f.x, f.y, f.z);
  const v = phys.getVelocity(body);
  phys.setVelocity(body, v.x * 0.92, v.y * 0.92, v.z * 0.92);
}
```

In `animate()`, directly after the harpoon block: `if (netLink) updateNet();`

In `buildTargets()` after `detachHarpoon();` and in `reset()` after `detachHarpoon();`
add `detachNet();` (comment in `buildTargets`: `// the net references target bodies we're about to remove`).

- [ ] **Step 6: Keys and Pull.**
  - Keydown: `if (k === 'n') setAmmo('net');`
  - Space: `if (e.key === ' ' && (harpoonLink || netLink)) { pulling = true; e.preventDefault(); }`
  - Pull button: `holdButton(pullBtn, () => { if (!autoPlay && (harpoonLink || netLink)) pulling = true; }, () => { pulling = false; });`
  - Hints: in `.hint-desk` replace `Harpoon sticks — hold Space to reel the barrel in`
    with `Harpoon and heavy net — hold Space to reel the catch in`; in `.hint-touch`
    replace `Harpoon sticks: hold Pull to reel the barrel in` with
    `Harpoon and net: hold Pull to reel the catch in`.

- [ ] **Step 7: Run tests.**

Run: `node --test test/*.test.mjs` — Expected: PASS.

- [ ] **Step 8: Check by hand** (`python3 -m http.server 8000`):
- N at the barrel pyramid: a slow arcing bundle; on contact a green wire dome covers
  up to 6 barrels and a rope runs to the lower right of the view.
- Hold Space: the caught barrels slide toward you together; near the launcher the net
  lets go and the Pull button hides.
- A net that lands on empty ground catches nothing and disappears after ~12 s.
- A second net that catches replaces the first (one dome, one rope).
- Harpoon a barrel and net others: Space pulls both; releasing one keeps the other's
  rope.
- Switch target and press R while a net holds pieces: dome and rope vanish, no
  console errors.
- Mobile mode: 🪝 Pull shows while a net holds pieces.
- The console is empty.

- [ ] **Step 9: Commit**

```bash
git add index.html
git commit -m "feat(weapons): add heavy net that catches pieces and is pulled in (#54)"
```

---

### Task 7: Docs and final check

**Files:**
- Modify: `README.md` (How to Play tables and *Game Content*)
- Modify: `CHANGELOG.md` (`[Unreleased]` → `### Added`)

- [ ] **Step 1: README.**
  - *Switch ammo* row: add `` `B` (remote charge), `Z` (timed charge), `N` (heavy net) ``
    and `` `P` again cycles the paintball colour ``.
  - New desktop row after *Earthquake*: `| **Detonate** | `K` blows up all placed remote charges |`.
  - Mobile table: rename *Harpoon pull* to *Harpoon / net pull* with
    "Hold the 🪝 Pull button, shown while a harpoon or net holds something"; add
    `| **Detonate** | Tap the 💥 Boom button bottom-left, shown while remote charges are placed |`.
  - *Game Content* → *Explosives*: `paintball (splats; pick a colour or 🎲 random)`,
    add `remote charge (lies still until you press K / Boom; up to 6)`,
    `timed charge (explodes 4 s after the throw, LED blinks faster)`.
    *Launchers*: add `heavy net (catches up to 6 pieces, hold Space / Pull to drag them in)`.
- [ ] **Step 2: CHANGELOG** under `[Unreleased]` → `### Added`:

```markdown
- Remote charge (key B) that lies where it lands until you press K or the 💥 Boom button, and timed charge (key Z) that explodes 4 s after the throw (#54)
- Heavy net (key N): catches up to six pieces where it lands; hold Space or Pull to drag them in (#54)
- Paintball colours: pick one of seven colours or 🎲 random, where every shot has a different colour; P cycles them (#54)
```

- [ ] **Step 3: Full suite.**

Run: `node --test test/*.test.mjs` — Expected: PASS, including the 28 new tests.
If a browser is available, also open `test/harness/physics-contract.html` and
`test/harness/barrel-support.html` (served): titles `CONTRACT PASS` / `SUPPORT PASS`.

- [ ] **Step 4: Commit**

```bash
git add README.md CHANGELOG.md
git commit -m "docs(weapons): document charges, heavy net and paintball colours

Closes #54"
```
