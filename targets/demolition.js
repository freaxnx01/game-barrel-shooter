// Pure layout and collapse rules for the demolition tower target (#86): heavy floor slabs on
// slim columns, six storeys. No THREE, no DOM.
// Boxes: { hx, hy, hz, x, y, z, ry, part, storey }  // half extents + centre in base units,
// ry = yaw; part is 'column' or 'slab'; storey 0-based from the ground.
// Centred on x = 0, z = 0 with the ground at y = 0; index.html scales by TSCALE 2.
// Rigid boxes never crush, so a stack of slabs on columns only sits down one storey or tips
// over. Two rules make it pancake: an explosion next to a column crushes that column, and a
// slab that falls and lands crushes the columns standing on it.
// Spec: docs/superpowers/specs/2026-11-26-issue-86-demolition-highrise-design.md

export const DEMO = {
  storeys: 6,
  grid: 2,              // columns per side
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

export function slabHalf() {
  return (DEMO.grid - 1) / 2 * DEMO.pitch + DEMO.column / 2 + DEMO.overhang;
}

export function demolitionLayout() {
  const { storeys, grid, pitch, column, storeyHeight, slabThickness } = DEMO;
  const pts = [];
  for (let k = 0; k < grid; k++) pts.push((k - (grid - 1) / 2) * pitch);
  const half = slabHalf();
  const boxes = [];
  for (let storey = 0; storey < storeys; storey++) {
    const base = storey * storeyPitch();
    for (const x of pts) {
      for (const z of pts) {
        boxes.push({ hx: column / 2, hy: storeyHeight / 2, hz: column / 2, x, y: base + storeyHeight / 2, z, ry: 0, part: 'column', storey });
      }
    }
    boxes.push({ hx: half, hy: slabThickness / 2, hz: half, x: 0, y: base + storeyHeight + slabThickness / 2, z: 0, ry: 0, part: 'slab', storey });
  }
  return boxes;
}

// Distance from point p to the vertical axis segment of a column centred at c with half
// height hy (all in the same units).
export function distToColumnAxis(p, c, hy) {
  const dy = Math.max(0, Math.abs(p.y - c.y) - hy);
  return Math.hypot(p.x - c.x, dy, p.z - c.z);
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