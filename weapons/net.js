// Heavy net (#54): thrown with an arc, catches nearby target pieces, then is pulled in.
// Tuning and pure helpers. No engine, no DOM.

export const NET = {
  mass: 6,
  radius: 0.3,
  speedBase: 12,
  speedPower: 12,
  lift: 0.3,
  captureRadius: 1.6,
  maxCatch: 6,
  pullPerKg: 160,      // weaker than the harpoon's 220: it drags several pieces at once
  gravity: 9.82,
  releaseDistance: 4,
};

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function netLaunch(dir, power) {
  const p = Math.min(Math.max(power, 0), 1);
  const x = dir.x, y = dir.y + NET.lift, z = dir.z;
  const n = Math.hypot(x, y, z);
  return { direction: { x: x / n, y: y / n, z: z / n }, speed: NET.speedBase + p * NET.speedPower };
}

export function selectCaught(pieces, point) {
  return pieces
    .filter((p) => p.mass > 0)
    .map((p) => ({ p, d: distance(p.position, point) }))
    .filter((e) => e.d <= NET.captureRadius)
    .sort((a, b) => a.d - b.d)
    .slice(0, NET.maxCatch)
    .map((e) => e.p);
}

export function centroid(points) {
  if (!points.length) return null;
  const sum = points.reduce((s, p) => ({ x: s.x + p.x, y: s.y + p.y, z: s.z + p.z }), { x: 0, y: 0, z: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length, z: sum.z / points.length };
}

export function spread(points, centre) {
  return points.reduce((m, p) => Math.max(m, distance(p, centre)), 0);
}

export function pullForce(from, pos, mass) {
  const dx = from.x - pos.x, dy = from.y - pos.y, dz = from.z - pos.z;
  const dist = Math.hypot(dx, dy, dz) || 1;
  const f = NET.pullPerKg * mass;
  return { x: (dx / dist) * f, y: (dy / dist) * f + NET.gravity * mass, z: (dz / dist) * f };
}

export function isReeledIn(from, centre) {
  return distance(from, centre) < NET.releaseDistance;
}