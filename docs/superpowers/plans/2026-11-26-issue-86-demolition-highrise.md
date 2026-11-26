# Demolition Tower Implementation Plan (#86)

**Goal:** a new target "Demolition Tower": six heavy concrete slabs on slim columns. Four charges on the ground-floor columns, set off together, make the floors pancake straight down into the footprint; nothing flies off the top.

**Architecture:** pure layout and rule helpers in a new `targets/demolition.js` (no THREE, no DOM), unit-tested. `index.html` registers the target and adds two rules: an explosion crushes the column it goes off next to (`crushNear`, called from `explode()`), and a slab that falls and lands crushes the columns standing on it (`updateDemolition`, called from `animate()`). A crushed column stops colliding and is parked hidden below the ground, so it stays in `barrels` and counts as down. In its place a few visual-only debris chunks (no physics bodies) fly out and settle, and a dust puff grows and fades.

**Spec:** `docs/superpowers/specs/2026-11-26-issue-86-demolition-highrise-design.md`

Run tests with `node --test test/*.test.mjs` (no `package.json`; `node --test test/` does not work on Node 24). Make only the commits named below. **Do not run Playwright or the browser harness**: it was run during enrichment (numbers in Task 4). Reference code in `index.html` by function name and anchor text; line numbers shift, and #87 (cutting charge) may change `explode()` at the same time. If it does, keep its changes and put the one `crushNear` line right after `const p = ...` as described.

### Task 1: Layout module and unit tests

**Files:**
- Create: `targets/demolition.js`
- Create: `test/demolition.test.mjs`

- [ ] **Step 1: Write the failing tests.** Create `test/demolition.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEMO, demolitionLayout, storeyPitch, slabHalf, distToColumnAxis, slabLanded } from '../targets/demolition.js';
import { massFor } from '../targets/apk-layouts.js';
import { overlappingPairs, unsupported } from './layout-geometry.mjs';

const columns = () => demolitionLayout().filter(b => b.part === 'column');
const slabs = () => demolitionLayout().filter(b => b.part === 'slab');

test('demolitionLayout_Has30Blocks_24ColumnsAnd6Slabs', () => {
  assert.equal(demolitionLayout().length, 30);
  assert.equal(columns().length, 24);
  assert.equal(slabs().length, 6);
});
test('demolitionLayout_NoOverlaps', () => {
  assert.deepEqual(overlappingPairs(demolitionLayout()), []);
});
test('demolitionLayout_EveryBlockSupported', () => {
  assert.deepEqual(unsupported(demolitionLayout()), []);
});
test('demolitionLayout_GroundColumnsStandOnGround', () => {
  const ground = columns().filter(b => b.storey === 0);
  assert.equal(ground.length, 4);
  for (const b of ground) assert.ok(Math.abs(b.y - b.hy) < 1e-9);
});
test('demolitionLayout_ColumnsAtPitch3AndSlim', () => {
  const xs = [...new Set(columns().map(b => b.x))].sort((a, b) => a - b);
  assert.deepEqual(xs, [-1.5, 1.5]);
  for (const b of columns()) {
    assert.ok(Math.abs(b.hx - 0.15) < 1e-9 && Math.abs(b.hz - 0.15) < 1e-9);
    assert.ok(Math.abs(b.hy - 0.625) < 1e-9);
  }
});
test('demolitionLayout_OneSlabPerStoreyOnItsColumns', () => {
  for (const s of slabs()) {
    const below = columns().filter(b => b.storey === s.storey);
    assert.equal(below.length, 4);
    for (const c of below) assert.ok(Math.abs(c.y + c.hy - (s.y - s.hy)) < 1e-9);
    assert.ok(Math.abs(s.hx - slabHalf()) < 1e-9 && Math.abs(s.hz - slabHalf()) < 1e-9);
  }
});
test('demolitionLayout_SlabOverhangsColumns', () => {
  const s = slabs()[0], c = columns()[0];
  assert.ok(Math.abs(s.hx - (Math.abs(c.x) + c.hx + DEMO.overhang)) < 1e-9);
});
test('demolitionLayout_TopAt9BaseUnits', () => {
  const top = Math.max(...demolitionLayout().map(b => b.y + b.hy));
  assert.ok(Math.abs(top - DEMO.storeys * storeyPitch()) < 1e-9);
  assert.ok(Math.abs(top - 9) < 1e-9);
});
test('demolitionLayout_SlabsMuchHeavierThanColumns', () => {
  const ratio = massFor(slabs()[0]) / massFor(columns()[0]);
  assert.ok(ratio > 20, `ratio ${ratio}`);
});
test('distToColumnAxis_BesideAndAboveColumn', () => {
  const c = { x: 0, y: 2, z: 0 };
  assert.ok(Math.abs(distToColumnAxis({ x: 0.5, y: 2.5, z: 0 }, c, 1) - 0.5) < 1e-9);
  assert.ok(Math.abs(distToColumnAxis({ x: 0, y: 4, z: 0 }, c, 1) - 1) < 1e-9);
  assert.ok(Math.abs(distToColumnAxis({ x: 3, y: 0, z: 4 }, c, 1) - Math.hypot(3, 1, 4)) < 1e-9);
});
test('slabLanded_AtRest_Never', () => {
  const st = {};
  for (let i = 0; i < 10; i++) assert.equal(slabLanded(st, 0), false);
});
test('slabLanded_SlowSink_Never', () => {
  const st = {};
  assert.equal(slabLanded(st, -1.0), false);
  assert.equal(slabLanded(st, 0), false);
});
test('slabLanded_FallThenStop_TrueOnce', () => {
  const st = {};
  assert.equal(slabLanded(st, -3), false);
  assert.equal(slabLanded(st, -6), false);
  assert.equal(slabLanded(st, -0.2), true);
  assert.equal(slabLanded(st, -4), false);
  assert.equal(slabLanded(st, 0), false);
});
```

