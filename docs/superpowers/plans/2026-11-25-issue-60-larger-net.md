# Larger Heavy Net Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (this plan is dispatched through the issue pipeline). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the heavy net (#54) a 4 m × 4 m throw net of thick rope strands with wide meshes and corner weights that opens in flight, drapes over the catch as a rope dome, and catches up to 14 pieces within 2.4 m instead of 6 within 1.6 m (#60).

**Architecture:** All numbers and pure math stay in `weapons/net.js` (tested with `node:test`). `index.html` swaps the icosahedron for an open strand net built from shared geometries, keeps the mesh flat and opens it in the ball sync, and replaces the per-catch wireframe hemisphere with one shared rope dome. Physics body, launch, pull and release are unchanged.

**Tech Stack:** buildless vanilla JS (ES modules), three.js 0.160, crashcat through `phys`, `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-25-issue-60-larger-net-design.md`

## Global Constraints

- Only the net changes: `weapons/net.js`, `test/net.test.mjs`, the net parts of `index.html`, README.md, CHANGELOG.md. No edit to the harpoon, the rope tether helpers, `physics/*`, the physics body of the net (sphere r 0.3, mass 6) or `netLaunch()`.
- Numbers: `openSize` 4, `meshSpacing` 0.5, `ropeRadius` 0.035, `weightRadius` 0.1, `bundleScale` 0.12, `openMs` 350, `captureRadius` 2.4, `maxCatch` 14, `drapeMargin` 0.8, `drapeMin` 1.2, `drapeMeridians` 8, `drapeParallels` 4. `pullPerKg` stays 160.
- Shared geometries at module scope (see the comment at `index.html:1298`); a mesh may be created per shot, a geometry may not. The drape is one module-scope group, never disposed.
- Tests run with `node --test test/*.test.mjs` (no `package.json`; `node --test test/` does not work on Node 24). Test names: `function_State_Expected`.
- No browser harness run, no Playwright. The only visual check is the optional last step of Task 4.
- Follow the repo's CLAUDE.md: Conventional Commits, CHANGELOG and README updates.

## Review Focus

1. **A geometry per shot or per catch.** `makeNetMesh()` must use only `netStrandGeo` and `netWeightGeo`; `netCatch()` must add the shared `netDrape`, and `detachNet()` must not call `geometry.dispose()` on it.
2. **The net still tumbles or never opens**: the ball sync must reset the quaternion and set `scale` from `openScale(now - b.born)` for `type === 'net'`.
3. **Stale "6 pieces"** in README.md, CHANGELOG.md or comments.
4. **The old test** `selectCaught_MoreThanMax_NearestSixInOrder` left in place (it would fail at 14).

---

### Task 1: Net tuning and pure helpers

**Files:**
- Modify: `weapons/net.js`, `test/net.test.mjs`

- [ ] **Step 1: Write the failing tests.** In `test/net.test.mjs`, change the import line to:

```js
import { NET, netLaunch, selectCaught, centroid, spread, pullForce, isReeledIn, strandOffsets, openScale, drapeRadius, drapeParallels } from '../weapons/net.js';
```

Replace the test `selectCaught_MoreThanMax_NearestSixInOrder` with:

```js
test('NET_Catch_RadiusAndCapGrowWithTheOpenNet', () => {
  assert.equal(NET.captureRadius, 2.4);
  assert.equal(NET.maxCatch, 14);
  assert.ok(NET.captureRadius > NET.openSize / 2);          // covers at least the inscribed circle
  assert.ok(NET.captureRadius < NET.openSize / Math.SQRT2); // but not the full diagonal
});

test('selectCaught_MoreThanMax_NearestFourteenInOrder', () => {
  const pieces = Array.from({ length: 20 }, (_, i) => piece((20 - i) * 0.1));   // 2.0 m … 0.1 m, farthest first
  const caught = selectCaught(pieces, origin);
  assert.equal(caught.length, NET.maxCatch);
  assert.deepEqual(caught.map((p) => Math.round(p.position.x * 10)), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
});
```

Append at the end of the file:

