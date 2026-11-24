# Brick Industrial Chimney Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a tall, tapering brick factory chimney as a destructible target (#55): stone plinth, 24 ring courses of brick in running bond, a soot band and a corbelled crown, built from ordinary `addBlock` bodies so a hit at the foot makes it tip over and break apart.

**Architecture:**
- The pure module `targets/chimney.js` holds the constants and the layout (boxes with `part` and `course` tags). It is unit tested without THREE or the DOM, with the same overlap/support helpers the APK layouts use.
- `index.html` adds a brick `CanvasTexture`, the brick materials, `setupChimney()` (an `addBlock` loop), the picker button and a `camCfg` entry. No physics or material change.
- The browser harness `test/harness/chimney.html` builds the chimney on the real crashcat backend and checks: stands still, two cannonballs at the foot bring it down, a light ball does not.

**Tech Stack:** buildless vanilla JS (ES modules), three.js 0.160, crashcat through the `phys` facade (`physics/backend-crashcat.js`), `node:test`, Python Playwright for the harness and screenshots.

**Spec:** `docs/superpowers/specs/2026-11-24-issue-55-brick-chimney-design.md`

## Global Constraints

- Every other target, weapon and the camera code behave exactly as before. Chimney code paths run only when `targetMode === 'chimney'` (through `camCfg`).
- Bricks go through the existing `addBlock` (material `masonry`, `MASONRY_MASS_SCALE`, stone impact sound). No new material, no edit to `physics/materials.js`, no constraints.
- Geometry constants, verbatim from the spec: `segments` 10, `shaftCourses` 24, `courseHeight` 0.35, `radiusBottom` 1.3, `radiusTop` 0.75, `wallBottom` 0.30, `wallTop` 0.18, `plinthCourses` 2, `plinthBlock` 1.1, `plinthHeight` 0.45, `crownCourses` 2 (radii `radiusTop + 0.12` and `+ 0.24`, half depths 0.30 and 0.34), `sootCourses` 3, `clearance` 0.002. Row gap 0.001. Body count 278 (18 + 240 + 20).
- Picker label `Chimney`, `data-mode="chimney"`, in the **Towers** group after Jenga. HUD label stays `Blocks down`.
- Brick tints: `#9b4a35`, `#a85a40`, `#8c3f2d`, `#b0654a` (mortar `#bfb5a3`); soot `#4a3a34`, `#5a4640` (mortar `#6a625a`). Plinth uses `stoneMatls`.
- Camera: `camCfg.chimney = { r: 30, ty: 5, tz: -6, plat: false, build: setupChimney }`; `TSCALE` stays 2 (the default for anything not in the TSCALE-1 list).
- Only the geometry constants may be tuned, in this order: `wallBottom`/`wallTop`, then `shaftCourses` (20–26), then `segments` (8–12). Unit tests must be re-run after each change.
- Follow the repo's CLAUDE.md: conventional commits, a CHANGELOG and README update.
- Headless browser runs use `--use-gl=swiftshader --enable-unsafe-swiftshader`, wrapped in `timeout 180 systemd-run --user --scope -q -p MemoryMax=2G -p MemorySwapMax=0`. Stop servers with `fuser -k <port>/tcp`.
- Tests run with `node --test test/*.test.mjs` (there is no `package.json`).

## Review Focus

1. **A ring brick overlaps its neighbour at the inner face** (the half-length formula with the wrong radius or sign) and crashcat pops the ring apart on load. `chimneyLayout_NoOverlaps` in Task 1 pins it for every pair.
2. **A tapered ring brick hangs over the void** when the taper per course exceeds the wall depth, or the crown's first course overhangs the last shaft course. `chimneyLayout_EveryBlockSupported` and `chimneyLayout_CrownRestsOnShaft` in Task 1.
3. **The shaft course 0 corner bricks sit over the plinth seams or past its edge.** `chimneyLayout_FirstRingInsidePlinth` in Task 1 checks every course-0 brick corner lies inside the plinth's half width.
4. **The untouched chimney creeps on crashcat** once anything wakes it (a near miss, the ground impact of a ball). Harness check 1 in Task 2 wakes every brick on purpose before measuring.
5. **Switching away from the chimney mid-collapse** leaves nothing dangling, because the chimney adds no state beyond `barrels`; the manual check in Task 3 Step 6 confirms Reset and a target switch during a collapse throw no errors.

