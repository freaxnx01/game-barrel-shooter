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

// ---- Task 2: controller ----

test('selectPushes_IntactPyramid_None', () => {
  assert.deepEqual(selectPushes(pyramid(), [0, 0.5], 0, new Map()), []);
});
test('selectPushes_Row2MiddleRemoved_PushesBothRow3BarrelsAboveGap', () => {
  const ids = selectPushes(pyramid({ without: 'r1c2' }), [0, 0.5], 0, new Map()).map(p => p.id).sort();
  assert.deepEqual(ids, ['r2c1', 'r2c2']);
});
test('selectPushes_TopBarrelRemoved_None', () => {
  assert.deepEqual(selectPushes(pyramid({ without: 'r5c0' }), [0, 0.5], 0, new Map()), []);
});
test('selectPushes_PushIncludesBarrelsRestingOnIt_InWake', () => {
  const p = selectPushes(pyramid({ without: 'r1c2' }), [0, 0.5], 0, new Map()).find(x => x.id === 'r2c1');
  assert.ok(p.wake.includes('r2c1') && p.wake.includes('r3c0') && p.wake.includes('r3c1'));
});
test('selectPushes_FastOrTiltedPiece_Skipped', () => {
  // both gap barrels fast but still upright: they stay supports for the rows
  // above, so nothing is pushed (the fast pair is skipped as candidates)
  assert.deepEqual(selectPushes(gapWith({ r2c1: { speed: 1 }, r2c2: { speed: 1 } }), [0, 0.5], 0, new Map()), []);
});
test('selectPushes_TiltedPiece_NotInPushList', () => {
  // a tilted barrel is never a candidate, even if it is itself unsupported
  const ids = selectPushes(gapWith({ r2c1: { upright: false } }), [0, 0.5], 0, new Map()).map(p => p.id);
  assert.ok(!ids.includes('r2c1'));
});
test('selectPushes_WithinRepushDelay_NotPushedAgain', () => {
  const log = new Map(); const s = pyramid({ without: 'r1c2' });
  selectPushes(s, [0, 0.5], 0, log);
  assert.deepEqual(selectPushes(s, [0, 0.5], SUPPORT.repushMs - 1, log), []);
});
test('selectPushes_StillUnsupportedAfterRepushDelay_PushedAgain', () => {
  const log = new Map(); const s = pyramid({ without: 'r1c2' });
  selectPushes(s, [0, 0.5], 0, log);
  assert.equal(selectPushes(s, [0, 0.5], SUPPORT.repushMs, log).length, 2);
  assert.equal(log.get('r2c1').count, 2);
});
test('selectPushes_AfterMaxPushes_NotPushed', () => {
  const log = new Map([['r2c1', { count: SUPPORT.maxPushes, lastAt: 0 }], ['r2c2', { count: SUPPORT.maxPushes, lastAt: 0 }]]);
  assert.deepEqual(selectPushes(pyramid({ without: 'r1c2' }), [0, 0.5], 10_000, log), []);
});

function fakePhys() {
  const calls = { wake: [], applyImpulse: [], getVelocity: [], getAngularVelocity: [], setAngularVelocity: [], setQuaternion: [] };
  return {
    calls,
    wake(h) { calls.wake.push(h); },
    applyImpulse(h, x, y, z) { calls.applyImpulse.push({ h, x, y, z }); },
    getVelocity(h) { calls.getVelocity.push(h); return h._vel || { x: 0, y: 0, z: 0 }; },
    getAngularVelocity(h) { calls.getAngularVelocity.push(h); return { x: 0, y: 0, z: 0 }; },
    setAngularVelocity(h, x, y, z) { calls.setAngularVelocity.push({ h, x, y, z }); },
    setQuaternion(h, x, y, z, w) { calls.setQuaternion.push({ h, x, y, z, w }); },
  };
}
function piecesFrom(snaps, vel) {
  return snaps.map(s => ({
    body: { material: 'barrel', position: { x: s.x, y: s.y, z: s.z }, quaternion: { x: 0, y: 0, z: 0, w: 1 }, _vel: vel || { x: 0, y: 0, z: 0 } },
  }));
}

