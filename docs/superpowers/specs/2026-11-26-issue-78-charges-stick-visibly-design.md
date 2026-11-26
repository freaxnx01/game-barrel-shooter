# Charges stick visibly and leave the structure alone (#78)

Playtest feedback on the chimney after #62 and #71: a thrown remote charge does not stay visibly stuck on the outside. It disappears into the object, and bricks fall out although nobody pressed K or Boom. The timed charge must stick visibly too. Sticky-charge design: `docs/superpowers/specs/2026-11-25-issue-62-sticky-charges-design.md`.

## Reproduction (measured, not guessed)

Setup: a scratch copy of the game with debug hooks. Remote charges were thrown straight at the chimney from 2 m in front of the drawn outer face at 15 m/s. Physics was stepped by hand at `phys.step(1/60)`, the same call the frame loop makes. No detonation. Then 10 s of simulation with the block positions logged.

| Throw | Stuck at (radial, m) | Drawn outer face (m) | After 10 s, in the partner block's frame |
|---|---|---|---|
| foot, block centre | 4.07 | 4.00 | (0, -0.12, 0): **the block's centre** |
| foot, seam | 3.28 | 4.00 | (0, -0.12, 0) |
| mid (course 21), block | 3.27 | 3.16 | (0, 0.12, 0) |
| mid, seam | 2.74 | 3.16 | (0, -0.12, 0) |
| top (courses 36-42), 6 charges | on the face or in the seam | | **56 blocks moved, the farthest 692 m** |

There are two separate causes. The first one is the main bug.

1. **The fixed joint drags the charge into the piece's centre.** `addFixedJoint(a, b)` passes `point1` = the charge's position and `point2` = the piece's position (`physics/backend-crashcat.js:248-253`). In world space, crashcat stores each point relative to its own body's centre of mass. Fetched source of crashcat@0.0.5: `localSpacePosition1 = point1 - a.centerOfMass`, `localSpacePosition2 = point2 - b.centerOfMass`. Both offsets are therefore 0, and the constraint pulls the two centres together. Every charge ends up inside its block: hidden, and overlapping the block and its neighbours. The foot and mid blocks are heavy enough to stay put. The lighter top courses are thrown apart by the solver: 56 blocks moved with no detonation. That is the "self-detonation". The barrel pyramid shows the same sinking: the charge goes from 0.57 m to 0.16 m from the barrel axis, inside its 0.47 m radius.
2. **Charges slip into the seams behind the wedge mesh.** The ring blocks are boxes sized at the inner radius (`targets/chimney.js:62`). Since #71 the drawn wedge closes the V-shaped gap between them. A charge aimed at a seam passes the drawn surface and first touches a box side face 0.72 m deeper (foot: radial 3.28 vs 4.00). It sticks there, hidden, with the neighbouring block as its partner. Even with cause 1 fixed alone, the seam charges stayed at 3.28.

With only cause 1 fixed in the scratch copy, no block moved in 10 s, top included (max 4.8 cm, which is settling). The seam charges were still hidden.

## Design

### 1. The fixed joint holds the pose it was made at

In `physics/backend-crashcat.js`, `addFixedJoint(a, b)` passes the same world point, the position of `a`, as `point1` and `point2`. Each body keeps its current offset to that point, so the joint welds the two bodies in their current relative pose. That is what "fixed joint" means everywhere else in the game. Used by the charges (`chargeStick`) and the harpoon (`harpoonStick`, `index.html:2221`). The harpoon is dragged into the barrel's centre today too, and will now hold where it hit.

### 2. A stuck charge collides with nothing

A new backend call, `setCollides(h, on)`, sets `h.raw.collisionMask` to `0xffffffff` or `0`. crashcat filters every body pair on each step with `(groupsA & maskB) && (groupsB & maskA)`. This was read from the fetched source, where the default for both is `0xffffffff`. A zero mask therefore drops all of the charge's contacts. `chargeStick` calls `phys.setCollides(rec.body, false)` once the charge is stuck (joint or freeze). A charge lying on a drawn surface that is slightly smaller than its collider can no longer push the piece. Example: the barrel drum, where the charge's underside sits 3 cm inside the 0.47 m collider. Other pieces and projectiles pass through a stuck charge, which weighs 0.1 kg anyway.

