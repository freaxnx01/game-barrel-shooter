# Sniper scope as a picture-in-picture circle (#91) Implementation Plan

**Goal:** The sniper lens no longer zooms the whole screen. A round scope circle at the aim point shows a 5× magnified view with a reticle, rendered as a second pass of the scene; the main view keeps `DEFAULT_FOV`.

**Files:** `weapons/scope.js` (new), `test/scope.test.mjs` (new), `index.html`, `README.md`, `CHANGELOG.md`.
Spec: `docs/superpowers/specs/2026-11-26-issue-91-sniper-scope-design.md`. Other issues may have landed first and touched `index.html`; work by function and constant names (`setAmmo`, `setAim`, `resize`, `animate`, `fitCamera`), not line numbers.

### Task 1: Pure scope helpers

- [ ] **Step 1: Failing tests.** Create `test/scope.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { SCOPE, scopeDiameter, scopeRect, aimToScreen, scopeFov, scopeTextureSize, scopeNdcTransform } from '../weapons/scope.js';

test('scopeDiameter_Landscape_FractionOfHeight', () => {
  assert.equal(scopeDiameter(1280, 720), Math.round(720 * SCOPE.fraction));
  assert.equal(scopeDiameter(390, 844), Math.round(390 * SCOPE.fraction));
});

test('scopeRect_MouseMidScreen_CentredOnAim', () => {
  assert.deepEqual(scopeRect(640, 360, 1280, 720), { x: 640, y: 360, size: 288 });
});

test('scopeRect_MouseInCorner_StaysOnScreen', () => {
  assert.deepEqual(scopeRect(10, 10, 1280, 720), { x: 144, y: 144, size: 288 });
  assert.deepEqual(scopeRect(1275, 715, 1280, 720), { x: 1136, y: 576, size: 288 });
});

test('scopeRect_Touch_LiftedAboveFinger', () => {
  assert.deepEqual(scopeRect(195, 520, 390, 844, true), { x: 195, y: 520 - 156 * SCOPE.lift, size: 156 });
});

test('scopeRect_TouchNearTop_ClampedNotOffScreen', () => {
  assert.deepEqual(scopeRect(195, 100, 390, 844, true), { x: 195, y: 78, size: 156 });
});

test('aimToScreen_NdcCorners_MapToPixels', () => {
  assert.deepEqual(aimToScreen(0, 0, 1280, 720), { x: 640, y: 360 });
  assert.deepEqual(aimToScreen(-1, 1, 1280, 720), { x: 0, y: 0 });
  assert.deepEqual(aimToScreen(1, -1, 1280, 720), { x: 1280, y: 720 });
});

test('scopeFov_5xOf55Degrees_About12Degrees', () => {
  const fov = scopeFov(55);
  assert.ok(fov > 11.5 && fov < 12.5, `fov ${fov}`);
  assert.ok(Math.abs(scopeFov(55, 1) - 55) < 1e-9);
});

test('scopeTextureSize_OneToOneWithScreen_Capped', () => {
  assert.equal(scopeTextureSize(288, 2), 576);
  assert.equal(scopeTextureSize(288, 3), SCOPE.maxTexture);
  assert.equal(scopeTextureSize(156, 3), 468);
});

test('scopeNdcTransform_CentreRect_UnitCircleScaledToPixels', () => {
  assert.deepEqual(scopeNdcTransform({ x: 640, y: 360, size: 288 }, 1280, 720), { x: 0, y: 0, scaleX: 0.225, scaleY: 0.4 });
  const t = scopeNdcTransform({ x: 144, y: 144, size: 288 }, 1280, 720);
  assert.ok(Math.abs(t.x - (-0.775)) < 1e-12 && Math.abs(t.y - 0.6) < 1e-12);
});
```

Run `node --test test/scope.test.mjs`. Expected: FAIL (cannot find module `../weapons/scope.js`).

- [ ] **Step 2: Implement.** Create `weapons/scope.js`:

```js
// Sniper scope inset (#91): pure helpers for where the round scope sits on screen and what its
// camera sees. No engine, no DOM. The scope is a picture-in-picture circle around the aim point
// that shows a magnified view; the main view keeps its FOV.

export const SCOPE = {
  fraction: 0.4,       // circle diameter as a share of the shorter screen side
  magnification: 5,    // objects in the circle look 5x bigger than in the view beneath
  lift: 0.75,          // touch: raise the circle by this many diameters so the finger does not cover it
  maxTexture: 768,     // longest edge of the inset render target, in device pixels
};

export function scopeDiameter(width, height, fraction = SCOPE.fraction) {
  return Math.round(Math.min(width, height) * fraction);
}

// Centre and size of the circle in CSS pixels. aimX/aimY are the aim point in CSS pixels; a lifted
// scope (touch) sits above the finger. The whole circle stays on screen.
export function scopeRect(aimX, aimY, width, height, lifted = false) {
  const size = scopeDiameter(width, height);
  const r = size / 2;
  const cy = aimY - (lifted ? size * SCOPE.lift : 0);
  return {
    x: clamp(aimX, r, width - r),
    y: clamp(cy, r, height - r),
    size,
  };
}

// NDC x/y of the aim point -> CSS pixels (the inverse of setAim in index.html).
export function aimToScreen(ndcX, ndcY, width, height) {
  return { x: ((ndcX + 1) / 2) * width, y: ((1 - ndcY) / 2) * height };
}

// Vertical FOV (degrees) that magnifies the base FOV by `magnification`.
export function scopeFov(baseFov, magnification = SCOPE.magnification) {
  const half = Math.tan((baseFov * Math.PI) / 360) / magnification;
  return (Math.atan(half) * 360) / Math.PI;
}

// Square render-target edge in device pixels: 1:1 with the circle on screen, capped.
export function scopeTextureSize(diameter, pixelRatio, maxTexture = SCOPE.maxTexture) {
  return Math.max(1, Math.min(Math.round(diameter * pixelRatio), maxTexture));
}

// Where to draw a unit circle (radius 1) in an orthographic -1..1 overlay so it covers the rect.
export function scopeNdcTransform(rect, width, height) {
  return {
    x: (rect.x / width) * 2 - 1,
    y: 1 - (rect.y / height) * 2,
    scaleX: rect.size / width,
    scaleY: rect.size / height,
  };
}

function clamp(v, lo, hi) {
  return lo > hi ? (lo + hi) / 2 : Math.min(Math.max(v, lo), hi);
}
```

Run `node --test test/*.test.mjs`. Expected: all pass (9 new).

- [ ] **Step 3: Commit and push.** `git commit -m "feat(weapons): sniper scope rect, FOV and texture helpers (#91)"`

### Task 2: Second render pass into a disc, rim and reticle overlay

All edits in `index.html`.

- [ ] **Step 1: CSS.** Directly after the line `#c { display: block; width: 100%; height: 100%; cursor: crosshair; }` add:

```css
  /* Sniper scope inset (#91): the magnified circle is drawn by WebGL; this is the rim and reticle over it */
  #scope {
    position: fixed; left: 0; top: 0; pointer-events: none; border-radius: 50%; box-sizing: border-box;
    border: 3px solid #0b0b0d; box-shadow: 0 0 0 1px rgba(255,255,255,0.35), 0 0 18px rgba(0,0,0,0.7), inset 0 0 14px rgba(0,0,0,0.75);
  }
  #scope[hidden] { display: none; }
  #scope svg { display: block; width: 100%; height: 100%; }
```

- [ ] **Step 2: DOM.** Directly after `<div id="power"><div class="fill" id="powerFill"></div></div>` add:

```html
<div id="scope" hidden aria-hidden="true">   <!-- sniper scope rim and reticle (#91) -->
  <svg viewBox="0 0 100 100">
    <g stroke="#000" stroke-width="0.7" fill="none">
      <path d="M50 2V42M50 58V98M2 50H42M58 50H98"/>
      <circle cx="50" cy="50" r="22"/>
      <circle cx="50" cy="50" r="0.9" fill="#000" stroke="none"/>
    </g>
    <g fill="#000"><circle cx="50" cy="34" r="0.9"/><circle cx="50" cy="66" r="0.9"/><circle cx="34" cy="50" r="0.9"/><circle cx="66" cy="50" r="0.9"/></g>
  </svg>
</div>
```

- [ ] **Step 3: Import.** After `import { SNIPER, sniperSpeed, isOutOfRange, streakLength } from './weapons/sniper.js';` add:

```js
import { scopeRect, aimToScreen, scopeFov, scopeTextureSize, scopeNdcTransform } from './weapons/scope.js';
```

- [ ] **Step 4: One shadow pass per frame.** After `renderer.shadowMap.type = THREE.PCFSoftShadowMap;` add:

```js
renderer.shadowMap.autoUpdate = false;   // animate() flags one shadow pass per frame, shared by the scope and main renders (#91)
```

- [ ] **Step 5: Touch flag in `setAim`.** Replace the function `setAim` with:

```js
function setAim(e) {
  mouseNDC.x = (e.clientX / innerWidth) * 2 - 1;
  mouseNDC.y = -(e.clientY / innerHeight) * 2 + 1;
  aimByTouch = e.pointerType === 'touch';   // a finger covers the aim point, so the scope lifts above it (#91)
}
```

- [ ] **Step 6: Scope block.** Directly above `function resize() {` add:

```js
// ---------- Sniper scope (#91): second render of the scene through a narrow-FOV camera into a circle ----------
// The main view keeps DEFAULT_FOV. While the sniper is selected the scene is rendered once more, through
// scopeCamera (same position as the camera, looking along the aim ray, so the reticle centre is where the
// tracer goes), into a square render target, which a circle mesh then draws over the main image at the scope
// rect; #scope (DOM) adds rim and reticle. The shadow map is rendered once per frame for both passes.
let aimByTouch = false;
const scopeEl = document.getElementById('scope');
const scopeCamera = new THREE.PerspectiveCamera(scopeFov(DEFAULT_FOV), 1, 0.1, CAM_FAR);
const scopeTarget = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true });
const scopeScene = new THREE.Scene();
const scopeOrtho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const scopeDisc = new THREE.Mesh(new THREE.CircleGeometry(1, 72), new THREE.MeshBasicMaterial({ map: scopeTarget.texture, depthTest: false, depthWrite: false }));
scopeScene.add(scopeDisc);
const scopeLook = new THREE.Vector3();

function scopeActive() {
  return ammoType === 'sniper';
}
function placeScope(rect) {
  const px = scopeTextureSize(rect.size, renderer.getPixelRatio());
  if (scopeTarget.width !== px) scopeTarget.setSize(px, px);
  const t = scopeNdcTransform(rect, innerWidth, innerHeight);
  scopeDisc.position.set(t.x, t.y, 0);
  scopeDisc.scale.set(t.scaleX, t.scaleY, 1);
  scopeEl.style.width = scopeEl.style.height = rect.size + 'px';
  scopeEl.style.transform = `translate(${rect.x - rect.size / 2}px, ${rect.y - rect.size / 2}px)`;
}
function renderScope() {
  const aim = aimToScreen(mouseNDC.x, mouseNDC.y, innerWidth, innerHeight);
  placeScope(scopeRect(aim.x, aim.y, innerWidth, innerHeight, aimByTouch));
  raycaster.setFromCamera(mouseNDC, camera);
  scopeCamera.position.copy(camera.position);
  scopeCamera.far = camera.far;
  scopeCamera.updateProjectionMatrix();
  scopeCamera.lookAt(scopeLook.copy(camera.position).add(raycaster.ray.direction));
  renderer.setRenderTarget(scopeTarget);
  renderer.render(scene, scopeCamera);
  renderer.setRenderTarget(null);
}
function drawScopeDisc() {
  renderer.autoClear = false;
  renderer.render(scopeScene, scopeOrtho);
  renderer.autoClear = true;
}

```

