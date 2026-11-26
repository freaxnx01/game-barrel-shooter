import test from 'node:test';
import assert from 'node:assert/strict';
import { PAINT_COLORS, RANDOM_PAINT, paintDotInfo } from '../weapons/paintball.js';

test('paintDotInfo_EveryColour_UsesBallColourAndName', () => {
  PAINT_COLORS.forEach((c, i) => {
    const d = paintDotInfo(i);
    assert.equal(d.color, c.ball);
    assert.equal(d.glyph, '');
    assert.equal(d.label, c.name);
    assert.equal(d.title, `Paint colour: ${c.name}, click to change`);
  });
});
test('paintDotInfo_Random_ShowsDice', () => {
  const d = paintDotInfo(RANDOM_PAINT);
  assert.equal(d.color, null);
  assert.equal(d.glyph, '🎲');
  assert.equal(d.title, 'Paint colour: Random, click to change');
});