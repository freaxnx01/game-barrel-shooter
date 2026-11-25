// Heavy net (#54): thrown with an arc, catches nearby target pieces, then is pulled in.
// Tuning and pure helpers. No engine, no DOM.

export const NET = {
  mass: 6,
  radius: 0.3,         // the collider stays a small sphere; the open net is a visual on top of it
  speedBase: 12,
  speedPower: 12,
  lift: 0.3,
  captureRadius: 2.4,  // a bit more than half the open net (#60)
  maxCatch: 14,        // grows with the catch area: (2.4 / 1.6)² × 6 ≈ 14 (#60)
  pullPerKg: 160,      // weaker than the harpoon's 220: it drags several pieces at once; per piece, so the count does not matter
  gravity: 9.82,
  releaseDistance: 4,
  // open throw net (#60): a square of thick rope strands with lead weights on the corners
  openSize: 4,
  meshSpacing: 0.5,
  ropeRadius: 0.035,
  weightRadius: 0.1,
  bundleScale: 0.12,   // leaves the launcher as a bundle …
  openMs: 350,         // … and is fully open this long after the throw
  // drape after a catch: a rope dome over the caught pieces
  drapeMargin: 0.8,
  drapeMin: 1.2,
  drapeMeridians: 8,
  drapeParallels: 4,
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

// Strand positions along one axis of the open net: -2, -1.5, …, 2 for a 4 m net with 0.5 m meshes.
export function strandOffsets() {
  const n = Math.round(NET.openSize / NET.meshSpacing);
  return Array.from({ length: n + 1 }, (_, i) => -NET.openSize / 2 + i * NET.meshSpacing);
}

// Mesh scale during the throw: eased out from the bundle to the full net over openMs.
export function openScale(elapsedMs) {
  const t = Math.min(Math.max(elapsedMs / NET.openMs, 0), 1);
  const eased = 1 - (1 - t) * (1 - t);
  return NET.bundleScale + (1 - NET.bundleScale) * eased;
}

// Radius of the drape dome for a given spread of the caught pieces around their centroid.
export function drapeRadius(spreadValue) {
  return Math.max(NET.drapeMin, spreadValue + NET.drapeMargin);
}

// Parallels of the unit drape dome, from the rim upward: { radius, y } on the unit hemisphere.
export function drapeParallels() {
  return Array.from({ length: NET.drapeParallels }, (_, i) => {
    const lat = ((i + 1) / (NET.drapeParallels + 1)) * (Math.PI / 2);
    return { radius: Math.cos(lat), y: Math.sin(lat) };
  });
}