- [ ] **Step 2: Run to verify failure.** `node --test test/demolition.test.mjs` fails: `targets/demolition.js` does not exist.

- [ ] **Step 3: Implement.** Create `targets/demolition.js`:

```js
// Pure layout and collapse rules for the demolition tower target (#86): heavy floor slabs on
// slim columns, six storeys. No THREE, no DOM.
// Boxes: { hx, hy, hz, x, y, z, ry, part, storey }  // half extents + centre in base units,
// ry = yaw; part is 'column' or 'slab'; storey 0-based from the ground.
// Centred on x = 0, z = 0 with the ground at y = 0; index.html scales by TSCALE 2.
// Rigid boxes never crush, so a stack of slabs on columns only sits down one storey or tips
// over. Two rules make it pancake: an explosion next to a column crushes that column, and a
// slab that falls and lands crushes the columns standing on it.
// Spec: docs/superpowers/specs/2026-11-26-issue-86-demolition-highrise-design.md

export const DEMO = {
  storeys: 6,
  grid: 2,              // columns per side
  pitch: 3,             // column centre distance
  column: 0.3,          // square column cross-section
  storeyHeight: 1.25,   // column length (clear storey height)
  slabThickness: 0.25,
  overhang: 0.25,       // slab edge beyond the outer column faces
  breakRadius: 1.0,     // world units: an explosion this close to a column's axis crushes it
  fallSpeed: 1.5,       // world units/s: a slab sinking faster than this is falling
  landSpeed: 0.5,       // world units/s: a falling slab slower than this again has landed
};

export function storeyPitch() {
  return DEMO.storeyHeight + DEMO.slabThickness;
}

export function slabHalf() {
  return (DEMO.grid - 1) / 2 * DEMO.pitch + DEMO.column / 2 + DEMO.overhang;
}

export function demolitionLayout() {
  const { storeys, grid, pitch, column, storeyHeight, slabThickness } = DEMO;
  const pts = [];
  for (let k = 0; k < grid; k++) pts.push((k - (grid - 1) / 2) * pitch);
  const half = slabHalf();
  const boxes = [];
  for (let storey = 0; storey < storeys; storey++) {
    const base = storey * storeyPitch();
    for (const x of pts) {
      for (const z of pts) {
        boxes.push({ hx: column / 2, hy: storeyHeight / 2, hz: column / 2, x, y: base + storeyHeight / 2, z, ry: 0, part: 'column', storey });
      }
    }
    boxes.push({ hx: half, hy: slabThickness / 2, hz: half, x: 0, y: base + storeyHeight + slabThickness / 2, z: 0, ry: 0, part: 'slab', storey });
  }
  return boxes;
}

// Distance from point p to the vertical axis segment of a column centred at c with half
// height hy (all in the same units).
export function distToColumnAxis(p, c, hy) {
  const dy = Math.max(0, Math.abs(p.y - c.y) - hy);
  return Math.hypot(p.x - c.x, dy, p.z - c.z);
}

// Per-slab landing detector. Call once per frame with the slab's vertical velocity; returns
// true exactly once: on the first frame a slab that fell faster than fallSpeed is slower than
// landSpeed again. state is a plain object owned by the caller ({} at build time).
export function slabLanded(state, vy) {
  if (state.landed) return false;
  if (vy < -DEMO.fallSpeed) state.fell = true;
  if (state.fell && vy > -DEMO.landSpeed) {
    state.landed = true;
    return true;
  }
  return false;
}
```

- [ ] **Step 4: Verify.** `node --test test/demolition.test.mjs` passes (13 tests), then `node --test test/*.test.mjs` passes.

- [ ] **Step 5: Commit.** `git add targets/demolition.js test/demolition.test.mjs && git commit -m "feat(targets): demolition tower layout and collapse rules (#86)"`

### Task 2: Register the target in `index.html`

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Picker button.** In the *Towers* group of `#target`, after the line `<button data-mode="chimney">Chimney</button>`, add:

```html
      <button data-mode="demolition">Demolition Tower</button>
```

