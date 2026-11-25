# Cloth Net Drape Implementation Plan (#70)

**Goal:** After a catch, the heavy net becomes a 9 × 9 rope cloth (Verlet, distance constraints, gravity) that lies over the caught pieces, hangs down their sides and follows them while they are pulled. Catch and pull logic stay unchanged.

**Architecture:** All simulation math goes into a new pure module `weapons/cloth.js` (tested in `test/cloth.test.mjs`). `index.html` keeps one module-scope cloth state and one module-scope mesh group (an `InstancedMesh` of 144 rope cylinders plus the 4 lead weights), resets them on a catch, steps and syncs them in `updateNet()`, and hides them in `detachNet()`. The physics backend stores each body's shape spec on its handle, so collision proxies can be built from the caught bodies.

**Spec:** `docs/superpowers/specs/2026-11-25-issue-70-cloth-net-design.md`

Run tests with `node --test test/*.test.mjs` (252 pass before this work). Do not touch git beyond the commits named below. No Playwright, no harness.

Syntax check for the main module script of `index.html` (use it after every `index.html` edit):

```bash
python3 -c "import re;s=open('index.html').read();print(re.search(r'<script type=\"module\">(.*?)</script>',s,re.S).group(1))" > "${TMPDIR:-/tmp}/barrel-main.mjs" && node --check "${TMPDIR:-/tmp}/barrel-main.mjs" && echo SYNTAX-OK
```

### Task 1: Cloth simulation module

**Files:**
- Create: `weapons/cloth.js`
- Create: `test/cloth.test.mjs`

- [ ] **Step 1: Write the failing tests.** Create `test/cloth.test.mjs` with exactly:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { NET } from '../weapons/net.js';
import { CLOTH, createCloth, resetCloth, stepCloth, proxyFor, clothSegments, cornerNodes, nearestCorner } from '../weapons/cloth.js';

const STILL = { x: 0, y: 0, z: 0 };
const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };
const node = (c, k) => ({ x: c.pos[k * 3], y: c.pos[k * 3 + 1], z: c.pos[k * 3 + 2] });
const run = (c, seconds, world) => { for (let t = 0; t < seconds * 30; t++) stepCloth(c, 1 / 30, world); };
const minY = (c) => Math.min(...Array.from({ length: c.count }, (_, k) => c.pos[k * 3 + 1]));
const centreNode = (c) => Math.floor(c.count / 2);

function maxStretch(c) {
  let worst = 0;
  for (let s = 0; s < c.segA.length; s++) {
    const a = node(c, c.segA[s]), b = node(c, c.segB[s]);
    worst = Math.max(worst, Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / NET.meshSpacing - 1);
  }
  return worst;
}

test('clothSegments_NineByNine_144RowAndColumnRopes', () => {
  assert.equal(clothSegments(9).length, 144);
  assert.deepEqual(cornerNodes(9), [0, 8, 72, 80]);
});

test('resetCloth_FullyOpen_NodesOnTheOpenNetPlane', () => {
  const c = createCloth();
  resetCloth(c, { x: 1, y: 5, z: -6 }, 1, STILL);
  assert.equal(c.count, 81);
  assert.deepEqual(node(c, 0), { x: -1, y: 5 - (NET.radius - NET.ropeRadius), z: -8 });
  assert.deepEqual(node(c, 80), { x: 3, y: 5 - (NET.radius - NET.ropeRadius), z: -4 });
  assert.ok(c.invMass[0] < c.invMass[1]);   // corner weights are heavier
});

test('resetCloth_HalfOpen_ScaledAroundTheBody', () => {
  const c = createCloth();
  resetCloth(c, STILL, 0.5, STILL);
  assert.equal(node(c, 0).x, -1);
  assert.equal(node(c, 80).z, 1);
});

