# Bigger Chimney Without Crown and Base Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (this plan is dispatched through the issue pipeline). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change the brick chimney (#55) to a 1.25× wider, 1.5× higher shaft of 43 courses and 12 bricks per ring (516 bricks), without crown and plinth, standing on the ground, with unchanged brick size and a camera refit.

**Architecture:** `targets/chimney.js` loses its plinth and crown and keeps one shaft ring generator; tests, harness, `index.html` (material helper and camera) and docs follow. No physics or material change.

**Tech Stack:** buildless vanilla JS (ES modules), three.js 0.160, crashcat through `phys`, `node:test`, Python Playwright for harness and screenshots.

**Spec:** `docs/superpowers/specs/2026-11-25-issue-58-bigger-chimney-design.md`

## Global Constraints

- Only chimney code changes. No edit to `physics/materials.js`, damping, sleep values, `addBlock`, other targets, weapons or camera code.
- Constants: `segments` 12, `shaftCourses` 43, `courseHeight` 0.35, `radiusBottom` 1.625, `radiusTop` 0.9375, `wallBottom` 0.30, `wallTop` 0.18, `sootCourses` 5, `clearance` 0.002, `ROW_GAP` 0. Body count 516. Total height 43 × 0.35 = 15.05.
- Tuning if the harness fails, geometry only, in this order: walls (0.375 / 0.225 thicker), then `segments` (10 or 13), then `shaftCourses` 41–45 (record it). Re-run the unit tests after each change. Outside that: stop and report.
- Camera: `camCfg.chimney = { r: 45, ty: 7.5, tz: -6, plat: false, build: setupChimney }` as the starting point, refit by screenshot.
- Follow the repo's CLAUDE.md: conventional commits, CHANGELOG and README updates.
- Headless browser runs use `--use-gl=swiftshader --enable-unsafe-swiftshader`, wrapped in `timeout 180 systemd-run --user --scope -q -p MemoryMax=2G -p MemorySwapMax=0`. Stop servers with `fuser -k <port>/tcp`.
- Tests run with `node --test test/*.test.mjs` (no `package.json`).

## Review Focus

1. **Course 0 hangs above the ground or the support check fails** because the shaft still starts at a plinth height. `chimneyLayout_EveryBlockSupported` and `chimneyLayout_Course0OnGround`.
2. **Stale references** to `plinth`, `crown` or `plinthPitch` in `index.html`, the harness, tests or docs.
3. **43 stacked courses creep** once woken (the #55 note on `ROW_GAP` 0). Harness check 1.
4. **Cannonballs no longer topple the wider, taller shaft.** Harness check 2; follow the tuning order, do not touch physics.
5. **Camera cuts off the top or the foot** at 1280×720 or 390×844.

---

### Task 1: Layout module and unit tests

**Files:**
- Modify: `targets/chimney.js`, `test/chimney.test.mjs`

- [ ] **Step 1: Rewrite the tests first** (they fail against the old module). Replace `test/chimney.test.mjs` with:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHIMNEY, chimneyLayout, coursePitch, shaftRadius, shaftWall, isSoot } from '../targets/chimney.js';
import { overlappingPairs, unsupported } from './layout-geometry.mjs';

const shaft = () => chimneyLayout().filter(b => b.part === 'shaft');
const radial = (b) => Math.hypot(b.x, b.z);

