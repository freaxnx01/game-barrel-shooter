# Per-frame forces act for the whole frame (#29)

## Problem

Since the switch to crashcat, Magneto barely lifts or gathers pieces. Measured headless against
the real backend (crashcat 0.0.5, Chromium, game call order `phys.step(dt)` then
`phys.applyForce(...)` once per frame, box of mass 5 on a Magneto-like force of `96 m + 9.82 m`
up, 0.5 s):

| fps | substeps/frame | y after 0.5 s | vy |
|---|---|---|---|
| 30 | 8 | 0.96 | 1.6 |
| 60 | 4 | 2.52 | 7.9 |
| 120 | 2 | 5.76 | 20.9 |

The result depends on the frame rate. A second probe applies only the gravity compensation
(`9.82 m`) for 1 s to a body that should hover at y=10: it ends at 5.74 (30 fps), 6.34 (60 fps),
7.55 (120 fps), so the body falls instead of hovering.

Cause: `crashcat.updateWorld` clears every body's accumulated force at the end of each call
(`resetForces`), and `step()` in `physics/backend-crashcat.js` calls it up to 10 times per frame
with a 1/240 s step (`FIXED`). `applyForce` is called once per frame, so only the first substep
receives the force.

## Scope

In scope (they call `phys.applyForce` once per frame, `index.html`):

- Magneto (`index.html:2190`)
- Harpoon reel-in (`index.html:2146`)
- Earthquake (`index.html:2204`)

Not affected: hurricanes. They use `phys.applyImpulse(... * dt)` (`index.html:2239`), and an
impulse is applied immediately, so it does not depend on the substep count.

Out of scope: retuning force strengths, the per-frame velocity damping in Magneto/harpoon, any
weapon change. Issue #28 (barrel support check, `index.html` and `targets/barrel-support.js`)
runs in parallel; this fix touches only `physics/backend-crashcat.js` and `test/harness/`.

## Design

`applyForce(h, x, y, z)` in the facade stops forwarding to crashcat. It adds the force to a
per-handle pending map (and still wakes the body). `step(dt)` re-applies every pending force with
`cc.rigidBody.addForce` before each `updateWorld` substep, and clears the map after the frame once
at least one substep ran. `removeBody` and `destroy` drop pending entries.

This gives the semantics cannon-es had, which the tuning assumed: a force set during a frame acts
for the following `step()`, over its whole duration, and is gone afterwards. Several calls for the
same body in one frame add up.

## Assumptions

- **A1** [high] Fix once in the backend facade, not per weapon. Rejected: editing three weapon
  blocks. The bug is a facade/engine semantics mismatch, and the facade contract comment says
  `applyForce` is "at centre of mass" with the old per-frame meaning
  (`docs/superpowers/plans/2026-10-19-crashcat-physics-switch.md:82`). One place also covers
  future weapons.
- **A2** [med] Persistent force re-applied per substep, not conversion to an impulse. Rejected:
  `applyImpulse(F * dt)`. An impulse is exact for a constant force but applies everything at the
  start of the frame, so gravity compensation (`+9.82 m`) would not cancel gravity during the
  substeps (gravity acts every substep, the impulse only in the first). The measured hover test
  needs force-per-substep. Hurricanes use the impulse pattern and are unaffected, which shows
  the two styles coexist.
- **A3** [high] Pending forces are cleared after a `step()` that ran at least one substep. A
  `step()` with zero substeps (dt below 1/240) keeps them, so a force is never lost. The
  10-substep clamp (`index.html:2122`, `backend-crashcat.js` `n < 10`) drops the accumulator,
  not the force.
- **A4** [med] The force is not rescaled by the actual frame dt: it acts for `n/240` s, where `n`
  substeps ran, which is within one substep of `dt`. Rejected: scaling by `dt / (n/240)`.
  Error is at most 1/240 s per frame, below tuning noise.
- **A5** [med] Magneto, harpoon and earthquake will become several times stronger at 60 fps
  (now the full intended force). No retuning in this issue. The strengths were tuned for
  cannon-es, which kept the force the whole frame. If it feels too strong, that is a separate
  tuning issue.

## Consequences

- Barrels held by Magneto now hover and rise as designed; the harpoon pulls at its intended
  force and the earthquake rattles harder.
- The game calls `step()` before `applyForce()` in `animate()`, so a force set in frame N acts in
  frame N+1: a constant one-frame lag, same as with cannon-es. A weapon starting from rest loses
  one frame of force; nothing to fix.
- Behaviour no longer depends on the frame rate (30/60/120 fps give the same result within one
  substep).
- `applyForce` called while no `step()` follows (for example at game reset) leaves a pending
  entry until the next `step()` or `removeBody`.

## Acceptance criteria

Headless check (plan Task 2) was run against the real backend with the fix applied: all four new
contract cases pass and the 15 existing ones stay green; without the fix, the first two fail
(hover drift -4.2/-3.6/-2.4 m at 30/60/120 fps).

- A body given `applyForce(0, m*9.82, 0)` once per frame (before `step`) hovers (|dy| < 0.05 m over 1 s) at
  30, 60 and 120 fps.
- A body given a constant lift force rises the same distance (within 5%) at 30, 60 and 120 fps.
- Two `applyForce` calls in one frame add up.
- A force is not applied again on the frame after (no call, no effect).
- `removeBody` on a body with a pending force does not throw in the next `step()`.
- The existing contract cases still pass.