test('stepCloth_HangingFromOneEdge_FallsAboutFourMetresAndHoldsLengths', () => {
  const c = createCloth();
  resetCloth(c, { x: 0, y: 10, z: 0 }, 1, STILL);
  for (let i = 0; i < c.n; i++) c.invMass[i * c.n] = 0;   // pin the edge z = -2
  run(c, 6, { proxies: [], leashCentre: null });
  const top = node(c, 0).y;
  for (let i = 0; i < c.n; i++) {
    const drop = top - node(c, i * c.n + c.n - 1).y;
    assert.ok(Math.abs(drop - NET.openSize) < 0.2, `column ${i} drop ${drop}`);
  }
  assert.ok(maxStretch(c) < 0.05, `stretch ${maxStretch(c)}`);
});

test('stepCloth_DroppedOnASphere_EveryNodeOutsideAndCentreOnTop', () => {
  const c = createCloth();
  resetCloth(c, { x: 0, y: 3, z: 0 }, 1, STILL);
  const ball = proxyFor({ kind: 'sphere', radius: 1 }, { x: 0, y: 1, z: 0 }, IDENTITY, STILL);
  run(c, 4, { proxies: [ball], leashCentre: null });
  for (let k = 0; k < c.count; k++) {
    const p = node(c, k);
    assert.ok(Math.hypot(p.x, p.y - 1, p.z) >= 1 + CLOTH.nodeRadius - 1e-6, `node ${k} inside`);
  }
  assert.ok(Math.abs(node(c, centreNode(c)).y - (2 + CLOTH.nodeRadius)) < 0.05);
  assert.ok(node(c, 0).y < 1, 'the corners fall down the sides');
});

test('stepCloth_DroppedOnATurnedBarrel_CentreRestsOnTheLid', () => {
  const c = createCloth();
  resetCloth(c, { x: 0, y: 3, z: 0 }, 1, STILL);
  const s = Math.sin(Math.PI / 8), co = Math.cos(Math.PI / 8);   // 45° about y
  const barrel = proxyFor({ kind: 'cylinder', radiusTop: 0.47, radiusBottom: 0.47, height: 1.1 },
    { x: 0, y: 0.55, z: 0 }, { x: 0, y: s, z: 0, w: co }, STILL);
  assert.deepEqual(barrel.half, [0.47, 0.55, 0.47]);
  run(c, 4, { proxies: [barrel], leashCentre: null });
  assert.ok(Math.abs(node(c, centreNode(c)).y - (1.1 + CLOTH.nodeRadius)) < 0.05);
  assert.ok(minY(c) >= CLOTH.nodeRadius - 1e-9);
});

test('stepCloth_ThrownIntoTheGround_NeverBelowTheGround', () => {
  const c = createCloth();
  resetCloth(c, { x: 0, y: 1, z: 0 }, 1, { x: 0, y: -40, z: 0 });
  for (let t = 0; t < 60; t++) {
    stepCloth(c, 1 / 30, { proxies: [], leashCentre: null });
    assert.ok(minY(c) >= CLOTH.nodeRadius - 1e-9);
  }
});

test('stepCloth_PieceDraggedFast_ClothStaysWithIt', () => {
  const c = createCloth();
  resetCloth(c, { x: 0, y: 1.4, z: 0 }, 1, STILL);
  const centre = { x: 0, y: 0.55, z: 0 };
  const barrel = proxyFor({ kind: 'cylinder', radiusTop: 0.47, radiusBottom: 0.47, height: 1.1 }, centre, IDENTITY, STILL);
  run(c, 1, { proxies: [barrel], leashCentre: centre });
  barrel.velocity = { x: 0, y: 0, z: 8 };
  for (let t = 0; t < 45; t++) {   // 1.5 s at 8 m/s: 12 m
    centre.z += 8 / 30;
    stepCloth(c, 1 / 30, { proxies: [barrel], leashCentre: centre });
  }
  const mid = node(c, centreNode(c));
  assert.ok(Math.abs(mid.z - centre.z) < 1, `cloth centre z ${mid.z} vs piece ${centre.z}`);
});

