import test from 'node:test';
import assert from 'node:assert/strict';
import { NET } from '../weapons/net.js';
import { CLOTH, createCloth, resetCloth, stepCloth, proxyFor, clothSegments, cornerNodes, nearestCorner } from '../weapons/cloth.js';

const STILL = { x: 0, y: 0, z: 0 };
const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };
const node = (c, k) => ({ x: c.pos[k * 3], y: c.pos[k * 3 + 1], z: c.pos[k * 3 + 2] });
const run = (c, seconds, world) => { for (let t = 0; t < seconds * 30; t++) stepCloth(c, 1 / 30, world); };
const minY = (c) => Math.min(...Array.from({ length: c.count }, (_, k) => c.pos[k * 3 + 1]));
const centreNode = (c) => Math.floor(c.count / 2);

function maxStretch(c) {
  let worst = 0;
  for (let s = 0; s < c.segA.length; s++) {
    const a = node(c, c.segA[s]), b = node(c, c.segB[s]);
    worst = Math.max(worst, Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / NET.meshSpacing - 1);
  }
  return worst;
}

test('clothSegments_NineByNine_144RowAndColumnRopes', () => {
  assert.equal(clothSegments(9).length, 144);
  assert.deepEqual(cornerNodes(9), [0, 8, 72, 80]);
});

test('resetCloth_FullyOpen_NodesOnTheOpenNetPlane', () => {
  const c = createCloth();
  resetCloth(c, { x: 1, y: 5, z: -6 }, 1, STILL);
  assert.equal(c.count, 81);
  assert.deepEqual(node(c, 0), { x: -1, y: 5 - (NET.radius - NET.ropeRadius), z: -8 });
  assert.deepEqual(node(c, 80), { x: 3, y: 5 - (NET.radius - NET.ropeRadius), z: -4 });
  assert.ok(c.invMass[0] < c.invMass[1]);   // corner weights are heavier
});

test('resetCloth_HalfOpen_ScaledAroundTheBody', () => {
  const c = createCloth();
  resetCloth(c, STILL, 0.5, STILL);
  assert.equal(node(c, 0).x, -1);
  assert.equal(node(c, 80).z, 1);
});

test('stepCloth_HangingFromOneEdge_FallsAboutFourMetresAndHoldsLengths', () => {
  const c = createCloth();
  resetCloth(c, { x: 0, y: 10, z: 0 }, 1, STILL);
  for (let i = 0; i < c.n; i++) c.invMass[i * c.n] = 0;   // pin the edge z = -2
  run(c, 6, { proxies: [], leashCentre: null });
  const top = node(c, 0).y;
  for (let i = 0; i < c.n; i++) {
    const drop = top - node(c, i * c.n + c.n - 1).y;
    assert.ok(Math.abs(drop - NET.openSize) < 0.2, `column ${i} drop ${drop}`);
  }
  assert.ok(maxStretch(c) < 0.05, `stretch ${maxStretch(c)}`);
});

test('stepCloth_DroppedOnASphere_EveryNodeOutsideAndCentreOnTop', () => {
  const c = createCloth();
  resetCloth(c, { x: 0, y: 3, z: 0 }, 1, STILL);
  const ball = proxyFor({ kind: 'sphere', radius: 1 }, { x: 0, y: 1, z: 0 }, IDENTITY, STILL);
  run(c, 4, { proxies: [ball], leashCentre: null });
  for (let k = 0; k < c.count; k++) {
    const p = node(c, k);
    assert.ok(Math.hypot(p.x, p.y - 1, p.z) >= 1 + CLOTH.nodeRadius - 1e-6, `node ${k} inside`);
  }
  assert.ok(Math.abs(node(c, centreNode(c)).y - (2 + CLOTH.nodeRadius)) < 0.05);
  assert.ok(node(c, 0).y < 1, 'the corners fall down the sides');
});

test('stepCloth_DroppedOnATurnedBarrel_CentreRestsOnTheLid', () => {
  const c = createCloth();
  resetCloth(c, { x: 0, y: 3, z: 0 }, 1, STILL);
  const s = Math.sin(Math.PI / 8), co = Math.cos(Math.PI / 8);   // 45° about y
  const barrel = proxyFor({ kind: 'cylinder', radiusTop: 0.47, radiusBottom: 0.47, height: 1.1 },
    { x: 0, y: 0.55, z: 0 }, { x: 0, y: s, z: 0, w: co }, STILL);
  assert.deepEqual(barrel.half, [0.47, 0.55, 0.47]);
  run(c, 4, { proxies: [barrel], leashCentre: null });
  assert.ok(Math.abs(node(c, centreNode(c)).y - (1.1 + CLOTH.nodeRadius)) < 0.05);
  assert.ok(minY(c) >= CLOTH.nodeRadius - 1e-9);
});

