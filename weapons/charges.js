// Remote and timed demolition charges (#54): tuning and pure helpers. No engine, no DOM.
// Numbers from docs/superpowers/specs/2026-11-24-issue-54-detonators-net-paintball-design.md.

export const CHARGE = {
  mass: 0.1, // nearly massless: a stuck charge must not knock pieces over (#62)
  halfExtents: [0.16, 0.08, 0.11],
  speedBase: 12,
  speedPower: 14,
  lift: 0.28,          // tossed with a slight arc, like the grenade
  blastRadius: 4,      // between bomb (3/320) and dynamite (4.5/600)
  blastStrength: 500,
  fuseMs: 4000,
  blinkSlowMs: 600,
  blinkFastMs: 100,
  maxRemote: 6,
};

function clamp01(v) {
  return Math.min(Math.max(v, 0), 1);
}

export function chargeLaunch(dir, power) {
  const x = dir.x, y = dir.y + CHARGE.lift, z = dir.z;
  const n = Math.hypot(x, y, z);
  return {
    direction: { x: x / n, y: y / n, z: z / n },
    speed: CHARGE.speedBase + clamp01(power) * CHARGE.speedPower,
  };
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

export function canPlaceRemote(armedCount) {
  return armedCount < CHARGE.maxRemote;
}

export function armedRemotes(records) {
  return records.filter((r) => r.type === 'remotecharge' && !r.exploded);
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

// The number a new remote charge gets (#79): the lowest free one of 1..maxRemote among `used`
// (the numbers of the armed remotes). 0 only if all are taken, which the cap prevents.
export function nextChargeNumber(used) {
  for (let n = 1; n <= CHARGE.maxRemote; n++) if (!used.includes(n)) return n;
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
