import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEMO, demolitionLayout, storeyPitch, slabHalf, distToColumnAxis, slabLanded } from '../targets/demolition.js';
import { massFor } from '../targets/apk-layouts.js';
import { overlappingPairs, unsupported } from './layout-geometry.mjs';

const columns = () => demolitionLayout().filter(b => b.part === 'column');
const slabs = () => demolitionLayout().filter(b => b.part === 'slab');

test('demolitionLayout_Has30Blocks_24ColumnsAnd6Slabs', () => {
  assert.equal(demolitionLayout().length, 30);
  assert.equal(columns().length, 24);
  assert.equal(slabs().length, 6);
});
test('demolitionLayout_NoOverlaps', () => {
  assert.deepEqual(overlappingPairs(demolitionLayout()), []);
});
test('demolitionLayout_EveryBlockSupported', () => {
  assert.deepEqual(unsupported(demolitionLayout()), []);
});
test('demolitionLayout_GroundColumnsStandOnGround', () => {
  const ground = columns().filter(b => b.storey === 0);
  assert.equal(ground.length, 4);
  for (const b of ground) assert.ok(Math.abs(b.y - b.hy) < 1e-9);
});
test('demolitionLayout_ColumnsAtPitch3AndSlim', () => {
  const xs = [...new Set(columns().map(b => b.x))].sort((a, b) => a - b);
  assert.deepEqual(xs, [-1.5, 1.5]);
  for (const b of columns()) {
    assert.ok(Math.abs(b.hx - 0.15) < 1e-9 && Math.abs(b.hz - 0.15) < 1e-9);
    assert.ok(Math.abs(b.hy - 0.625) < 1e-9);
  }
});
test('demolitionLayout_OneSlabPerStoreyOnItsColumns', () => {
  for (const s of slabs()) {
    const below = columns().filter(b => b.storey === s.storey);
    assert.equal(below.length, 4);
    for (const c of below) assert.ok(Math.abs(c.y + c.hy - (s.y - s.hy)) < 1e-9);
    assert.ok(Math.abs(s.hx - slabHalf()) < 1e-9 && Math.abs(s.hz - slabHalf()) < 1e-9);
  }
});
test('demolitionLayout_SlabOverhangsColumns', () => {
  const s = slabs()[0], c = columns()[0];
  assert.ok(Math.abs(s.hx - (Math.abs(c.x) + c.hx + DEMO.overhang)) < 1e-9);
});
test('demolitionLayout_TopAt9BaseUnits', () => {
  const top = Math.max(...demolitionLayout().map(b => b.y + b.hy));
  assert.ok(Math.abs(top - DEMO.storeys * storeyPitch()) < 1e-9);
  assert.ok(Math.abs(top - 9) < 1e-9);
});
test('demolitionLayout_SlabsMuchHeavierThanColumns', () => {
  const ratio = massFor(slabs()[0]) / massFor(columns()[0]);
  assert.ok(ratio > 20, `ratio ${ratio}`);
});
test('distToColumnAxis_BesideAndAboveColumn', () => {
  const c = { x: 0, y: 2, z: 0 };
  assert.ok(Math.abs(distToColumnAxis({ x: 0.5, y: 2.5, z: 0 }, c, 1) - 0.5) < 1e-9);
  assert.ok(Math.abs(distToColumnAxis({ x: 0, y: 4, z: 0 }, c, 1) - 1) < 1e-9);
  assert.ok(Math.abs(distToColumnAxis({ x: 3, y: 0, z: 4 }, c, 1) - Math.hypot(3, 1, 4)) < 1e-9);
});
test('slabLanded_AtRest_Never', () => {
  const st = {};
  for (let i = 0; i < 10; i++) assert.equal(slabLanded(st, 0), false);
});
test('slabLanded_SlowSink_Never', () => {
  const st = {};
  assert.equal(slabLanded(st, -1.0), false);
  assert.equal(slabLanded(st, 0), false);
});
test('slabLanded_FallThenStop_TrueOnce', () => {
  const st = {};
  assert.equal(slabLanded(st, -3), false);
  assert.equal(slabLanded(st, -6), false);
  assert.equal(slabLanded(st, -0.2), true);
  assert.equal(slabLanded(st, -4), false);
  assert.equal(slabLanded(st, 0), false);
});