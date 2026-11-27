// Pure layout and collapse rules for the demolition tower target (#86): heavy floor slabs on
// slim columns, six storeys. Two targets: the slim tower of #86 (one bay, 2 × 2 columns per
// storey) and the wide block of #99 (six bays, three across and two deep, 4 × 3 columns per
// storey). No THREE, no DOM.
// Boxes: { hx, hy, hz, x, y, z, ry, part, storey }  // half extents + centre in base units,
// ry = yaw; part is 'column' or 'slab'; storey 0-based from the ground.
// Centred on x = 0, z = 0 with the ground at y = 0; index.html scales by TSCALE 2.
// Rigid boxes never crush, so a stack of slabs on columns only sits down one storey or tips
// over. Two rules make it pancake: an explosion crushes the columns in reach on one storey, and
// a slab that falls and lands crushes the columns standing on it.
// Spec: docs/superpowers/specs/2026-11-26-issue-86-demolition-highrise-design.md
// Ground floor: docs/superpowers/specs/2026-11-27-issue-99-demolition-ground-floor-design.md

export const DEMO = {
  storeys: 6,
  pitch: 3,             // column centre distance
  column: 0.3,          // square column cross-section
  storeyHeight: 1.25,   // column length (clear storey height)
  slabThickness: 0.25,
  overhang: 0.25,       // slab edge beyond the outer column faces
  breakRadius: 1.0,     // world units: an explosion this close to a column's axis crushes it
  fallSpeed: 1.5,       // world units/s: a slab sinking faster than this is falling
  landSpeed: 0.5,       // world units/s: a falling slab slower than this again has landed
};

export function storeyPitch() {
  return DEMO.storeyHeight + DEMO.slabThickness;
}

// Columns across (x) and front to back (z) per storey, by target mode.
export const DEMO_GRIDS = {
  demolition: { x: 2, z: 2 },       // slim tower (#86)
  demolitionwide: { x: 4, z: 3 },   // wide block, six bays (#99)
};

export function isDemolitionMode(mode) {
  return mode in DEMO_GRIDS;
}

// Half size of a slab in x and z: the outer columns plus the overhang.
export function slabHalves(grid) {
  const half = (n) => (n - 1) / 2 * DEMO.pitch + DEMO.column / 2 + DEMO.overhang;
  return { x: half(grid.x), z: half(grid.z) };
}

export function demolitionLayout(grid) {
  const { storeys, pitch, column, storeyHeight, slabThickness } = DEMO;
  const points = (n) => Array.from({ length: n }, (_, k) => (k - (n - 1) / 2) * pitch);
  const xs = points(grid.x), zs = points(grid.z);
  const half = slabHalves(grid);
  const boxes = [];
  for (let storey = 0; storey < storeys; storey++) {
    const base = storey * storeyPitch();
    for (const x of xs) {
      for (const z of zs) {
        boxes.push({ hx: column / 2, hy: storeyHeight / 2, hz: column / 2, x, y: base + storeyHeight / 2, z, ry: 0, part: 'column', storey });
      }
    }
    boxes.push({ hx: half.x, hy: slabThickness / 2, hz: half.z, x: 0, y: base + storeyHeight + slabThickness / 2, z: 0, ry: 0, part: 'slab', storey });
  }
  return boxes;
}

// Distance from point p to the vertical axis segment of a column centred at c with half
// height hy (all in the same units).
export function distToColumnAxis(p, c, hy) {
  const dy = Math.max(0, Math.abs(p.y - c.y) - hy);
  return Math.hypot(p.x - c.x, dy, p.z - c.z);
}

// The columns an explosion at p crushes: every column on the storey of the nearest column in
// reach whose axis is within breakRadius, or []. Never a column on another storey, so a charge
// high on a ground column does not also take out the column standing on the slab above it
// (review on #97). columns: [{ position, hy, storey }] in world units; returns those objects.
export function columnsToCrush(p, columns) {
  let nearest = null, bestD = DEMO.breakRadius;
  for (const c of columns) {
    const d = distToColumnAxis(p, c.position, c.hy);
    if (d < bestD) { bestD = d; nearest = c; }
  }
  if (!nearest) return [];
  return columns.filter(c => c.storey === nearest.storey && distToColumnAxis(p, c.position, c.hy) < DEMO.breakRadius);
}