test('chimneyLayout_Has516Blocks', () => {
  assert.equal(chimneyLayout().length, 516);
  assert.equal(CHIMNEY.segments * CHIMNEY.shaftCourses, 516);
});
test('chimneyLayout_OnlyShaftPart', () => {
  assert.equal(shaft().length, chimneyLayout().length);
  assert.equal(CHIMNEY.plinthCourses, undefined);
  assert.equal(CHIMNEY.crownCourses, undefined);
});
test('chimneyLayout_NoOverlaps', () => {
  assert.deepEqual(overlappingPairs(chimneyLayout()), []);
});
test('chimneyLayout_EveryBlockSupported', () => {
  assert.deepEqual(unsupported(chimneyLayout()), []);
});
test('chimneyLayout_Course0OnGround', () => {
  for (const b of shaft().filter(b => b.course === 0)) assert.ok(Math.abs(b.y - b.hy) < 1e-9);
});
test('chimneyLayout_ShaftRadiusStrictlyDecreasing', () => {
  for (let c = 1; c < CHIMNEY.shaftCourses; c++) {
    const mean = (k) => shaft().filter(b => b.course === k).reduce((s, b) => s + radial(b), 0) / CHIMNEY.segments;
    assert.ok(mean(c) < mean(c - 1) - 1e-6, `course ${c}`);
  }
});
test('chimneyLayout_ShaftWallThinsTowardTop', () => {
  assert.ok(Math.abs(shaft().find(b => b.course === 0).hz - CHIMNEY.wallBottom) < 1e-9);
  assert.ok(Math.abs(shaft().find(b => b.course === CHIMNEY.shaftCourses - 1).hz - CHIMNEY.wallTop) < 1e-9);
});
test('chimneyLayout_RunningBond_OddCoursesHalfStep', () => {
  const step = 2 * Math.PI / CHIMNEY.segments;
  const first = (k) => shaft().find(b => b.course === k).ry;
  assert.ok(Math.abs(first(0)) < 1e-9);
  assert.ok(Math.abs(first(1) - step / 2) < 1e-9);
});
test('chimneyLayout_TopHeightIsAbout15', () => {
  const top = Math.max(...chimneyLayout().map(b => b.y + b.hy));
  assert.ok(Math.abs(top - CHIMNEY.shaftCourses * coursePitch()) < 1e-9);
  assert.ok(Math.abs(top - 15.0) < 0.06);
});
test('shaftRadiusAndWall_Endpoints', () => {
  assert.equal(shaftRadius(0), CHIMNEY.radiusBottom);
  assert.equal(shaftRadius(CHIMNEY.shaftCourses - 1), CHIMNEY.radiusTop);
  assert.ok(Math.abs(CHIMNEY.radiusBottom - 1.3 * 1.25) < 1e-9);
  assert.ok(Math.abs(CHIMNEY.radiusTop - 0.75 * 1.25) < 1e-9);
  assert.equal(shaftWall(0), CHIMNEY.wallBottom);
  assert.equal(shaftWall(CHIMNEY.shaftCourses - 1), CHIMNEY.wallTop);
});
test('isSoot_TopFiveShaftCourses', () => {
  const n = CHIMNEY.shaftCourses;
  assert.equal(isSoot({ part: 'shaft', course: n - 5 }), true);
  assert.equal(isSoot({ part: 'shaft', course: n - 6 }), false);
  assert.equal(isSoot({ part: 'shaft', course: 0 }), false);
});
test('chimneyLayout_BrickLengthStaysCloseToBefore', () => {
  const bottom = shaft().find(b => b.course === 0);
  assert.ok(bottom.hx * 2 < 0.646 * 1.15, `bottom brick length ${bottom.hx * 2}`);
  for (const b of chimneyLayout()) assert.ok(b.hx > 0.15, `course ${b.course}`);
});
```

- [ ] **Step 2: Run, expect failures.** `node --test test/chimney.test.mjs`.

- [ ] **Step 3: Rewrite `targets/chimney.js`:**

```js
// Pure layout module for the brick industrial chimney target (#55, reshaped in #58): a
// tapering round brick shaft in running bond standing directly on the ground. No plinth,
// no crown. No THREE, no DOM.
// Boxes: { hx, hy, hz, x, y, z, ry, part, course }  // half extents + centre in base units,
// ry = yaw; part is always 'shaft'; course 0-based from the ground.
// Centred on x = 0, z = 0 with the ground at y = 0; index.html scales by TSCALE 2.
// Spec: docs/superpowers/specs/2026-11-25-issue-58-bigger-chimney-design.md

export const CHIMNEY = {
  segments: 12,
  shaftCourses: 43,
  courseHeight: 0.35,
  radiusBottom: 1.625,
  radiusTop: 0.9375,
  wallBottom: 0.30,
  wallTop: 0.18,
  sootCourses: 5,           // top shaft courses tinted by soot
  clearance: 0.002,         // tangential clearance per ring brick (#9)
};

const ROW_GAP = 0;      // courses touch exactly so waking the stack doesn't settle (#55)