- [ ] **Step 2: Import.** After the line that imports from `./targets/chimney.js`, add:

```js
import { DEMO, demolitionLayout, distToColumnAxis, slabLanded } from './targets/demolition.js';
```

- [ ] **Step 3: Setup and rules.** Directly above the comment line `// Jenga tower (#34): wooden blocks, own 'jenga' material, no MASONRY_MASS_SCALE`, add:

```js
// Demolition tower (#86): heavy concrete slabs on slim columns. Rigid boxes never crush, so two
// rules make it pancake: an explosion next to a column crushes that column (crushNear, from
// explode), and a slab that falls and lands crushes the columns standing on it (updateDemolition).
const demoColumnMatl = new THREE.MeshStandardMaterial({ color: '#8f8b84', roughness: 0.95, flatShading: true });
const demoSlabMatl = new THREE.MeshStandardMaterial({ color: '#c4c0b8', roughness: 0.9, flatShading: true });
function setupDemolition() {
  const zC = -6;
  for (const b of demolitionLayout()) {
    addBlock(b.hx, b.hy, b.hz, b.part === 'slab' ? demoSlabMatl : demoColumnMatl, massFor(b), b.x, b.y, b.z + zC, b.ry, 0);
    barrels[barrels.length - 1].demo = { part: b.part, storey: b.storey, hy: b.hy * TSCALE, state: {} };
  }
}
// A crushed column leaves the simulation without leaving `barrels` (so the HUD total stays): it
// stops colliding, hangs weightless below the ground and is hidden. It counts as down.
function crushColumn(b) {
  if (b.crushed) return;
  b.crushed = b.down = true;
  b.mesh.visible = false;
  if (harpoonLink && harpoonLink.barrel === b.body) detachHarpoon();
  phys.stopColliding(b.body);
  phys.setGravityFactor(b.body, 0);
  phys.setVelocity(b.body, 0, 0, 0);
  phys.setPosition(b.body, b.home.x, -50, b.home.z);
  for (const o of barrels) phys.wake(o.body);   // the slab it held must fall, not hover asleep
  updateHud();
}
function crushNear(p) {
  for (const b of barrels) {
    if (b.demo?.part === 'column' && !b.crushed && distToColumnAxis(p, b.body.position, b.demo.hy) < DEMO.breakRadius) crushColumn(b);
  }
}
function updateDemolition() {
  for (const s of barrels) {
    if (s.demo?.part !== 'slab' || !slabLanded(s.demo.state, phys.getVelocity(s.body).y)) continue;
    for (const c of barrels) if (c.demo?.part === 'column' && c.demo.storey === s.demo.storey + 1) crushColumn(c);
  }
}
```

`harpoonLink`, `detachHarpoon`, `updateHud` are declared further down; that is fine, these functions only run after the module has loaded.

- [ ] **Step 4: Camera preset.** In `camCfg`, after the `chimney:` entry, add:

```js
  demolition: { r: 24,  ty: 4.5, tz: -6, plat: false, build: setupDemolition },
```

Do not add `demolition` to the `TSCALE` 1 list in `buildTargets()`: it uses TSCALE 2 like the other buildings.

- [ ] **Step 5: Rule 1 in `explode()`.** In `function explode(rec, ...)`, directly after the line `const p = { x: rec.body.position.x, y: rec.body.position.y, z: rec.body.position.z };`, add:

```js
  if (targetMode === 'demolition') crushNear(p);   // before the impulse: a crushed column is gone
```

- [ ] **Step 6: Rule 2 in `animate()`.** In `function animate()`, directly above the comment line `// sync barrels + detect knocked-over`, add:

```js
  if (targetMode === 'demolition') updateDemolition();

```

- [ ] **Step 7: Verify.** `node --test test/*.test.mjs` passes. `grep -c "demolition" index.html` prints 6 or more. Do not open a browser.

- [ ] **Step 8: Commit.** `git add index.html && git commit -m "feat(targets): demolition tower target that pancakes when its base is blasted (#86)"`

### Task 3: Debris and dust for crushed columns

**Files:**
- Modify: `targets/demolition.js`
- Modify: `test/demolition.test.mjs`
- Modify: `index.html`

A crushed column must not just vanish: it breaks into 5 small chunks and a short dust puff. They are **visual only** (no physics bodies), so they can never jam the pancaking slabs. Chunks share `unitBoxGeo` and `demoColumnMatl`; each puff clones `dustMatl` because it fades, and only that clone is disposed. At most 24 × 5 = 120 chunks, gone after 4 s. No allocations per frame.

- [ ] **Step 1: Write the failing tests.** In `test/demolition.test.mjs`, replace the first import line from `'../targets/demolition.js'` with:

```js
import { DEMO, DEBRIS, demolitionLayout, storeyPitch, slabHalf, distToColumnAxis, slabLanded, debrisChunks, stepChunk, chunkScale, dustPuff } from '../targets/demolition.js';
```

and append at the end of the file:

