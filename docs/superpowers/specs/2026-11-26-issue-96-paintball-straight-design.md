# Paintball flies straight to the crosshair (#96)

## Problem

The paintball uses the default launch in `shootBall` (`speed = 18 + power * 22` along the aim `dir`)
under full gravity, so it drops and falls short of distant targets. #90 already made charges fly
straight to the crosshair; the playtester wants the same for the paintball.

## Design

Same mechanism as #90, no new physics:

- **Launch:** speed `PAINTBALL.speedBase + power * PAINTBALL.speedPower` = 40–60 m/s, along `dir`
  (the crosshair ray, no lift). Pure helper `paintballSpeed(power)` in `weapons/paintball.js`.
- **Gravity:** the body is created with `gravityFactor: 0` (the same `addBody` option the sniper and
  charges use) and joins `fastProjectiles` (continuous collision, so a 60 m/s ball does not tunnel).
- **Hit:** unchanged. `paintSplat()` colours the piece and removes the ball on the first contact (#82).
- **Miss:** after `PAINTBALL.flightRange` = 100 m without a contact, gravity comes back
  (`paintballOutOfRange(start, pos)`), like `chargeOutOfRange` (#90). The 12 s cull and the
  y < -5 removal stay as they are.
- Mass (0.01 kg, #82) is unchanged: at 60 m/s that is 0.6 N·s, still far below what moves a stone block.

## Tests

`paintballSpeed` at power 0 and 1, and `paintballOutOfRange` below and at the range.