export function chimneyLayout() {
  const boxes = [];
  for (let course = 0; course < CHIMNEY.shaftCourses; course++) {
    addRing(boxes, course, course % 2 === 1, shaftRadius(course), shaftWall(course), course * coursePitch());
  }
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
  return box.part === 'shaft' && box.course >= CHIMNEY.shaftCourses - CHIMNEY.sootCourses;
}

// One ring of bricks like setupCylinder: centre on the ring at yaw a, local x tangential,
// local z radial; the inner faces meet at the polygon vertices minus the clearance.
function addRing(boxes, course, staggered, radius, wall, bottomY) {
  const { segments, courseHeight, clearance } = CHIMNEY;
  const step = 2 * Math.PI / segments;
  const hx = (radius - wall) * Math.tan(step / 2) - clearance;
  for (let j = 0; j < segments; j++) {
    const a = j * step + (staggered ? step / 2 : 0);
    boxes.push({
      hx, hy: courseHeight / 2, hz: wall,
      x: radius * Math.sin(a), y: bottomY + courseHeight / 2, z: radius * Math.cos(a),
      ry: a, part: 'shaft', course,
    });
  }
}
```

- [ ] **Step 4: Run** `node --test test/*.test.mjs`; all green (also the other layout tests).

- [ ] **Step 5: Commit**

```bash
git add targets/chimney.js test/chimney.test.mjs
git commit -m "feat(targets): chimney shaft 1.25x wider, 1.5x higher, no crown or plinth (#58)"
```

### Task 2: Harness

**Files:**
- Modify: `test/harness/chimney.html`

- [ ] **Step 1: Edit the script block**

- Import: `import { CHIMNEY, chimneyLayout, coursePitch } from '../../targets/chimney.js';` (drop `plinthPitch`).
- Replace the crown helpers by top-brick helpers:

```js
const isTop = (b) => b.course >= CHIMNEY.shaftCourses - CHIMNEY.sootCourses;
function topOf(ctx) { return ctx.bricks.filter(isTop); }
function topMeanY(ctx) { const c = topOf(ctx); return c.reduce((s, b) => s + b.body.position.y, 0) / c.length; }
function topHomeY(ctx) { const c = topOf(ctx); return c.reduce((s, b) => s + b.home.y, 0) / c.length; }
function topMeanRadial(ctx) {
  const c = topOf(ctx);
  return c.reduce((s, b) => s + Math.hypot(b.body.position.x, b.body.position.z - ZC), 0) / c.length;
}
function shaftCourseY(course) {
  return (course * coursePitch() + CHIMNEY.courseHeight / 2) * S;
}
```

- Replace every `crownMeanY`/`crownHomeY`/`crownMeanRadial` use with the top helpers; log text says "top mean y" instead of "crown".
- Tip-over INFO threshold `> 2.0` becomes `> 2.5`.
- Light hit: `down < Math.round(0.1 * ctx.bricks.length)` and the detail text prints that limit; still fired at `shaftCourseY(Math.floor(CHIMNEY.shaftCourses / 2))`.
- Update the title/comment lines mentioning crown and plinth. Leave ball parameters (mass 9, r 0.29, 40 m/s, two shots 1 s apart at course 1; light ball mass 0.6, r 0.33, 25 m/s) unchanged.

- [ ] **Step 2: Run the harness** like the other harnesses (serve the repo, Playwright with the swiftshader flags, wait for title `CHIMNEY PASS`/`CHIMNEY FAIL`, read the `#out` text). If check 1 or 2 or 3 fails, tune geometry in the order of Global Constraints, re-run `node --test test/*.test.mjs` after each change, and re-run the harness. Do not touch physics. Do not loosen the thresholds.

- [ ] **Step 3: Record** the final constants and the measured numbers (stable displacement, top mean y fraction after the base hit, tip-over radial, light-hit top fraction and bricks moved) in the harness header comment, replacing the 2026-11-24 block, dated 2026-11-25.

- [ ] **Step 4: Run the other harnesses that exist** (`test/harness/*.html`) and confirm they still pass.

- [ ] **Step 5: Commit**

```bash
git add test/harness/chimney.html targets/chimney.js test/chimney.test.mjs
git commit -m "test(harness): chimney checks for the bigger shaft (#58)"
```

### Task 3: Wire into the game

**Files:**
- Modify: `index.html` (`chimneyMatl` ~line 909, `camCfg.chimney` ~line 1209)

- [ ] **Step 1:** In `chimneyMatl`, delete the line `if (b.part === 'plinth') return stoneMatls[i % stoneMatls.length];` (keep the rest; `i` and `b.course` still pick the tint). Update the comment above `makeBrickTexture` only if it mentions plinth or crown.

- [ ] **Step 2:** Set `chimney:   { r: 45,   ty: 7.5, tz: -6, plat: false, build: setupChimney },`.

- [ ] **Step 3: Screenshots.** Headless Playwright, swiftshader flags, 1280×720 and 390×844 (mobile viewport, touch): select Chimney, screenshot the standing chimney, fire two cannonballs at the foot, screenshot mid-collapse. Look at all with the Read tool. The whole chimney from ground to top must be in view, with sky above and the foot visible; the soot band on top, no plinth, no crown. If the top is cut off or the chimney is tiny, change `r`/`ty` (`ty` stays near half the height) and repeat. Check the orbit zoom limits (search `orbit` min/max radius in `index.html`) allow the new radius; if they clamp it, record that in the PR rather than changing camera code. Also note informally whether the 516 bricks feel responsive in the headless run.

- [ ] **Step 4: Manual check:** Reset and a target switch during a collapse throw no console errors; the Chimney button still sits after Jenga.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(targets): refit chimney camera and drop plinth material (#58)"
```

### Task 4: Docs and the #55 spec

**Files:**
- Modify: `docs/superpowers/specs/2026-11-24-issue-55-brick-chimney-design.md`, `README.md`, `CHANGELOG.md`

- [ ] **Step 1: #55 spec.** Insert directly under the `# Brick industrial chimney (#55)` title:

```
> **Reshaped by #58.** The plinth and the crown were removed and the shaft became 1.25× wider
> (radius 1.625 → 0.9375) and 1.5× higher (43 courses, 12 bricks per ring, 516 bricks, total
> 15.05 base units). The current shape is in
> `2026-11-25-issue-58-bigger-chimney-design.md`; where this document still says otherwise
> it describes the original #55 build (PR #56).
```

Then correct the passages so they no longer contradict: Intent ("a square stone footing ... soot-blackened crown with a corbelled rim" becomes "a round shaft that tapers toward the top with a soot-blackened top band, standing on the ground"; "twice as high" stays out); Goals "Looks" (drop the plinth and crown, "a soot band on the top courses"); the Shape table and the stack paragraph (new values, remove plinth/crown rows, body count 516); "Look" (drop the Plinth bullet, camera line `r: 45, ty: 7.5`); Collapse harness descriptions (top bricks instead of crown, 52 instead of 28 bricks, 15.05 instead of 10.0); the Verification bullet list (516 blocks, shaft only, top 15.05). Keep the "Row gap changed in implementation (PR #56)" note as history.

- [ ] **Step 2: README.** In the Targets paragraph (~line 89) replace `tall brick industrial chimney on a stone plinth, tapering to a soot-blackened crown, that tips over and breaks apart when hit at the foot.` with `tall brick industrial chimney, tapering to a soot-blackened top, that tips over and breaks apart when hit at the foot.` The harness line (~72) and controls row need no change.

- [ ] **Step 3: CHANGELOG.** Under `[Unreleased]`, add to `Changed` (create the heading if it is missing, keep Keep-a-Changelog order):

```
- Brick chimney is 1.25× wider and 1.5× higher, has no crown and no stone base any more, and stands directly on the ground (#58)
```

and reword the #55 `Added` line so it no longer mentions the plinth and crown: `... a tapering factory chimney of red brick with a soot-blackened top; ...`.

- [ ] **Step 4: Grep** `grep -rn -i "plinth\|crown" README.md CHANGELOG.md index.html targets/chimney.js test/chimney.test.mjs test/harness/chimney.html docs/superpowers/specs/2026-11-24-issue-55-brick-chimney-design.md` — remaining hits must be only the #58 banner and historical notes.

- [ ] **Step 5: Final run and commit** `node --test test/*.test.mjs`; then

```bash
git add README.md CHANGELOG.md docs/superpowers/specs/2026-11-24-issue-55-brick-chimney-design.md
git commit -m "docs: chimney without crown and plinth, bigger shaft (#58)"
```