```js
const col = () => ({ c: { x: 3, y: 5, z: -12 }, hx: 0.3, hy: 1.25, hz: 0.3 });
const chunks = (seed = 7) => { const { c, hx, hy, hz } = col(); return debrisChunks(c, hx, hy, hz, seed); };
const settle = (ch) => { for (let i = 0; i < 600; i++) stepChunk(ch, 1 / 60); return ch; };

test('debrisChunks_FivePerColumn_AtMost120ForTheTower', () => {
  assert.equal(chunks().length, DEBRIS.chunks);
  assert.ok(24 * DEBRIS.chunks <= 120);
});
test('debrisChunks_SameSeedSameChunks_OtherSeedDiffers', () => {
  assert.deepEqual(chunks(7), chunks(7));
  assert.notDeepEqual(chunks(7), chunks(8));
});
test('debrisChunks_StartInsideTheColumn_SmallerThanItsWidth', () => {
  const { c, hx, hy, hz } = col();
  for (const ch of chunks()) {
    assert.ok(Math.abs(ch.x - c.x) <= hx && Math.abs(ch.z - c.z) <= hz);
    assert.ok(ch.y >= c.y - hy && ch.y <= c.y + hy);
    assert.ok(ch.size > 0 && ch.size <= Math.min(hx, hz) * 1.1 + 1e-9);
  }
});
test('debrisChunks_ThrownOutwardAndUp_WithinLimits', () => {
  for (const ch of chunks()) {
    const h = Math.hypot(ch.vx, ch.vz);
    assert.ok(h >= DEBRIS.speed * 0.5 - 1e-9 && h <= DEBRIS.speed * 1.5 + 1e-9);
    assert.ok(ch.vy >= 0 && ch.vy <= DEBRIS.lift);
  }
});
test('stepChunk_Falls_UnderGravity', () => {
  const ch = chunks()[2], y0 = ch.y, vy0 = ch.vy;
  stepChunk(ch, 0.1);
  assert.ok(Math.abs(ch.vy - (vy0 - DEBRIS.gravity * 0.1)) < 1e-9);
  assert.ok(ch.y < y0 + vy0 * 0.1);
});
test('stepChunk_SettlesOnTheGround_NearTheColumn', () => {
  const { c } = col();
  for (const ch of chunks()) {
    settle(ch);
    assert.equal(ch.resting, true);
    assert.ok(Math.abs(ch.y - ch.size / 2) < 1e-9);
    assert.ok(Math.hypot(ch.x - c.x, ch.z - c.z) < 6, 'lands within a few metres');
  }
});
test('stepChunk_Resting_DoesNotMoveButAges', () => {
  const ch = settle(chunks()[0]), x = ch.x, age = ch.age;
  stepChunk(ch, 0.5);
  assert.equal(ch.x, x);
  assert.ok(Math.abs(ch.age - age - 0.5) < 1e-9);
});
test('chunkScale_FullThenShrinksToZeroAtLife', () => {
  assert.equal(chunkScale(0), 1);
  assert.equal(chunkScale(DEBRIS.life - DEBRIS.shrink), 1);
  assert.ok(Math.abs(chunkScale(DEBRIS.life - DEBRIS.shrink / 2) - 0.5) < 1e-9);
  assert.equal(chunkScale(DEBRIS.life), 0);
  assert.equal(chunkScale(DEBRIS.life + 1), 0);
});
test('dustPuff_GrowsAndFades_ThenGone', () => {
  const a = dustPuff(0), b = dustPuff(DEBRIS.dustLife / 2);
  assert.equal(a.scale, 1);
  assert.equal(a.opacity, DEBRIS.dustOpacity);
  assert.ok(b.scale > a.scale && b.opacity < a.opacity);
  assert.equal(dustPuff(DEBRIS.dustLife), null);
});
```

- [ ] **Step 2: Run to verify failure.** `node --test test/demolition.test.mjs` fails: `DEBRIS`, `debrisChunks`, `stepChunk`, `chunkScale`, `dustPuff` are not exported.

- [ ] **Step 3: Implement the pure part.** Append to `targets/demolition.js`:

