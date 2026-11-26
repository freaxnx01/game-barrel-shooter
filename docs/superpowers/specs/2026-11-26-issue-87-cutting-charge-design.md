# Cutting charge: a small blast for controlled demolition (#87)

## Goal

Remote charges throw the upper parts of a building around (radius 4, strength 500,
extra upward kick). For a controlled demolition (companion #86, a high-rise of slabs
on slim columns) the player needs a charge that breaks the piece it sits on and lets
the rest fall under gravity. Bomb, dynamite, remote and timed charge stay as they are.

## Design

**A separate weapon, type `cutcharge`**, "Cutting charge", key `Y`, in the Explosives
group of the weapon sheet. It shares everything with the remote charge: launch
(`chargeLaunch`), flush sticking (#78), the number label and the 6-charge cap (#79),
and detonation by K, Boom or the number buttons. Only the look and the blast differ.
`armedRemotes()` counts both types, so numbers 1..6 are shared and Boom works on both.

**Why not a toggle:** a toggle needs a new button on mobile and state that changes how
an already placed charge behaves. A weapon needs only a picker entry and a key, and
the player can mix a cutting charge and a remote charge on one building.

**Blast, pure and tested (`weapons/charges.js`):**

- `CUT = { radius: 1.2, strength: 260, lift: 0, shove: 160, ... }`.
- `blastImpulse(offset, radius, strength, lift)`: the existing radial falloff as a
  pure function (`lift` defaults to 0.3, the value `explode()` uses today, so old
  blasts are unchanged). Returns `null` outside the radius. The cutting mode passes
  `lift = 0`.
- `cutShove(offset, strength)`: a horizontal impulse on the piece the charge is stuck
  to, pointing from the charge to that piece's centre (fixed `+x` when they are
  vertically aligned). Applied even when the piece centre is outside the 1.2 m radius,
  because a slab or column centre can be metres away from the charge.

**"Breaking the piece it sits on" = a strong sideways shove, not a removal.** Removal
would need bookkeeping in each target's piece list and leaves no debris. A shove of
about 20 m/s on an 8 kg piece knocks a column out of the line of support, which is
exactly what a cut looks like, and what sits on it falls. The stuck-to body is
remembered as `rec.stickBody` in `chargeStick()`. Static bodies (ground) get no shove.

**explode()** gets a fourth argument `opts = { lift, shove, flash }` (defaults keep
today's behaviour). Charge bodies are still skipped (#62).

**Visual:** same brick as the remote charge but with two red bands and no antenna, a
red-orange LED, and a smaller flash (scale 0.5) with fewer debris particles.

**Timed charge** stays as it is. Its fuse gives no control over the moment, which is
the point of a controlled demolition.

## Ordering with #90

#90 changes how charges are launched (straight to the crosshair). The cutting charge
must call whatever `chargeLaunch` / the launch branch in `shootBall` does for the
remote charge when this lands: it joins the same `if` branch through `isChargeType()`,
it never has its own launch code.

## Out of scope

Chimney and other target tuning, the high-rise (#86), a cutting mode for the timed charge.
