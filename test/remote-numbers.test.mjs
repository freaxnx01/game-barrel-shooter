import test from 'node:test';
import assert from 'node:assert/strict';
import { nextChargeNumber, chargeLabelScale } from '../weapons/charges.js';
import { shownNumbers, numberRowShown } from '../ui/actions.js';

test('nextChargeNumber_NoneUsed_One', () => {
  assert.equal(nextChargeNumber([]), 1);
});
test('nextChargeNumber_LowestFreeGap', () => {
  assert.equal(nextChargeNumber([1, 3]), 2);
  assert.equal(nextChargeNumber([2, 3]), 1);
});
test('nextChargeNumber_ReusesNumberAfterItWentOff', () => {
  assert.equal(nextChargeNumber([1, 2, 3, 4, 5, 6].filter((n) => n !== 4)), 4);
});
test('nextChargeNumber_AllSixUsed_Zero', () => {
  assert.equal(nextChargeNumber([1, 2, 3, 4, 5, 6]), 0);
});
test('chargeLabelScale_GameDistance_ReadableSize', () => {
  assert.ok(Math.abs(chargeLabelScale(52) - 1.82) < 1e-9);
});
test('chargeLabelScale_ClampedBothWays', () => {
  assert.equal(chargeLabelScale(1), 0.5);
  assert.equal(chargeLabelScale(500), 2);
});
test('shownNumbers_SortedUniqueAndValidOnly', () => {
  assert.deepEqual(shownNumbers([3, 1, 3, 0, 7, 2.5, undefined]), [1, 3]);
  assert.deepEqual(shownNumbers([]), []);
});
test('numberRowShown_NeedsOpenAndArmed', () => {
  assert.equal(numberRowShown(true, 2), true);
  assert.equal(numberRowShown(true, 0), false);
  assert.equal(numberRowShown(false, 3), false);
});

test('nextChargeNumber_WithCap12_GivesNumbersAbove6', () => {
  // #99: the demolition tower allows 12 charges
  assert.equal(nextChargeNumber([1, 2, 3, 4, 5, 6], 12), 7);
  assert.equal(nextChargeNumber([1, 2, 3, 4, 5, 6]), 0);
  assert.equal(nextChargeNumber([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 12), 0);
});

test('shownNumbers_WithCap12_KeepsNumbersAbove6', () => {
  assert.deepEqual(shownNumbers([12, 7, 3], 12), [3, 7, 12]);
  assert.deepEqual(shownNumbers([12, 7, 3]), [3]);
});