```js
// ---- Debris (visual only) ----------------------------------------------------
// A crushed column breaks into a few small chunks and a dust puff. They have no physics
// bodies, so they can never jam the pancaking slabs: plain objects moved by stepChunk
// (gravity, a damped bounce on the ground y = 0, then rest), shrunk away by chunkScale.
// All values in world units and seconds.
export const DEBRIS = {
  chunks: 5,        // per crushed column (24 columns -> at most 120 chunks)
  speed: 3,         // mean horizontal launch speed
  lift: 2,          // max upward launch speed
  spin: 6,          // max angular speed per axis, rad/s
  gravity: 9.82,
  bounce: 0.3,      // vertical speed kept on a ground bounce
  grip: 0.6,        // horizontal and spin speed kept on a ground bounce
  restSpeed: 1,     // a bounce slower than this settles the chunk
  life: 4,          // a chunk is gone after this many seconds
  shrink: 1,        // ... shrinking to nothing over the last second
  dustLife: 1.2,
  dustGrow: 3,      // the puff grows to this many times its start radius
  dustOpacity: 0.5,
};

// Park-Miller generator, so the same seed gives the same chunks (testable, no Math.random).
function rng(seed) {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// Chunks for a column centred at c with half extents hx, hy, hz. Chunks are spread up the
// column's height, sized from its cross-section and thrown outward in all directions.
export function debrisChunks(c, hx, hy, hz, seed) {
  const r = rng(seed);
  const out = [];
  for (let i = 0; i < DEBRIS.chunks; i++) {
    const a = r() * 2 * Math.PI;
    const sp = DEBRIS.speed * (0.5 + r());
    out.push({
      x: c.x + (r() * 2 - 1) * hx,
      y: c.y - hy + ((i + 0.5) / DEBRIS.chunks) * 2 * hy,
      z: c.z + (r() * 2 - 1) * hz,
      vx: Math.cos(a) * sp, vy: r() * DEBRIS.lift, vz: Math.sin(a) * sp,
      rx: 0, ry: 0, rz: 0,
      wx: (r() * 2 - 1) * DEBRIS.spin, wy: (r() * 2 - 1) * DEBRIS.spin, wz: (r() * 2 - 1) * DEBRIS.spin,
      size: Math.min(hx, hz) * (0.6 + 0.5 * r()),
      age: 0, resting: false,
    });
  }
  return out;
}

// Advances a chunk by dt in place and returns it.
export function stepChunk(ch, dt) {
  ch.age += dt;
  if (ch.resting) return ch;
  ch.vy -= DEBRIS.gravity * dt;
  ch.x += ch.vx * dt; ch.y += ch.vy * dt; ch.z += ch.vz * dt;
  ch.rx += ch.wx * dt; ch.ry += ch.wy * dt; ch.rz += ch.wz * dt;
  const floor = ch.size / 2;
  if (ch.y < floor) {
    ch.y = floor;
    if (-ch.vy * DEBRIS.bounce < DEBRIS.restSpeed) {
      ch.vx = ch.vy = ch.vz = ch.wx = ch.wy = ch.wz = 0;
      ch.resting = true;
    } else {
      ch.vy = -ch.vy * DEBRIS.bounce;
      ch.vx *= DEBRIS.grip; ch.vz *= DEBRIS.grip;
      ch.wx *= DEBRIS.grip; ch.wy *= DEBRIS.grip; ch.wz *= DEBRIS.grip;
    }
  }
  return ch;
}

// Size factor of a chunk of this age: 1, then shrinking to 0 over the last DEBRIS.shrink s.
export function chunkScale(age) {
  return Math.max(0, Math.min(1, (DEBRIS.life - age) / DEBRIS.shrink));
}

// Dust puff of this age: radius factor and opacity, or null once it is gone.
export function dustPuff(age) {
  if (age >= DEBRIS.dustLife) return null;
  const t = age / DEBRIS.dustLife;
  return { scale: 1 + (DEBRIS.dustGrow - 1) * Math.sqrt(t), opacity: DEBRIS.dustOpacity * (1 - t) };
}
```

- [ ] **Step 4: Verify.** `node --test test/demolition.test.mjs` passes (22 tests).

- [ ] **Step 5: Wire it in `index.html`.**

1. Extend the demolition import line to:

```js
import { DEMO, demolitionLayout, distToColumnAxis, slabLanded, debrisChunks, stepChunk, chunkScale, dustPuff } from './targets/demolition.js';
```

2. Directly above `function crushNear(p) {` (added in Task 2), add:

```js
// Debris of crushed columns (#86): visual only, no physics bodies, so it never jams the
// pancaking slabs. Chunks share unitBoxGeo and demoColumnMatl; each dust puff gets its own
// clone of dustMatl (it fades) that is disposed when the puff is gone.
const dustGeo = new THREE.SphereGeometry(1, 10, 8);
const dustMatl = new THREE.MeshBasicMaterial({ color: '#b8b0a2', transparent: true, depthWrite: false });
const debris = [], dusts = [];
let debrisSeed = 1;
function spawnDebris(c, hx, hy, hz) {
  for (const ch of debrisChunks(c, hx, hy, hz, debrisSeed++)) {
    const mesh = new THREE.Mesh(unitBoxGeo, demoColumnMatl);
    mesh.castShadow = true;
    scene.add(mesh);
    debris.push({ mesh, ch });
  }
  const mesh = new THREE.Mesh(dustGeo, dustMatl.clone());
  mesh.position.set(c.x, c.y, c.z);
  scene.add(mesh);
  dusts.push({ mesh, age: 0, r: 2 * Math.max(hx, hz) });
}
function updateDebris(dt) {
  for (let i = debris.length - 1; i >= 0; i--) {
    const { mesh, ch } = debris[i];
    stepChunk(ch, dt);
    const k = chunkScale(ch.age);
    if (k <= 0) { scene.remove(mesh); debris.splice(i, 1); continue; }
    mesh.position.set(ch.x, ch.y, ch.z);
    mesh.rotation.set(ch.rx, ch.ry, ch.rz);
    mesh.scale.setScalar(ch.size * k);
  }
  for (let i = dusts.length - 1; i >= 0; i--) {
    const d = dusts[i];
    d.age += dt;
    const f = dustPuff(d.age);
    if (!f) { scene.remove(d.mesh); d.mesh.material.dispose(); dusts.splice(i, 1); continue; }
    d.mesh.scale.setScalar(d.r * f.scale);
    d.mesh.material.opacity = f.opacity;
  }
}
function clearDebris() {
  for (const d of debris) scene.remove(d.mesh);
  for (const d of dusts) { scene.remove(d.mesh); d.mesh.material.dispose(); }
  debris.length = dusts.length = 0;
}
```

