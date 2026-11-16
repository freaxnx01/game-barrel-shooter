# Jenga tower with a push-out mode (#34)

## Intent

A Jenga tower as a new target in Barrel Blast. On it, you play the core of Jenga instead of shooting: you push single blocks out of the tower until it falls. The fun is the tension of a tower that wobbles but holds. The pushing must feel physical: loose blocks slide out, and blocks under heavy load stick.

## Goals

- A classic tower of 18 layers × 3 blocks, each layer crosswise to the one below. It sits in the target picker under **Towers** as "Jenga".
- **Push-out mode, on automatically when Jenga is selected:**
  - Tap or click a block and **hold**: the block is pushed slowly along its long axis, away from where you touched it. Release to stop.
  - Mouse, touchpad and touch all work the same way.
- **Shoot toggle:** a button that is visible only on Jenga and switches between push-out and the normal weapons. Shoot mode behaves exactly like every other target.
- **Score:**
  - A block counts as pulled once it has slid far enough out (see Rules). The HUD shows "Blocks pulled: n".
  - The round ends when the tower falls. The HUD then shows "Tower fell! n blocks pulled", the score turns red, and pushing is disabled until Reset.

## Non-goals

- The two-player game, and stacking pulled blocks back on top.
- Turn-taking, timers and high scores.
- Changing any other target, weapon or the existing physics materials.

## Anti-goals (a failure even if it technically works)

- Pushing one block drags the layers above along, so the tower always falls on the first push.
- Blocks teleport or move kinematically through their neighbours. The push must be a force, so stuck blocks stay stuck.
- The tower sags or collapses by itself while nobody touches it.

## Rules (owner decisions, 2026-11-15)

Layers are numbered from 1 (on the ground) to 18 (on top) in this document. In code, `box.layer` is 0-based.

- **Interaction:** hold to push (option "Antippen + halten schiebt").
- **Mode:** automatic on Jenga, plus a Shoot toggle (option "Automatisch + Schiessen-Schalter").
- **End:** the tower has fallen when either of these holds:
  - **a block you are not pushing**, from layer 2 or higher (that is, not resting on the ground at build time) and not already counted as pulled, touches the ground. Its bottom face is within 0.05 of y = 0;
  - **the top layer sinks:** the mean y of the top-layer blocks drops more than half a block thickness below its home height.
- **Pulled:** a block counts as pulled once it has moved more than 0.8 × its length along its own long axis from home. It is counted once and excluded from the fall checks from then on. Pulled blocks stay in the scene and may fall to the ground; that is no failure.

## Decided how (builder must follow)

- **Pure module `targets/jenga.js`,** without THREE or the DOM, in the style of `targets/apk-layouts.js`:
  - `jengaTower(layers = 18)` returns boxes `{ hx, hy, hz, x, y, z, ry }` centred on x = 0, z = 0 with the ground at y = 0. Block full size: length 3.0, width 1.0, height 0.6 (the real Jenga ratio 7.5 : 2.5 : 1.5). Each layer has three blocks side by side with a horizontal clearance of 0.001, and every layer is rotated 90° from the one below (`ry` 0 / π/2). Each box also carries its `layer` index.
  - The constants (`JENGA`) and the pure rule functions behind the push force, "pulled" and "fallen" (see Rules) are tested in `test/jenga.test.mjs`, including no-overlap and every-block-resting checks with `test/layout-geometry.mjs`.