---

### Task 1: Pure chimney layout module

**Files:**
- Create: `targets/chimney.js`
- Test: `test/chimney.test.mjs`

**Interfaces:**
- Consumes: `boxesOverlap`, `overlappingPairs`, `unsupported` from `test/layout-geometry.mjs` (existing); `massFor` from `targets/apk-layouts.js` (existing, used by Task 3, not here).
- Produces:
  - `CHIMNEY` — the constants object listed in Global Constraints, plus `crownStep: 0.12`, `crownWalls: [0.30, 0.34]`.
  - `chimneyLayout() → Array<{ hx, hy, hz, x, y, z, ry, part, course }>` — base units, centred on x = 0, z = 0, ground at y = 0, in order plinth → shaft → crown. `part` is `'plinth' | 'shaft' | 'crown'`; `course` is 0-based within the part.
  - `coursePitch() → number` — `CHIMNEY.courseHeight + 0.001`.
  - `shaftRadius(c) → number`, `shaftWall(c) → number` — linear from the bottom to the top value across `shaftCourses` courses.
  - `isSoot(box) → boolean` — true for crown boxes and for shaft boxes with `course >= shaftCourses - sootCourses`.

- [ ] **Step 1: Write the failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHIMNEY, chimneyLayout, coursePitch, shaftRadius, shaftWall, isSoot } from '../targets/chimney.js';
import { overlappingPairs, unsupported } from './layout-geometry.mjs';

const byPart = (part) => chimneyLayout().filter(b => b.part === part);
const radial = (b) => Math.hypot(b.x, b.z);

