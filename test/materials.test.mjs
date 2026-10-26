import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONTACT_PAIRS, DEFAULT_CONTACT, contactFor } from '../physics/materials.js';

test('contactFor_KnownPair_ReturnsTableValues', () => {
  assert.deepEqual(contactFor('ball', 'ground'), { friction: 0.4, restitution: 0.75 });
  assert.deepEqual(contactFor('stone', 'stone'), { friction: 0.7, restitution: 0.0 });
});
test('contactFor_ReversedOrder_SameResult', () => {
  assert.deepEqual(contactFor('ground', 'ball'), contactFor('ball', 'ground'));
});
test('contactFor_UnpairedMaterials_ReturnsCannonDefault', () => {
  assert.deepEqual(contactFor('card', 'barrel'), { friction: 0.3, restitution: 0 });
  assert.deepEqual(DEFAULT_CONTACT, { friction: 0.3, restitution: 0 });
});
test('contactFor_Masonry_SlipperierThanStone', () => {
  assert.deepEqual(contactFor('masonry', 'masonry'), { friction: 0.35, restitution: 0.0 });
  assert.deepEqual(contactFor('masonry', 'ground'), { friction: 0.45, restitution: 0.0 });
  assert.deepEqual(contactFor('masonry', 'ball'), contactFor('stone', 'ball'));
  assert.deepEqual(contactFor('masonry', 'heavy'), contactFor('stone', 'heavy'));
});
test('CONTACT_PAIRS_HasSeventeenPairs', () => assert.equal(CONTACT_PAIRS.length, 17));
