# Elongated Chimney Bricks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (this plan is dispatched through the issue pipeline). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the chimney bricks look elongated by drawing two brick courses on every physics body's texture, without changing the 516 bodies or the tuned physics from #58.

**Architecture:** A pure helper `brickFaceRects()` and a constant `CHIMNEY.faceRows` in `targets/chimney.js` describe the brick rectangles of one texture; `makeBrickTexture()` in `index.html` draws them. Layout, physics, camera and harness stay unchanged.

**Tech Stack:** buildless vanilla JS (ES modules), three.js 0.160, `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-25-issue-64-elongated-chimney-bricks-design.md`

## Global Constraints

- Do **not** change `chimneyLayout()`, `addRing()`, the existing `CHIMNEY` geometry constants, `addBlock`, `physics/`, camera config or `test/harness/chimney.html`. Body count stays 516.
- Do **not** run `test/harness/chimney.html` or any other harness: the physics does not change and the harness does not use the texture. Unit tests only.
- Never modify an existing test to make it green.
- Tests run with `node --test test/*.test.mjs` (no `package.json`).
- One optional screenshot at most (Task 2 Step 4). If the headless browser is slow, skip it and say so in the PR.

## Review Focus

1. `brickFaceRects` frame is `joint / 2` at the edges and `joint` between rows, so joints look equal inside a body and between two bodies.
2. `makeBrickTexture` takes all brick rects from `brickFaceRects`, no hard-coded second rectangle.
3. No change to any physics value or to the chimney geometry.

---

### Task 1: Pure face-rect helper and aspect check

**Files:**
- Modify: `targets/chimney.js`
- Modify: `test/chimney.test.mjs`

- [ ] **Step 1: Write the failing tests.** In `test/chimney.test.mjs` change the import line to:

```js
import { CHIMNEY, chimneyLayout, coursePitch, shaftRadius, shaftWall, isSoot, brickFaceRects, visibleBrickAspect } from '../targets/chimney.js';
```

and append at the end of the file:

```js
test('chimneyFaceRows_IsTwo', () => {
  assert.equal(CHIMNEY.faceRows, 2);
});
test('brickFaceRects_TwoRows_EqualHeightsAndJoints', () => {
  const rects = brickFaceRects(256, 128, 2, 8);
  assert.equal(rects.length, 2);
  assert.deepEqual(rects[0], { x: 4, y: 4, w: 248, h: 56 });
  assert.deepEqual(rects[1], { x: 4, y: 68, w: 248, h: 56 });
});
test('brickFaceRects_AnyRows_FrameHalfJointGapFullJoint', () => {
  for (const rows of [1, 2, 3]) {
    const rects = brickFaceRects(256, 128, rows, 8);
    assert.equal(rects.length, rows);
    assert.equal(rects[0].y, 4);
    const last = rects[rows - 1];
    assert.ok(Math.abs(128 - (last.y + last.h) - 4) < 1e-9, `bottom frame rows=${rows}`);
    for (let i = 1; i < rows; i++) {
      assert.ok(Math.abs(rects[i].y - (rects[i - 1].y + rects[i - 1].h) - 8) < 1e-9, `gap ${i}`);
      assert.ok(Math.abs(rects[i].h - rects[0].h) < 1e-9);
    }
    for (const r of rects) {
      assert.equal(r.x, 4);
      assert.equal(r.w, 248);
    }
  }
});
test('visibleBrickAspect_EveryBody_Elongated', () => {
  for (const b of chimneyLayout()) {
    const a = visibleBrickAspect(b);
    assert.ok(a >= 2.0 && a <= 4.0, `course ${b.course}: aspect ${a}`);
  }
});
test('visibleBrickAspect_FootLongerThanTop', () => {
  const boxes = chimneyLayout();
  const foot = visibleBrickAspect(boxes.find(b => b.course === 0));
  const top = visibleBrickAspect(boxes.find(b => b.course === CHIMNEY.shaftCourses - 1));
  assert.ok(foot > top);
  assert.ok(Math.abs(foot - 3.805) < 0.01, `foot ${foot}`);
  assert.ok(Math.abs(top - 2.159) < 0.01, `top ${top}`);
});
```

- [ ] **Step 2: Run the tests to see them fail.**

Run: `node --test test/chimney.test.mjs`
Expected: FAIL — `brickFaceRects` / `visibleBrickAspect` are not exported, `CHIMNEY.faceRows` is undefined.

- [ ] **Step 3: Implement.** In `targets/chimney.js` add `faceRows` to `CHIMNEY` (after `clearance`):