test('chimneyLayout_Has278Blocks', () => {
  assert.equal(chimneyLayout().length, 278);
});
test('chimneyLayout_PartCounts', () => {
  assert.equal(byPart('plinth').length, 18);
  assert.equal(byPart('shaft').length, 240);
  assert.equal(byPart('crown').length, 20);
});
test('chimneyLayout_NoOverlaps', () => {
  assert.deepEqual(overlappingPairs(chimneyLayout()), []);
});
test('chimneyLayout_EveryBlockSupported', () => {
  assert.deepEqual(unsupported(chimneyLayout()), []);
});
test('chimneyLayout_ShaftRadiusStrictlyDecreasing', () => {
  const shaft = byPart('shaft');
  for (let c = 1; c < CHIMNEY.shaftCourses; c++) {
    const mean = (k) => shaft.filter(b => b.course === k).reduce((s, b) => s + radial(b), 0) / CHIMNEY.segments;
    assert.ok(mean(c) < mean(c - 1) - 1e-6, `course ${c}`);
  }
});
test('chimneyLayout_ShaftWallThinsTowardTop', () => {
  const shaft = byPart('shaft');
  assert.ok(Math.abs(shaft.find(b => b.course === 0).hz - CHIMNEY.wallBottom) < 1e-9);
  assert.ok(Math.abs(shaft.find(b => b.course === CHIMNEY.shaftCourses - 1).hz - CHIMNEY.wallTop) < 1e-9);
});
test('chimneyLayout_RunningBond_OddCoursesHalfStep', () => {
  const shaft = byPart('shaft');
  const step = 2 * Math.PI / CHIMNEY.segments;
  const first = (k) => shaft.find(b => b.course === k).ry;
  assert.ok(Math.abs(first(0)) < 1e-9);
  assert.ok(Math.abs(first(1) - step / 2) < 1e-9);
});
test('chimneyLayout_CrownRestsOnShaft', () => {
  const top = byPart('shaft').filter(b => b.course === CHIMNEY.shaftCourses - 1);
  const crown0 = byPart('crown').filter(b => b.course === 0);
  const crown1 = byPart('crown').filter(b => b.course === 1);
  assert.ok(radial(crown0[0]) > radial(top[0]));
  assert.ok(radial(crown1[0]) > radial(crown0[0]));
  // radial extents overlap: inner face of the course above lies inside the outer face below
  assert.ok(radial(crown0[0]) - crown0[0].hz < radial(top[0]) + top[0].hz);
  assert.ok(radial(crown1[0]) - crown1[0].hz < radial(crown0[0]) + crown0[0].hz);
});
test('chimneyLayout_FirstRingInsidePlinth', () => {
  const halfWidth = 1.5 * CHIMNEY.plinthBlock + 0.001;
  for (const b of byPart('shaft').filter(b => b.course === 0)) {
    const c = Math.cos(b.ry), s = Math.sin(b.ry);
    for (const [lx, lz] of [[b.hx, b.hz], [b.hx, -b.hz], [-b.hx, b.hz], [-b.hx, -b.hz]]) {
      const wx = b.x + lx * c + lz * s, wz = b.z - lx * s + lz * c;
      assert.ok(Math.abs(wx) <= halfWidth && Math.abs(wz) <= halfWidth, `corner (${wx.toFixed(3)}, ${wz.toFixed(3)})`);
    }
  }
});
test('chimneyLayout_TopOfCrownHeight', () => {
  const top = Math.max(...chimneyLayout().map(b => b.y + b.hy));
  const expected = CHIMNEY.plinthCourses * (CHIMNEY.plinthHeight + 0.001) + (CHIMNEY.shaftCourses + CHIMNEY.crownCourses - 1) * coursePitch() + CHIMNEY.courseHeight;
  assert.ok(Math.abs(top - expected) < 1e-9);
  assert.ok(Math.abs(top - 10.027) < 0.01);
});
test('shaftRadiusAndWall_Endpoints', () => {
  assert.equal(shaftRadius(0), CHIMNEY.radiusBottom);
  assert.equal(shaftRadius(CHIMNEY.shaftCourses - 1), CHIMNEY.radiusTop);
  assert.equal(shaftWall(0), CHIMNEY.wallBottom);
  assert.equal(shaftWall(CHIMNEY.shaftCourses - 1), CHIMNEY.wallTop);
});
test('isSoot_TopThreeShaftCoursesAndCrown', () => {
  assert.equal(isSoot({ part: 'shaft', course: CHIMNEY.shaftCourses - 3 }), true);
  assert.equal(isSoot({ part: 'shaft', course: CHIMNEY.shaftCourses - 4 }), false);
  assert.equal(isSoot({ part: 'crown', course: 0 }), true);
  assert.equal(isSoot({ part: 'plinth', course: 1 }), false);
});
test('chimneyLayout_RingBricksHavePositiveLength', () => {
  for (const b of chimneyLayout()) assert.ok(b.hx > 0.1, `${b.part} ${b.course}`);
});
```

- [ ] **Step 2: Run the tests and check that they fail**

Run: `node --test test/chimney.test.mjs`
Expected: FAIL with "Cannot find module ... targets/chimney.js".

- [ ] **Step 3: Implement `targets/chimney.js`**

```js
// Pure layout module for the brick industrial chimney target (#55): a square stone
// plinth, a tapering round brick shaft in running bond and a corbelled crown. No THREE,
// no DOM.
// Boxes: { hx, hy, hz, x, y, z, ry, part, course }  // half extents + centre in base units,
// ry = yaw; part 'plinth' | 'shaft' | 'crown'; course 0-based within the part.
// Centred on x = 0, z = 0 with the ground at y = 0; index.html scales by TSCALE 2.
// Spec: docs/superpowers/specs/2026-11-24-issue-55-brick-chimney-design.md

export const CHIMNEY = {
  segments: 10,
  shaftCourses: 24,
  courseHeight: 0.35,
  radiusBottom: 1.3,
  radiusTop: 0.75,
  wallBottom: 0.30,
  wallTop: 0.18,
  plinthCourses: 2,
  plinthBlock: 1.1,
  plinthHeight: 0.45,
  crownCourses: 2,
  crownStep: 0.12,          // each crown course steps this far out in radius
  crownWalls: [0.30, 0.34], // half depth per crown course
  sootCourses: 3,           // top shaft courses tinted by soot; the crown always is
  clearance: 0.002,         // tangential clearance per ring brick (#9)
};