test('tick_NeverDisturbed_NoPushes', () => {
  const fake = fakePhys();
  const sup = createBarrelSupport({ phys: fake, floors: [0, 0.5] });
  const pieces = piecesFrom(pyramid());
  let total = 0;
  for (let t = 0; t <= 5000; t += 120) total += sup.tick(t, pieces);
  assert.equal(total, 0);
  assert.equal(fake.calls.applyImpulse.length, 0);
});
test('tick_AfterMotionAndGap_PushesAndWakes', () => {
  const fake = fakePhys();
  const sup = createBarrelSupport({ phys: fake, floors: [0, 0.5] });
  const pieces = piecesFrom(pyramid({ without: 'r1c2' }));
  pieces[0].body._vel = { x: 0, y: 2, z: 0 };
  const pushes = sup.tick(0, pieces);
  assert.equal(pushes, 2);
  assert.ok(fake.calls.wake.length >= 4);
});
test('tick_CalledFasterThanPeriod_ChecksOncePerPeriod', () => {
  const fake = fakePhys();
  const sup = createBarrelSupport({ phys: fake, floors: [0, 0.5] });
  const pieces = piecesFrom(pyramid({ without: 'r1c2' }));
  pieces[0].body._vel = { x: 0, y: 2, z: 0 };
  let checks = 0;
  for (let t = 0; t <= 110; t += 10) { if (sup.tick(t, pieces) > 0) checks++; }
  assert.equal(checks, 1);
});
test('tick_QuietLongerThanActiveMs_StopsChecking', () => {
  const fake = fakePhys();
  const sup = createBarrelSupport({ phys: fake, floors: [0, 0.5] });
  const pieces = piecesFrom(pyramid());
  pieces[0].body._vel = { x: 0, y: 2, z: 0 };
  sup.tick(0, pieces);
  pieces[0].body._vel = { x: 0, y: 0, z: 0 };
  let pushesAfter = 0;
  for (let t = 120; t <= SUPPORT.activeMs + 200; t += 120) pushesAfter += sup.tick(t, pieces);
  assert.equal(pushesAfter, 0);
});
test('tick_NonBarrelMaterial_Ignored', () => {
  const fake = fakePhys();
  const sup = createBarrelSupport({ phys: fake, floors: [0, 0.5] });
  const pieces = pyramid({ without: 'r1c2' }).map(s => ({
    body: { material: 'stone', position: { x: s.x, y: s.y, z: s.z }, quaternion: { x: 0, y: 0, z: 0, w: 1 }, _vel: { x: 0, y: 2, z: 0 } },
  }));
  sup.tick(0, pieces);
  assert.equal(fake.calls.applyImpulse.length, 0);
});
test('reset_ClearsPushLogAndDisturbed', () => {
  const fake = fakePhys();
  const sup = createBarrelSupport({ phys: fake, floors: [0, 0.5] });
  const pieces = piecesFrom(pyramid({ without: 'r1c2' }));
  pieces[0].body._vel = { x: 0, y: 2, z: 0 };
  sup.tick(0, pieces);
  pieces[0].body._vel = { x: 0, y: 0, z: 0 };
  sup.reset();
  assert.equal(sup.tick(0, pieces), 0);
});
// ---- tip spin, no pop ----

function pushedTick() {
  const fake = fakePhys();
  const sup = createBarrelSupport({ phys: fake, floors: [0, 0.5] });
  const pieces = piecesFrom(pyramid({ without: 'r1c2' }));
  pieces[0].body._vel = { x: 0, y: 2, z: 0 };
  sup.tick(0, pieces);
  return fake.calls;
}

test('tick_Push_ImpulseHasNoUpwardComponent', () => {
  const calls = pushedTick();
  assert.equal(calls.applyImpulse.length, 2);
  for (const i of calls.applyImpulse) assert.equal(i.y, 0);
});
test('tick_Push_SpinAxisHorizontal', () => {
  const calls = pushedTick();
  assert.equal(calls.setAngularVelocity.length, 2);
  for (const s of calls.setAngularVelocity) assert.equal(s.y, 0);
});
test('tick_Push_SpinMagnitudeIsTipSpin', () => {
  const calls = pushedTick();
  assert.equal(calls.setAngularVelocity.length, 2);
  for (const s of calls.setAngularVelocity) close(Math.hypot(s.x, s.y, s.z), SUPPORT.tipSpin);
});
test('tick_Push_SpinAxisPerpendicularToPushTipsTowardGap', () => {
  const calls = pushedTick();
  assert.equal(calls.setAngularVelocity.length, 2);
  for (const s of calls.setAngularVelocity) {
    const i = calls.applyImpulse.find(p => p.h === s.h);
    close(s.x * i.x + s.z * i.z, 0);
    // top moves along the push: (spin x up) . push > 0  with up = (0,1,0) -> spin x up = (-s.z, 0, s.x)
    assert.ok(-s.z * i.x + s.x * i.z > 0);
  }
});
test('tick_Push_NoQuaternionTeleport', () => {
  assert.equal(pushedTick().setQuaternion.length, 0);
});