// Per-slab landing detector. Call once per frame with the slab's vertical velocity; returns
// true exactly once: on the first frame a slab that fell faster than fallSpeed is slower than
// landSpeed again. state is a plain object owned by the caller ({} at build time).
export function slabLanded(state, vy) {
  if (state.landed) return false;
  if (vy < -DEMO.fallSpeed) state.fell = true;
  if (state.fell && vy > -DEMO.landSpeed) {
    state.landed = true;
    return true;
  }
  return false;
}

// ---- Debris (visual only) ----------------------------------------------------
// A crushed column breaks into a few small chunks and a dust puff. They have no physics
// bodies, so they can never jam the pancaking slabs: plain objects moved by stepChunk
// (gravity, a damped bounce on the ground y = 0, then rest), shrunk away by chunkScale.
// All values in world units and seconds.
export const DEBRIS = {
  chunks: 5,        // per crushed column (24 columns -> at most 120 chunks)
  speed: 3,         // mean horizontal launch speed
  lift: 2,          // max upward launch speed
  spin: 6,          // max angular speed per axis, rad/s
  gravity: 9.82,
  bounce: 0.3,      // vertical speed kept on a ground bounce
  grip: 0.6,        // horizontal and spin speed kept on a ground bounce
  restSpeed: 1,     // a bounce slower than this settles the chunk
  life: 4,          // a chunk is gone after this many seconds
  shrink: 1,        // ... shrinking to nothing over the last second
  dustLife: 1.2,
  dustGrow: 3,      // the puff grows to this many times its start radius
  dustOpacity: 0.5,
};

// Park-Miller generator, so the same seed gives the same chunks (testable, no Math.random).
function rng(seed) {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// Chunks for a column centred at c with half extents hx, hy, hz. Chunks are spread up the
// column's height, sized from its cross-section and thrown outward in all directions.
export function debrisChunks(c, hx, hy, hz, seed) {
  const r = rng(seed);
  const out = [];
  for (let i = 0; i < DEBRIS.chunks; i++) {
    const a = r() * 2 * Math.PI;
    const sp = DEBRIS.speed * (0.5 + r());
    out.push({
      x: c.x + (r() * 2 - 1) * hx,
      y: c.y - hy + ((i + 0.5) / DEBRIS.chunks) * 2 * hy,
      z: c.z + (r() * 2 - 1) * hz,
      vx: Math.cos(a) * sp, vy: r() * DEBRIS.lift, vz: Math.sin(a) * sp,
      rx: 0, ry: 0, rz: 0,
      wx: (r() * 2 - 1) * DEBRIS.spin, wy: (r() * 2 - 1) * DEBRIS.spin, wz: (r() * 2 - 1) * DEBRIS.spin,
      size: Math.min(hx, hz) * (0.6 + 0.5 * r()),
      age: 0, resting: false,
    });
  }
  return out;
}

// Advances a chunk by dt in place and returns it.
export function stepChunk(ch, dt) {
  ch.age += dt;
  if (ch.resting) return ch;
  ch.vy -= DEBRIS.gravity * dt;
  ch.x += ch.vx * dt; ch.y += ch.vy * dt; ch.z += ch.vz * dt;
  ch.rx += ch.wx * dt; ch.ry += ch.wy * dt; ch.rz += ch.wz * dt;
  const floor = ch.size / 2;
  if (ch.y < floor) {
    ch.y = floor;
    if (-ch.vy * DEBRIS.bounce < DEBRIS.restSpeed) {
      ch.vx = ch.vy = ch.vz = ch.wx = ch.wy = ch.wz = 0;
      ch.resting = true;
    } else {
      ch.vy = -ch.vy * DEBRIS.bounce;
      ch.vx *= DEBRIS.grip; ch.vz *= DEBRIS.grip;
      ch.wx *= DEBRIS.grip; ch.wy *= DEBRIS.grip; ch.wz *= DEBRIS.grip;
    }
  }
  return ch;
}

// Size factor of a chunk of this age: 1, then shrinking to 0 over the last DEBRIS.shrink s.
export function chunkScale(age) {
  return Math.max(0, Math.min(1, (DEBRIS.life - age) / DEBRIS.shrink));
}

// Dust puff of this age: radius factor and opacity, or null once it is gone.
export function dustPuff(age) {
  if (age >= DEBRIS.dustLife) return null;
  const t = age / DEBRIS.dustLife;
  return { scale: 1 + (DEBRIS.dustGrow - 1) * Math.sqrt(t), opacity: DEBRIS.dustOpacity * (1 - t) };
}