3. In `crushColumn(b)`, directly after the line `  b.mesh.visible = false;`, add (before the body is moved away):

```js
  const at = b.body.position;
  spawnDebris({ x: at.x, y: at.y, z: at.z }, b.mesh.scale.x / 2, b.mesh.scale.y / 2, b.mesh.scale.z / 2);
```

4. In `function clearTargets()`, directly after the line `  impactThrottle.reset();`, add:

```js
  clearDebris();
```

5. In `function animate()`, directly after the line `  if (targetMode === 'demolition') updateDemolition();` (added in Task 2), add:

```js
  if (debris.length || dusts.length) updateDebris(dt);
```

`animate()` already has `const dt = Math.min(clock.getDelta(), 1 / 30);` at its top.

- [ ] **Step 6: Verify.** `node --test test/*.test.mjs` passes. Do not open a browser.

- [ ] **Step 7: Commit.** `git add targets/demolition.js test/demolition.test.mjs index.html && git commit -m "feat(targets): crushed demolition columns break into debris and dust (#86)"`

### Task 4: Physics harness (do not run it)

**Files:**
- Create: `test/harness/demolition.html`

The pipeline must not run this file: it needs a served repo and a headless browser with swiftshader. Enrichment ran exactly this file on 2026-11-26: `DEMOLITION PASS` in 2.3 s, with
stable 0.0027; remote charge (radius 4, 500, lift 0.3) on all four ground columns at 50 / 25 / 75 % height: top slab 0.90 / 1.34 / 1.94 from home, at 15 % of its height, 30/30 blocks down, all slabs inside the footprint; cutting charge (1.2, 500, no lift) 0.50; one charge: tower stands (100 %); front two only: falls forward (4.73, info).