```js
  clearance: 0.002,         // tangential clearance per ring brick (#9)
  faceRows: 2,              // brick courses drawn on one body's texture, so bricks look elongated (#64)
```

and append at the end of the file:

```js
// Brick rectangles of one chimney texture (#64): a mortar frame of joint/2 on every edge,
// so two bodies side by side show one full joint, and `rows` equal bricks separated by a
// full joint. Head joints stay at the body edges, so the running bond is unchanged.
export function brickFaceRects(width, height, rows, joint) {
  const h = (height - rows * joint) / rows;
  const rects = [];
  for (let i = 0; i < rows; i++) {
    rects.push({ x: joint / 2, y: joint / 2 + i * (h + joint), w: width - joint, h });
  }
  return rects;
}

// Visible length : height of one drawn brick of a body (#64).
export function visibleBrickAspect(box) {
  return (2 * box.hx) / ((2 * box.hy) / CHIMNEY.faceRows);
}
```

Also extend the header comment of the file with one line: `// brickFaceRects/visibleBrickAspect describe the texture: two brick courses per body (#64).`

- [ ] **Step 4: Run the full suite.**

Run: `node --test test/*.test.mjs`
Expected: PASS, including all existing chimney tests (516 blocks, no overlaps, every block supported, top about 15).

- [ ] **Step 5: Commit.**

```bash
git add targets/chimney.js test/chimney.test.mjs
git commit -m "feat(targets): chimney face rects with two brick courses per body (#64)"
```

---

### Task 2: Draw the texture from the face rects

**Files:**
- Modify: `index.html` (import line near 343, `makeBrickTexture` near 887-904)

- [ ] **Step 1: Import.** Change

```js
import { chimneyLayout, isSoot } from './targets/chimney.js';
```

to

```js
import { CHIMNEY, chimneyLayout, isSoot, brickFaceRects } from './targets/chimney.js';
```

(`CHIMNEY` is not imported anywhere else in `index.html` today.)

- [ ] **Step 2: Replace `makeBrickTexture`** and its comment with:

```js
// Brick chimney (#55, #64): one body per brick of the physics, but each body's texture shows
// CHIMNEY.faceRows courses of bricks, so they look elongated; the mortar frame is half a joint
// on every edge, so joints between bodies match joints inside one. Tints vary per body, soot on top.
function makeBrickTexture(brick, mortar) {
  const W = 256, H = 128, JOINT = 8;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = mortar; g.fillRect(0, 0, W, H);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  brickFaceRects(W, H, CHIMNEY.faceRows, JOINT).forEach((r, i) => {
    g.fillStyle = brick; g.fillRect(r.x, r.y, r.w, r.h);
    if (i % 2 === 1) { g.fillStyle = 'rgba(0,0,0,0.07)'; g.fillRect(r.x, r.y, r.w, r.h); }
    for (let k = 0; k < 60; k++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.10)';
      g.fillRect(r.x + 1 + rnd() * (r.w - 6), r.y + 1 + rnd() * (r.h - 4), 2 + rnd() * 4, 1 + rnd() * 3);
    }
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
```

Leave `brickMatls`, `sootMatls`, `chimneyMatl` and `setupChimney` unchanged.

- [ ] **Step 3: Check the module still parses and tests pass.**

Run: `node --test test/*.test.mjs && grep -n "brickFaceRects\|faceRows" index.html`
Expected: PASS; grep shows the import and the use in `makeBrickTexture`.

- [ ] **Step 4 (optional, max 3 minutes): one screenshot.** Serve on port 8764 (`python3 -m http.server 8764 &`), open `http://localhost:8764/` headless (`--use-gl=swiftshader --enable-unsafe-swiftshader`, wrapped in `timeout 120 systemd-run --user --scope -q -p MemoryMax=2G -p MemorySwapMax=0`), click the `Chimney` target button, wait 3 s, take one 1280×720 screenshot and view it: each brick body shows two horizontal brick rows. Check the browser console has no errors. Stop the server with `fuser -k 8764/tcp`. If this takes longer than 3 minutes, skip it and note it in the PR body.

- [ ] **Step 5: Commit.**

```bash
git add index.html
git commit -m "feat(targets): elongated chimney bricks, two courses per body texture (#64)"
```

---

### Task 3: Changelog

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1:** Under `## [Unreleased]` → `### Changed` (the heading already exists), add at the end of that list:

```markdown
- Chimney bricks look elongated: every brick block now shows two courses of long bricks; the chimney's size and how it falls are unchanged (#64)
```

- [ ] **Step 2: Run the full suite once more.**

Run: `node --test test/*.test.mjs`
Expected: PASS.

- [ ] **Step 3: Commit.**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): elongated chimney bricks (#64)"
```