- [ ] **Step 7: Render order.** At the end of `animate()`, replace the single line `renderer.render(scene, camera);` (the last statement before the closing `}` of `animate`, after the camera-shake block) with:

```js
  renderer.shadowMap.needsUpdate = true;   // one shadow pass per frame, whichever render comes first (#91)
  const scoped = scopeActive();
  if (scoped) renderScope();
  renderer.render(scene, camera);
  if (scoped) drawScopeDisc();
```

- [ ] **Step 8: Check.** `grep -n "renderer.render(scene, camera)" index.html` prints exactly one line, inside `animate`. `node --test test/*.test.mjs` passes. Open the game, press `Q`: a magnified disc follows the mouse (the whole view is still zoomed to 26° until Task 3; that is expected here).
- [ ] **Step 9: Commit and push.** `git commit -m "feat(weapons): render the sniper view into a scope circle at the aim point (#91)"`

### Task 3: Drop the full-screen zoom, show the rim and reticle with the sniper

- [ ] **Step 1: `setAmmo`.** In `index.html`, replace the three lines

```js
  // Sniper lens zooms the view for precision; other ammo restores the default FOV.
  const fov = type === 'sniper' ? 26 : DEFAULT_FOV;
  if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
```

with

```js
  scopeEl.hidden = type !== 'sniper';   // the sniper lens shows a magnified scope circle around the aim point (#91)
```

`scopeEl` is declared in the scope block from Task 2, later in the module; `setAmmo` only runs from click and key handlers after the module has loaded, so there is no temporal-dead-zone access.

- [ ] **Step 2: `fitCamera` comment.** Delete the line `// the default FOV, not the sniper's zoomed one, so picking the sniper doesn't move the camera` inside `fitCamera`. Keep the `fitOrbitRadius(..., DEFAULT_FOV, ...)` call as it is.
- [ ] **Step 3: Check.** `grep -n "26 : DEFAULT_FOV\|camera.fov" index.html` prints nothing. `node --test test/*.test.mjs` passes. In the game, press `Q`: the view keeps its size, the circle with rim and crosshair follows the mouse, and a shot lands at the reticle centre. Press `1`: the circle is gone, no extra render runs.
- [ ] **Step 4: Commit and push.** `git commit -m "feat(weapons): sniper lens keeps the view and shows a scope instead of zooming (#91)"`

### Task 4: Docs

- [ ] **Step 1: README.** In `README.md`, Game Content, `*Launchers*` line: after `mini F-16 (flies nose-first)` insert `, sniper lens (key Q: a round scope at the cursor shows the target 5× magnified with a reticle; the tracer flies dead straight to its centre)` so the line reads `..., mini F-16 (flies nose-first), sniper lens (key Q: ...), heavy net (...)`.
- [ ] **Step 2: CHANGELOG.** In `CHANGELOG.md` under `## [Unreleased]` → `### Changed`, replace the line
  `- The sniper lens fires a bright tracer round that flies dead straight to the crosshair instead of a gold ball that dropped; it hits barrels about as hard as before (#30)`
  with
  `- The sniper lens fires a bright tracer round that flies dead straight to the crosshair instead of a gold ball that dropped; it hits barrels about as hard as before (#30). It no longer zooms the whole screen: a round scope at the cursor (lifted above the finger on touch screens) shows the target 5× magnified with a reticle, and the shot lands at its centre (#91)`
- [ ] **Step 3: Commit and push.** `git commit -m "docs: sniper scope circle (#91)"`

Optional visual check (skip if short on time): serve the repo (`python3 -m http.server 8787`), open it headless with Playwright at 1280×720 (`--use-gl=swiftshader --enable-unsafe-swiftshader`), press `q`, move the mouse to (600, 420), screenshot: the barrels outside the circle look like before, the ones inside about 5× bigger with the crosshair, and the console has no errors.