- [ ] **Step 1: Create the harness.** Create `test/harness/demolition.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Demolition</title>
<style>
  body { background:#1a1611; color:#f5efe4; font-family: monospace; padding: 16px; }
  pre { white-space: pre-wrap; }
  .pass { color: #6dd96d; }
  .fail { color: #e0483a; }
  .info { color: #c9a13a; }
</style>
</head>
<body>
<!-- Demolition tower harness (#86). Builds the tower on the real crashcat backend with the same
     body spec as addBlock in index.html (TSCALE 2, masonry, MASONRY_MASS_SCALE) and the same two
     collapse rules as index.html (an explosion within DEMO.breakRadius of a column crushes it; a
     slab that falls and lands crushes the columns on it). A crushed column stops colliding, loses
     gravity and is parked below the ground, like crushColumn() in the game. Unlike addBlock it adds
     the centre offset ZC after scaling. Title becomes DEMOLITION PASS/FAIL.
     Charges go off on the +z face (the side facing the default camera) of each ground column,
     0.08 off the face like a stuck charge.
     Measured 2026-11-26 during enrichment with this file (DEMOLITION PASS, 2.3 s headless):
       stable 0.0027; remote-mid / -low / -high: top slab 0.90 / 1.34 / 1.94 from home, 15 % of its
       height, 30/30 down; cutting 0.50; one-charge 100 %; front-only 4.73 (falls forward).
     And in a scratch harness with the same rules, 24 random placements per row (charge height
     15-85 % of the column, sideways up to 80 % of its half width): remote 23/24 pancakes, top
     slab 0.2-2.2 from home; cutting 23/24, 0.5-2.2. Without the two rules no geometry pancaked
     (18 geometries: it sits down one storey or tips over), and a 1.2 m blast without lift never
     freed a loaded column: friction under the load pins it. -->
<pre id="out">running…</pre>
<script type="module">
import { createCrashcatBackend } from '../../physics/backend-crashcat.js';
import { DEMO, demolitionLayout, slabHalf, distToColumnAxis, slabLanded } from '../../targets/demolition.js';
import { massFor } from '../../targets/apk-layouts.js';

const out = document.getElementById('out');
const lines = [];
let allPass = true;
function row(pass, name, detail, required = true) {
  const cls = pass ? 'pass' : (required ? 'fail' : 'info');
  const tag = pass ? 'PASS' : (required ? 'FAIL' : 'INFO');
  if (!pass && required) allPass = false;
  lines.push(`<span class="${cls}">[${tag}] ${name}: ${detail}</span>`);
}

const DT = 1 / 60, S = 2, MASONRY_MASS_SCALE = 0.25, ZC = -6;
const REMOTE = { radius: 4, strength: 500, lift: 0.3 };   // weapons/charges.js CHARGE, explode()
const CUTTING = { radius: 1.2, strength: 500, lift: 0 };   // #87 cutting charge as planned there
let cc;

async function fresh() {
  cc ??= await import('https://esm.sh/crashcat@0.0.5');
  const phys = createCrashcatBackend(cc);
  phys.addBody({ shape: { kind: 'ground' }, mass: 0, material: 'ground', position: { x: 0, y: 0, z: 0 }, isStatic: true });
  const blocks = demolitionLayout().map(b => {
    const home = { x: b.x * S, y: b.y * S, z: b.z * S + ZC };
    return {
      ...b, home, state: {}, crushed: false,
      body: phys.addBody({
        shape: { kind: 'box', halfExtents: [b.hx * S, b.hy * S, b.hz * S] },
        mass: massFor(b) * MASONRY_MASS_SCALE, material: 'masonry', startAsleep: true,
        position: home, quaternion: { x: 0, y: 0, z: 0, w: 1 },
        linearDamping: 0.15, angularDamping: 0.3, sleepSpeedLimit: 0.3, sleepTimeLimit: 0.5,
      }),
    };
  });
  return { phys, blocks };
}

function crush(ctx, b) {
  if (b.crushed) return;
  b.crushed = true;
  ctx.phys.stopColliding(b.body);
  ctx.phys.setGravityFactor(b.body, 0);
  ctx.phys.setVelocity(b.body, 0, 0, 0);
  ctx.phys.setPosition(b.body, b.home.x, -50, b.home.z);
  for (const o of ctx.blocks) ctx.phys.wake(o.body);
}

function explodeAt(ctx, p, { radius, strength, lift }) {
  for (const b of ctx.blocks) {
    if (b.part === 'column' && !b.crushed && distToColumnAxis(p, b.body.position, b.hy * S) < DEMO.breakRadius) crush(ctx, b);
  }
  for (const body of ctx.phys.bodies()) {
    if (body.mass <= 0) continue;
    let dx = body.position.x - p.x, dy = body.position.y - p.y, dz = body.position.z - p.z;
    const dist = Math.max(Math.hypot(dx, dy, dz), 0.5);
    if (dist > radius) continue;
    dx /= dist; dy /= dist; dz /= dist;
    const imp = strength * (1 - dist / radius);
    ctx.phys.wake(body);
    ctx.phys.applyImpulse(body, dx * imp, dy * imp + imp * lift, dz * imp);
  }
}

function step(ctx, seconds) {
  for (let f = 0; f < seconds / DT; f++) {
    ctx.phys.step(DT);
    for (const s of ctx.blocks) {
      if (s.part !== 'slab' || !slabLanded(s.state, ctx.phys.getVelocity(s.body).y)) continue;
      for (const c of ctx.blocks) if (c.part === 'column' && c.storey === s.storey + 1) crush(ctx, c);
    }
  }
}

function moved(b) {
  const p = b.body.position;
  return Math.hypot(p.x - b.home.x, p.y - b.home.y, p.z - b.home.z);
}
// how far a piece lies outside the slab footprint (negative: inside)
function beyond(b) {
  const p = b.body.position, h = slabHalf() * S;
  return Math.max(Math.abs(p.x) - h, Math.abs(p.z - ZC) - h);
}
const topSlab = (ctx) => ctx.blocks.find(b => b.part === 'slab' && b.storey === DEMO.storeys - 1);

async function checkStable() {
  const ctx = await fresh();
  for (const b of ctx.blocks) ctx.phys.wake(b.body);
  step(ctx, 10);
  const worst = Math.max(...ctx.blocks.map(moved));
  row(worst < 0.01, 'stable', `max displacement after 10 s (all woken): ${worst.toFixed(4)} (< 0.01)`);
  ctx.phys.destroy();
}

// charges on the +z face of the chosen ground columns at height fraction fy of the column
async function blast(charge, fy, which = () => true) {
  const ctx = await fresh();
  for (const c of ctx.blocks.filter(b => b.part === 'column' && b.storey === 0 && which(b))) {
    explodeAt(ctx, { x: c.home.x, y: fy * c.hy * 2 * S, z: c.home.z + c.hz * S + 0.08 }, charge);
  }
  step(ctx, 10);
  const top = topSlab(ctx), p = top.body.position;
  const res = {
    xz: Math.hypot(p.x - top.home.x, p.z - top.home.z),
    yFrac: p.y / top.home.y,
    slabOut: Math.max(...ctx.blocks.filter(b => b.part === 'slab').map(beyond)),
    upperOut: Math.max(...ctx.blocks.filter(b => !b.crushed && (b.part === 'slab' || b.storey >= 1)).map(beyond)),
    down: ctx.blocks.filter(b => b.crushed || moved(b) > 0.45).length,
    total: ctx.blocks.length,
  };
  ctx.phys.destroy();
  return res;
}

async function checkPancake(label, charge, fy) {
  const r = await blast(charge, fy);
  const pass = r.xz < 2.5 && r.yFrac < 0.25 && r.slabOut < 0.5 && r.upperOut < 3 && r.down === r.total;
  row(pass, label, `top slab ${r.xz.toFixed(2)} from home in x/z (< 2.5), at ${(100 * r.yFrac).toFixed(0)} % of its height (< 25 %), slabs outside footprint ${r.slabOut.toFixed(2)} (< 0.5), upper pieces ${r.upperOut.toFixed(2)} (< 3), blocks down ${r.down}/${r.total}`);
}

async function checkOneCharge() {
  const r = await blast(REMOTE, 0.5, (b) => b.x < 0 && b.z > 0);
  row(r.yFrac > 0.95, 'one-charge', `one remote charge: top slab at ${(100 * r.yFrac).toFixed(0)} % of its height (> 95 %, the other three columns hold it)`);
}

async function checkFrontOnly() {
  const r = await blast(REMOTE, 0.5, (b) => b.z > 0);
  row(r.xz > 2, 'front-only', `front two columns only: top slab ${r.xz.toFixed(2)} from home (it falls forward)`, false);
}

async function main() {
  await checkStable();
  await checkPancake('remote-mid', REMOTE, 0.5);
  await checkPancake('remote-low', REMOTE, 0.25);
  await checkPancake('remote-high', REMOTE, 0.75);
  await checkPancake('cutting', CUTTING, 0.5);
  await checkOneCharge();
  await checkFrontOnly();
  out.innerHTML = lines.join('\n');
  document.title = allPass ? 'DEMOLITION PASS' : 'DEMOLITION FAIL';
}
main().catch(e => { out.textContent = 'ERROR ' + e.stack; document.title = 'DEMOLITION FAIL'; });
</script>
</body>
</html>
```

