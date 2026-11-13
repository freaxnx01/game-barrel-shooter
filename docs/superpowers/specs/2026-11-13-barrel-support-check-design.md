# Barrel support check — design (#28)

## Why

A tester played the barrel pyramid, knocked one barrel out of row 2 with the ball, and the two
barrels in row 3 that stood half on it stayed upright over the gap. His verdict: "ich find da ned
realistisch". The owner wants the behaviour to be **realistic**.

The headless investigation in #28 (comment of 2026-11-13, "Headless reproduction") found:

- It is not a crashcat regression: the old cannon-es backend behaves identically.
- A lone barrel whose centre of mass (COM) is past the rim of its support tips over correctly.
- In the pyramid, the rows above lock the barrels over the gap in place (a friction-locked arch).
  They stay put even when all barrels are kept awake, even with spacing widened to 41 cm, and with
  friction down to 0.1. Only friction 0.05 plus wide spacing releases them.
- Secondary: after the hit barrel leaves, the barrels around the gap stay asleep, because
  `wakeAroundMovers()` (`physics/backend-crashcat.js`) only wakes neighbours of bodies moving
  faster than 0.2 m/s.

So physics tuning alone cannot fix this without breaking the pyramid at rest. The owner chose a
**barrel support check**, like the stone `collapseUnsupported()` that existed before `c33018a`.

## What "realistic" means here (agreed with the owner)

- **Only barrels that really lost their footing move.** A barrel whose COM still sits over a
  remaining support stays put, even if one of its supports is gone. A barrel whose COM is past
  the edge of everything that still holds it must go.
- **Physics does the falling, not an animation.** The check only breaks the lock: it wakes the
  unsupported barrel and gives it a small push toward the side where it overhangs. Tipping,
  rolling and landing are normal physics afterwards.
- **Chain reaction.** When a barrel falls, the barrels above it may now have lost their footing
  too; the next run of the check catches them. The stack slumps from the gap upward. It does not
  drop all at once.
- **No visible pop or snap.** The push is just big enough to start a tip. A viewer sees a tip and
  slide, never a jump.

## Scope

- **In:** the oil-barrel pyramid (`barrels` mode, `setupBarrels()`) and the wooden-barrel pyramid
  (`woodbarrels` mode, `setupWoodBarrels()`). Both use upright cylinders with the `barrel` material
  (`createBarrel()`, `createWoodBarrel()` in `index.html`). Including wood was the agent's call:
  same layout, same material, same problem.
- **Out (non-goals):** stone buildings, house of cards, Eiffel, APK buildings, bowling pins, any
  other target; physics engine or material retuning; changes to weapons; the general crashcat
  wake logic in `backend-crashcat.js`.
- **Anti-goals (a failure even if it "works"):**
  - an intact pyramid that slumps, wobbles or loses barrels with nobody shooting at it;
  - barrels that visibly jump, pop or get flung by the check;
  - the whole upper pyramid collapsing because of one corner barrel that would hold in reality;
  - a noticeable frame-time cost.

## Behaviour

### When the check runs

- Only in modes whose target pieces are barrels (`barrel` material), i.e. the two pyramids.
- Only after the structure has been disturbed (some barrel has moved or a shot hit it), then
  periodically, a few times a second (the old stone check used ~120 ms), while anything is still
  settling. When the scene is at rest it stops costing anything.