const ROW_GAP = 0.001;   // courses rest on each other instead of hovering a gap apart (#9)

export function chimneyLayout() {
  const boxes = [];
  const plinthTop = addPlinth(boxes);
  const shaftTop = addShaft(boxes, plinthTop);
  addCrown(boxes, shaftTop);
  return boxes;
}

export function coursePitch() {
  return CHIMNEY.courseHeight + ROW_GAP;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function shaftT(course) {
  return course / (CHIMNEY.shaftCourses - 1);
}

export function shaftRadius(course) {
  return lerp(CHIMNEY.radiusBottom, CHIMNEY.radiusTop, shaftT(course));
}

export function shaftWall(course) {
  return lerp(CHIMNEY.wallBottom, CHIMNEY.wallTop, shaftT(course));
}

export function isSoot(box) {
  if (box.part === 'crown') return true;
  return box.part === 'shaft' && box.course >= CHIMNEY.shaftCourses - CHIMNEY.sootCourses;
}

// Solid 3×3 grid of stone blocks per course; returns the y of the plinth's top face plus gap.
function addPlinth(boxes) {
  const { plinthCourses, plinthBlock, plinthHeight } = CHIMNEY;
  const pitch = plinthBlock + ROW_GAP;
  const rowPitch = plinthHeight + ROW_GAP;
  for (let course = 0; course < plinthCourses; course++) {
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        boxes.push({
          hx: plinthBlock / 2, hy: plinthHeight / 2, hz: plinthBlock / 2,
          x: i * pitch, y: course * rowPitch + plinthHeight / 2, z: j * pitch,
          ry: 0, part: 'plinth', course,
        });
      }
    }
  }
  return plinthCourses * rowPitch;
}

// One ring of bricks like setupCylinder: centre on the ring at yaw a, local x tangential,
// local z radial; the inner faces meet at the polygon vertices minus the clearance.
function addRing(boxes, part, course, staggered, radius, wall, bottomY) {
  const { segments, courseHeight, clearance } = CHIMNEY;
  const step = 2 * Math.PI / segments;
  const hx = (radius - wall) * Math.tan(step / 2) - clearance;
  for (let j = 0; j < segments; j++) {
    const a = j * step + (staggered ? step / 2 : 0);
    boxes.push({
      hx, hy: courseHeight / 2, hz: wall,
      x: radius * Math.sin(a), y: bottomY + courseHeight / 2, z: radius * Math.cos(a),
      ry: a, part, course,
    });
  }
}

function addShaft(boxes, bottomY) {
  for (let course = 0; course < CHIMNEY.shaftCourses; course++) {
    addRing(boxes, 'shaft', course, course % 2 === 1, shaftRadius(course), shaftWall(course), bottomY + course * coursePitch());
  }
  return bottomY + CHIMNEY.shaftCourses * coursePitch();
}