- **Push:** while a block is held, every frame applies a force through the existing `phys.applyForce` (the same per-frame force path Magneto uses, #29):
  - The force runs along the block's long axis, in the direction from the touch point toward the block's centre. Its sign comes from that vector projected on the axis, decided once at touch-down.
  - It is a speed controller toward `JENGA.pushSpeed` along the axis and is capped at `JENGA.maxPushForce`. The cap is what lets loaded blocks stick.
  - The start values are pushSpeed 0.6 m/s and a cap of 1.5 × the block's weight. The builder tunes them with the harness (below).
- **Material:** a new wooden `jenga` material in `physics/materials.js` with `jenga|jenga` and `jenga|ground` pairs, plus pairs with `ball`, `heavy` and `barrel` so shoot mode works. The builder tunes the friction with the harness. Jenga blocks do not use `MASONRY_MASS_SCALE` or the `masonry` material.
- **Picking:** on pointerdown in push mode, raycast against the Jenga meshes (the same `raycaster` pattern the code already uses at `index.html` ~1664).
  - A hit starts the push.
  - A miss does nothing (no shot).
  - A second finger cancels the push, like the charge cancel in #37.
  - Right-drag, the camera pad and two-finger gestures keep orbiting the camera.
- **The Shoot toggle button:**
  - On desktop it sits under Auto-Play.
  - In mobile mode it sits in `#mob-bar`.
  - It is hidden on every other target.
  - Reset keeps the current toggle state.
- **Camera:** a `camCfg` entry framed so the whole tower is visible at 1280×720. The portrait fit from #39 applies automatically.
- **Auto-Play** on Jenga shoots, the same as on other targets.

## Verification

- A browser harness `test/harness/jenga.html` sets its title to `JENGA PASS` or `JENGA FAIL`. It runs on the real crashcat backend with the real material table and checks:
  1. **Stable:** an untouched tower settles. After 5 s no block has moved more than 0.02 from home.
  2. **Push out:** holding the push on the middle block of layer 9 makes it count as pulled within 6 s. The layer above moves less than 0.1, and the tower has not fallen.
  3. **Side block:** pushing out a side block of layer 9 still leaves the tower standing.
  4. **Stuck block:** pushing a bottom-layer block (layer 1, under the full load) does **not** pull it within 3 s, because the force cap holds.
  5. **Collapse:** after pushing out both side blocks of one layer, then the middle block of the same layer, the fall rule fires.
- Unit tests for `targets/jenga.js` and `node --test test/*.test.mjs` are green. The existing harnesses still pass.
- Screenshots at 1280×720 and 390×844 of the full tower, with the Shoot toggle visible.

## Calls made after the builder check (my calls, owner may override)

- **Scale:** the units are the same as the stone targets (metres; Fortress walls are about 1.5 high per course, the Eiffel and frame targets about 10 high). A 10.8-high tower needs no rescaling and no solver changes. Use `TSCALE` 1, with the camera at about r 26, ty 5.5, tz -6, tuned to frame the tower at 1280×720.
- **Sleep:** Jenga blocks start asleep, with the same `sleepSpeedLimit`/`sleepTimeLimit` and damping as `addBlock`. The "stable" check runs with the backend's normal wake behaviour (neighbours of movers wake).
- **Friction window:** with an even load, the friction holding a block is about μ × (load above + load below):
  - the middle block of layer 9 has about 19 block weights on it, so it slides when 19μW < cap;
  - a layer-1 block has about 35W on it, so it sticks when 35μW > cap.
  - With a cap of 1.5W that means 0.043 < μ < 0.079. Start at `jenga|jenga` μ ≈ 0.06 and tune it together with the cap inside that window.
  - The cap is a fixed force (weight-relative is just how it is written down). It does not scale with the layer.
  - If no pair passes checks 2 and 4 together, keep check 2 (push-out works) and report the measured window in the PR instead of loosening check 2.
- **Pointer arbitration (from the code):**
  - Today, left-press charges and fires, right-drag orbits, and two fingers orbit or zoom (#37). Nothing orbits with one finger.
  - In push mode, left-press or one finger on a block pushes, and a press on empty space does nothing.
  - Right-drag, the pad and two fingers keep orbiting. A two-finger gesture cancels any push.
- **Pulled is permanent:** a block once counted as pulled stays pulled, wherever it ends up.
- **Auto-Play:** it shoots whatever the toggle says. While Auto-Play runs, pushing is off.

## Left to the builder

- Wood colours and texture: a slightly varied light wood. A grain texture is optional.
- The exact tuned friction, `pushSpeed` and `maxPushForce` values, within the harness checks above.
- Visual feedback on the held block, such as a highlight.
- Button and HUD styling, which must match the existing buttons.
