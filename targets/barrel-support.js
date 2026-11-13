// Barrel support check (#28): detect barrels in the oil/wooden pyramid that
// lost their footing and tip them into the gap so the stack slumps. Pure
// geometry plus a small controller that only talks to the `phys` facade.

export const SUPPORT = {
  r: 0.4725, h: 1.1, comMargin: 0.015, contactGap: 0.06, uprightCos: 0.99,
  maxSpeed: 0.3, periodMs: 120, pushSpeed: 0.35, tipSpin: 0.8,
  repushMs: 600, maxPushes: 4, activeMs: 2000,
};

// ---- 2D convex geometry (x/z plane) ----

function convexHull2D(pts) {
  const ps = pts.slice().sort((a, b) => a.x - b.x || a.z - b.z);
  const n = ps.length;
  if (n < 3) return ps.slice();
  const cross = (O, A, B) => (A.x - O.x) * (B.z - O.z) - (A.z - O.z) * (B.x - O.x);
  const lower = [];
  for (const p of ps) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = n - 1; i >= 0; i--) {
    const p = ps[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}

function nearestOnSegment(p, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const len2 = dx * dx + dz * dz;
  let t = len2 > 0 ? ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + t * dx, z: a.z + t * dz };
}

function pointInConvex(p, hull) {
  const n = hull.length;
  if (n < 3) return false;
  let pos = 0, neg = 0;
  for (let i = 0; i < n; i++) {
    const a = hull[i], b = hull[(i + 1) % n];
    const c = (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x);
    if (c > 0) pos++; else if (c < 0) neg++;
  }
  return pos === 0 || neg === 0;
}

function nearestHullPoint(com, hull) {
  const n = hull.length;
  if (n === 0) return { p: com, d: 0 };
  if (n === 1) return { p: hull[0], d: Math.hypot(hull[0].x - com.x, hull[0].z - com.z) };
  let best = null, bestD = Infinity;
  for (let i = 0; i < n; i++) {
    const a = hull[i], b = hull[(i + 1) % n];
    const np = nearestOnSegment(com, a, b);
    const d = Math.hypot(np.x - com.x, np.z - com.z);
    if (d < bestD) { bestD = d; best = np; }
  }
  return { p: best, d: bestD };
}

// ---- support test ----

export function supportPatches(piece, others, floors, cfg = SUPPORT) {
  const r = cfg.r;
  const N = 24;
  const eps = 1e-9;
  const pieceBot = piece.y - cfg.h / 2;
  let onFloor = false;
  for (const f of floors) {
    if (Math.abs(pieceBot - f) <= cfg.contactGap) { onFloor = true; break; }
  }
  const points = [];
  for (const o of others) {
    if (o === piece || !o.upright) continue;
    const dx = o.x - piece.x, dz = o.z - piece.z;
    const d = Math.hypot(dx, dz);
    if (d >= 2 * r) continue;
    const oTop = o.y + cfg.h / 2;
    if (Math.abs(oTop - pieceBot) > cfg.contactGap) continue;
    if (d < 1e-6) {
      for (let i = 0; i < N; i++) {
        const a = (i / N) * 2 * Math.PI;
        points.push({ x: piece.x + r * Math.cos(a), z: piece.z + r * Math.sin(a) });
      }
      continue;
    }
    for (let i = 0; i < N; i++) {
      const a = (i / N) * 2 * Math.PI;
      const ca = Math.cos(a), sa = Math.sin(a);
      const pa = { x: piece.x + r * ca, z: piece.z + r * sa };
      if (Math.hypot(pa.x - o.x, pa.z - o.z) <= r + eps) points.push(pa);
      const pb = { x: o.x + r * ca, z: o.z + r * sa };
      if (Math.hypot(pb.x - piece.x, pb.z - piece.z) <= r + eps) points.push(pb);
    }
  }
  return { onFloor, points };
}

export function isSupported(piece, others, floors, cfg = SUPPORT) {
  const { onFloor, points } = supportPatches(piece, others, floors, cfg);
  if (onFloor) return true;
  if (points.length === 0) return false;
  const hull = convexHull2D(points);
  const com = { x: piece.x, z: piece.z };
  if (pointInConvex(com, hull)) return true;
  return nearestHullPoint(com, hull).d <= cfg.comMargin;
}

export function pushFor(piece, others, floors, mass, cfg = SUPPORT) {
  if (isSupported(piece, others, floors, cfg)) return null;
  const { onFloor, points } = supportPatches(piece, others, floors, cfg);
  if (onFloor) return null;
  if (points.length === 0) return null;
  const hull = convexHull2D(points);
  const com = { x: piece.x, z: piece.z };
  const { p: best } = nearestHullPoint(com, hull);
  let dx = com.x - best.x, dz = com.z - best.z;
  const len = Math.hypot(dx, dz);
  if (len < 1e-9) return null;
  dx /= len; dz /= len;
  const impulse = { x: mass * cfg.pushSpeed * dx, y: 0, z: mass * cfg.pushSpeed * dz };
  const spin = { x: cfg.tipSpin * dz, y: 0, z: -cfg.tipSpin * dx };
  return { impulse, spin };
}

export function selectPushes(snaps, floors, now, log, cfg = SUPPORT) {
  throw new Error('selectPushes not implemented');
}

export function createBarrelSupport({ phys, floors, cfg = SUPPORT }) {
  throw new Error('createBarrelSupport not implemented');
}