```js
test('strandOffsets_FourMetreNet_NineStrandsHalfAMetreApart', () => {
  assert.deepEqual(strandOffsets(), [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2]);
});

test('openScale_StartAndEnd_BundleThenFull', () => {
  assert.equal(openScale(0), NET.bundleScale);
  assert.equal(openScale(-10), NET.bundleScale);
  assert.equal(openScale(NET.openMs), 1);
  assert.equal(openScale(5000), 1);
});

test('openScale_Midway_MonotonicAndEasedOut', () => {
  const a = openScale(100), b = openScale(200), c = openScale(300);
  assert.ok(NET.bundleScale < a && a < b && b < c && c < 1);
  assert.ok(openScale(NET.openMs / 2) > (NET.bundleScale + 1) / 2);   // ease-out: past half size at half time
});

test('drapeRadius_SmallAndLargeSpread_FloorThenMargin', () => {
  assert.equal(drapeRadius(0), NET.drapeMin);
  assert.equal(drapeRadius(0.3), NET.drapeMin);
  assert.ok(Math.abs(drapeRadius(2.5) - 3.3) < 1e-9);
});

test('drapeParallels_FourRings_OnUnitHemisphereRisingAndNarrowing', () => {
  const rings = drapeParallels();
  assert.equal(rings.length, NET.drapeParallels);
  for (const r of rings) assert.ok(Math.abs(r.radius * r.radius + r.y * r.y - 1) < 1e-9);
  for (let i = 1; i < rings.length; i++) {
    assert.ok(rings[i].y > rings[i - 1].y);
    assert.ok(rings[i].radius < rings[i - 1].radius);
  }
  assert.ok(rings[0].y > 0 && rings[rings.length - 1].radius > 0);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test test/net.test.mjs`
Expected: FAIL, `does not provide an export named 'strandOffsets'`.

- [ ] **Step 3: Write the implementation.** In `weapons/net.js`, replace the `NET` object with:

```js
export const NET = {
  mass: 6,
  radius: 0.3,         // the collider stays a small sphere; the open net is a visual on top of it
  speedBase: 12,
  speedPower: 12,
  lift: 0.3,
  captureRadius: 2.4,  // a bit more than half the open net (#60)
  maxCatch: 14,        // grows with the catch area: (2.4 / 1.6)² × 6 ≈ 14 (#60)
  pullPerKg: 160,      // weaker than the harpoon's 220: it drags several pieces at once; per piece, so the count does not matter
  gravity: 9.82,
  releaseDistance: 4,
  // open throw net (#60): a square of thick rope strands with lead weights on the corners
  openSize: 4,
  meshSpacing: 0.5,
  ropeRadius: 0.035,
  weightRadius: 0.1,
  bundleScale: 0.12,   // leaves the launcher as a bundle …
  openMs: 350,         // … and is fully open this long after the throw
  // drape after a catch: a rope dome over the caught pieces
  drapeMargin: 0.8,
  drapeMin: 1.2,
  drapeMeridians: 8,
  drapeParallels: 4,
};
```

Append at the end of the file:

```js
// Strand positions along one axis of the open net: -2, -1.5, …, 2 for a 4 m net with 0.5 m meshes.
export function strandOffsets() {
  const n = Math.round(NET.openSize / NET.meshSpacing);
  return Array.from({ length: n + 1 }, (_, i) => -NET.openSize / 2 + i * NET.meshSpacing);
}

// Mesh scale during the throw: eased out from the bundle to the full net over openMs.
export function openScale(elapsedMs) {
  const t = Math.min(Math.max(elapsedMs / NET.openMs, 0), 1);
  const eased = 1 - (1 - t) * (1 - t);
  return NET.bundleScale + (1 - NET.bundleScale) * eased;
}

// Radius of the drape dome for a given spread of the caught pieces around their centroid.
export function drapeRadius(spreadValue) {
  return Math.max(NET.drapeMin, spreadValue + NET.drapeMargin);
}

// Parallels of the unit drape dome, from the rim upward: { radius, y } on the unit hemisphere.
export function drapeParallels() {
  return Array.from({ length: NET.drapeParallels }, (_, i) => {
    const lat = ((i + 1) / (NET.drapeParallels + 1)) * (Math.PI / 2);
    return { radius: Math.cos(lat), y: Math.sin(lat) };
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/*.test.mjs`
Expected: PASS, every file; `net.test.mjs` has 18 tests.

- [ ] **Step 5: Commit**

