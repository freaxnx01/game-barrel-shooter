import test from 'node:test';
import assert from 'node:assert/strict';
import { PAINT_COLORS, RANDOM_PAINT, nextPaintChoice, paintIndexForShot } from '../weapons/paintball.js';

test('PAINT_COLORS_Palette_SevenWithRedFirst', () => {
  assert.equal(PAINT_COLORS.length, 7);
  assert.deepEqual(PAINT_COLORS[0], { name: 'Red', ball: '#e23b3b', splat: '#d62828' });
  assert.deepEqual(PAINT_COLORS.map((c) => c.name), ['Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple', 'Pink']);
});

test('nextPaintChoice_Cycle_ColoursThenRandomThenRed', () => {
  assert.equal(nextPaintChoice(0), 1);
  assert.equal(nextPaintChoice(5), 6);
  assert.equal(nextPaintChoice(6), RANDOM_PAINT);
  assert.equal(nextPaintChoice(RANDOM_PAINT), 0);
});

test('paintIndexForShot_FixedChoice_ThatColour', () => {
  assert.equal(paintIndexForShot(3, 1, () => 0.9), 3);
  assert.equal(paintIndexForShot(0, null, () => 0.5), 0);
});

test('paintIndexForShot_RandomFirstShot_AnyColour', () => {
  assert.equal(paintIndexForShot(RANDOM_PAINT, null, () => 0), 0);
  assert.equal(paintIndexForShot(RANDOM_PAINT, null, () => 0.999), 6);
});

test('paintIndexForShot_RandomAfterAShot_SkipsPrevious', () => {
  assert.equal(paintIndexForShot(RANDOM_PAINT, 0, () => 0), 1);
  assert.equal(paintIndexForShot(RANDOM_PAINT, 3, () => 0.5), 4);
  assert.equal(paintIndexForShot(RANDOM_PAINT, 6, () => 0.999), 5);
});

test('paintIndexForShot_RandomEveryPrevAndRng_NeverRepeats', () => {
  for (let prev = 0; prev < PAINT_COLORS.length; prev++) {
    for (let i = 0; i < 1000; i++) {
      const idx = paintIndexForShot(RANDOM_PAINT, prev, () => i / 1000);
      assert.notEqual(idx, prev);
      assert.ok(Number.isInteger(idx) && idx >= 0 && idx < PAINT_COLORS.length);
    }
  }
});