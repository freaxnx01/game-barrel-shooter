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
