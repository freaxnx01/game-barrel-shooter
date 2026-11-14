// Two-finger touch gestures: drag the pair to orbit, pinch to zoom. Feeds nudgeOrbit.

// rad per px of centroid drag (same as right-drag), units of radius per px of pinch
export const GESTURE_RATE = { theta: 0.005, phi: 0.004, zoom: 0.04 };

export function touchPair(a, b) {
  return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, dist: Math.hypot(b.x - a.x, b.y - a.y) };
}

// Spreading the fingers zooms in (smaller radius); `0 -` keeps a still pinch at +0, not -0.
export function pairNudge(prev, next) {
  return {
    dTheta: 0 - (next.cx - prev.cx) * GESTURE_RATE.theta,
    dPhi: (next.cy - prev.cy) * GESTURE_RATE.phi,
    dRadius: 0 - (next.dist - prev.dist) * GESTURE_RATE.zoom,
  };
}
