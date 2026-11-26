# Chimney Wedge Blocks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (this plan is dispatched through the issue pipeline). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Draw each chimney block as a wedge so neighbours meet seamlessly and the dark checkerboard patches disappear. Physics (box collider, layout, masses) stays unchanged.

**Architecture:** Two pure helpers in `targets/chimney.js` (`wedgeProfile`, `wedgeFaces`); `index.html` builds a cached `BufferGeometry` per taper and passes it to `addBlock` through a new optional last parameter. No harness work.

**Spec:** `docs/superpowers/specs/2026-11-26-issue-71-chimney-wedge-blocks-design.md`

### Task 1: Pure wedge helpers with tests

**Files:**
- Modify: `targets/chimney.js` (append after `visibleBrickAspect`)
- Modify: `test/chimney.test.mjs`

- [ ] **Step 1: Write the failing tests**

In `test/chimney.test.mjs` extend the import with `wedgeProfile, wedgeFaces` and append:

```js
test('wedgeProfile_InnerWidthDepthHeightUnchanged', () => {
  for (const b of chimneyLayout()) {
    const w = wedgeProfile(b);
    assert.equal(w.innerHx, b.hx);
    assert.equal(w.hy, b.hy);
    assert.equal(w.hz, b.hz);
  }
});
test('wedgeProfile_OuterWidthMatchesOuterCircumference', () => {
  const t = Math.tan(Math.PI / CHIMNEY.segments);
  for (const c of [0, 20, 42]) {
    const b = shaft().find(x => x.course === c);
    const w = wedgeProfile(b);
    const expected = (shaftRadius(c) + shaftWall(c)) * t - CHIMNEY.clearance;
    assert.ok(Math.abs(w.outerHx - expected) < 1e-9, `course ${c}`);
    assert.ok(w.taper > 1);
    assert.ok(Math.abs(w.taper - w.outerHx / w.innerHx) < 1e-12);
  }
});
test('wedgeProfile_NeighbourOuterCornersMeet', () => {
  // world position of a block's outer corner: centre + yaw-rotated (lx, lz)
  const corner = (b, sx) => {
    const w = wedgeProfile(b);
    const lx = sx * w.outerHx, lz = b.hz;
    return [b.x + lx * Math.cos(b.ry) + lz * Math.sin(b.ry), b.z - lx * Math.sin(b.ry) + lz * Math.cos(b.ry)];
  };
  for (const c of [0, 1, 42]) {
    const ring = shaft().filter(b => b.course === c);
    for (let j = 0; j < ring.length; j++) {
      const a = corner(ring[j], +1);
      const n = corner(ring[(j + 1) % ring.length], -1);
      assert.ok(Math.hypot(a[0] - n[0], a[1] - n[1]) < 0.01, `course ${c} block ${j}`);
    }
  }
});
test('wedgeFaces_ShapeAndOuterFace', () => {
  const taper = 1.6;
  const f = wedgeFaces(taper);
  assert.equal(f.positions.length, 36 * 3);
  assert.equal(f.normals.length, 36 * 3);
  assert.equal(f.uvs.length, 36 * 2);
  const xs = [];
  for (let i = 0; i < 36; i++) {
    if (f.normals[i * 3 + 2] === 1) xs.push(Math.abs(f.positions[i * 3]));
    assert.ok(Math.abs(f.positions[i * 3 + 1]) <= 0.5 + 1e-12);
    assert.ok(Math.abs(f.positions[i * 3 + 2]) <= 0.5 + 1e-12);
  }
  assert.equal(xs.length, 6);                       // outer face is two triangles
  assert.ok(Math.abs(Math.max(...xs) - 0.5 * taper) < 1e-12);
  // inner face (z = -0.5) is exactly the unit box width
  const inner = [];
  for (let i = 0; i < 36; i++) if (f.normals[i * 3 + 2] === -1) inner.push(Math.abs(f.positions[i * 3]));
  assert.equal(inner.length, 6);
  assert.equal(Math.max(...inner), 0.5);
});
test('wedgeFaces_NormalsMatchWindingAndPointOutwards', () => {
  const f = wedgeFaces(1.6);
  const p = (i) => [f.positions[i * 3], f.positions[i * 3 + 1], f.positions[i * 3 + 2]];
  for (let t = 0; t < 12; t++) {
    const [a, b, c] = [p(t * 3), p(t * 3 + 1), p(t * 3 + 2)];
    const u = b.map((v, k) => v - a[k]), w = c.map((v, k) => v - a[k]);
    const cr = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const n = [0, 1, 2].map(k => f.normals[t * 9 + k]);
    assert.ok(Math.abs(Math.hypot(...n) - 1) < 1e-9, `unit normal tri ${t}`);
    const dot = cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2];
    assert.ok(dot > 0, `winding tri ${t}`);
    const centroid = [0, 1, 2].map(k => (a[k] + b[k] + c[k]) / 3);
    assert.ok(centroid[0] * n[0] + centroid[1] * n[1] + (centroid[2]) * n[2] > 0, `outward tri ${t}`);
  }
});
```

- [ ] **Step 2: Run, expect failure**

Run: `node --test test/chimney.test.mjs`
Expected: FAIL, `wedgeProfile` is not exported.

- [ ] **Step 3: Implement**

Append to `targets/chimney.js`:

