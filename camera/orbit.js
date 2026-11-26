// Orbit camera limits and the held-control nudge shared by right-drag, wheel, D-pad and arrow keys.

export const ORBIT_LIMITS = { phiMin: 0.02, phiMax: 1.35, radiusMin: 5, radiusMax: 30 };
export const CAM_SPEED = { theta: 1.6, phi: 0.8, zoom: 12 };   // rad/s, rad/s, units/s while a control is held
export const FIT_MARGIN = 0.08;   // share of the half-screen left free beside a fitted target

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

export function nudgeOrbit(orbit, dTheta, dPhi, dRadius) {
  orbit.theta += dTheta;
  orbit.phi = clamp(orbit.phi + dPhi, ORBIT_LIMITS.phiMin, ORBIT_LIMITS.phiMax);
  const radiusMax = Math.max(ORBIT_LIMITS.radiusMax, orbit.fitRadius ?? 0);   // never snap a fitted camera back in
  orbit.radius = clamp(orbit.radius + dRadius, ORBIT_LIMITS.radiusMin, radiusMax);
}

// Smallest orbit radius at which a target fits the horizontal field of view, never below baseRadius
// (the per-target desktop framing). extent: halfWidth either side of the look-at point and nearDepth,
// how far its nearest face sits in front of it. On a narrow portrait screen this pulls the camera back.
export function fitOrbitRadius(baseRadius, extent, vFovDeg, aspect) {
  const tanHalfHFov = Math.tan(vFovDeg * Math.PI / 360) * aspect;
  const needed = extent.halfWidth / (tanHalfHFov * (1 - FIT_MARGIN)) + extent.nearDepth;
  return Math.max(baseRadius, needed);
}

// held: -1/0/1 per axis (zoom 1 = in). Returns null when nothing is held. `0 -` keeps an idle zoom at +0, not -0.
export function heldNudge(held, dt) {
  if (!held.theta && !held.phi && !held.zoom) return null;
  return { dTheta: held.theta * CAM_SPEED.theta * dt, dPhi: held.phi * CAM_SPEED.phi * dt, dRadius: 0 - held.zoom * CAM_SPEED.zoom * dt };
}

// Whether the drawing buffer no longer matches the window. three.js sizes the canvas to
// floor(css size × pixel ratio), so compare against the same floor: with Windows display
// scaling the raw product is fractional and would never match, re-fitting (and un-zooming)
// the camera every frame (#76).
export function canvasNeedsResize(canvasW, canvasH, cssW, cssH, pixelRatio) {
  return canvasW !== Math.floor(cssW * pixelRatio) || canvasH !== Math.floor(cssH * pixelRatio);
}