test('stepCloth_LongFrame_AtMostFourSubsteps', () => {
  const c = createCloth();
  resetCloth(c, { x: 0, y: 50, z: 0 }, 1, STILL);
  stepCloth(c, 1, { proxies: [], leashCentre: null });   // a 1 s hitch must not run 120 substeps
  const fallen = 50 - (NET.radius - NET.ropeRadius) - node(c, 40).y;
  assert.ok(fallen < 0.5 * CLOTH.gravity * (4 * CLOTH.substep) ** 2 * 2, `fell ${fallen}`);
});

test('proxyFor_GroundAndEmpty_None', () => {
  assert.equal(proxyFor({ kind: 'ground' }, STILL, IDENTITY, STILL), null);
  assert.equal(proxyFor({ kind: 'none' }, STILL, IDENTITY, STILL), null);
  assert.deepEqual(proxyFor({ kind: 'box', halfExtents: [1, 2, 3] }, STILL, IDENTITY, STILL).half, [1, 2, 3]);
});

test('nearestCorner_LauncherInFront_CornerOnThatSide', () => {
  const c = createCloth();
  resetCloth(c, STILL, 1, STILL);
  assert.equal(nearestCorner(c, { x: 5, y: 1, z: 5 }), 80);
  assert.equal(nearestCorner(c, { x: -5, y: 1, z: -5 }), 0);
});
```

- [ ] **Step 2: Run to verify failure.** `node --test test/cloth.test.mjs` fails with `Cannot find module '../weapons/cloth.js'`.

- [ ] **Step 3: Implement.** Create `weapons/cloth.js` with exactly:

```js
// Heavy net drape (#70): a 9×9 rope cloth, Verlet integration with distance constraints.
// Pure math on flat Float64Arrays. No engine, no THREE, no DOM. Nothing is allocated per step.
import { NET, strandOffsets } from './net.js';

export const CLOTH = {
  substep: 1 / 120,      // fixed step (s)
  maxSubsteps: 4,        // dt is capped at 1/30 in animate(), so 4 × 1/120 covers it
  iterations: 8,         // constraint passes per substep
  damping: 0.01,         // share of the velocity lost per substep
  gravity: 9.82,
  cornerMass: 4,         // lead weights: corner nodes are 4× heavier than the others
  nodeRadius: 0.05,      // rope radius 0.035 plus a little air, so ropes sit on surfaces
  friction: 0.8,         // how much of a touched proxy's (or the ground's) motion a node takes on
  carry: 0.5,            // share of the flying net's velocity the cloth keeps at the catch
  leash: 3.5,            // nodes farther than this from the catch centroid are pulled back …
  leashStiffness: 0.2,   // … by this share of the excess per substep
};

const NODE_Y = -(NET.radius - NET.ropeRadius);   // strand plane below the net body, as in makeNetMesh()

export function clothSegments(n) {
  const segs = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const k = i * n + j;
      if (i + 1 < n) segs.push([k, k + n]);
      if (j + 1 < n) segs.push([k, k + 1]);
    }
  }
  return segs;
}

export function cornerNodes(n) {
  return [0, n - 1, (n - 1) * n, n * n - 1];
}

export function createCloth() {
  const n = strandOffsets().length;
  const segments = clothSegments(n);
  const cloth = {
    n,
    count: n * n,
    pos: new Float64Array(n * n * 3),
    prev: new Float64Array(n * n * 3),
    invMass: new Float64Array(n * n).fill(1),
    segA: Int32Array.from(segments, (s) => s[0]),
    segB: Int32Array.from(segments, (s) => s[1]),
    rest: NET.meshSpacing,
    pending: 0,
  };
  for (const k of cornerNodes(n)) cloth.invMass[k] = 1 / CLOTH.cornerMass;
  return cloth;
}