### 3. Stick where the flight path first meets a drawn piece

Before each `phys.step(dt)`, a new `stickChargesAhead(dt)` in `index.html` handles every flying charge (not stuck, not exploded, speed > 0.5 m/s):

- It casts a `THREE.Raycaster` ray from the charge's centre along its velocity. Length: `chargeReach(speed, dt) = speed * (dt + 1/240) + 0.21`, which is one frame of flight plus one physics substep plus the charge's half diagonal.
- It tests the ray against the drawn target meshes (`barrels[].mesh`, recursive).
- On a hit, `pieceOf(hit.object, barrels)` walks up the parents to the piece. The face normal goes to world space with the normal matrix, because the meshes are scaled non-uniformly (`addBlock`).
- `flushPose(point, normal)` places the charge flat on the face. Its centre sits `halfExtents[1]` = 0.08 m out along the normal, and its local +Y (detonator box, LED, antenna) points along the normal.
- After that pose is set, `chargeStick(rec, piece.body)` runs, so the joint welds this pose.

The physics contact path (`onCollide` → `chargeStick`) stays as the fallback for anything without a mesh hit: the ground, a rare exact seam (see below), a corner clipping a collider first. The pure helpers (`chargeReach`, `quatFromUp`, `flushPose`, `pieceOf`) live in `weapons/charges.js` with unit tests.

### Unchanged (#62)

- No impact damage: mass 0.1 kg.
- Rides along with the piece: rigid joint.
- Blasts skip charges (`explode`, `index.html:1958`).
- 6-remote cap.
- Cull rules: `stuck` is exempt, and `y < -5` only applies with a joint.
- `explode()` still reads `rec.body.position`, which is now on the surface.

## Proof (scratch copy, design 1 + 2 + 3)

| Check | Before | After |
|---|---|---|
| Chimney foot/mid, aimed at the face and 0.3-1° beside a seam: charge position in the partner's frame | block centre (0, ±0.12, 0) | local z = 0.83 / 0.68 = hz + 0.08, flush on the drawn face |
| Blocks moved > 10 cm after 10 s, 6 charges | foot/mid 0, top 56 | 0 (foot/mid and top) |
| K after 10 s | | 516/516 chimney blocks moved, 0 charges left |
| Timed charges | | same positions as remote, flush |
| Barrel pyramid, 5 charges | sink to 0.16 m from the axis | stay at 0.52 m (surface); K moves 21/21 |
| Top barrel knocked 17 m with a charge on it | | charge keeps its local offset (0.061, -0.008, 0.518) |

A close-up screenshot shows no charge at all before the fix. After it, three charges sit on the brick face with the detonator facing out.

## Rejected alternatives

- **Snap at the physics contact with the manifold point and normal.** In a seam, the first contact is a box side face 0.72 m inside the drawn surface, so the contact point and normal are already hidden.
- **Collider bigger than the seams.** At the foot the gap on the outer face is about 0.78 m. The charge would need to be bigger than the drawn charge, which changes its flight and look.
- **Wedge-shaped (convex hull) chimney colliders.** That changes how the chimney falls, and #71 kept boxes on purpose.
- **Drop the charge body and parent a mesh to the piece.** `explode`, the cull, `removeProjectile`, the cap and the mesh sync all read `rec.body`, so this touches far more code than a mask and a joint anchor.
- **Collision-off only, without the joint fix.** The joint would still drag the charge into the block's centre, hidden.

## Limits

- A ray that runs exactly along a seam passes through the 2 × clearance sliver between two wedges (8 mm at TSCALE 2) and misses both. In the scratch copy this happened when aiming at exactly 15.0°; at 15.5° the charge stuck on the face. Such charges fall back to the contact stick inside the seam. They are hidden but harmless, thanks to designs 1 and 2.
- The ray tests the meshes at last frame's pose. A piece that moves fast in this frame can be missed. The contact fallback then catches it.
