# Auto-Play CPU Mode — Design

Issue: [freaxnx01/game-barrel-shooter#3](https://github.com/freaxnx01/game-barrel-shooter/issues/3)

## Problem

Add an auto-play CPU mode that plays the game on its own, using the default
loadout (basketball ammo vs. the 21-barrel pyramid), clearing it as
efficiently as possible — as few shots as possible.

## Architecture

A single boolean flag, `autoPlay`, plus a small state machine
(`idle` → `aiming` → `firing` → `settling` → back to `aiming`, or `idle` on
win) driven from the existing `requestAnimationFrame` render loop. No new
timers, no duplicate physics polling.

## Aiming

Bypasses the mouse/raycaster path entirely. Each cycle:

1. Find the nearest still-standing barrel (`!b.down`, using the existing
   per-barrel `down` flag) by straight-line distance from the camera.
2. Compute `dir = barrel.mesh.position.clone().sub(camera.position).normalize()`.
3. Call the existing `shootBall(dir, 1.0)` directly — full power every shot.

No screen-space projection is needed since the direction is computed directly
in 3D world space.

## Pacing

After firing, wait for the scene to settle: poll each frame whether every
body in `balls` and `barrels` has linear velocity below a small threshold
(`0.05`), then aim/fire the next shot.

A per-shot timeout (~5s) is a safety net against a shot that never fully
settles (e.g. a slow roll) — it proceeds to the next shot rather than
hanging forever. This is a pacing guard only, not an overall stuck-detector.

## Controls

- New "▶ Auto-Play" button next to the existing Reset button.
- Toggling on sets `autoPlay = true` and starts the state machine.
- Toggling off (or clicking again) sets `autoPlay = false`; the in-flight
  shot is allowed to finish, then the loop stops.
- While active, the existing `pointerdown`/`pointerup`/ammo-key/target-switch
  handlers early-return (guard clause) so manual input is ignored. Orbit
  camera (right-click drag) still works — it doesn't affect gameplay state.

## Completion

Reuses the existing win check (`down === barrels.length`). When true,
auto-play stops itself and the button reverts to idle — same as manual
play's existing win-color feedback on the score HUD. No shot cap.

## Testing

No test harness exists in this repo (static `index.html`, no build/test
tooling). Verification is manual in-browser:

- Toggle auto-play; confirm it fires only basketballs at the barrel pyramid.
- Confirm all 21 barrels clear without any manual input.
- Confirm auto-play stops itself on the win condition.
- Confirm the shot counter reflects real fired shots (no double-counting).
- Confirm toggling off mid-run stops cleanly after the in-flight shot settles.
- Confirm manual controls (aim/fire, ammo keys, target switch) are ignored
  while auto-play is active, and work normally again after it stops.

## Out of scope

- Targeting strategies smarter than nearest-standing-barrel (e.g. predicted
  chain-reaction / cluster-density aiming).
- An overall shot cap or stuck-game detection.
- Auto-play for any target other than the default barrel pyramid.
