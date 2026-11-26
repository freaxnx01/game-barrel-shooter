# Paintball only colours (#82)

## Problem

The paintball is a 0.5 kg sphere (`index.html` `cfg.paintball`) fired at 18–40 m/s
(`shootBall`, default `speed = 18 + power * 22`), so it puts up to 20 N·s into what it hits
and knocks stone buildings apart. `paintSplat()` also leaves a splat sphere (`splatGeo`,
`paintSplats`) at the impact spot. The playtester wants it to only colour the struck piece.

## Design

- **Almost no force.** The paintball's mass drops from 0.5 kg to 0.01 kg, kept as
  `PAINTBALL.mass` in `weapons/paintball.js`. At the top speed of 40 m/s that is 0.4 N·s,
  1/50 of today. Zeroing velocity in the collide callback cannot work, because crashcat
  queues collisions and dispatches them after the step, so the contact impulse is already
  solved (same reasoning as #62's charges). The lightest stone blocks weigh tens of kg
  (`massFor` = 170 × volume), so 0.4 N·s moves them by millimetres per second.
- **No splash.** `paintSplat()` keeps recolouring the struck piece and removing the ball, and
  no longer adds a splat mesh. `splatGeo`, `paintSplatMatls`, the `paintSplats` array and its
  cleanup in the target reset are removed (dead code otherwise). A miss (ground, platform) leaves
  nothing.
- Unchanged: palette, picker, random mode, flight (speed and arc), the impact sound.

## Tests

`PAINTBALL_MaxMomentum_UnderHalfNewtonSecond`: `PAINTBALL.mass * 40 <= 0.5`.

## Out of scope

The colour picker's visibility (#81).
