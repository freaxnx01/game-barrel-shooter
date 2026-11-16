import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JENGA, jengaTower, blockAxis, pushSign, pushForce, isPulled, hasFallen } from '../targets/jenga.js';
import { boxesOverlap, unsupported } from './layout-geometry.mjs';

test('jengaTower_Default_18LayersOf3', () => {
  const t = jengaTower();
  assert.equal(t.length, 54);
  for (let k = 0; k < 18; k++) assert.equal(t.filter(b => b.layer === k).length, 3);
});
test('jengaTower_LayersAlternateCrosswise', () => {
  const t = jengaTower();
  assert.equal(t.find(b => b.layer === 0).ry, 0);
  assert.equal(t.find(b => b.layer === 1).ry, Math.PI / 2);
});
test('jengaTower_BlocksRestOnLayerBelow', () => {
  for (const b of jengaTower()) assert.ok(Math.abs((b.y - b.hy) - b.layer * JENGA.height) < 1e-9);
});
test('jengaTower_NoOverlaps', () => {
  const t = jengaTower();
  for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) assert.equal(boxesOverlap(t[i], t[j]), false, `${i}/${j}`);
});
test('jengaTower_EveryBlockSupported', () => {
  assert.deepEqual(unsupported(jengaTower()), []);
});
test('jengaTower_CentredAndSized', () => {
  const t = jengaTower();
  const b = t[0];
  assert.deepEqual([b.hx, b.hy, b.hz], [1.5, 0.3, 0.5]);
  assert.ok(Math.abs(t.filter(b => b.layer === 0).reduce((s, b) => s + b.z, 0)) < 1e-9);
});
test('blockAxis_ZeroAndQuarterTurn', () => {
  assert.deepEqual(blockAxis(0), [1, -0]);
  const [ax, az] = blockAxis(Math.PI / 2);
  assert.ok(Math.abs(ax) < 1e-9 && Math.abs(az + 1) < 1e-9);
});
test('pushSign_TouchAtPlusEnd_PushesMinus', () => {
  assert.equal(pushSign([1, 0], { x: 0, z: 0 }, { x: 1.5, z: 0.2 }), -1);
  assert.equal(pushSign([1, 0], { x: 0, z: 0 }, { x: -1.5, z: 0 }), 1);
  assert.equal(pushSign([1, 0], { x: 0, z: 0 }, { x: 0, z: 0.5 }), 1);
});
test('pushForce_AtRest_PositiveAndCapped', () => {
  const cap = JENGA.maxPushForceFactor * JENGA.mass * 9.82;
  assert.equal(pushForce(0, JENGA.mass), Math.min(JENGA.gain * JENGA.mass * JENGA.pushSpeed, cap));
  assert.ok(pushForce(-100, JENGA.mass) <= cap + 1e-9);
});
test('pushForce_AtOrAboveTargetSpeed_Zero', () => {
  assert.equal(pushForce(JENGA.pushSpeed, JENGA.mass), 0);
  assert.equal(pushForce(5, JENGA.mass), 0);
});
test('isPulled_Threshold', () => {
  const home = { x: 0, z: 0 }, ax = [1, 0];
  assert.equal(isPulled(home, { x: 0.8 * 3.0 - 0.01, z: 0 }, ax), false);
  assert.equal(isPulled(home, { x: -(0.8 * 3.0 + 0.01), z: 0 }, ax), true);
  assert.equal(isPulled(home, { x: 0, z: 5 }, ax), false);
});
const blk = (layer, dy = 0, extra = {}) => ({ layer, homeX: 0, homeZ: 0, x: 0, z: 0, homeY: layer * 0.6 + 0.3, y: layer * 0.6 + 0.3 + dy, hy: 0.3, pulled: false, ...extra });
test('hasFallen_IntactTower_False', () => {
  const bs = []; for (let k = 0; k < 18; k++) for (let i = 0; i < 3; i++) bs.push(blk(k));
  assert.equal(hasFallen(bs, -1), false);
});
test('hasFallen_ForeignBlockOnGround_True', () => {
  const bs = [blk(0), blk(5, -5 * 0.6), blk(17)];
  assert.equal(hasFallen(bs, -1), true);
});
test('hasFallen_ActiveOrPulledBlockOnGround_False', () => {
  assert.equal(hasFallen([blk(0), blk(5, -3), blk(17)], 1), false);
});
test('hasFallen_PulledBlockOnGround_False', () => {
  assert.equal(hasFallen([blk(0), blk(5, -3, { pulled: true }), blk(17)], -1), false);
});
test('hasFallen_TopLayerSinksHalfBlock_True', () => {
  assert.equal(hasFallen([blk(0), blk(17, -0.31), blk(17, -0.31), blk(17, -0.31)], -1), true);
  assert.equal(hasFallen([blk(0), blk(17, -0.29), blk(17, -0.29), blk(17, -0.29)], -1), false);
});
// Pushing the last block of a layer drags the whole tower above it along (measured in
// the game, #34): the top layer slides off sideways before it sinks.
test('hasFallen_TopLayerDriftsHalfABlockLength_True', () => {
  const far = { x: 1.6 }, near = { x: 1.4 };
  assert.equal(hasFallen([blk(0), blk(17, -0.1, far), blk(17, -0.1, far), blk(17, -0.1, far)], -1), true);
  assert.equal(hasFallen([blk(0), blk(17, -0.1, near), blk(17, -0.1, near), blk(17, -0.1, near)], -1), false);
});
test('hasFallen_OneTopBlockKnockedSideways_False', () => {
  assert.equal(hasFallen([blk(0), blk(17, 0, { z: 2 }), blk(17), blk(17)], -1), false);
});
test('hasFallen_ActiveTopBlockPushedOut_False', () => {
  assert.equal(hasFallen([blk(0), blk(17, 0, { x: 2.3 }), blk(17, 0, { x: 0.01 }), blk(17)], 1), false);
});