// Lays the cloth on the flying net's pose: flat, centred on the net body, at its current open scale.
export function resetCloth(cloth, centre, scale, velocity) {
  const offs = strandOffsets();
  const h = CLOTH.substep * CLOTH.carry;
  for (let i = 0; i < cloth.n; i++) {
    for (let j = 0; j < cloth.n; j++) {
      const o = (i * cloth.n + j) * 3;
      cloth.pos[o] = centre.x + offs[i] * scale;
      cloth.pos[o + 1] = centre.y + NODE_Y * scale;
      cloth.pos[o + 2] = centre.z + offs[j] * scale;
      cloth.prev[o] = cloth.pos[o] - velocity.x * h;
      cloth.prev[o + 1] = cloth.pos[o + 1] - velocity.y * h;
      cloth.prev[o + 2] = cloth.pos[o + 2] - velocity.z * h;
    }
  }
  cloth.pending = 0;
}

// Collision proxy for a body shape: an oriented box or a sphere. Ground and empty shapes have none.
export function proxyFor(shape, position, quaternion, velocity) {
  if (shape.kind === 'sphere') return { kind: 'sphere', centre: position, velocity, radius: shape.radius };
  const half = boxHalf(shape);
  if (!half) return null;
  const reach = Math.hypot(half[0], half[1], half[2]) + CLOTH.nodeRadius;
  return { kind: 'box', centre: position, quaternion, velocity, half, reach };
}

function boxHalf(shape) {
  if (shape.kind === 'box') return shape.halfExtents;
  if (shape.kind === 'cylinder') return [shape.radiusTop, shape.height / 2, shape.radiusTop];
  if (shape.kind === 'spheroid') return [shape.radius, shape.halfLength, shape.radius];
  return null;
}

// Advances the cloth by dt in fixed substeps. world = { proxies, leashCentre } (leashCentre may be null).
export function stepCloth(cloth, dt, world) {
  cloth.pending = Math.min(cloth.pending + dt, CLOTH.maxSubsteps * CLOTH.substep);
  while (cloth.pending >= CLOTH.substep - 1e-9) {
    cloth.pending -= CLOTH.substep;
    substep(cloth, world);
  }
}

function substep(cloth, world) {
  integrate(cloth);
  for (let it = 0; it < CLOTH.iterations; it++) solveDistances(cloth);
  for (let k = 0; k < cloth.count; k++) {
    if (cloth.invMass[k] === 0) continue;
    for (const proxy of world.proxies) collideProxy(cloth, k, proxy);
    collideGround(cloth, k);
    if (world.leashCentre) leash(cloth, k, world.leashCentre);
  }
}

function integrate(cloth) {
  const keep = 1 - CLOTH.damping;
  const g = CLOTH.gravity * CLOTH.substep * CLOTH.substep;
  for (let k = 0; k < cloth.count; k++) {
    if (cloth.invMass[k] === 0) continue;
    for (let a = 0; a < 3; a++) {
      const o = k * 3 + a;
      const p = cloth.pos[o];
      cloth.pos[o] += (p - cloth.prev[o]) * keep - (a === 1 ? g : 0);
      cloth.prev[o] = p;
    }
  }
}

function solveDistances(cloth) {
  const { pos, invMass, rest } = cloth;
  for (let s = 0; s < cloth.segA.length; s++) {
    const a = cloth.segA[s], b = cloth.segB[s];
    const wa = invMass[a], wb = invMass[b], w = wa + wb;
    if (w === 0) continue;
    const ax = a * 3, bx = b * 3;
    const dx = pos[bx] - pos[ax], dy = pos[bx + 1] - pos[ax + 1], dz = pos[bx + 2] - pos[ax + 2];
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len < 1e-9) continue;
    const f = (len - rest) / (len * w);
    pos[ax] += dx * f * wa; pos[ax + 1] += dy * f * wa; pos[ax + 2] += dz * f * wa;
    pos[bx] -= dx * f * wb; pos[bx + 1] -= dy * f * wb; pos[bx + 2] -= dz * f * wb;
  }
}