```bash
git add weapons/net.js test/net.test.mjs
git commit -m "feat(weapons): net catches 14 pieces within 2.4 m, open-net and drape helpers (#60)"
```

---

### Task 2: The open throw net in flight

**Files:**
- Modify: `index.html`:
  - the net import (line 347)
  - `netMatl` (line 1296) and the shared net geometries (lines 1304–1305)
  - `makeNetBundleMesh()` (lines 1523–1533) and its call in `shootBall()` (line 1821)
  - the ball sync in `animate()` (lines 3148–3149, `b.mesh.position.copy …`)
  - optional: the picker dot of the Heavy net button (line 238)

- [ ] **Step 1: Run the suite to confirm a green baseline**

Run: `node --test test/*.test.mjs` — Expected: PASS.

- [ ] **Step 2: Import the new helpers.** Change line 347 to:

```js
import { NET, netLaunch, selectCaught, centroid, spread, pullForce, isReeledIn, strandOffsets, openScale, drapeRadius, drapeParallels } from './weapons/net.js';
```

- [ ] **Step 3: Material and shared geometries.** Replace the `netMatl` line (1296) with:

```js
const netMatl = new THREE.MeshStandardMaterial({ color: '#7a6646', roughness: 0.95 });   // thick hemp rope (#60)
```

Replace the two lines `const netBundleGeo = …` and `const netWeightGeo = …` (1304–1305) with:

```js
const netStrandGeo = new THREE.CylinderGeometry(NET.ropeRadius, NET.ropeRadius, NET.openSize, 6);   // one rope strand of the open net
const netWeightGeo = new THREE.SphereGeometry(NET.weightRadius, 10, 8);
```

- [ ] **Step 4: The open net mesh.** Replace `makeNetBundleMesh()` (the comment line and the function, 1523–1533) with:

```js
// the open throw net (#60): a square of thick rope strands with wide meshes and lead weights on the corners.
// Only shared geometries. The strand plane sits just below the sphere body, so a net lying on the ground touches it.
function makeNetMesh() {
  const g = new THREE.Group();
  const half = NET.openSize / 2;
  const y = -(NET.radius - NET.ropeRadius);
  for (const o of strandOffsets()) {
    const alongX = new THREE.Mesh(netStrandGeo, netMatl);   // strand parallel to x, offset along z
    alongX.rotation.z = Math.PI / 2;
    alongX.position.set(0, y, o);
    const alongZ = new THREE.Mesh(netStrandGeo, netMatl);   // strand parallel to z, offset along x
    alongZ.rotation.x = Math.PI / 2;
    alongZ.position.set(o, y, 0);
    g.add(alongX, alongZ);
  }
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const w = new THREE.Mesh(netWeightGeo, netWeightMatl);
    w.position.set(x * half, y, z * half);
    g.add(w);
  }
  g.scale.setScalar(NET.bundleScale);   // leaves the launcher bundled; the ball sync opens it
  return g;
}
```

In `shootBall()` change `mesh = makeNetBundleMesh();` to `mesh = makeNetMesh();`.

- [ ] **Step 5: Flat and opening in flight.** In the ball sync in `animate()`, directly after

```js
    b.mesh.position.copy(b.body.position);
    b.mesh.quaternion.copy(b.body.quaternion);
```

add:

```js
    if (b.type === 'net') {   // the net flies and lies flat, and opens over the first part of the throw (#60)
      b.mesh.quaternion.identity();
      b.mesh.scale.setScalar(openScale(now - b.born));
    }
```

- [ ] **Step 6 (optional, one line): picker dot.** In the Heavy net button (line 238) change `background:#3c4a2e` to `background:#7a6646` so the dot matches the rope.

- [ ] **Step 7: Check for leftovers and run the suite**

