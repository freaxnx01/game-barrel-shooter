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
test('pushFor_OverhangToPlusX_PushesPlusXTurnedBySlideTurnNeverUp', () => {
  const a = up(1, -ROW / 2, y0), top = up(3, 0, y1);
  const { impulse } = pushFor(top, [a], [0, 0.5], 8);
  assert.ok(impulse.x > 0); assert.equal(impulse.y, 0);
  close(Math.atan2(impulse.z, impulse.x), SUPPORT.slideTurn);
  close(Math.hypot(impulse.x, impulse.z), 8 * SUPPORT.pushSpeed);
});
test('pushFor_PartnersOverOneGap_SlidePastOnOppositeSides', () => {
  const s = pyramid({ without: 'r1c2' });
  const left = s.find(b => b.id === 'r2c1'), right = s.find(b => b.id === 'r2c2');
  const l = pushFor(left, s.filter(b => b !== left), [0, 0.5], 8).impulse;
  const r = pushFor(right, s.filter(b => b !== right), [0, 0.5], 8).impulse;
  assert.ok(l.x > 0 && r.x < 0);
  assert.ok(l.z * r.z < 0);
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
  const calls = { wake: [], applyImpulse: [], getVelocity: [], getAngularVelocity: [], setQuaternion: [], setFriction: [], restoreFriction: [] };
  return {
    calls,
    wake(h) { calls.wake.push(h); },
    applyImpulse(h, x, y, z) { calls.applyImpulse.push({ h, x, y, z }); },
    getVelocity(h) { calls.getVelocity.push(h); return h._vel || { x: 0, y: 0, z: 0 }; },
    getAngularVelocity(h) { calls.getAngularVelocity.push(h); return { x: 0, y: 0, z: 0 }; },
    setQuaternion(h, x, y, z, w) { calls.setQuaternion.push({ h, x, y, z, w }); },
    setFriction(h, f) { calls.setFriction.push({ h, f }); },
    restoreFriction(h) { calls.restoreFriction.push(h); },
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
// ---- slide push with released friction, no pop ----

function pushedRun() {
  const fake = fakePhys();
  const sup = createBarrelSupport({ phys: fake, floors: [0, 0.5] });
  const pieces = piecesFrom(pyramid({ without: 'r1c2' }));
  pieces[0].body._vel = { x: 0, y: 2, z: 0 };
  sup.tick(0, pieces);
  pieces[0].body._vel = { x: 0, y: 0, z: 0 };
  return { fake, sup, pieces };
}
function pushedTick() {
  return pushedRun().fake.calls;
}
const pushedIds = (calls) => calls.applyImpulse.map(i => i.h);
// moving faster than maxSpeed: still upright, but no longer a push candidate
function holdMoving(pieces) {
  for (const p of pieces) p.body._vel = { x: 1, y: 0, z: 0 };
}
function tipAll(pieces) {
  for (const p of pieces) p.body.quaternion = { x: 0.2, y: 0, z: 0, w: 0.98 };
}

test('tick_Push_ImpulseHasNoUpwardComponent', () => {
  const calls = pushedTick();
  assert.equal(calls.applyImpulse.length, 2);
  for (const i of calls.applyImpulse) assert.equal(i.y, 0);
});
test('tick_Push_DropsFrictionToSlipFriction', () => {
  const calls = pushedTick();
  assert.equal(calls.setFriction.length, 2);
  for (const c of calls.setFriction) assert.equal(c.f, SUPPORT.slipFriction);
  assert.deepEqual(calls.setFriction.map(c => c.h), pushedIds(calls));
});
test('tick_SlippingBeforeSlipMs_KeepsFrictionDropped', () => {
  const { fake, sup, pieces } = pushedRun();
  holdMoving(pieces);
  sup.tick(SUPPORT.slipMs - 1, pieces);
  assert.equal(fake.calls.restoreFriction.length, 0);
});
test('tick_SlipMsAfterLastPush_RestoresFrictionOnce', () => {
  const { fake, sup, pieces } = pushedRun();
  holdMoving(pieces);
  sup.tick(SUPPORT.slipMs, pieces);
  sup.tick(SUPPORT.slipMs + 200, pieces);
  assert.deepEqual(fake.calls.restoreFriction, pushedIds(fake.calls));
});
test('tick_RepushedWhileSlipping_ExtendsSlipWindow', () => {
  const { fake, sup, pieces } = pushedRun();
  sup.tick(SUPPORT.repushMs, pieces);          // still unsupported: pushed again
  holdMoving(pieces);
  sup.tick(SUPPORT.slipMs, pieces);
  assert.equal(fake.calls.restoreFriction.length, 0);
});
test('tick_SlippingBarrelTipped_RestoresFriction', () => {
  const { fake, sup, pieces } = pushedRun();
  tipAll(pieces);
  sup.tick(1, pieces);
  assert.deepEqual(fake.calls.restoreFriction, pushedIds(fake.calls));
});
test('tick_QuietLongAfterPush_StillRestoresFriction', () => {
  const { fake, sup, pieces } = pushedRun();
  sup.tick(SUPPORT.activeMs + SUPPORT.slipMs + 1, pieces);
  assert.equal(fake.calls.restoreFriction.length, 2);
});
test('tick_Push_NoQuaternionTeleport', () => {
  assert.equal(pushedTick().setQuaternion.length, 0);
});