// Moves the node out of the proxy and lets it take on the proxy's motion (friction).
function collideProxy(cloth, k, proxy) {
  const hit = proxy.kind === 'sphere' ? pushOutSphere(cloth.pos, k * 3, proxy) : pushOutBox(cloth.pos, k * 3, proxy);
  if (hit) applyFriction(cloth, k, proxy.velocity);
}

const ZERO = { x: 0, y: 0, z: 0 };
function collideGround(cloth, k) {
  const o = k * 3 + 1;
  if (cloth.pos[o] >= CLOTH.nodeRadius) return;
  cloth.pos[o] = CLOTH.nodeRadius;
  applyFriction(cloth, k, ZERO);
}

function applyFriction(cloth, k, v) {
  const o = k * 3, h = CLOTH.substep, f = CLOTH.friction;
  const tx = cloth.pos[o] - v.x * h, ty = cloth.pos[o + 1] - v.y * h, tz = cloth.pos[o + 2] - v.z * h;
  cloth.prev[o] += (tx - cloth.prev[o]) * f;
  cloth.prev[o + 1] += (ty - cloth.prev[o + 1]) * f;
  cloth.prev[o + 2] += (tz - cloth.prev[o + 2]) * f;
}

function pushOutSphere(pos, o, s) {
  const dx = pos[o] - s.centre.x, dy = pos[o + 1] - s.centre.y, dz = pos[o + 2] - s.centre.z;
  const min = s.radius + CLOTH.nodeRadius;
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (d >= min) return false;
  if (d < 1e-9) { pos[o + 1] = s.centre.y + min; return true; }
  const k = min / d;
  pos[o] = s.centre.x + dx * k; pos[o + 1] = s.centre.y + dy * k; pos[o + 2] = s.centre.z + dz * k;
  return true;
}

// Oriented box: rotate the node into the box frame, push it out through the nearest face, rotate back.
function pushOutBox(pos, o, b) {
  const dx = pos[o] - b.centre.x, dy = pos[o + 1] - b.centre.y, dz = pos[o + 2] - b.centre.z;
  if (dx * dx + dy * dy + dz * dz > b.reach * b.reach) return false;   // cheap reject: outside the bounding sphere
  const q = b.quaternion;
  const local = rotate(-q.x, -q.y, -q.z, q.w, dx, dy, dz);
  let axis = -1, depth = Infinity;
  for (let a = 0; a < 3; a++) {
    const d = b.half[a] + CLOTH.nodeRadius - Math.abs(local[a]);
    if (d <= 0) return false;
    if (d < depth) { depth = d; axis = a; }
  }
  local[axis] = (local[axis] < 0 ? -1 : 1) * (b.half[axis] + CLOTH.nodeRadius);
  const w = rotate(q.x, q.y, q.z, q.w, local[0], local[1], local[2]);
  pos[o] = b.centre.x + w[0]; pos[o + 1] = b.centre.y + w[1]; pos[o + 2] = b.centre.z + w[2];
  return true;
}

const tmp = [0, 0, 0];
// v' = q v q*, written out (t = 2 q×v; v' = v + w t + q×t). Returns a shared scratch array.
function rotate(qx, qy, qz, qw, vx, vy, vz) {
  const tx = 2 * (qy * vz - qz * vy), ty = 2 * (qz * vx - qx * vz), tz = 2 * (qx * vy - qy * vx);
  tmp[0] = vx + qw * tx + (qy * tz - qz * ty);
  tmp[1] = vy + qw * ty + (qz * tx - qx * tz);
  tmp[2] = vz + qw * tz + (qx * ty - qy * tx);
  return tmp;
}

function leash(cloth, k, c) {
  const o = k * 3;
  const dx = cloth.pos[o] - c.x, dy = cloth.pos[o + 1] - c.y, dz = cloth.pos[o + 2] - c.z;
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (d <= CLOTH.leash) return;
  const k2 = ((d - CLOTH.leash) / d) * CLOTH.leashStiffness;
  cloth.pos[o] -= dx * k2; cloth.pos[o + 1] -= dy * k2; cloth.pos[o + 2] -= dz * k2;
}

