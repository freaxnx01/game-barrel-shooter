# Numbered remote charges and single detonation (#79)

Requires #78 (charges stick visibly) merged first; this builds on the code after it.

## Goal

Show how many remote charges are armed on the Boom button, give each placed remote charge a number (1-6) floating above it in the scene, and let the player detonate one charge by number. Boom and K still detonate all armed charges.

## Behaviour

- **Number assignment.** A new remote charge gets the lowest free number from 1 to `CHARGE.maxRemote` (6) among the armed remotes. A number is free again as soon as its charge is `exploded`. Pure `nextChargeNumber(used)` in `weapons/charges.js`. The cap of 6 (`canPlaceRemote`) is unchanged, so a free number always exists.
- **3D label.** One `THREE.Sprite` per remote charge, a child of the charge mesh (it is removed together with the mesh, no extra cleanup). Six canvas textures (dark disc, green ring, light digit), built lazily once and shared. The material has `depthTest: false`, so the number is never hidden inside the chimney's geometry. Each frame the sprite is placed 0.7 above the charge in world space (the charge may be tilted flush against a face, so the local offset is recomputed via `worldToLocal`) and scaled with the camera distance (`chargeLabelScale`: 0.035 per unit, clamped to 0.5-2) so it reads from the chimney camera at about 52 units. Sprites face the camera by definition.
- **Boom button.** The existing span shows `Boom N` (N = armed count). The button itself still detonates all armed charges.
- **Toggle + number row.** A narrow `#act-boom-more` button (caret) sits next to Boom, visible while a charge is armed. It opens a row `#act-nums` of buttons `1`..`6`, floating above `#act-bar` (so the bar does not grow into the camera pad or off screen on mobile). Only armed numbers are shown. Each button detonates just that charge. The row closes itself when no charge is armed. Same markup on desktop and mobile; the row is right-aligned on desktop and left-aligned on mobile like the bar.
- **Events.** `pointerdown` with `preventDefault`, like the existing Boom (#63), guarded by `!autoPlay`.
- **No number keys** (1-9 select weapons).
- **Unchanged.** Auto-play still calls `detonateRemoteCharges()` (all). Cut is unaffected. Timed charges have no number and no label.

## Pure helpers (tested)

- `weapons/charges.js`: `nextChargeNumber(used)`, `chargeLabelScale(dist)`.
- `ui/actions.js`: `shownNumbers(numbers)` (sorted, unique, valid 1-6), `numberRowShown(open, count)`.

## Files

`weapons/charges.js`, `ui/actions.js`, `index.html`, `test/remote-numbers.test.mjs` (new), `README.md`, `CHANGELOG.md`.

## Out of scope

Keyboard shortcuts for single charges, numbers on timed charges, reordering numbers, a count on K's hint text.
