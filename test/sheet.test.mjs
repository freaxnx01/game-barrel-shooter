import test from 'node:test';
import assert from 'node:assert/strict';
import { sheetAfter } from '../ui/sheet.js';

test('sheetAfter_OpenAmmo_ShowsAmmo', () => {
  assert.equal(sheetAfter(null, 'open-ammo'), 'ammo');
});
test('sheetAfter_OpenTargetWhileAmmoOpen_SwitchesToTarget', () => {
  assert.equal(sheetAfter('ammo', 'open-target'), 'target');
});
test('sheetAfter_CloseEvents_Close', () => {
  for (const ev of ['backdrop', 'pick', 'escape', 'layout-change']) {
    assert.equal(sheetAfter('ammo', ev), null, ev);
    assert.equal(sheetAfter(null, ev), null, ev);
  }
});
test('sheetAfter_UnknownEvent_KeepsState', () => {
  assert.equal(sheetAfter('target', 'nonsense'), 'target');
  assert.equal(sheetAfter(null, 'nonsense'), null);
});
test('sheetAfter_PickKeepOpen_KeepsAmmoOpen', () => {
  assert.equal(sheetAfter('ammo', 'pick-keep-open'), 'ammo');
});
test('sheetAfter_PickKeepOpenWhileClosed_StaysClosed', () => {
  assert.equal(sheetAfter(null, 'pick-keep-open'), null);
});
test('sheetAfter_PickAfterKeepOpen_Closes', () => {
  assert.equal(sheetAfter(sheetAfter('ammo', 'pick-keep-open'), 'pick'), null);
});