// Index of the corner node nearest to a point (the launcher), where the pull rope is tied.
export function nearestCorner(cloth, p) {
  let best = 0, bestD = Infinity;
  for (const k of cornerNodes(cloth.n)) {
    const o = k * 3;
    const d = Math.hypot(cloth.pos[o] - p.x, cloth.pos[o + 1] - p.y, cloth.pos[o + 2] - p.z);
    if (d < bestD) { bestD = d; best = k; }
  }
  return best;
}
```

Keep `Math.sqrt(dx * dx + dy * dy + dz * dz)` in the per-substep loops: `Math.hypot` there made a frame about 2.5× slower in measurement.

- [ ] **Step 4: Run to verify it passes.** `node --test test/cloth.test.mjs` → 11 pass. Then `node --test test/*.test.mjs` → all pass (263).

- [ ] **Step 5: Commit.**

```bash
git add weapons/cloth.js test/cloth.test.mjs
git commit -m "feat(weapons): Verlet rope cloth for the heavy net drape (#70)"
```

### Task 2: Shape on body handles and the cloth mesh

**Files:**
- Modify: `physics/backend-crashcat.js` (the `handle` object in `addBody`, around line 77)
- Modify: `index.html` (import at line 367, module-scope net meshes around lines 1318–1330 and 1569–1588)

- [ ] **Step 1: Store the shape spec on the handle.** In `physics/backend-crashcat.js`, inside `addBody`, in the `const handle = { … }` literal, add after `userData: spec.userData,`:

```js
      shape: spec.shape,             // the shape spec, read by the heavy net cloth for collision proxies (#70)
```

- [ ] **Step 2: Import the cloth module.** In `index.html`, directly below the line `import { NET, netLaunch, … } from './weapons/net.js';` (line 367) add:

```js
import { createCloth, resetCloth, stepCloth, proxyFor, cornerNodes, nearestCorner } from './weapons/cloth.js';
```

- [ ] **Step 3: Add the shared segment geometry.** Directly below the line `const netWeightGeo = new THREE.SphereGeometry(NET.weightRadius, 10, 8);` add:

```js
const netSegGeo = new THREE.CylinderGeometry(NET.ropeRadius, NET.ropeRadius, 1, 6);   // one cloth rope segment, unit length along +Y (#70)
```

- [ ] **Step 4: Add the cloth state, mesh and sync.** Directly below the line `const netDrape = makeNetDrapeMesh();` add (the dome is removed in Task 3):

```js
// cloth drape after a catch (#70): one instanced rope cylinder per cloth segment plus the four corner weights.
// Built once; netCatch() resets the cloth and adds the group, detachNet() removes it. No per-frame GPU allocation.
const netCloth = createCloth();
function makeNetClothMesh() {
  const g = new THREE.Group();
  const ropes = new THREE.InstancedMesh(netSegGeo, netMatl, netCloth.segA.length);
  ropes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  ropes.frustumCulled = false;   // the instances move every frame; the unit geometry's bounds would cull them wrongly
  g.add(ropes);
  const weights = cornerNodes(netCloth.n).map((node) => {
    const mesh = new THREE.Mesh(netWeightGeo, netWeightMatl);
    g.add(mesh);
    return { node, mesh };
  });
  g.userData = { ropes, weights };
  return g;
}
const netClothMesh = makeNetClothMesh();
const netClothUp = new THREE.Vector3(0, 1, 0);
const netClothA = new THREE.Vector3(), netClothDir = new THREE.Vector3(), netClothScale = new THREE.Vector3();
const netClothQ = new THREE.Quaternion(), netClothM = new THREE.Matrix4();
function syncNetClothMesh() {
  const { pos, segA, segB } = netCloth;
  const { ropes, weights } = netClothMesh.userData;
  for (let s = 0; s < segA.length; s++) {
    netClothA.fromArray(pos, segA[s] * 3);
    netClothDir.fromArray(pos, segB[s] * 3).sub(netClothA);
    const len = netClothDir.length();
    if (len > 1e-6) netClothQ.setFromUnitVectors(netClothUp, netClothDir.multiplyScalar(1 / len));
    netClothA.addScaledVector(netClothDir, len / 2);   // segment midpoint
    netClothScale.set(1, len, 1);
    ropes.setMatrixAt(s, netClothM.compose(netClothA, netClothQ, netClothScale));
  }
  ropes.instanceMatrix.needsUpdate = true;
  for (const { node, mesh } of weights) mesh.position.fromArray(pos, node * 3);
}
```

- [ ] **Step 5: Verify.** Run the syntax check from the top of this plan → `SYNTAX-OK`. `node --test test/*.test.mjs` → all pass. `grep -n "createCloth\|syncNetClothMesh\|netSegGeo" index.html` shows the new lines.

- [ ] **Step 6: Commit.**

```bash
git add physics/backend-crashcat.js index.html
git commit -m "feat(weapons): instanced rope mesh for the cloth net and shapes on body handles (#70)"
```

### Task 3: Drive the cloth from the catch, remove the rope dome

**Files:**
- Modify: `index.html` (`netCatch`, `detachNet`, `updateNet` around lines 2212–2253, the call `if (netLink) updateNet();` around line 3076, the dome around lines 1569–1588, the import at line 367)
- Modify: `weapons/net.js`
- Modify: `test/net.test.mjs`

- [ ] **Step 1: Remove the dome tests first.** In `test/net.test.mjs` remove `drapeRadius, drapeParallels` from the import list and delete the two tests `drapeRadius_SmallAndLargeSpread_FloorThenMargin` and `drapeParallels_FourRings_OnUnitHemisphereRisingAndNarrowing` (they test the dome this task deletes). Run `node --test test/net.test.mjs` → passes.

- [ ] **Step 2: Remove the dome helpers.** In `weapons/net.js` delete the comment `// drape after a catch: a rope dome over the caught pieces` with the four lines `drapeMargin`, `drapeMin`, `drapeMeridians`, `drapeParallels` in `NET`, and the two functions `drapeRadius()` and `drapeParallels()` with their comments. In `index.html` delete the block from the comment `// rope dome draped over the caught pieces (#60)` through `const netDrape = makeNetDrapeMesh();` (this removes `NET_DRAPE_TUBE_R`, `makeNetDrapeMesh` and `netDrape`), and change the net import on line 367 to:

```js
import { NET, netLaunch, selectCaught, centroid, pullForce, isReeledIn, strandOffsets, openScale } from './weapons/net.js';
```

(`spread` is no longer used in `index.html`; it stays exported and tested in `weapons/net.js`.)

- [ ] **Step 3: Replace `netCatch`, `detachNet` and `updateNet`.** Replace the three functions (from `function netCatch(rec) {` through the closing brace of `function updateNet() {`, leaving `pullNetPiece` untouched) with:

```js
function netCatch(rec) {
  rec.hit = true;
  const caught = selectCaught(barrels.map((b) => b.body), rec.body.position);
  if (!caught.length) return;                 // missed: the net lies where it fell and is culled later
  detachNet();                                // one net at a time: a new catch replaces the old one
  for (const body of caught) phys.wake(body);
  // the cloth continues from the flying net: same place, same open scale, half its speed (#70)
  resetCloth(netCloth, rec.body.position, rec.mesh.scale.x, phys.getVelocity(rec.body));
  syncNetClothMesh();
  const rope = makeRopeMesh();
  scene.add(netClothMesh);
  scene.add(rope);
  netLink = { bodies: caught, rope, ropeNode: nearestCorner(netCloth, launcherPoint()) };
  // the bundled net is replaced by the cloth — removed out of the collide callback, like paintSplat()
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
  scene.remove(netClothMesh);
  disposeRope(netLink.rope);
  netLink = null;
  syncPullButton();
}

const NET_STILL = { x: 0, y: 0, z: 0 };
// collision proxies for the cloth: every caught piece (live pose and velocity) plus the target platform
function netProxies(bodies) {
  const proxies = [];
  for (const body of bodies) {
    const p = proxyFor(body.shape, body.position, body.quaternion, phys.getVelocity(body));
    if (p) proxies.push(p);
  }
  if (platBody) proxies.push(proxyFor(platBody.shape, platBody.position, platBody.quaternion, NET_STILL));
  return proxies;
}

function updateNet(dt) {
  netLink.bodies = netLink.bodies.filter((body) => body.position.y >= -5);   // pieces off the world drop out
  if (!netLink.bodies.length) { detachNet(); return; }
  const from = launcherPoint();
  const centre = centroid(netLink.bodies.map((body) => body.position));
  stepCloth(netCloth, dt, { proxies: netProxies(netLink.bodies), leashCentre: centre });
  syncNetClothMesh();
  drawRope(netLink.rope, from, new THREE.Vector3().fromArray(netCloth.pos, netLink.ropeNode * 3));
  if (!pulling) return;
  if (isReeledIn(from, centre)) { detachNet(); return; }
  for (const body of netLink.bodies) pullNetPiece(body, from);
}
```

- [ ] **Step 4: Pass the frame time.** In `animate()` change `if (netLink) updateNet();` to:

```js
  if (netLink) updateNet(dt);
```

- [ ] **Step 5: Verify.** Syntax check → `SYNTAX-OK`. `node --test test/*.test.mjs` → all pass (261: 263 minus the two dome tests). `grep -n "drape\|netDrape" index.html weapons/net.js test/net.test.mjs` prints nothing. `grep -n "updateNet(" index.html` shows only `updateNet(dt)` and its definition.

- [ ] **Step 6 (optional, skip if a headless browser is not already installed or it takes more than 5 minutes): one cheap glance.** Serve the repo (`python3 -m http.server 8765` in the background), open `http://localhost:8765/?dev=1` headless, press `N`, throw at the barrel pyramid and take one screenshot about 1.5 s after the catch: the net should hang over the barrels. Check the console has no errors. Stop the server.

- [ ] **Step 7: Commit.**

```bash
git add index.html weapons/net.js test/net.test.mjs
git commit -m "feat(weapons): heavy net drapes over the catch as a rope cloth (#70)"
```

### Task 4: Docs

**Files:**
- Modify: `README.md` (line 83, the *Launchers* bullet)
- Modify: `CHANGELOG.md` (the existing unreleased "Heavy net (key N)" entry, line 26)

- [ ] **Step 1: README.** In `README.md` replace `heavy net (a 4 m rope net that catches up to 14 pieces, hold Space / Pull to drag them in, O / Cut to let go)` with:

```
heavy net (a 4 m rope net that drapes over what it catches like cloth, up to 14 pieces, hold Space / Pull to drag them in, O / Cut to let go)
```

- [ ] **Step 2: CHANGELOG.** Amend the existing entry in `## [Unreleased]` → `### Added` instead of adding a new one. Replace the whole line starting `- Heavy net (key N):` with:

```
- Heavy net (key N): a 4 m × 4 m throw net of thick rope with wide meshes that opens in flight, falls over the catch like cloth, hanging down the sides of the pieces and following them as they are dragged, and holds up to 14 pieces within 2.4 m; hold Space or Pull to drag them in (#54, #60, #70)
```

- [ ] **Step 3: Verify.** `grep -n "Heavy net" CHANGELOG.md` shows exactly one line, ending in `(#54, #60, #70)`. `node --test test/*.test.mjs` → all pass.

- [ ] **Step 4: Commit.**

```bash
git add README.md CHANGELOG.md
git commit -m "docs: heavy net drapes like cloth in README and changelog (#70)"
```
