// Remote and timed demolition charges (#54): tuning and pure helpers. No engine, no DOM.
// Numbers from docs/superpowers/specs/2026-11-24-issue-54-detonators-net-paintball-design.md.
// Launch tuning changed in #90 (docs/superpowers/specs/2026-11-26-issue-90-charges-fly-straight-design.md).

export const CHARGE = {
  mass: 0.1, // nearly massless: a stuck charge must not knock pieces over (#62)
  halfExtents: [0.16, 0.08, 0.11],
  speedBase: 40,       // fast and straight to the crosshair (#90): 40-60 m/s, no gravity until first contact
  speedPower: 20,
  flightRange: 100,    // metres from the muzzle without a contact: gravity comes back (#90)
  blastRadius: 4,      // between bomb (3/320) and dynamite (4.5/600)
  blastStrength: 500,
  fuseMs: 4000,
  blinkSlowMs: 600,
  blinkFastMs: 100,
  maxRemote: 6,
  maxRemoteDemolition: 12,   // #99: one per ground column of the six-bay demolition block
};

// How many remote and cutting charges may be armed at once on a target.
export function maxRemoteFor(mode) {
  return mode === 'demolitionwide' ? CHARGE.maxRemoteDemolition : CHARGE.maxRemote;
}

// Cutting charge (#87): a small blast for controlled demolition. It breaks the piece it sits on
// (a strong sideways shove) and barely touches the rest, so the building falls under gravity.
export const CUT = {
  radius: 1.2,
  strength: 260,   // radial impulse at point blank, falls off to 0 at the radius
  lift: 0,         // no upward kick
  shove: 160,      // horizontal impulse on the piece the charge is stuck to (about 20 m/s on an 8 kg piece)
  flashScale: 0.5, // visual flash relative to a normal blast
};
export const BLAST_LIFT = 0.3;   // the upward kick every other blast has: impulse * 0.3

export function isRemoteType(type) {
  return type === 'remotecharge' || type === 'cutcharge';
}

export function isChargeType(type) {
  return isRemoteType(type) || type === 'timedcharge';
}

// Impulse a blast gives a body at `offset` from the charge, or null outside the radius.
// Same maths explode() always had: radial, linear falloff, distance floored at 0.5, plus `lift` * impulse upward.
export function blastImpulse(offset, radius, strength, lift = BLAST_LIFT) {
  const dist = Math.max(Math.hypot(offset.x, offset.y, offset.z), 0.5);
  if (dist > radius) return null;
  const imp = strength * (1 - dist / radius);
  return { x: (offset.x / dist) * imp, y: (offset.y / dist) * imp + imp * lift, z: (offset.z / dist) * imp };
}

// The sideways shove on the piece a cutting charge is stuck to: horizontal, away from the charge.
// A piece straight above or below the charge gets a fixed +x shove.
export function cutShove(offset, strength = CUT.shove) {
  const h = Math.hypot(offset.x, offset.z);
  if (h < 0.05) return { x: strength, y: 0, z: 0 };
  return { x: (offset.x / h) * strength, y: 0, z: (offset.z / h) * strength };
}

function clamp01(v) {
  return Math.min(Math.max(v, 0), 1);
}

export function chargeLaunch(dir, power) {
  const n = Math.hypot(dir.x, dir.y, dir.z);
  return {
    direction: { x: dir.x / n, y: dir.y / n, z: dir.z / n },   // exactly the crosshair ray (#90)
    speed: CHARGE.speedBase + clamp01(power) * CHARGE.speedPower,
  };
}

// True once a flying charge has gone CHARGE.flightRange from its muzzle (#90): it then falls like a miss.
export function chargeOutOfRange(start, pos) {
  return Math.hypot(pos.x - start.x, pos.y - start.y, pos.z - start.z) >= CHARGE.flightRange;
}

export function isFuseDone(bornMs, nowMs) {
  return nowMs - bornMs >= CHARGE.fuseMs;
}

export function blinkPeriod(elapsedMs) {
  const t = clamp01(elapsedMs / CHARGE.fuseMs);
  return CHARGE.blinkSlowMs - (CHARGE.blinkSlowMs - CHARGE.blinkFastMs) * t;
}

export function ledOn(elapsedMs) {
  const period = blinkPeriod(elapsedMs);
  return Math.max(elapsedMs, 0) % period < period / 2;
}

export function canPlaceRemote(armedCount, max = CHARGE.maxRemote) {
  return armedCount < max;
}

export function armedRemotes(records) {
  return records.filter((r) => isRemoteType(r.type) && !r.exploded);
}

// What a charge does on a contact: 'ignore' once stuck or when it hits another projectile
// (removed on its own schedule, so a joint to it would outlive its body), 'freeze' in place
// when there is no body handle to join, otherwise 'joint' (static bodies such as the ground count too).
export function chargeStickPlan(stuck, other, otherIsProjectile = false) {
  if (stuck || otherIsProjectile) return 'ignore';
  return other ? 'joint' : 'freeze';
}

// How far ahead of a flying charge to look for a drawn surface this frame (#78): one frame of
// flight plus one physics substep, plus the charge's half diagonal, so it sticks to the face it
// is about to reach before any corner slips into a gap behind the drawn mesh.
export function chargeReach(speed, dtSec) {
  const [x, y, z] = CHARGE.halfExtents;
  return speed * (dtSec + 1 / 240) + Math.hypot(x, y, z);
}

// Shortest rotation that turns local +Y onto the unit vector n, as a quaternion {x, y, z, w}.
export function quatFromUp(n) {
  const w = 1 + n.y;
  if (w < 1e-9) return { x: 1, y: 0, z: 0, w: 0 };   // n = -Y: half turn about X
  const len = Math.hypot(n.z, n.x, w);
  return { x: n.z / len, y: 0, z: -n.x / len, w: w / len };
}

// Pose of a charge lying flush on a drawn face (#78): its flat underside on the face at `point`,
// the detonator box (local +Y) along the face's outward unit `normal`.
export function flushPose(point, normal) {
  const t = CHARGE.halfExtents[1];
  return {
    position: { x: point.x + normal.x * t, y: point.y + normal.y * t, z: point.z + normal.z * t },
    quaternion: quatFromUp(normal),
  };
}

// The number a new remote charge gets (#79): the lowest free one of 1..max among `used`
// (the numbers of the armed remotes). 0 only if all are taken, which the cap prevents.
export function nextChargeNumber(used, max = CHARGE.maxRemote) {
  for (let n = 1; n <= max; n++) if (!used.includes(n)) return n;
  return 0;
}

// World size of a charge's number sprite (#79): grows with the camera distance so the digit stays
// readable from the chimney camera (about 52 units away) without being huge up close.
export function chargeLabelScale(dist) {
  return Math.min(Math.max(dist * 0.035, 0.5), 2);
}

// The target piece whose drawn mesh is `object` or one of its ancestors, or null (#78).
// pieces: [{ mesh, ... }] (the game's `barrels`); a raycast hit can land on a child mesh of a group.
export function pieceOf(object, pieces) {
  for (let o = object; o; o = o.parent) {
    const piece = pieces.find((p) => p.mesh === o);
    if (piece) return piece;
  }
  return null;
}
