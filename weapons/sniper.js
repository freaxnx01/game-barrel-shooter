// Sniper tracer round: tuning and pure helpers. No engine, no DOM.
// Numbers measured in docs/superpowers/specs/2026-11-13-sniper-bullet-design.md:
// mass 1.0 at 160-240 m/s gives the same barrel response (19-29 m/s) as the old 6 kg round at 42-60 m/s.

export const SNIPER = { mass: 1.0, radius: 0.1, speedBase: 160, speedPower: 80, cullDistance: 150, streakLength: 3 };

export function sniperSpeed(power) {
  const p = Math.min(Math.max(power, 0), 1);
  return SNIPER.speedBase + p * SNIPER.speedPower;
}

export function isOutOfRange(start, pos) {
  return Math.hypot(pos.x - start.x, pos.y - start.y, pos.z - start.z) >= SNIPER.cullDistance;
}

export function streakLength(flown) {
  return Math.min(SNIPER.streakLength, Math.max(flown, 0));
}