test('stepCloth_ThrownIntoTheGround_NeverBelowTheGround', () => {
  const c = createCloth();
  resetCloth(c, { x: 0, y: 1, z: 0 }, 1, { x: 0, y: -40, z: 0 });
  for (let t = 0; t < 60; t++) {
    stepCloth(c, 1 / 30, { proxies: [], leashCentre: null });
    assert.ok(minY(c) >= CLOTH.nodeRadius - 1e-9);
  }
});

test('stepCloth_PieceDraggedFast_ClothStaysWithIt', () => {
  const c = createCloth();
  resetCloth(c, { x: 0, y: 1.4, z: 0 }, 1, STILL);
  const centre = { x: 0, y: 0.55, z: 0 };
  const barrel = proxyFor({ kind: 'cylinder', radiusTop: 0.47, radiusBottom: 0.47, height: 1.1 }, centre, IDENTITY, STILL);
  run(c, 1, { proxies: [barrel], leashCentre: centre });
  barrel.velocity = { x: 0, y: 0, z: 8 };
  for (let t = 0; t < 45; t++) {   // 1.5 s at 8 m/s: 12 m
    centre.z += 8 / 30;
    stepCloth(c, 1 / 30, { proxies: [barrel], leashCentre: centre });
  }
  const mid = node(c, centreNode(c));
  assert.ok(Math.abs(mid.z - centre.z) < 1, `cloth centre z ${mid.z} vs piece ${centre.z}`);
});

test('stepCloth_LongFrame_AtMostFourSubsteps', () => {
  const c = createCloth();
  resetCloth(c, { x: 0, y: 50, z: 0 }, 1, STILL);
  stepCloth(c, 1, { proxies: [], leashCentre: null });   // a 1 s hitch must not run 120 substeps
  const fallen = 50 - (NET.radius - NET.ropeRadius) - node(c, 40).y;
  assert.ok(fallen < 0.5 * CLOTH.gravity * (4 * CLOTH.substep) ** 2 * 2, `fell ${fallen}`);
});

test('proxyFor_GroundAndEmpty_None', () => {
  assert.equal(proxyFor({ kind: 'ground' }, STILL, IDENTITY, STILL), null);
  assert.equal(proxyFor({ kind: 'none' }, STILL, IDENTITY, STILL), null);
  assert.deepEqual(proxyFor({ kind: 'box', halfExtents: [1, 2, 3] }, STILL, IDENTITY, STILL).half, [1, 2, 3]);
});

test('nearestCorner_LauncherInFront_CornerOnThatSide', () => {
  const c = createCloth();
  resetCloth(c, STILL, 1, STILL);
  assert.equal(nearestCorner(c, { x: 5, y: 1, z: 5 }), 80);
  assert.equal(nearestCorner(c, { x: -5, y: 1, z: -5 }), 0);
});

test('stepCloth_CaughtHalfOpen_OpensGentlyToFullRest', () => {
  // a catch before the net is fully open must not snap the cloth apart (#72 review)
  const cloth = createCloth();
  resetCloth(cloth, { x: 0, y: 3, z: 0 }, 0.5, { x: 0, y: 0, z: 0 });
  let maxStep = 0;
  for (let f = 0; f < 60; f++) {
    const before = Float64Array.from(cloth.pos);
    stepCloth(cloth, 1 / 60, { proxies: [], leashCentre: null });
    for (let k = 0; k < cloth.count; k++) {
      const o = k * 3;
      maxStep = Math.max(maxStep, Math.sqrt((cloth.pos[o] - before[o]) ** 2 + (cloth.pos[o + 1] - before[o + 1]) ** 2 + (cloth.pos[o + 2] - before[o + 2]) ** 2));
    }
  }
  assert.ok(maxStep * 60 < 12, `peak node speed ${(maxStep * 60).toFixed(1)} m/s`);
  assert.equal(cloth.rest, NET.meshSpacing);
});

