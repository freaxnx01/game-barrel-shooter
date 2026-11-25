# Sticky remote and timed charges (#62)

Playtest feedback: thrown remote and timed charges should stick where they land and do no impact damage. They still explode as before (remote: K / Boom, timed: 4 s fuse). Original design: `docs/superpowers/specs/2026-11-24-issue-54-detonators-net-paintball-design.md`.

## Problem

Charges are 2 kg dynamic boxes thrown at 12-26 m/s (`weapons/charges.js:5-9`) with no joint, so they bounce and knock pieces over. Up to 52 kg*m/s of momentum hits a piece on first contact.

## Design

**No impact damage: tiny mass.** The collision callback cannot prevent the knock. `onContactAdded` queues the event and `flushCollisions` dispatches it after the step (`physics/backend-crashcat.js:213`, `:225`), so the contact impulse has already been solved when our code runs. Zeroing velocity in the callback is too late. So the charge gets `CHARGE.mass = 0.1` (was 2). At 26 m/s that is 2.6 N*s, which barely nudges a piece. The pure guard `chargeMomentum()` is unit-tested to stay at or below 3 N*s.

**Stick on first contact.** In the charge's `onCollide` callback, the first contact (guarded by `rec.stuck`) calls a new `chargeStick(rec, other)` in `index.html`, modelled on `harpoonStick` (`index.html:2107`):

- zero linear and angular velocity (no bounce before the joint takes over),
- `phys.addFixedJoint(rec.body, other)`, stored as `rec.stickJoint`,
- `rec.stuck = true` (exempts the charge from the 12 s cull and the y < -5 cull, `index.html:3180`).

The decision lives in pure `chargeStickPlan(stuck, other)` in `weapons/charges.js`: `'ignore'` when already stuck, `'freeze'` when there is no `other` handle, otherwise `'joint'`.

**Ground and static geometry.** `other` is the static body, so the same fixed joint pins the charge to it. A joint to a static body is supported by crashcat's fixed constraint. If `other` is missing, the charge is frozen: velocity zero, gravity factor 0.

**Rides along.** The joint is rigid, so a charge on a piece moves with it, also when the piece is knocked away. The charge never detaches by itself.

**Explosion.** `explode()` already removes the charge body in a deferred `setTimeout(0)`. That block now removes `rec.stickJoint` first. The radial impulse is applied before the removal, so the stuck piece is blasted like any other. `removeProjectile` (reset, cull) also removes the joint before the body.

**Caps and timers.** Unchanged and compatible:

- `armedRemotes` counts non-exploded remote records, so stuck charges still count toward the cap of 6 (`weapons/charges.js:55`).
- The timed fuse is checked in the sync loop (`index.html:3103`) and fires regardless of sticking.
- `b.stuck` already exempts the cull (`index.html:3180`). After `explode` the record leaves `balls` through the deferred removal.

## Out of scope

- Visual change to the charge mesh, a sticking sound beyond the existing bounce.
- Sticking to charges placed on other charges beyond what the joint gives for free.
- Detaching when a barrel is removed individually (barrels are only removed in `reset`, which clears projectiles first).

## Testing

- Unit tests in `test/charges.test.mjs` for `CHARGE.mass`, `chargeMomentum`, `chargeStickPlan`.
- One cheap headless check (optional): throw a remote charge at a barrel with the page clock slowed (headless runs at about 5 fps and the 12 s cleanup would cull a shot before it lands), confirm `rec.stuck` and the barrel is not knocked over.
