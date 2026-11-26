# Charges fly straight to the crosshair (#90)

Playtest wish: remote and timed charges land where the crosshair points, not on a physical arc. Decided in the issue: the charge flies fast and straight, with no gravity until its first contact (like the sniper round, #30), along the crosshair ray, and sticks where it hits (#78 flush placement).

In scope: the launch of the remote charge (key B) and timed charge (key Z). Everything else found along the way gets written down, not acted on.

## Today

- `chargeLaunch(dir, power)` in `weapons/charges.js` adds `CHARGE.lift` (0.28) to the aim and returns 12 to 26 m/s. The charge then falls under gravity, so it often lands short of the chimney.
- The sniper (`weapons/sniper.js`, `sniperSpeed`) is created with `gravityFactor: 0`; its first `onCollide` restores gravity to 1, and `isOutOfRange` culls it after `SNIPER.cullDistance`.
- `shootBall` in `index.html` computes `start = camera.position + dir * 1.2` and calls `chargeLaunch` in the per-type speed chain.
- `stickChargesAhead(dt)` raycasts along the velocity with `far = chargeReach(speed, dt)` and snaps the charge flush on the first drawn face (`flushPose`, `chargeStick`, #78). The physics contact stays the fallback.

## Design

### 1. Launch: exactly the crosshair ray

`CHARGE.lift` is removed. `chargeLaunch` returns the normalised aim direction unchanged. Speed stays power-scaled, but fast: `speedBase` 40, `speedPower` 20, so 40 to 60 m/s. The charge-up bar behaves as for the other weapons (`power` 0..1); it only changes the speed, never the direction. At 40 m/s a charge crosses 40 m in 1 s, so it is still visible in flight, and the drop it would have had is gone.

### 2. No gravity until the first contact

`shootBall` creates the charge body with `gravityFactor: 0` (as for the sniper). Gravity comes back at the first contact, inside `chargeStick`:

- plan `joint`: gravity back to 1, as before #90 (the fixed joint carries a 0.1 kg charge).
- plan `freeze`: stays 0 (existing behaviour, it hangs where it is).
- plan `ignore` on a flying charge (it touched another projectile): gravity back to 1 so it falls. An already stuck charge is left alone.

Fast projectile flag: both charges join the `fastProjectiles` set so the physics step does not tunnel a 60 m/s box through a thin collider. The raycast of #78 stays the main stick path.

### 3. Misses

A charge that flies `CHARGE.flightRange` (100 m) from its muzzle without any contact gets gravity back and falls, like any other projectile. A new pure helper `chargeOutOfRange(start, pos)` decides, and the per-frame loop in `index.html` calls it once per charge (`rec.hit` guards a second call). After that the existing rules apply unchanged: the ground sticks it (ground counts as a contact), `y < -5` removes a non-stuck one, a remote charge is exempt from the 12 s cull while unexploded, and `canPlaceRemote` still caps armed remotes at 6. No new cull.

### 4. Interplay with #78

`chargeReach(speed, dt)` is `speed * (dt + 1/240) + halfDiagonal`, so the look-ahead scales with speed: at 60 m/s and 60 fps it is about 1.5 m, covering the 1 m the charge travels in a frame. A new test pins this property for the new speed range. `flushPose`, `quatFromUp` and `stickChargeOnFace` are untouched, so the flush snap works as before. The tumble set at launch (random angular velocity) is harmless: the snap overrides orientation.

### 5. Timed charges

Same flight. The 4 s fuse (`isFuseDone(b.born, now)`) starts at the throw, as today. The 100 m range is passed in 2.5 s at 40 m/s, so a miss gets gravity back before the fuse ends.

## Later charge types (#87)

A new cutting charge that shares the remote charge's launch (#87) must reuse `chargeLaunch`, `CHARGE.speedBase/speedPower` and the gravity-off launch in `shootBall`. Add its type next to `remotecharge` and `timedcharge` in the same branches instead of copying the logic.

## Assumptions

- **A1** Power scales speed only (40 to 60 m/s); direction is never touched by power.
- **A2** Misses get gravity back after 100 m instead of being culled.
- **A3** Gravity returns inside `chargeStick`, so both the contact and the raycast stick paths are covered.

## Tests

Pure tests in `test/charges.test.mjs`: speed range, clamping, direction equals the aim (flat, up, down, sideways), `chargeOutOfRange`, `chargeReach` covers one frame of flight at max speed. Wiring is not unit-testable (no DOM); one optional cheap visual check: aim at the chimney from the default camera and see the charge stick at the crosshair.
