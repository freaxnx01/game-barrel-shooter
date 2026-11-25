// Heavy net drape (#70): a 9×9 rope cloth, Verlet integration with distance constraints.
// Pure math on flat Float64Arrays. No engine, no THREE, no DOM. Nothing is allocated per step.
import { NET, strandOffsets } from './net.js';

export const CLOTH = {
  substep: 1 / 120,      // fixed step (s)
  maxSubsteps: 4,        // dt is capped at 1/30 in animate(), so 4 × 1/120 covers it
  iterations: 8,         // constraint passes per substep
  damping: 0.01,         // share of the velocity lost per substep
  gravity: 9.82,
  cornerMass: 4,         // lead weights: corner nodes are 4× heavier than the others
  nodeRadius: 0.05,      // rope radius 0.035 plus a little air, so ropes sit on surfaces
  friction: 0.8,         // how much of a touched proxy's (or the ground's) motion a node takes on
  carry: 0.5,            // share of the flying net's velocity the cloth keeps at the catch
  leash: 3.5,            // nodes farther than this from the catch centroid are pulled back …
  leashStiffness: 0.2,   // … by this share of the excess per substep
};

const NODE_Y = -(NET.radius - NET.ropeRadius);   // strand plane below the net body, as in makeNetMesh()

export function clothSegments(n) {
  const segs = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const k = i * n + j;
      if (i + 1 < n) segs.push([k, k + n]);
      if (j + 1 < n) segs.push([k, k + 1]);
    }
  }
  return segs;
}

export function cornerNodes(n) {
  return [0, n - 1, (n - 1) * n, n * n - 1];
}

export function createCloth() {
  const n = strandOffsets().length;
  const segments = clothSegments(n);
  const cloth = {
    n,
    count: n * n,
    pos: new Float64Array(n * n * 3),
    prev: new Float64Array(n * n * 3),
    invMass: new Float64Array(n * n).fill(1),
    segA: Int32Array.from(segments, (s) => s[0]),
    segB: Int32Array.from(segments, (s) => s[1]),
    rest: NET.meshSpacing,
    pending: 0,
  };
  for (const k of cornerNodes(n)) cloth.invMass[k] = 1 / CLOTH.cornerMass;
  return cloth;
}

// Lays the cloth on the flying net's pose: flat, centred on the net body, at its current open scale.
export function resetCloth(cloth, centre, scale, velocity) {
  const offs = strandOffsets();
  const h = CLOTH.substep * CLOTH.carry;
  for (let i = 0; i < cloth.n; i++) {
    for (let j = 0; j < cloth.n; j++) {
      const o = (i * cloth.n + j) * 3;
      cloth.pos[o] = centre.x + offs[i] * scale;
      cloth.pos[o + 1] = centre.y + NODE_Y * scale;
      cloth.pos[o + 2] = centre.z + offs[j] * scale;
      cloth.prev[o] = cloth.pos[o] - velocity.x * h;
      cloth.prev[o + 1] = cloth.pos[o + 1] - velocity.y * h;
      cloth.prev[o + 2] = cloth.pos[o + 2] - velocity.z * h;
    }
  }
  cloth.pending = 0;
}

// Collision proxy for a body shape: an oriented box or a sphere. Ground and empty shapes have none.
export function proxyFor(shape, position, quaternion, velocity) {
  if (shape.kind === 'sphere') return { kind: 'sphere', centre: position, velocity, radius: shape.radius };
  const half = boxHalf(shape);
  if (!half) return null;
  const reach = Math.hypot(half[0], half[1], half[2]) + CLOTH.nodeRadius;
  return { kind: 'box', centre: position, quaternion, velocity, half, reach };
}

function boxHalf(shape) {
  if (shape.kind === 'box') return shape.halfExtents;
  if (shape.kind === 'cylinder') return [shape.radiusTop, shape.height / 2, shape.radiusTop];
  if (shape.kind === 'spheroid') return [shape.radius, shape.halfLength, shape.radius];
  return null;
}

// Advances the cloth by dt in fixed substeps. world = { proxies, leashCentre } (leashCentre may be null).
export function stepCloth(cloth, dt, world) {
  cloth.pending = Math.min(cloth.pending + dt, CLOTH.maxSubsteps * CLOTH.substep);
  while (cloth.pending >= CLOTH.substep - 1e-9) {
    cloth.pending -= CLOTH.substep;
    substep(cloth, world);
  }
}

function substep(cloth, world) {
  integrate(cloth);
  for (let it = 0; it < CLOTH.iterations; it++) solveDistances(cloth);
  for (let k = 0; k < cloth.count; k++) {
    if (cloth.invMass[k] === 0) continue;
    for (const proxy of world.proxies) collideProxy(cloth, k, proxy);
    collideGround(cloth, k);
    if (world.leashCentre) leash(cloth, k, world.leashCentre);
  }
}

function integrate(cloth) {
  const keep = 1 - CLOTH.damping;
  const g = CLOTH.gravity * CLOTH.substep * CLOTH.substep;
  for (let k = 0; k < cloth.count; k++) {
    if (cloth.invMass[k] === 0) continue;
    for (let a = 0; a < 3; a++) {
      const o = k * 3 + a;
      const p = cloth.pos[o];
      cloth.pos[o] += (p - cloth.prev[o]) * keep - (a === 1 ? g : 0);
      cloth.prev[o] = p;
    }
  }
}

