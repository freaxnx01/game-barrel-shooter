import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spheroidPoints } from '../physics/spheroid.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

function triples(flat) {
  const out = [];
  for (let i = 0; i < flat.length; i += 3) out.push({ x: flat[i], y: flat[i + 1], z: flat[i + 2] });
  return out;
}

test('spheroidPoints_AllPoints_LieOnTheSurface', () => {
  const pts = triples(spheroidPoints(0.34, 0.2));
  for (const p of pts) close((p.x * p.x + p.z * p.z) / 0.04 + (p.y * p.y) / (0.34 * 0.34), 1);
});

test('spheroidPoints_LongAxisAlongY_TipsAtHalfLength', () => {
  const pts = triples(spheroidPoints(0.34, 0.2));
  close(Math.max(...pts.map((p) => p.y)), 0.34);
  close(Math.min(...pts.map((p) => p.y)), -0.34);
  assert.ok(pts.some((p) => p.x === 0 && p.z === 0 && p.y === 0.34), 'top tip present');
});

test('spheroidPoints_Equator_ReachesRadius', () => {
  const pts = triples(spheroidPoints(0.34, 0.2));
  close(Math.max(...pts.map((p) => Math.hypot(p.x, p.z))), 0.2);
});

test('spheroidPoints_DefaultResolution_9RingsOf12PlusTips', () => {
  assert.equal(spheroidPoints(0.34, 0.2).length, (9 * 12 + 2) * 3);
});

test('spheroidPoints_InvalidSize_Throws', () => {
  assert.throws(() => spheroidPoints(0, 0.2), /spheroid/);
  assert.throws(() => spheroidPoints(0.3, -1), /spheroid/);
});
