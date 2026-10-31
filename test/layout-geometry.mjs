// Geometry test helpers for the APK layout module. Pure math, no THREE/physics.
// Used by `test/apk-layouts.test.mjs` to assert no overlaps and every block resting.

// 2D projection of a yaw-rotated xz rectangle onto an axis (ax, az).
// three.js Y-rotation by ry maps local +x to (cos ry, -sin ry) and local +z to
// (sin ry, cos ry) in world xz.
function projRange(box, ax, az) {
  const c = Math.cos(box.ry), s = Math.sin(box.ry);
  const lx = [c, -s];  // box local x axis in world xz
  const lz = [s, c];   // box local z axis in world xz
  const base = box.x * ax + box.z * az;
  const d1 = box.hx * (lx[0] * ax + lx[1] * az);
  const d2 = box.hz * (lz[0] * ax + lz[1] * az);
  return [base - Math.abs(d1) - Math.abs(d2), base + Math.abs(d1) + Math.abs(d2)];
}

// true if the interiors of a and b intersect. Touching faces don't count as overlap.
export function boxesOverlap(a, b, eps = 1e-6) {
  const aLo = a.y - a.hy, aHi = a.y + a.hy;
  const bLo = b.y - b.hy, bHi = b.y + b.hy;
  if (aHi <= bLo + eps || bHi <= aLo + eps) return false;
  const axes = [
    [Math.cos(a.ry), -Math.sin(a.ry)],
    [Math.sin(a.ry), Math.cos(a.ry)],
    [Math.cos(b.ry), -Math.sin(b.ry)],
    [Math.sin(b.ry), Math.cos(b.ry)],
  ];
  for (const [ax, az] of axes) {
    const [aMin, aMax] = projRange(a, ax, az);
    const [bMin, bMax] = projRange(b, ax, az);
    if (aMax <= bMin + eps || bMax <= aMin + eps) return false;
  }
  return true;
}

// true if the xz rectangles overlap with positive area (strict, no eps tolerance).
function xzOverlapStrict(a, b) {
  const axes = [
    [Math.cos(a.ry), -Math.sin(a.ry)],
    [Math.sin(a.ry), Math.cos(a.ry)],
    [Math.cos(b.ry), -Math.sin(b.ry)],
    [Math.sin(b.ry), Math.cos(b.ry)],
  ];
  for (const [ax, az] of axes) {
    const [aMin, aMax] = projRange(a, ax, az);
    const [bMin, bMax] = projRange(b, ax, az);
    if (aMax <= bMin || bMax <= aMin) return false;
  }
  return true;
}

// true if the box bottom is within eps of y=0, or rests on the top of another box
// whose xz rectangle intersects this one with positive area.
export function isSupported(box, boxes, eps = 0.0015) {
  const bot = box.y - box.hy;
  if (Math.abs(bot) <= eps) return true;
  for (const o of boxes) {
    if (o === box) continue;
    const oTop = o.y + o.hy;
    if (Math.abs(oTop - bot) <= eps && xzOverlapStrict(box, o)) return true;
  }
  return false;
}

export function overlappingPairs(boxes) {
  const pairs = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (boxesOverlap(boxes[i], boxes[j])) pairs.push([i, j]);
    }
  }
  return pairs;
}

export function unsupported(boxes) {
  const r = [];
  for (let i = 0; i < boxes.length; i++) {
    if (!isSupported(boxes[i], boxes)) r.push(i);
  }
  return r;
}