- [ ] **Step 2: Verify.** `node --test test/*.test.mjs` still passes. Do not serve or open the file.

- [ ] **Step 3: Commit.** `git add test/harness/demolition.html && git commit -m "test(targets): demolition tower physics harness (#86)"`

### Task 5: README and changelog

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: README controls.** In the table row starting with `| **Switch target** |`, replace `/ Jenga / Chimney ·` with `/ Jenga / Chimney / Demolition Tower ·`.

- [ ] **Step 2: README harness list.** After the line starting with `` `test/harness/chimney.html` checks the brick chimney``, add:

```markdown
`test/harness/demolition.html` checks the demolition tower: it stands still, four charges on the ground-floor columns pancake it into its footprint (remote and cutting charge), one charge does not bring it down (title `DEMOLITION PASS`/`FAIL`).
```

- [ ] **Step 3: README targets.** In the `**Targets:**` paragraph, replace the closing `when hit at the foot.` with:

```markdown
when hit at the foot; a six-storey demolition tower of concrete slabs on slim columns that
pancakes into its own footprint, its columns bursting into rubble and dust, when charges take out
all four ground-floor columns at once.
```

- [ ] **Step 4: CHANGELOG.** Under `## [Unreleased]` → `### Added`, add as the first line:

```markdown
- Demolition Tower target (Towers group): six concrete floors on slim columns. Put a remote charge on each of the four ground-floor columns and press Boom: the columns burst into rubble and dust and the floors pancake one onto the other into the tower's own footprint, with nothing flying off the top; one charge alone leaves it standing, charges on one side only make it fall that way (#86)
```

- [ ] **Step 5: Verify and commit.** `node --test test/*.test.mjs` passes. `git add README.md CHANGELOG.md && git commit -m "docs: demolition tower in the README and changelog (#86)"`

### Optional headless check (not part of the pipeline)

On a scratch copy, expose `window.__boom = (x, y, z) => { const body = phys.addBody({ shape: { kind: 'sphere', radius: 0.05 }, mass: 0.1, material: 'ball', position: { x, y, z } }); phys.stopColliding(body); phys.setGravityFactor(body, 0); const rec = { body, mesh: new THREE.Group(), type: 'remotecharge', muzzle: { x, y, z }, stuck: true }; balls.push(rec); explode(rec, CHARGE.blastRadius, CHARGE.blastStrength); }` above `function animate()`, pick Demolition Tower, call `__boom` for the four ground columns (home x, home y, home z + 0.38) in one `evaluate`, and wait until all slabs rest: enrichment saw 30/30, the top slab 1.8 from home at 15 % of its height, up to 120 debris chunks and 16 dust puffs at once, all gone about 4 s after the last crush, no console errors, and no debris left after switching target. Swiftshader runs the game far below real time, so allow a minute.
