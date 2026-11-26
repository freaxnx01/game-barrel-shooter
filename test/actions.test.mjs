import test from 'node:test';
import assert from 'node:assert/strict';
import { visibleActions, CUT_KEY } from '../ui/actions.js';

const none = { tethered: false, armed: 0, mobile: false };

test('visibleActions_Idle_Desktop_OnlyQuake', () => {
  // Quake shows on desktop too, next to holding Shift (playtest 2026-11-26)
  assert.deepEqual(visibleActions(none), { quake: true, pull: false, cut: false, boom: false });
});
test('visibleActions_Idle_Mobile_OnlyQuake', () => {
  assert.deepEqual(visibleActions({ ...none, mobile: true }), { quake: true, pull: false, cut: false, boom: false });
});
test('visibleActions_Tethered_PullAndCut', () => {
  const v = visibleActions({ ...none, tethered: true });
  assert.equal(v.pull, true);
  assert.equal(v.cut, true);
  assert.equal(v.boom, false);
});
test('visibleActions_ArmedCharges_Boom', () => {
  assert.equal(visibleActions({ ...none, armed: 1 }).boom, true);
  assert.equal(visibleActions({ ...none, armed: 6 }).boom, true);
});
test('visibleActions_EverythingAtOnce_Mobile', () => {
  assert.deepEqual(visibleActions({ tethered: true, armed: 2, mobile: true }), { quake: true, pull: true, cut: true, boom: true });
});
test('CUT_KEY_IsLowercaseLetterO', () => {
  assert.equal(CUT_KEY, 'o');
});