Run: `grep -n 'netBundleGeo\|makeNetBundleMesh\|IcosahedronGeometry(NET' index.html` — Expected: no output.
Run: `node --test test/*.test.mjs` — Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "feat(weapons): heavy net opens into a 4 m rope net with wide meshes in flight (#60)"
```

---

### Task 3: Rope dome drape over the catch

**Files:**
- Modify: `index.html`:
  - after `makeNetMesh()` (from Task 2): new `makeNetDrapeMesh()` and `netDrape`
  - `netCatch()` (around line 2139, `const drape = new THREE.Mesh(new THREE.SphereGeometry(…`)
  - `detachNet()` (around line 2158, `netLink.drape.geometry.dispose();`)
  - `updateNet()` (around line 2173, `netLink.drape.scale.setScalar(spread(points, centre) + 0.6);`)

- [ ] **Step 1: The shared drape.** Directly after `makeNetMesh()` add:

```js
// rope dome draped over the caught pieces (#60): arcs and rings of thick rope on a unit hemisphere,
// scaled to the catch every frame. Built once; netCatch() adds it to the scene, detachNet() removes it.
const NET_DRAPE_TUBE_R = 0.02;   // at unit scale; the dome is 1.2–4 m, so the rope reads as 2.4–8 cm
function makeNetDrapeMesh() {
  const g = new THREE.Group();
  const arcGeo = new THREE.TorusGeometry(1, NET_DRAPE_TUBE_R, 6, 24, Math.PI);   // half-torus: rim to rim over the top
  for (let i = 0; i < NET.drapeMeridians; i++) {
    const arc = new THREE.Mesh(arcGeo, netMatl);
    arc.rotation.y = (i / NET.drapeMeridians) * Math.PI;
    g.add(arc);
  }
  for (const ring of drapeParallels()) {
    const p = new THREE.Mesh(new THREE.TorusGeometry(ring.radius, NET_DRAPE_TUBE_R, 6, 32), netMatl);
    p.rotation.x = Math.PI / 2;
    p.position.y = ring.y;
    g.add(p);
  }
  return g;
}
const netDrape = makeNetDrapeMesh();
```

- [ ] **Step 2: Use it in the net tether.** In `netCatch()` replace

```js
  const drape = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), netMatl);
  const rope = makeRopeMesh();
  scene.add(drape);
  scene.add(rope);
  netLink = { bodies: caught, drape, rope };
```

with

```js
  const rope = makeRopeMesh();
  scene.add(netDrape);
  scene.add(rope);
  netLink = { bodies: caught, drape: netDrape, rope };
```

In `detachNet()` delete the line `netLink.drape.geometry.dispose();` (the group is shared and lives on).

In `updateNet()` replace `netLink.drape.scale.setScalar(spread(points, centre) + 0.6);` with:

```js
  netLink.drape.scale.setScalar(drapeRadius(spread(points, centre)));
```

- [ ] **Step 3: Check and run the suite**

Run: `grep -n 'SphereGeometry(1, 16, 8\|drape.geometry.dispose\|+ 0.6)' index.html` — Expected: no output.
Run: `node --test test/*.test.mjs` — Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(weapons): net drapes over the catch as a shared rope dome (#60)"
```

---

### Task 4: Docs and final check

**Files:**
- Modify: `README.md` (line 80), `CHANGELOG.md` (`### Changed` under `[Unreleased]`)

- [ ] **Step 1: README.** In the *Launchers* line change `heavy net (catches up to 6 pieces, hold Space / Pull to drag them in)` to:

```
heavy net (a 4 m rope net that catches up to 14 pieces, hold Space / Pull to drag them in)
```

- [ ] **Step 2: CHANGELOG.** Add as the first bullet under `### Changed` in `[Unreleased]`:

```
- Heavy net is now a 4 m × 4 m throw net of thick rope with wide meshes and corner weights: it opens in flight, lies flat where it lands, drapes over the catch as a rope dome and catches up to 14 pieces within 2.4 m instead of 6 within 1.6 m (#60)
```

- [ ] **Step 3: Full suite**

Run: `node --test test/*.test.mjs` — Expected: PASS, all files.
Run: `grep -rn 'up to 6\|up to six' README.md CHANGELOG.md` — Expected: only the historical `### Added` line for #54 in CHANGELOG.md (leave it).

- [ ] **Step 4 (optional, skip if the clock is short): one visual look.** Serve with `python3 -m http.server 8000`, open `http://localhost:8000/`, press `N`, fire one net at the barrel pyramid. Expected: the bundle opens into a flat square of thick strands within about a third of a second, lands flat, and on contact a rope dome covers the caught barrels; holding Space drags them in. Stop the server with `fuser -k 8000/tcp`.

- [ ] **Step 5: Commit**

```bash
git add README.md CHANGELOG.md
git commit -m "docs: heavy net is a 4 m rope net that catches up to 14 pieces (#60)"
```
