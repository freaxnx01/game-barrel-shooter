import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SUPPORT, supportPatches, isSupported, pushFor, selectPushes, createBarrelSupport } from '../targets/barrel-support.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const ROW = 0.45 * 2.3;
const y0 = 0.5 + 0.55 + 0.01;
const y1 = y0 + 1.12;
const up = (id, x, y) => ({ id, x, y, z: -6, upright: true, speed: 0 });

function pyramid({ without } = {}) {
  const rows = [6, 5, 4, 3, 2, 1];
  const baseY = y0;
  const z = -6;
  const out = [];
  rows.forEach((count, row) => {
    const y = baseY + row * 1.12;
    const x0 = -((count - 1) * ROW) / 2;
    for (let i = 0; i < count; i++) {
      const id = `r${row}c${i}`;
      if (id === without) continue;
      out.push({ id, x: x0 + i * ROW, y, z, upright: true, speed: 0 });
    }
  });
  return out;
}

function gapWith(overrides = {}) {
  const s = pyramid({ without: 'r1c2' });
  for (const [id, fields] of Object.entries(overrides)) {
    const item = s.find(x => x.id === id);
    if (item) Object.assign(item, fields);
  }
  return s;
}

// ---- Task 1: support geometry ----

test('isSupported_OnPlatform_True', () => {
  assert.equal(isSupported(up(1, 0, y0), [], [0, 0.5]), true);
});
test('isSupported_BetweenTwoBarrels_True', () => {
  const a = up(1, -ROW / 2, y0), b = up(2, ROW / 2, y0), top = up(3, 0, y1);
  assert.equal(isSupported(top, [a, b], [0, 0.5]), true);
});
test('isSupported_OneSupportGone_Issue28_False', () => {
  const a = up(1, -ROW / 2, y0), top = up(3, 0, y1);
  assert.equal(isSupported(top, [a], [0, 0.5]), false);
});
test('isSupported_CentredOnOneBarrel_True', () => {
  assert.equal(isSupported(up(3, 0.1, y1), [up(1, 0, y0)], [0, 0.5]), true);
});
test('isSupported_COMJustInsideMargin_True', () => {
  const a = up(1, 0, y0), top = up(3, 0.4725 + 0.01, y1);
  assert.equal(isSupported(top, [a], [0, 0.5]), true);
});
test('supportPatches_BarrelTooFarBelow_NotASupport', () => {
  const p = supportPatches(up(3, 0, y1), [up(1, 0, y0 - 0.2)], [0, 0.5]);
  assert.equal(p.points.length, 0);
});
test('supportPatches_TiltedNeighbour_Ignored', () => {
  const tilted = { ...up(1, 0, y0), upright: false };
  assert.equal(supportPatches(up(3, 0, y1), [tilted], [0, 0.5]).points.length, 0);
});
test('pushFor_Supported_Null', () => {
  assert.equal(pushFor(up(1, 0, y0), [], [0, 0.5], 8), null);
});
test('pushFor_OverhangToPlusX_PushesPlusXNeverUp', () => {
  const a = up(1, -ROW / 2, y0), top = up(3, 0, y1);
  const { impulse, spin } = pushFor(top, [a], [0, 0.5], 8);
  assert.ok(impulse.x > 0); assert.equal(impulse.y, 0); assert.ok(Math.abs(impulse.z) < 1e-9);
  close(Math.hypot(impulse.x, impulse.z), 8 * SUPPORT.pushSpeed);
  assert.ok(spin.z < 0); close(Math.hypot(spin.x, spin.z), SUPPORT.tipSpin); assert.equal(spin.y, 0);
});