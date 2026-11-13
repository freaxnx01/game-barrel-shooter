# Sniper bullet: fast straight tracer round (#30)

## Why

A tester said the **Sniper lens** "should be more like a bullet flying in a straight line". Today the round is a
golden 0.14 m sphere (`mesh = new THREE.Mesh(ballGeo, ...)` in the `type === 'sniper'` branch of `shootBall()` and
its mesh builder, `index.html`) with mass 6, launched at `42 + power * 18` m/s under full gravity. It drops about
0.8 m over 20 m and looks like a ball.

## Decision (owner)

The owner decided: the sniper round becomes a **fast straight projectile**.

- A visible tracer round, roughly 150-250 m/s.
- No gravity (or effectively none), so it flies dead straight to the crosshair.
- It still hits barrels physically, with momentum.
- Not hitscan, and no visible drop.

The zoomed lens (FOV 26 in `setAmmo()`) stays unchanged.

## Design

### Flight

| Property | Today | New |
|---|---|---|
| Collision shape | sphere r 0.14 | sphere r 0.1 |
| Mass | 6 kg | 1.0 kg |
| Speed | `42 + power * 18` (42-60 m/s) | `160 + power * 80` (160-240 m/s) |
| Gravity | full (factor 1) | factor 0 until first contact |
| Motion quality | LINEAR_CAST (`fast`) | LINEAR_CAST (unchanged) |

- **No gravity.** The body is created with `gravityFactor: 0`, so the round travels exactly along the camera ray
  through the crosshair at any distance. (Under full gravity at 200 m/s it would still drop 4.9 cm over 20 m and
  1.2 m over 100 m; "dead straight" was the decision, so the factor is 0, not small.)
- **Gravity returns on first contact.** In the collide callback the round gets `gravityFactor = 1` back. Without
  this, a round that glances off a barrel or the ground keeps sliding at speed forever instead of dropping.
- **Cull.** A zero-gravity round that misses everything would fly for the 12 s cull time (about 2.4 km). It is
  removed once it is 150 m from the muzzle (past every target set) or at the existing cull time, whichever is first.
  The existing `body.position.y < -5` cull never fires for a straight round.

### Tunnelling: measured, no raycast needed

At 200 m/s and the facade's fixed 1/240 s step (`physics/backend-crashcat.js`, `FIXED = 1/240`, at most 10 substeps
per frame; a 1/30 s frame is 8 substeps, inside the cap), the round moves 0.83 m per step. Barrel physics radius is
`BARREL_R * 1.05 = 0.4725` m. Probed on crashcat 0.0.5 in node through the real facade, sweeping 135 start
phases over one step (0.9 m) and 9 lateral offsets (-0.4 to 0.4 m) against a mass-8 barrel:

| Motion quality | 160 m/s | 200 m/s | 250 m/s |
|---|---|---|---|
| `LINEAR_CAST` (what `fast: true` sets) | 135/135 hit | 135/135 hit | 135/135 hit |
| discrete | 135/135 | 135/135 | 133/135 |

A thin test: a 0.1 m thick static wall at 240 m/s, 40 phases: `LINEAR_CAST` stopped the round 40/40, discrete only
10/40. crashcat 0.0.5 has working continuous collision detection through `MotionQuality.LINEAR_CAST`, and
`sniper` is already in `fastProjectiles` (`index.html`). **So no per-step raycast sweep is added.** The plan adds a
regression test (thin wall) so a future change of `fast` handling cannot silently reintroduce tunnelling.

### Hit impulse: momentum matched, not energy

Today's round carries 252-360 kg m/s. Barrel peak speed after a centred hit at 20 m (measured, same probe,
barrel mass 8):

| Round | Barrel peak speed |
|---|---|
| today, m 6, 42 m/s (power 0) | 19.2 m/s |
| today, m 6, 60 m/s (power 1) | 27.5 m/s |
| new, m 1.0, 160 m/s | 19.2 m/s |
| new, m 1.0, 200 m/s | 24.3 m/s |
| new, m 1.0, 240 m/s | 29.2 m/s |
| m 6 kept at 200 m/s (rejected) | 93.8 m/s |

Mass 1.0 with 160-240 m/s reproduces today's 19-28 m/s barrel response, so the round is not a wrecking ball. Kinetic
energy goes up (20 kJ vs 7.8 kJ at mid power), which is why the barrel response, not energy, was the tuning target.

### Tracer visual

The round is no longer a gold ball but a tracer:

- **Core:** a bright capsule (radius 0.045 m, length 0.5 m), emissive warm white-yellow (`#fff1b0`), unlit
  (`MeshBasicMaterial`), oriented along the velocity every frame (like the spear). Smaller than the physics sphere
  (r 0.1) on purpose: it reads as a bullet, the hit sphere stays forgiving.
- **Streak:** behind the core, a stretched cone/cylinder 3 m long, additive blending, `#ffb347` fading to transparent
  (vertex-colour or alpha gradient), no shadow. Its length is capped to the distance already flown, so it never
  pokes behind the muzzle or through the camera.
- **Shadow:** the round casts no shadow (`castShadow = false`); an elongated 200 m/s shadow only flickers.
- **After first contact** the streak fades out over 120 ms and the core is shown as is while the round tumbles.
- Shot sound is unchanged (`playShoot(power)`).

## Out of scope

- Hitscan or ray cast hit detection.
- Retuning other weapons or crashcat settings.
- The Magneto (#29) and the barrel support check (#28), which touch other code.

## Consequences

See the issue body (`## Consequences`).