function solveDistances(cloth) {
  const { pos, invMass, rest } = cloth;
  for (let s = 0; s < cloth.segA.length; s++) {
    const a = cloth.segA[s], b = cloth.segB[s];
    const wa = invMass[a], wb = invMass[b], w = wa + wb;
    if (w === 0) continue;
    const ax = a * 3, bx = b * 3;
    const dx = pos[bx] - pos[ax], dy = pos[bx + 1] - pos[ax + 1], dz = pos[bx + 2] - pos[ax + 2];
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len < 1e-9) continue;
    const f = (len - rest) / (len * w);
    pos[ax] += dx * f * wa; pos[ax + 1] += dy * f * wa; pos[ax + 2] += dz * f * wa;
    pos[bx] -= dx * f * wb; pos[bx + 1] -= dy * f * wb; pos[bx + 2] -= dz * f * wb;
  }
}

// Moves the node out of the proxy and lets it take on the proxy's motion (friction).
function collideProxy(cloth, k, proxy) {
  const hit = proxy.kind === 'sphere' ? pushOutSphere(cloth.pos, k * 3, proxy) : pushOutBox(cloth.pos, k * 3, proxy);
  if (hit) applyFriction(cloth, k, proxy.velocity);
}

const ZERO = { x: 0, y: 0, z: 0 };
function collideGround(cloth, k) {
  const o = k * 3 + 1;
  if (cloth.pos[o] >= CLOTH.nodeRadius) return;
  cloth.pos[o] = CLOTH.nodeRadius;
  applyFriction(cloth, k, ZERO);
}

function applyFriction(cloth, k, v) {
  const o = k * 3, h = CLOTH.substep, f = CLOTH.friction;
  const tx = cloth.pos[o] - v.x * h, ty = cloth.pos[o + 1] - v.y * h, tz = cloth.pos[o + 2] - v.z * h;
  cloth.prev[o] += (tx - cloth.prev[o]) * f;
  cloth.prev[o + 1] += (ty - cloth.prev[o + 1]) * f;
  cloth.prev[o + 2] += (tz - cloth.prev[o + 2]) * f;
}

function pushOutSphere(pos, o, s) {
  const dx = pos[o] - s.centre.x, dy = pos[o + 1] - s.centre.y, dz = pos[o + 2] - s.centre.z;
  const min = s.radius + CLOTH.nodeRadius;
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (d >= min) return false;
  if (d < 1e-9) { pos[o + 1] = s.centre.y + min; return true; }
  const k = min / d;
  pos[o] = s.centre.x + dx * k; pos[o + 1] = s.centre.y + dy * k; pos[o + 2] = s.centre.z + dz * k;
  return true;
}

// Oriented box: rotate the node into the box frame, push it out through the nearest face, rotate back.
function pushOutBox(pos, o, b) {
  const dx = pos[o] - b.centre.x, dy = pos[o + 1] - b.centre.y, dz = pos[o + 2] - b.centre.z;
  if (dx * dx + dy * dy + dz * dz > b.reach * b.reach) return false;   // cheap reject: outside the bounding sphere
  const q = b.quaternion;
  const local = rotate(-q.x, -q.y, -q.z, q.w, dx, dy, dz);
  let axis = -1, depth = Infinity;
  for (let a = 0; a < 3; a++) {
    const d = b.half[a] + CLOTH.nodeRadius - Math.abs(local[a]);
    if (d <= 0) return false;
    if (d < depth) { depth = d; axis = a; }
  }
  local[axis] = (local[axis] < 0 ? -1 : 1) * (b.half[axis] + CLOTH.nodeRadius);
  const w = rotate(q.x, q.y, q.z, q.w, local[0], local[1], local[2]);
  pos[o] = b.centre.x + w[0]; pos[o + 1] = b.centre.y + w[1]; pos[o + 2] = b.centre.z + w[2];
  return true;
}

const tmp = [0, 0, 0];
// v' = q v q*, written out (t = 2 q×v; v' = v + w t + q×t). Returns a shared scratch array.
function rotate(qx, qy, qz, qw, vx, vy, vz) {
  const tx = 2 * (qy * vz - qz * vy), ty = 2 * (qz * vx - qx * vz), tz = 2 * (qx * vy - qy * vx);
  tmp[0] = vx + qw * tx + (qy * tz - qz * ty);
  tmp[1] = vy + qw * ty + (qz * tx - qx * tz);
  tmp[2] = vz + qw * tz + (qx * ty - qy * tx);
  return tmp;
}

function leash(cloth, k, c) {
  const o = k * 3;
  const dx = cloth.pos[o] - c.x, dy = cloth.pos[o + 1] - c.y, dz = cloth.pos[o + 2] - c.z;
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (d <= CLOTH.leash) return;
  const k2 = ((d - CLOTH.leash) / d) * CLOTH.leashStiffness;
  cloth.pos[o] -= dx * k2; cloth.pos[o + 1] -= dy * k2; cloth.pos[o + 2] -= dz * k2;
}

// Index of the corner node nearest to a point (the launcher), where the pull rope is tied.
export function nearestCorner(cloth, p) {
  let best = 0, bestD = Infinity;
  for (const k of cornerNodes(cloth.n)) {
    const o = k * 3;
    const d = Math.hypot(cloth.pos[o] - p.x, cloth.pos[o + 1] - p.y, cloth.pos[o + 2] - p.z);
    if (d < bestD) { bestD = d; best = k; }
  }
  return best;
}