"Disturbed" (agent's call): a projectile or other body has touched a barrel, or any barrel has
moved faster than a small threshold or turned `down`. A hit that moves nothing measurable doesn't
start the check. That's fine: if nothing moved, no support was lost.

### Which barrels are checked

Barrels that are still upright and resting: not `down`, small tilt, slow. Barrels that are already
falling, rolling or lying on their side are left to physics.

### Support test

For each checked barrel, find what it rests on: the ground or platform, or other barrels whose top
face touches its bottom face (vertical gap within a small tolerance, horizontal overlap of the two
discs). The barrel counts as **supported** if its COM, projected onto the horizontal plane, lies
within the region spanned by its contact patches with those supports (for one support: inside that
support's disc; for several: inside the convex hull of the patches), with a small tolerance.

Supports are the static platform body (`platBody` in `index.html`; both pyramids have
`plat: true` in the mode table) and the ground, plus other `barrel`-material bodies. Barrels never
rest on other target types in these two modes.

The **COM tolerance** must stay well under the 4.5 cm overhang of the #28 case. Agent's call:
about 1–2 cm. At rest, a barrel over two supports has its COM in the middle of the hull spanned by
both patches, far from its edge, so a small tolerance gives no false positives there.

At rest, every barrel in either pyramid passes this test. In the #28 scenario, the two row-3
barrels over the gap fail it: each has its COM about 4.5 cm past the rim of its one remaining
support.

### What happens to an unsupported barrel

1. Wake it, and wake every barrel resting on it.
2. Apply a small push toward the overhang side: horizontally from the support region toward the
   COM, plus enough tipping rotation to start the fall. Size it so the barrel tips into the gap
   but does not visibly jump. Scale it with the barrel's mass so oil and wood barrels behave
   alike.
3. Don't push the same barrel again on every run: once it is tipping, physics takes over.
   If a barrel is still upright and still fails the support test a while after its push (the
   rows above can hold it, see #28), push it again with the same small push, a bounded number of
   times. Agent's call on priorities: **realism wins over "push once"**, and **"no pop" is a hard
   limit**. Several small pushes are fine; one big shove is not.

### Chain reaction

The check runs again on its normal period. Barrels above a fallen one are tested against their now
changed supports, and fall only if they fail the test themselves.

## Constraints

- Buildless vanilla JS, as in the rest of the repo. No new dependencies.
- **TDD per the repo `CLAUDE.md`:** the support test and the push direction/size live in a pure
  module with no engine and no DOM, unit-tested with `node --test` like `test/tire.test.mjs` and
  `weapons/tire.js`. `index.html` only wires the module into the game loop and the physics facade.
- Go through the `phys` facade (`physics/backend-crashcat.js`). Don't reach into crashcat
  internals from game code. The facade already has what the push needs: `position`/`quaternion`
  on each handle, `getVelocity`, `getAngularVelocity`, `setAngularVelocity`, `applyImpulse` and
  `wake`. Adding a small facade method (for example an angular impulse) is allowed if it's really
  needed. That isn't the "wake logic" ruled out of scope.
- Must not change behaviour in any non-barrel mode.

## Acceptance criteria

- [ ] **At rest:** both pyramids, left alone for 10 s after building, report zero unsupported
      barrels, and no barrel moves (all `down === false`).
- [ ] **#28 scenario:** in the oil-barrel pyramid, with the middle barrel of row 2 (counting from
      the bottom) removed or knocked out backwards, both row-3 barrels that rested on it tip
      toward the gap (tilt > 15° or `down === true`) within 3 s.
- [ ] **Same scenario in the wooden-barrel pyramid** gives the same result.
- [ ] **Chain:** after those row-3 barrels fall, any barrel above them whose COM is no longer over
      a support also falls. Barrels whose COM is still supported stay upright.
- [ ] **Holding case:** knocking out the single top barrel moves no other barrel.
- [ ] **No pop:** no barrel gets an upward velocity above a small threshold from the check, and the
      check never pushes a barrel that passed the support test.
- [ ] **Other modes untouched:** the check doesn't run in any non-barrel mode.
- [ ] Unit tests for the pure module pass, and the full `node --test` suite stays green.

## Left to the builder

- The module name and location (for example `targets/barrel-support.js`), and its function
  signatures.
- Exact tolerances (contact gap, COM margin, tilt limit for "upright"), the check period, and the
  push size, within the anti-goals above. The #28 measurements give the geometry: barrel physics
  radius `0.45 * 1.05`, row offset `0.45 * 2.3 / 2`, height `1.1`, mass 8.
- How "disturbed" is detected, as long as an untouched pyramid never runs the support test.
- Whether to verify the scenarios with a headless harness page like `test/harness/`. The #28
  investigation used a page that builds the pyramid on the real backend and removes one barrel.
