# Sniper scope as a picture-in-picture circle (#91)

## Problem

Selecting the sniper lens zooms the whole screen: `setAmmo()` in `index.html` sets
`camera.fov = 26` (DEFAULT_FOV is 55). The player loses the overview, the UI around the
canvas stays the same, and it does not read as "looking through a rifle scope". The
playtester wants the scope look: the normal view stays as it is, and a round scope in front of
the aim point shows the magnified picture with a reticle. Decided in the issue: picture in
picture, not a black full-screen vignette.

## Design

### Rendering: a second render into a square render target, drawn as a disc

While the sniper is selected, `animate()` renders the scene twice:

1. **Scope pass.** `scopeCamera`, a `PerspectiveCamera` with aspect 1 and the narrow FOV from
   `scopeFov(DEFAULT_FOV)` (about 11.9°, 5× magnification), is placed at `camera.position`
   (after the camera shake, so the scope shakes with the view) and looks along the aim ray
   (`raycaster.setFromCamera(mouseNDC, camera)`), so the reticle centre is exactly where the
   tracer goes: the sniper flies dead straight (#30). The scene is rendered into
   `scopeTarget`, a square `WebGLRenderTarget`.
2. **Main pass.** Unchanged: `renderer.render(scene, camera)` at `DEFAULT_FOV`.
3. **Disc pass.** A `CircleGeometry(1, 72)` mesh with a `MeshBasicMaterial` whose `map` is
   `scopeTarget.texture`, in its own `scopeScene` with an orthographic −1..1 camera, is drawn over
   the main image with `renderer.autoClear = false`. Its position and scale come from
   `scopeNdcTransform(rect, innerWidth, innerHeight)`, so the disc covers exactly the scope
   rect in CSS pixels. The disc edge is a 72-gon; the DOM rim covers it.

A DOM element `#scope` (position fixed, `pointer-events: none`) sits over the disc and draws the
**rim** (3 px dark border, thin light outline, inner shadow vignette) and the **reticle** (an
inline SVG: fine crosshair lines with a gap in the centre, a centre dot, four mil-dots and a thin
inner ring). The reticle is DOM, not geometry, so it costs no GL work and is crisp at any DPR.

Rejected alternatives:

- `setScissor`/`setViewport` square inset directly on the canvas: the square's corners would
  overwrite the main image, so a mask would have to cover them; a rim thick enough to hide the
  corners is 21 % of the diameter. A render target lets the rim stay thin.
- Stencil mask: works, but needs a stencil buffer on the main canvas and extra state; the
  textured disc is simpler and does the same thing.
- A second canvas with its own renderer: the scene cannot be shared between two WebGL contexts.
- Full-screen vignette (black screen with a round hole): rejected in the issue.

### Budget

- The shadow map (2048², `PCFSoftShadowMap`) would be rendered once per `render()` call, so
  twice per frame. `renderer.shadowMap.autoUpdate = false` at setup and
  `renderer.shadowMap.needsUpdate = true` once per frame in `animate()` means three.js renders the
  shadow pass in whichever render comes first and skips it in the second. Without the sniper,
  behaviour is unchanged (one shadow pass per frame, as today).
- Render target edge = `scopeTextureSize(diameter, pixelRatio)` = the circle's size in device
  pixels (1:1 with the screen), capped at 768. Desktop 1280×720 at DPR 1: 288² = 0.08 Mpx on top
  of a 0.92 Mpx frame (+9 %). Phone 390×844 at DPR 2 (`setPixelRatio` caps at 2): 312² =
  0.10 Mpx on a 1.3 Mpx frame (+7 %). Worst case 768² = 0.59 Mpx. The scope pass draws the full
  scene (same draw calls, fewer pixels) only while the sniper is selected; with any other weapon
  there is no extra work at all.
- The render target is resized only when the edge changes (resize or DPR change), inside
  `placeScope()`. `resize()` and `fitCamera()` are not touched, so #76's per-frame refit guard
  stays as it is.

### Where the circle sits

`scopeRect(aimX, aimY, width, height, lifted)` in `weapons/scope.js`:

- **Diameter** = 40 % of the shorter screen side (`SCOPE.fraction = 0.4`): 288 px at 1280×720,
  156 px on a 390 px wide phone.
- **Desktop (mouse):** centred on the aim point. Aiming uses the mouse position (`setAim` →
  `mouseNDC`), so the scope follows the cursor over the target, like holding the rifle.
- **Touch:** the finger would cover the circle, so the scope is lifted by 0.75 diameters
  (`SCOPE.lift`) above the touch point. `setAim(e)` records `aimByTouch = e.pointerType ===
  'touch'`. The reticle centre still shows the shot: the scope camera looks along the aim ray,
  wherever the circle is drawn. Before the first touch `mouseNDC` is (0, 0), so the scope sits at
  the screen centre.
- The circle is clamped so it stays fully on screen (near the edges the reticle is then no longer
  under the cursor, which is fine for the same reason).
- `aimToScreen(ndcX, ndcY, width, height)` turns `mouseNDC` back into CSS pixels (the inverse of
  `setAim`).

### Magnification

`scopeFov(baseFov, magnification)` = `2·atan(tan(baseFov/2) / magnification)`; with
`SCOPE.magnification = 5` and `DEFAULT_FOV = 55` that is 11.9°. Objects in the circle look 5×
bigger than in the view beneath. (The old full-screen 26° was about 2.2×.) The scope camera's
`far` follows `camera.far` (which `fitCamera` pushes back on narrow screens, #39), so the fog
and far plane match the main view.

### Wiring

- `setAmmo(type)`: the FOV change is removed (`camera.fov` stays `DEFAULT_FOV` always);
  `scopeEl.hidden = type !== 'sniper'`.
- `animate()` end: `renderer.shadowMap.needsUpdate = true;` then if `ammoType === 'sniper'`:
  `renderScope()` (place + scope pass), main render, `drawScopeDisc()`.
- Unchanged: the tracer streak (#36), the straight flight and 160–240 m/s speed (#30),
  `fitCamera`, `resize`, aiming, charging (tap-and-hold on touch), and the main camera's FOV.
  The comment in `fitCamera` about "the sniper's zoomed one" goes, since there is no zoom any more.

### Prototype check

Prototyped in a scratch copy and rendered headless (SwiftShader) at 1280×720 with the mouse on
the barrel stack: the circle follows the cursor, shows the barrels about 5× bigger with the
reticle, and the main view keeps its FOV. On a 390×844 touch viewport the circle sits above the
touch point. No console errors.

## Files

- `weapons/scope.js` (new): `SCOPE`, `scopeDiameter`, `scopeRect`, `aimToScreen`, `scopeFov`,
  `scopeTextureSize`, `scopeNdcTransform`. Pure, no three.js, no DOM.
- `test/scope.test.mjs` (new): node:test, assert/strict.
- `index.html`: CSS `#scope`, the `#scope` DOM element with the reticle SVG, the import, the
  shadow-map flag, `setAim`, the scope block (`scopeCamera`, `scopeTarget`, `scopeScene`,
  `placeScope`, `renderScope`, `drawScopeDisc`), `setAmmo`, `animate`.
- `README.md`, `CHANGELOG.md`.

## Tests

`test/scope.test.mjs`: diameter from the shorter side; rect centred on the mouse; rect clamped at
the corners; rect lifted on touch and clamped at the top; NDC → pixel mapping; `scopeFov(55)`
between 11.5° and 12.5° and `scopeFov(55, 1) = 55`; texture size 1:1 with the screen and capped;
NDC transform of a centred and an off-centre rect.

## Out of scope

- A scope-specific sound or a breathing sway.
- Hiding the scope in Jenga push mode or while Auto-Play runs; it simply follows the aim point.
- A different magnification per target or a zoom wheel inside the scope.
