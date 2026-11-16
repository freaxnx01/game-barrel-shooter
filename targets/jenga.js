// Pure module for the Jenga tower target (#34): layout, constants and the rules
// behind the push force, "pulled" and "tower fell". No THREE, no DOM.
// Boxes: { hx, hy, hz, x, y, z, ry, layer }  // half extents + centre in metres, ry = yaw
// The tower is centred on x = 0, z = 0 with the ground at y = 0; `layer` is 0-based.
// Spec: docs/superpowers/specs/2026-11-15-jenga-tower-design.md

export const JENGA = {
  length: 3.0,
  width: 1.0,
  height: 0.6,
  layers: 18,
  clearance: 0.001,
  mass: 6,
  pushSpeed: 1.0,           // m/s target speed of a held block along its long axis
  gain: 100,                // 1/s, speed controller gain; high, so the cap (not the gain) decides what sticks
  maxPushForceFactor: 1.5,  // force cap in block weights; the cap lets loaded blocks stick
  pulledFraction: 0.8,      // pulled once moved this fraction of its length from home
  groundEps: 0.05,
};

const G = 9.82;

export function jengaTower(layers = JENGA.layers) {
  const { length, width, height, clearance } = JENGA;
  const pitch = width + clearance;
  const boxes = [];
  for (let layer = 0; layer < layers; layer++) {
    const ry = layer % 2 ? Math.PI / 2 : 0;
    const [sx, sz] = sideAxis(ry);
    for (let i = -1; i <= 1; i++) {
      boxes.push({
        hx: length / 2, hy: height / 2, hz: width / 2,
        x: i * pitch * sx, y: layer * height + height / 2, z: i * pitch * sz,
        ry, layer,
      });
    }
  }
  return boxes;
}

// Long axis (local +x) in world xz, three.js Y-rotation convention.
export function blockAxis(ry) {
  return [Math.cos(ry), -Math.sin(ry)];
}

// Local +z in world xz: the direction the three blocks of a layer sit side by side.
function sideAxis(ry) {
  return [Math.sin(ry), Math.cos(ry)];
}

function dotXZ(dx, dz, axis) {
  return dx * axis[0] + dz * axis[1];
}

// Push away from the touch point: sign of (centre - hit) along the long axis.
export function pushSign(axis, center, hit) {
  return dotXZ(center.x - hit.x, center.z - hit.z, axis) < 0 ? -1 : 1;
}

// Speed controller toward JENGA.pushSpeed, never pulling back, capped at the max force.
export function pushForce(vAlong, mass, g = G) {
  const want = JENGA.gain * mass * (JENGA.pushSpeed - vAlong);
  const cap = JENGA.maxPushForceFactor * mass * g;
  return Math.min(Math.max(want, 0), cap);
}

export function isPulled(home, pos, axis) {
  return Math.abs(dotXZ(pos.x - home.x, pos.z - home.z, axis)) > JENGA.pulledFraction * JENGA.length;
}

// blocks: [{ layer, homeX, homeY, homeZ, x, y, z, hy, pulled }]; activeIndex = the block
// being pushed or -1.
export function hasFallen(blocks, activeIndex) {
  return foreignBlockOnGround(blocks, activeIndex) || topLayerSank(blocks) || topLayerDrifted(blocks, activeIndex);
}

function foreignBlockOnGround(blocks, activeIndex) {
  return blocks.some((b, i) => i !== activeIndex && !b.pulled && b.layer >= 1 && b.y - b.hy < JENGA.groundEps);
}

function topLayerOf(blocks) {
  const top = Math.max(...blocks.map(b => b.layer));
  return blocks.filter(b => b.layer === top && !b.pulled);
}

function topLayerSank(blocks) {
  const tops = topLayerOf(blocks);
  if (tops.length === 0) return false;
  const mean = (key) => tops.reduce((s, b) => s + b[key], 0) / tops.length;
  return mean('homeY') - mean('y') > JENGA.height / 2;
}

// Pushing the last block of a layer drags the tower above it along: the top layer slides
// off sideways before it sinks, and its blocks would count as pulled. Half a block length
// of drift puts the upper tower's centre over the edge of the layer below. The median
// ignores one top block knocked or pushed on its own.
function topLayerDrifted(blocks, activeIndex) {
  const tops = topLayerOf(blocks).filter(b => b !== blocks[activeIndex]);
  if (tops.length === 0) return false;
  return median(tops.map(b => Math.hypot(b.x - b.homeX, b.z - b.homeZ))) > JENGA.length / 2;
}

function median(values) {
  const v = [...values].sort((a, b) => a - b), m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
