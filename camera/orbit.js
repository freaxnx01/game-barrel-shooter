// Orbit camera limits and the held-control nudge shared by right-drag, wheel, D-pad and arrow keys.

export const ORBIT_LIMITS = { phiMin: 0.02, phiMax: 1.35, radiusMin: 5, radiusMax: 30 };
export const CAM_SPEED = { theta: 1.6, phi: 0.8, zoom: 12 };   // rad/s, rad/s, units/s while a control is held

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

export function nudgeOrbit(orbit, dTheta, dPhi, dRadius) {
  orbit.theta += dTheta;
  orbit.phi = clamp(orbit.phi + dPhi, ORBIT_LIMITS.phiMin, ORBIT_LIMITS.phiMax);
  orbit.radius = clamp(orbit.radius + dRadius, ORBIT_LIMITS.radiusMin, ORBIT_LIMITS.radiusMax);
}

// held: -1/0/1 per axis (zoom 1 = in). Returns null when nothing is held. `0 -` keeps an idle zoom at +0, not -0.
export function heldNudge(held, dt) {
  if (!held.theta && !held.phi && !held.zoom) return null;
  return { dTheta: held.theta * CAM_SPEED.theta * dt, dPhi: held.phi * CAM_SPEED.phi * dt, dRadius: 0 - held.zoom * CAM_SPEED.zoom * dt };
}
