import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEMO, DEMO_GRIDS, isDemolitionMode, DEBRIS, demolitionLayout, storeyPitch, slabHalves, distToColumnAxis, columnsToCrush, slabLanded, debrisChunks, stepChunk, chunkScale, dustPuff } from '../targets/demolition.js';
import { massFor } from '../targets/apk-layouts.js';
import { overlappingPairs, unsupported } from './layout-geometry.mjs';

// the wide block (#99, six bays); the slim tower of #86 has its own tests below
const WIDE = DEMO_GRIDS.demolitionwide, SLIM = DEMO_GRIDS.demolition;
const columns = (g = WIDE) => demolitionLayout(g).filter(b => b.part === 'column');
const slabs = (g = WIDE) => demolitionLayout(g).filter(b => b.part === 'slab');

// Seen from above: six bays of the old square footprint, three across (x) and two deep (z),
// so a 4 × 3 grid of columns at pitch 3 on every storey under one slab (#99).
test('demolitionLayout_Has78Blocks_72ColumnsAnd6Slabs', () => {
  assert.equal(demolitionLayout(WIDE).length, 78);
  assert.equal(columns().length, 72);
  assert.equal(slabs().length, 6);
});
test('demolitionLayout_NoOverlaps', () => {
  assert.deepEqual(overlappingPairs(demolitionLayout(WIDE)), []);
});
test('demolitionLayout_EveryBlockSupported', () => {
  assert.deepEqual(unsupported(demolitionLayout(WIDE)), []);
});
test('demolitionLayout_GroundColumnsStandOnGround', () => {
  const ground = columns().filter(b => b.storey === 0);
  assert.equal(ground.length, 12);
  for (const b of ground) assert.ok(Math.abs(b.y - b.hy) < 1e-9);
});
test('demolitionLayout_EveryStorey4x3ColumnsAtPitch3AndSlim', () => {
  for (let storey = 0; storey < DEMO.storeys; storey++) {
    const cs = columns().filter(b => b.storey === storey);
    const xs = [...new Set(cs.map(b => b.x))].sort((a, b) => a - b);
    const zs = [...new Set(cs.map(b => b.z))].sort((a, b) => a - b);
    assert.deepEqual(xs, [-4.5, -1.5, 1.5, 4.5]);
    assert.deepEqual(zs, [-3, 0, 3]);
  }
  for (const b of columns()) {
    assert.ok(Math.abs(b.hx - 0.15) < 1e-9 && Math.abs(b.hz - 0.15) < 1e-9);
    assert.ok(Math.abs(b.hy - 0.625) < 1e-9);
  }
});
test('demolitionLayout_OneSlabPerStoreyOnItsColumns', () => {
  const h = slabHalves(WIDE);
  for (const s of slabs()) {
    const below = columns().filter(b => b.storey === s.storey);
    assert.equal(below.length, 12);
    for (const c of below) assert.ok(Math.abs(c.y + c.hy - (s.y - s.hy)) < 1e-9);
    assert.ok(Math.abs(s.hx - h.x) < 1e-9 && Math.abs(s.hz - h.z) < 1e-9);
  }
});
test('slabHalves_ThreeBaysByTwo', () => {
  const h = slabHalves(WIDE);
  assert.ok(Math.abs(h.x - (4.5 + 0.15 + DEMO.overhang)) < 1e-9);
  assert.ok(Math.abs(h.z - (3 + 0.15 + DEMO.overhang)) < 1e-9);
});
// The slim tower of #86 is back as its own target next to the wide block (#99).
test('slimTower_Has30Blocks_2x2ColumnsPerStorey', () => {
  assert.equal(demolitionLayout(SLIM).length, 30);
  assert.equal(columns(SLIM).length, 24);
  for (let storey = 0; storey < DEMO.storeys; storey++) {
    const cs = columns(SLIM).filter(b => b.storey === storey);
    assert.deepEqual([...new Set(cs.map(b => b.x))].sort((a, b) => a - b), [-1.5, 1.5]);
    assert.deepEqual([...new Set(cs.map(b => b.z))].sort((a, b) => a - b), [-1.5, 1.5]);
  }
});
test('slimTower_NoOverlaps_EveryBlockSupported_SquareSlab', () => {
  assert.deepEqual(overlappingPairs(demolitionLayout(SLIM)), []);
  assert.deepEqual(unsupported(demolitionLayout(SLIM)), []);
  const h = slabHalves(SLIM);
  assert.ok(Math.abs(h.x - 1.9) < 1e-9 && Math.abs(h.z - 1.9) < 1e-9);
  const top = Math.max(...demolitionLayout(SLIM).map(b => b.y + b.hy));
  assert.ok(Math.abs(top - 9) < 1e-9);
});
test('isDemolitionMode_BothTowers', () => {
  assert.equal(isDemolitionMode('demolition'), true);
  assert.equal(isDemolitionMode('demolitionwide'), true);
  assert.equal(isDemolitionMode('chimney'), false);
});
test('demolitionLayout_SlabOverhangsColumns', () => {
  const s = slabs()[0], c = columns()[0];
  assert.ok(Math.abs(s.hx - (Math.abs(c.x) + c.hx + DEMO.overhang)) < 1e-9);
  assert.ok(Math.abs(s.hz - (Math.abs(c.z) + c.hz + DEMO.overhang)) < 1e-9);
});
test('demolitionLayout_TopAt9BaseUnits', () => {
  const top = Math.max(...demolitionLayout(WIDE).map(b => b.y + b.hy));
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

const col = () => ({ c: { x: 3, y: 5, z: -12 }, hx: 0.3, hy: 1.25, hz: 0.3 });
const chunks = (seed = 7) => { const { c, hx, hy, hz } = col(); return debrisChunks(c, hx, hy, hz, seed); };
const settle = (ch) => { for (let i = 0; i < 600; i++) stepChunk(ch, 1 / 60); return ch; };

test('debrisChunks_FivePerColumn_AtMost120ForTheTower', () => {
  assert.equal(chunks().length, DEBRIS.chunks);
  assert.ok(24 * DEBRIS.chunks <= 120);
});
test('debrisChunks_SameSeedSameChunks_OtherSeedDiffers', () => {
  assert.deepEqual(chunks(7), chunks(7));
  assert.notDeepEqual(chunks(7), chunks(8));
});
test('debrisChunks_StartInsideTheColumn_SmallerThanItsWidth', () => {
  const { c, hx, hy, hz } = col();
  for (const ch of chunks()) {
    assert.ok(Math.abs(ch.x - c.x) <= hx && Math.abs(ch.z - c.z) <= hz);
    assert.ok(ch.y >= c.y - hy && ch.y <= c.y + hy);
    assert.ok(ch.size > 0 && ch.size <= Math.min(hx, hz) * 1.1 + 1e-9);
  }
});
test('debrisChunks_ThrownOutwardAndUp_WithinLimits', () => {
  for (const ch of chunks()) {
    const h = Math.hypot(ch.vx, ch.vz);
    assert.ok(h >= DEBRIS.speed * 0.5 - 1e-9 && h <= DEBRIS.speed * 1.5 + 1e-9);
    assert.ok(ch.vy >= 0 && ch.vy <= DEBRIS.lift);
  }
});
test('stepChunk_Falls_UnderGravity', () => {
  const ch = chunks()[2], y0 = ch.y, vy0 = ch.vy;
  stepChunk(ch, 0.1);
  assert.ok(Math.abs(ch.vy - (vy0 - DEBRIS.gravity * 0.1)) < 1e-9);
  assert.ok(ch.y < y0 + vy0 * 0.1);
});
test('stepChunk_SettlesOnTheGround_NearTheColumn', () => {
  const { c } = col();
  for (const ch of chunks()) {
    settle(ch);
    assert.equal(ch.resting, true);
    assert.ok(Math.abs(ch.y - ch.size / 2) < 1e-9);
    assert.ok(Math.hypot(ch.x - c.x, ch.z - c.z) < 6, 'lands within a few metres');
  }
});
test('stepChunk_Resting_DoesNotMoveButAges', () => {
  const ch = settle(chunks()[0]), x = ch.x, age = ch.age;
  stepChunk(ch, 0.5);
  assert.equal(ch.x, x);
  assert.ok(Math.abs(ch.age - age - 0.5) < 1e-9);
});
test('chunkScale_FullThenShrinksToZeroAtLife', () => {
  assert.equal(chunkScale(0), 1);
  assert.equal(chunkScale(DEBRIS.life - DEBRIS.shrink), 1);
  assert.ok(Math.abs(chunkScale(DEBRIS.life - DEBRIS.shrink / 2) - 0.5) < 1e-9);
  assert.equal(chunkScale(DEBRIS.life), 0);
  assert.equal(chunkScale(DEBRIS.life + 1), 0);
});
test('dustPuff_GrowsAndFades_ThenGone', () => {
  const a = dustPuff(0), b = dustPuff(DEBRIS.dustLife / 2);
  assert.equal(a.scale, 1);
  assert.equal(a.opacity, DEBRIS.dustOpacity);
  assert.ok(b.scale > a.scale && b.opacity < a.opacity);
  assert.equal(dustPuff(DEBRIS.dustLife), null);
});
// world units: columns 6.0 apart (pitch 3 base x TSCALE 2), hy 1.25, axis centre y 1.25
const gcol = (x, z) => ({ position: { x, y: 1.25, z }, hy: 1.25, storey: 0 });
const row3 = () => [gcol(-6, 0), gcol(0, 0), gcol(6, 0)];

test('columnsToCrush_OnFace_OnlyThatColumn', () => {
  const cols = row3();
  assert.deepEqual(columnsToCrush({ x: 0, y: 1.2, z: 0.38 }, cols), [cols[1]]);
});
test('columnsToCrush_MidwayBetweenTwo_None', () => {
  assert.deepEqual(columnsToCrush({ x: -3, y: 0.3, z: 0 }, row3()), []);
});
test('DEMO_BreakRadius_BackTo1', () => {
  assert.equal(DEMO.breakRadius, 1.0);
});
test('columnsToCrush_ChargeHighOnGroundColumn_NeverTheOneAbove', () => {
  // review on #97: the column above is within reach too; only the nearest column's storey goes
  const ground = { position: { x: 0, y: 1.25, z: 0 }, hy: 1.25, storey: 0 };
  const above = { position: { x: 0, y: 4.25, z: 0 }, hy: 1.25, storey: 1 };
  const p = { x: 0.38, y: 2.4, z: 0 };
  assert.ok(distToColumnAxis(p, above.position, above.hy) < DEMO.breakRadius);   // both are in reach
  assert.deepEqual(columnsToCrush(p, [above, ground]), [ground]);
});
test('columnsToCrush_NothingInReach_Empty', () => {
  assert.deepEqual(columnsToCrush({ x: 5, y: 1, z: 0 }, [gcol(0, 0)]), []);
});