// The bond continues from the shaft: the crown's first course is staggered iff the shaft
// would have staggered its next course.
function addCrown(boxes, bottomY) {
  const { crownCourses, crownStep, crownWalls, radiusTop, shaftCourses } = CHIMNEY;
  for (let course = 0; course < crownCourses; course++) {
    const staggered = (shaftCourses + course) % 2 === 1;
    addRing(boxes, 'crown', course, staggered, radiusTop + crownStep * (course + 1), crownWalls[course], bottomY + course * coursePitch());
  }
}
```

- [ ] **Step 4: Run the tests and check that they pass**

Run: `node --test test/*.test.mjs`
Expected: all pass, with 13 new tests. If `chimneyLayout_NoOverlaps` or `chimneyLayout_EveryBlockSupported` fails, print the offending indices and their `part`/`course`; the formulas above are the same as `setupCylinder`, so a failure points at a typo (a wrong sign in `addRing` or a missing `ROW_GAP`), not at the design.

- [ ] **Step 5: Commit**

```bash
git add targets/chimney.js test/chimney.test.mjs
git commit -m "feat(targets): brick chimney layout module (#55)"
```

### Task 2: Chimney physics harness

**Files:**
- Create: `test/harness/chimney.html`
- Modify, only if a check forces it: `targets/chimney.js` (`CHIMNEY` values, within the Global Constraints ranges)

**Interfaces:**
- Consumes: `CHIMNEY`, `chimneyLayout` from Task 1; `massFor` from `targets/apk-layouts.js`; the `phys` facade: `createCrashcatBackend`, `addBody`, `step`, `wake`, `setVelocity` (all exported by `physics/backend-crashcat.js`).
- Produces: the harness title `CHIMNEY PASS` / `CHIMNEY FAIL`, and the final geometry values that Task 3 uses through `CHIMNEY`.

The harness mirrors `test/harness/jenga.html`: the import map, `row(pass, name, detail, required)`, the `fresh()` builder, `document.title` at the end, and the `main().catch` fallback. The chimney is built **as the game builds it**: every layout box scaled by 2 (`TSCALE`), mass `massFor(box) * 0.25` (`MASONRY_MASS_SCALE`), material `masonry`, `startAsleep: true`, `linearDamping: 0.15, angularDamping: 0.3, sleepSpeedLimit: 0.3, sleepTimeLimit: 0.5`, centred at z = −6.

- [ ] **Step 1: Write the harness**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Chimney</title>
<script type="importmap">
{ "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js" } }
</script>
<style>
  body { background:#1a1611; color:#f5efe4; font-family: monospace; padding: 16px; }
  pre { white-space: pre-wrap; }
  .pass { color: #6dd96d; }
  .fail { color: #e0483a; }
  .info { color: #c9a13a; }
</style>
</head>
<body>
<!-- Brick chimney collapse harness (#55). Builds the chimney on the real crashcat backend
     with the same body spec as addBlock in index.html (TSCALE 2, masonry, MASONRY_MASS_SCALE)
     and checks: it stands still, two cannonballs at the foot bring it down, a light ball
     does not. Title becomes CHIMNEY PASS/FAIL.
     Measured <date>: <fill in the numbers printed by each check and the final CHIMNEY values> -->
<pre id="out">running…</pre>
<script type="module">
import { createCrashcatBackend } from '../../physics/backend-crashcat.js';
import { CHIMNEY, chimneyLayout } from '../../targets/chimney.js';
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
let cc;

function quatY(ry) {
  return { x: 0, y: Math.sin(ry / 2), z: 0, w: Math.cos(ry / 2) };
}

async function fresh() {
  cc ??= await import('https://esm.sh/crashcat@0.0.5');
  const phys = createCrashcatBackend(cc);
  phys.addBody({ shape: { kind: 'ground' }, mass: 0, material: 'ground', position: { x: 0, y: 0, z: 0 }, isStatic: true });
  const bricks = chimneyLayout().map(b => {
    const home = { x: b.x * S, y: b.y * S, z: b.z * S + ZC };
    return {
      ...b, home,
      body: phys.addBody({
        shape: { kind: 'box', halfExtents: [b.hx * S, b.hy * S, b.hz * S] },
        mass: massFor(b) * MASONRY_MASS_SCALE, material: 'masonry', startAsleep: true,
        position: home, quaternion: quatY(b.ry),
        linearDamping: 0.15, angularDamping: 0.3, sleepSpeedLimit: 0.3, sleepTimeLimit: 0.5,
      }),
    };
  });
  return { phys, bricks };
}

function moved(b) {
  const p = b.body.position;
  return Math.hypot(p.x - b.home.x, p.y - b.home.y, p.z - b.home.z);
}
function crownOf(ctx) { return ctx.bricks.filter(b => b.part === 'crown'); }
function crownMeanY(ctx) { const c = crownOf(ctx); return c.reduce((s, b) => s + b.body.position.y, 0) / c.length; }
function crownHomeY(ctx) { const c = crownOf(ctx); return c.reduce((s, b) => s + b.home.y, 0) / c.length; }
function crownMeanRadial(ctx) {
  const c = crownOf(ctx);
  return c.reduce((s, b) => s + Math.hypot(b.body.position.x, b.body.position.z - ZC), 0) / c.length;
}
function shaftCourseY(course) {
  return (CHIMNEY.plinthCourses * (CHIMNEY.plinthHeight + 0.001) + course * (CHIMNEY.courseHeight + 0.001) + CHIMNEY.courseHeight / 2) * S;
}
function stepSeconds(ctx, seconds, onFrame) {
  for (let f = 0; f < seconds / DT; f++) { onFrame?.(f * DT); ctx.phys.step(DT); }
}
// A ball flying along -z from z = ZC + 12 toward the axis at height y.
function fire(ctx, { mass, radius, speed, y }) {
  const body = ctx.phys.addBody({
    shape: { kind: 'sphere', radius }, mass, material: 'ball', fast: true,
    position: { x: 0, y, z: ZC + 12 },
  });
  ctx.phys.setVelocity(body, 0, 0, -speed);
  return body;
}

async function checkStable() {
  const ctx = await fresh();
  for (const b of ctx.bricks) ctx.phys.wake(b.body);
  stepSeconds(ctx, 5);
  const worst = Math.max(...ctx.bricks.map(moved));
  row(worst < 0.02, 'stable', `max displacement after 5 s (all woken): ${worst.toFixed(4)} (< 0.02)`);
}

async function checkBaseHit() {
  const ctx = await fresh();
  const homeY = crownHomeY(ctx), y = shaftCourseY(1);
  const cannon = { mass: 9, radius: 0.29, speed: 40, y };
  fire(ctx, cannon);
  stepSeconds(ctx, 1);
  fire(ctx, cannon);
  let tipRadial = null, lowest = Infinity;
  stepSeconds(ctx, 12, () => {
    const my = crownMeanY(ctx);
    lowest = Math.min(lowest, my);
    if (tipRadial === null && my < 0.9 * homeY) tipRadial = crownMeanRadial(ctx);
  });
  row(lowest < 0.5 * homeY, 'base-hit', `crown mean y min ${lowest.toFixed(2)} of home ${homeY.toFixed(2)} (< 50 %)`);
  row(tipRadial !== null && tipRadial > 2.0, 'tip-over', `crown mean radial offset when first below 90 %: ${tipRadial === null ? 'never' : tipRadial.toFixed(2)} (> 2.0 means it toppled sideways)`, false);
}

async function checkLightHit() {
  const ctx = await fresh();
  const homeY = crownHomeY(ctx);
  fire(ctx, { mass: 0.6, radius: 0.33, speed: 25, y: shaftCourseY(Math.floor(CHIMNEY.shaftCourses / 2)) });
  stepSeconds(ctx, 6);
  const my = crownMeanY(ctx);
  const down = ctx.bricks.filter(b => moved(b) > 0.45).length;
  row(my > 0.8 * homeY && down < 28, 'light-hit', `crown mean y ${my.toFixed(2)} of ${homeY.toFixed(2)} (> 80 %), bricks moved > 0.45: ${down} (< 28)`);
}

async function main() {
  await checkStable();
  await checkBaseHit();
  await checkLightHit();
  out.innerHTML = lines.join('\n');
  document.title = allPass ? 'CHIMNEY PASS' : 'CHIMNEY FAIL';
}
main().catch(e => { out.textContent = 'ERROR ' + e.stack; document.title = 'CHIMNEY FAIL'; });
</script>
</body>
</html>
```

Check `physics/backend-crashcat.js` lines 36–45 before running: the sphere shape is `{ kind: 'sphere', radius }` and `fast: true` selects linear-cast motion for the ball, both as the game's projectiles use them. If `phys.wake` is not on the facade under that name, use the name the facade exports (`grep -n "wake" physics/backend-crashcat.js`).

- [ ] **Step 2: Run it and record the baseline**

Serve the repo with `python3 -m http.server 8765` (from the repo root, in the background), open `http://localhost:8765/test/harness/chimney.html` in Python Playwright (chromium, headless, with the swiftshader flags from Global Constraints), wait for the title to match `/(PASS|FAIL)$/` (timeout 180 s), print the page text. Expected on first run: `stable` and `light-hit` PASS; `base-hit` may PASS or FAIL; `tip-over` is INFO.

- [ ] **Step 3: Tune geometry if a required check fails**

In this order, one change at a time, re-running `node --test test/*.test.mjs` and the harness after each:
1. `stable` fails → raise `wallBottom`/`wallTop` by 0.02 (max 0.36 / 0.24).
2. `base-hit` fails → lower `wallTop` by 0.02 (min 0.14), then `wallBottom` by 0.02 (min 0.24); then `shaftCourses` to 26; then `segments` to 8.
3. `light-hit` fails → raise `wallBottom`/`wallTop` by 0.02.

Stop as soon as all required checks pass. If `base-hit` still fails after the whole ladder, keep `stable` and `light-hit` green, mark `base-hit` as `required = false` with its measurement, and say so in the PR: the chimney then needs more than two cannonballs, which is playable but not the spec's intent.

Write the measured numbers and the final `CHIMNEY` values into the harness header comment (replace the `<date>` / `<fill in ...>` placeholders).

- [ ] **Step 4: Run every harness and the unit tests**

Run `node --test test/*.test.mjs`: all pass. Open `test/harness/physics-contract.html`, `barrel-support.html`, `jenga.html`, `magneto-hum.html`, `football-flight.html` and `sniper-flight.html` the same way: each title ends with `PASS`. Then `fuser -k 8765/tcp`.

- [ ] **Step 5: Commit**

```bash
git add test/harness/chimney.html targets/chimney.js
git commit -m "test(harness): chimney stands, falls to cannonballs at the foot, shrugs off a light ball (#55)"
```

### Task 3: Wire the chimney into the game

**Files:**
- Modify: `index.html`
  - imports (~line 328, next to `import { LAYOUTS, massFor } from './targets/apk-layouts.js';`)
  - target picker, Towers group (~line 298, after `<button data-mode="jenga">Jenga</button>`)
  - brick texture + materials + `setupChimney()` (after `placeLayout`, ~line 867, before the Jenga block)
  - `camCfg` (~line 1131–1158)

**Interfaces:**
- Consumes: `CHIMNEY`, `chimneyLayout`, `isSoot` from Task 1; `massFor` (already imported); `addBlock(hx, hy, hz, matl3, mass, x, y, z, ry, rz)` and `stoneMatls` (existing, ~line 663–690).
- Produces, inside index.html: `makeBrickTexture(brick, mortar)`, `brickMatls` (4), `sootMatls` (2), `setupChimney()`, `camCfg.chimney`.

- [ ] **Step 1: Add the import and the picker button**

```js
import { CHIMNEY, chimneyLayout, isSoot } from './targets/chimney.js';
```

```html
      <button data-mode="chimney">Chimney</button>
```
(in the Towers `.btns`, right after Jenga.)

- [ ] **Step 2: Add the brick texture, the materials and `setupChimney()`**

Place this after `placeLayout` and before the `// Jenga tower (#34)` comment:

```js
// Brick chimney (#55): one brick per body; the mortar joint is a frame drawn on every face
// of the brick texture, so courses read as brickwork. Tints vary per brick, soot on top.
function makeBrickTexture(brick, mortar) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = mortar; g.fillRect(0, 0, 128, 64);
  g.fillStyle = brick; g.fillRect(5, 5, 118, 54);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 60; i++) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.10)';
    g.fillRect(6 + rnd() * 116, 6 + rnd() * 52, 1 + rnd() * 3, 1 + rnd() * 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const brickMatls = ['#9b4a35', '#a85a40', '#8c3f2d', '#b0654a'].map(c =>
  new THREE.MeshStandardMaterial({ map: makeBrickTexture(c, '#bfb5a3'), roughness: 0.9 }));
const sootMatls = ['#4a3a34', '#5a4640'].map(c =>
  new THREE.MeshStandardMaterial({ map: makeBrickTexture(c, '#6a625a'), roughness: 0.9 }));
function chimneyMatl(b, i) {
  if (b.part === 'plinth') return stoneMatls[i % stoneMatls.length];
  const set = isSoot(b) ? sootMatls : brickMatls;
  return set[(i * 7 + b.course) % set.length];
}
function setupChimney() {
  const zC = -6;
  chimneyLayout().forEach((b, i) => addBlock(b.hx, b.hy, b.hz, chimneyMatl(b, i), massFor(b), b.x, b.y, b.z + zC, b.ry, 0));
}
```

The `tex.colorSpace = THREE.SRGBColorSpace` line matches the drum and wood textures in this file (~lines 438 and 480).

- [ ] **Step 3: Add the camera entry**

```js
  chimney:   { r: 30,   ty: 5,   tz: -6, plat: false, build: setupChimney },
```
(in `camCfg`, after the `jenga` line.) `TSCALE` stays 2: do **not** add `'chimney'` to the TSCALE-1 list in `buildTargets`.

- [ ] **Step 4: Load the page with an empty console**

Serve with `python3 -m http.server 8765`, open `http://localhost:8765/` in Playwright at 1280×720, click the `Chimney` button (`page.click('button[data-mode="chimney"]')`), wait 2 s, and assert the console shows no errors and `#scoreLabel` reads `Blocks down` with the score `0/278`. Save a screenshot and look at it with the Read tool: the plinth, the whole shaft and the crown are in view with sky above; the shaft visibly narrows; mortar lines and the soot band are visible. If the crown is cut off or the chimney fills less than half the height, adjust `r` (±4) / `ty` (±1) and look again.

- [ ] **Step 5: Mobile and collapse screenshots**

At 390×844 with touch emulation (`has_touch=True`), open the targets sheet (the 🎯 button in `#mob-bar`), pick Chimney, screenshot: the chimney fits in portrait. Then at 1280×720 select the Cannonball weapon (key `2`), aim at the foot of the chimney (`page.mouse.move` to the plinth's screen position, obtained by projecting `(0, 1.5, -6)` through `page.evaluate` with the scene camera, or simply the lower third of the chimney on screen), hold the mouse down 400 ms and release, twice, 1 s apart; wait 3 s; screenshot. Look at it: the shaft should be leaning or already in pieces, not standing untouched. Save both screenshots under a temp directory and attach them to the PR.

- [ ] **Step 6: Manual robustness check**

During a collapse (right after the two shots), click `Reset`, then switch to `Jenga` and back to `Chimney`. Expected: no console errors, the chimney rebuilds standing, score `0/278`.

- [ ] **Step 7: Run everything**

`node --test test/*.test.mjs` and all harnesses incl. `chimney.html`: all pass. `fuser -k 8765/tcp`.

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "feat(targets): brick industrial chimney with mortar texture and soot crown (#55)"
```

### Task 4: Docs

**Files:**
- Modify: `README.md` (the `Switch target` row in the controls table, ~line 22, and the `**Targets:**` paragraph ~line 80–85; the harness list ~line 64), `CHANGELOG.md` (`[Unreleased]` → `Added`)

- [ ] **Step 1: README**

- In the `Switch target` row, append ` / Chimney` after `Jenga` in the *Towers* list.
- In the `**Targets:**` paragraph, add: `tall brick industrial chimney on a stone plinth, tapering to a soot-blackened crown, that tips over and breaks apart when hit at the foot;`
- In the harness list, add: `` `test/harness/chimney.html` checks the brick chimney: it stands still, two cannonballs at the foot bring it down and a light ball does not (title `CHIMNEY PASS`/`FAIL`). ``

- [ ] **Step 2: CHANGELOG**

Under `[Unreleased]` → `Added`, append:

```
- Brick industrial chimney target: a tapering factory chimney of red brick on a stone plinth with a soot-blackened crown; hit it at the foot and it tips over and breaks apart (#55)
```

- [ ] **Step 3: Commit**

```bash
git add README.md CHANGELOG.md
git commit -m "docs: brick chimney in README and CHANGELOG (#55)"
```
