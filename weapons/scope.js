// Sniper scope inset (#91): pure helpers for where the round scope sits on screen and what its
// camera sees. No engine, no DOM. The scope is a picture-in-picture circle around the aim point
// that shows a magnified view; the main view keeps its FOV.

export const SCOPE = {
  fraction: 0.4,       // circle diameter as a share of the shorter screen side
  magnification: 5,    // objects in the circle look 5x bigger than in the view beneath
  lift: 0.75,          // touch: raise the circle by this many diameters so the finger does not cover it
  maxTexture: 768,     // longest edge of the inset render target, in device pixels
};

export function scopeDiameter(width, height, fraction = SCOPE.fraction) {
  return Math.round(Math.min(width, height) * fraction);
}

// Centre and size of the circle in CSS pixels. aimX/aimY are the aim point in CSS pixels; a lifted
// scope (touch) sits above the finger. The whole circle stays on screen.
export function scopeRect(aimX, aimY, width, height, lifted = false) {
  const size = scopeDiameter(width, height);
  const r = size / 2;
  const cy = aimY - (lifted ? size * SCOPE.lift : 0);
  return {
    x: clamp(aimX, r, width - r),
    y: clamp(cy, r, height - r),
    size,
  };
}

// NDC x/y of the aim point -> CSS pixels (the inverse of setAim in index.html).
export function aimToScreen(ndcX, ndcY, width, height) {
  return { x: ((ndcX + 1) / 2) * width, y: ((1 - ndcY) / 2) * height };
}

// Vertical FOV (degrees) that magnifies the base FOV by `magnification`.
export function scopeFov(baseFov, magnification = SCOPE.magnification) {
  const half = Math.tan((baseFov * Math.PI) / 360) / magnification;
  return (Math.atan(half) * 360) / Math.PI;
}

// Square render-target edge in device pixels: 1:1 with the circle on screen, capped.
export function scopeTextureSize(diameter, pixelRatio, maxTexture = SCOPE.maxTexture) {
  return Math.max(1, Math.min(Math.round(diameter * pixelRatio), maxTexture));
}

// Where to draw a unit circle (radius 1) in an orthographic -1..1 overlay so it covers the rect.
export function scopeNdcTransform(rect, width, height) {
  return {
    x: (rect.x / width) * 2 - 1,
    y: 1 - (rect.y / height) * 2,
    scaleX: rect.size / width,
    scaleY: rect.size / height,
  };
}

function clamp(v, lo, hi) {
  return lo > hi ? (lo + hi) / 2 : Math.min(Math.max(v, lo), hi);
}