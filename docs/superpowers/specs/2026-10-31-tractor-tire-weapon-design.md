# Rolling tractor tire weapon (#8)

## Intent

A big tractor tire as a new weapon. It doesn't fly like the other ammo. It is set
down upright on the ground in front of the player and **rolls** into the target, heavy
enough to plough through a structure instead of bouncing off. When it runs out of
speed it wobbles, falls on its side and lies flat, like a real tire.

The user agreed this design in chat on 2026-10-24. It is recorded in a comment on #8.

## Goals

- **Picker and key:**
  - New ammo **Tractor tire** in the *Heavy & melee* group of the ammo picker,
    after Spear.
  - Key **T**, which is currently unused (see the keydown handler in `index.html`).
- **Launch:**
  - Spawns upright on the ground in front of the camera.
  - Rolls along the ground toward the aim direction.
  - Holding the mouse longer makes it roll faster. It uses the same 0–1 charge
    `power` as every other weapon.
- **Size and weight:**
  - About 1.6 m tall, the height of two barrels.
  - Heavy, so it pushes through blocks and barrels rather than stopping at the first
    one.
- **End of the roll:** when it is slow it tips, wobbles and comes to rest lying flat.
  After that it is culled like other spent ammo, using the existing 12 s `cullTime`.
- **Look:** black rubber with chunky tread blocks and a yellow tractor rim with a hub.
  It is procedural, with no image assets.
- **Sound:** a low rolling rumble while it rolls, fading with speed, plus the existing
  impact sound (`playBounce`) on hits.

## Non-goals

- Bouncing or jumping.
- Steering after launch.
- Explosions.
- Using the tire as a target or obstacle. That was the original idea; the user
  decided against it.

## Anti-goals

- A tire that flies through the air like a ball. It must start on the ground.
- A tire that rolls forever or keeps standing upright at rest.
- A rumble sound that keeps playing after the tire stops or is culled.

## Decided physics (mine, recorded)

- **Collider:**
  - A crashcat `cylinder` (`phys.addBody` shape `{ kind: 'cylinder', radiusTop: 0.8,
    radiusBottom: 0.8, height: 0.55 }`).
  - Its local Y axis is turned horizontal, perpendicular to the roll direction.
  - Material `'heavy'`.
- **Mass:** 40. The barrel is 8 and the wrecking ball 22.
- **Spawn:**
  - 2.5 m in front of the camera along the horizontal aim direction, at
    y = radius + 0.01.
  - When the aim is nearly vertical (horizontal part < 0.1), use the camera's
    horizontal forward instead.
- **Speed:** `8 + 12 * power` m/s, horizontal.
- **Spin:** rolling without slip, `ω = (up × v) / r`. It must not skid on the first
  frames.
- **Rolling resistance:**
  - A crashcat cylinder rolling without slip loses almost no speed. The game therefore
    slows the tire itself each frame while it is upright: horizontal speed drops by
    `2.0 m/s²`, and ω is scaled by the same factor so it doesn't start skidding.
  - Rough stopping times, from 8 m/s and from 20 m/s, are 4 s and 10 s on open
    ground. Hits slow it sooner.
- **Tipping:**
  - A spinning symmetric cylinder doesn't fall over by itself, so the nudge is
    **always** part of the design. It is not a fallback.
  - Trigger: horizontal speed below 2.5 m/s while the axle is still within 30° of
    horizontal.
  - Effect: a small angular velocity about the roll direction, magnitude 1.5 rad/s,
    sign random. It is applied at most once per tire.
  - After it tips, rolling resistance stops being applied and the physics takes over.
- **Verification:**
  - The pure functions (launch, resistance, tip decision) are unit-tested.
  - Whether the tire actually wobbles and lies flat is checked in the manual
    in-browser playtest. There is no headless physics check.

These live in a pure module, `weapons/tire.js`, with no THREE and no physics, so
`node --test` can check them. `index.html` does the mesh, the sound and the per-frame
call.

## Left to the builder

- **Tread look:**
  - number and size of tread blocks (about 20–28 chunky blocks)
  - rim proportions and colour shade, within "tractor yellow"
- **How the rumble is built.** For example, looped low-passed noise with a gain that
  follows speed. It must stop when the tire is culled or the game resets.
- **The picker dot style** for the new button, matching the existing `.dot` spans.

## Consequences

- On platform targets (Barrels, Wooden Barrels, Cards) the tire hits the side of the
  0.5 m platform before it reaches the targets. It still knocks the platform's contents
  about, but that is not tuned.
- #24 (new targets) also edits `index.html` (the target picker, `camCfg`). The two
  branches touch different regions, so a rebase is expected to be clean, but they
  should not be implemented at the same time.