```js
// Render shape of one ring block (#71): the collider stays the box, the mesh is a wedge whose
// inner face is the box width and whose outer face reaches the outer circumference, so
// neighbours meet along their side faces (minus the clearance). Local z is radial outward,
// hz = wall, so the outer face is 2 * hz further out than the inner one.
export function wedgeProfile(box) {
  const t = Math.tan(Math.PI / CHIMNEY.segments);
  const outerHx = box.hx + 2 * box.hz * t;
  return { innerHx: box.hx, outerHx, hy: box.hy, hz: box.hz, taper: outerHx / box.hx };
}

// Non-indexed triangles of the wedge in the unit frame of the box mesh (index.html scales it
// by 2hx, 2hy, 2hz): x, y, z in [-0.5, 0.5] at the inner face (z = -0.5), outer face at
// z = +0.5 with half-width 0.5 * taper. Counter-clockwise from outside; every face has
// UVs 0..1 like BoxGeometry, so the outer face shows the brick texture as the box did.
export function wedgeFaces(taper) {
  const h = 0.5 * taper;
  const A = [-0.5, -0.5, -0.5], B = [0.5, -0.5, -0.5], C = [0.5, 0.5, -0.5], D = [-0.5, 0.5, -0.5];
  const E = [-h, -0.5, 0.5], F = [h, -0.5, 0.5], G = [h, 0.5, 0.5], H = [-h, 0.5, 0.5];
  const side = Math.hypot(1, 0.5 * (taper - 1));
  const nx = 1 / side, nz = -0.5 * (taper - 1) / side;   // +x side face normal
  const faces = [
    { q: [E, F, G, H], n: [0, 0, 1] },        // outer
    { q: [B, A, D, C], n: [0, 0, -1] },       // inner
    { q: [F, B, C, G], n: [nx, 0, nz] },      // +x side
    { q: [A, E, H, D], n: [-nx, 0, nz] },     // -x side
    { q: [H, G, C, D], n: [0, 1, 0] },        // top
    { q: [A, B, F, E], n: [0, -1, 0] },       // bottom
  ];
  const quadUv = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const positions = [], normals = [], uvs = [];
  for (const { q, n } of faces) {
    for (const i of [0, 1, 2, 0, 2, 3]) {
      positions.push(...q[i]); normals.push(...n); uvs.push(...quadUv[i]);
    }
  }
  return { positions, normals, uvs };
}
```

- [ ] **Step 4: Run, expect pass**

Run: `node --test test/*.test.mjs`
Expected: all PASS. If the neighbour test fails, check the yaw convention in `addRing` (local x = `(cos a, -sin a)`, local z = `(sin a, cos a)`), do not loosen the tolerance beyond 0.01.

- [ ] **Step 5: Commit**

```
git add targets/chimney.js test/chimney.test.mjs
git commit -m "feat(targets): wedge profile and faces for chimney blocks (#71)"
```

### Task 2: Wire the wedge mesh into the chimney

**Files:**
- Modify: `index.html` (import line ~363, `addBlock` ~711, `setupChimney` ~941)

- [ ] **Step 1: Import**

Change the import to
`import { CHIMNEY, chimneyLayout, isSoot, brickFaceRects, wedgeProfile, wedgeFaces } from './targets/chimney.js';`

- [ ] **Step 2: Optional geometry parameter in `addBlock`**

```js
function addBlock(hx, hy, hz, matl3, mass, x, y, z, ry, rz, geo = unitBoxGeo) {
```
and `const mesh = new THREE.Mesh(geo, matl3);`. Nothing else in `addBlock` changes (scale, body, sync stay).

- [ ] **Step 3: Cached wedge geometry and chimney call**

Above `setupChimney`:

```js
// Chimney wedge meshes (#71): one geometry per taper (one per course, at most 43), shared by
// the 12 blocks of a ring. Module scope and never disposed, like unitBoxGeo.
const wedgeGeos = new Map();
function wedgeGeo(taper) {
  const key = taper.toFixed(4);
  let geo = wedgeGeos.get(key);
  if (!geo) {
    const f = wedgeFaces(taper);
    geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(f.positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(f.normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(f.uvs, 2));
    wedgeGeos.set(key, geo);
  }
  return geo;
}
```

and in `setupChimney`:

```js
chimneyLayout().forEach((b, i) => addBlock(b.hx, b.hy, b.hz, chimneyMatl(b, i), massFor(b), b.x, b.y, b.z + zC, b.ry, 0, wedgeGeo(wedgeProfile(b).taper)));
```

- [ ] **Step 4: Verify**

Run: `node --test test/*.test.mjs` (PASS). Check that `index.html` has no syntax error:
`node --input-type=module -e "import('./targets/chimney.js')"` and `grep -n "wedgeGeo" index.html` shows definition and use. Do not run the browser harness.

- [ ] **Step 5: Commit**

```
git add index.html
git commit -m "feat(targets): draw chimney blocks as wedges (#71)"
```

### Task 3: Changelog and README

**Files:**
- Modify: `CHANGELOG.md` (the unreleased `### Changed` line about #64, currently "Chimney bricks look elongated: ... (#64)")
- Modify: `README.md` only if it describes the chimney bricks' look (line ~92 does not; leave it unless it says something contradicting wedges)

- [ ] **Step 1: Amend the #64 line, do not add a new one**

Replace it with:

`- Chimney bricks look elongated and seamless: every brick block shows two courses of long bricks and is drawn as a wedge, so the blocks of a ring meet without dark gaps from every angle; the chimney's size and how it falls are unchanged (#64, #71)`

- [ ] **Step 2: Check README**

Run: `grep -n -i "chimney" README.md`. The lines at 22, 75 and 92 do not describe the brick look, so no change is expected.

- [ ] **Step 3: Commit**

```
git add CHANGELOG.md
git commit -m "docs(changelog): chimney blocks drawn as wedges (#71)"
```
