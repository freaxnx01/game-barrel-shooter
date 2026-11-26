import test from 'node:test';
import assert from 'node:assert/strict';
import { SCOPE, scopeDiameter, scopeRect, aimToScreen, scopeFov, scopeTextureSize, scopeNdcTransform } from '../weapons/scope.js';

test('scopeDiameter_Landscape_FractionOfHeight', () => {
  assert.equal(scopeDiameter(1280, 720), Math.round(720 * SCOPE.fraction));
  assert.equal(scopeDiameter(390, 844), Math.round(390 * SCOPE.fraction));
});

test('scopeRect_MouseMidScreen_CentredOnAim', () => {
  assert.deepEqual(scopeRect(640, 360, 1280, 720), { x: 640, y: 360, size: 288 });
});

test('scopeRect_MouseInCorner_StaysOnScreen', () => {
  assert.deepEqual(scopeRect(10, 10, 1280, 720), { x: 144, y: 144, size: 288 });
  assert.deepEqual(scopeRect(1275, 715, 1280, 720), { x: 1136, y: 576, size: 288 });
});

test('scopeRect_Touch_LiftedAboveFinger', () => {
  assert.deepEqual(scopeRect(195, 520, 390, 844, true), { x: 195, y: 520 - 156 * SCOPE.lift, size: 156 });
});

test('scopeRect_TouchNearTop_ClampedNotOffScreen', () => {
  assert.deepEqual(scopeRect(195, 100, 390, 844, true), { x: 195, y: 78, size: 156 });
});

test('aimToScreen_NdcCorners_MapToPixels', () => {
  assert.deepEqual(aimToScreen(0, 0, 1280, 720), { x: 640, y: 360 });
  assert.deepEqual(aimToScreen(-1, 1, 1280, 720), { x: 0, y: 0 });
  assert.deepEqual(aimToScreen(1, -1, 1280, 720), { x: 1280, y: 720 });
});

test('scopeFov_5xOf55Degrees_About12Degrees', () => {
  const fov = scopeFov(55);
  assert.ok(fov > 11.5 && fov < 12.5, `fov ${fov}`);
  assert.ok(Math.abs(scopeFov(55, 1) - 55) < 1e-9);
});

test('scopeTextureSize_OneToOneWithScreen_Capped', () => {
  assert.equal(scopeTextureSize(288, 2), 576);
  assert.equal(scopeTextureSize(288, 3), SCOPE.maxTexture);
  assert.equal(scopeTextureSize(156, 3), 468);
});

test('scopeNdcTransform_CentreRect_UnitCircleScaledToPixels', () => {
  assert.deepEqual(scopeNdcTransform({ x: 640, y: 360, size: 288 }, 1280, 720), { x: 0, y: 0, scaleX: 0.225, scaleY: 0.4 });
  const t = scopeNdcTransform({ x: 144, y: 144, size: 288 }, 1280, 720);
  assert.ok(Math.abs(t.x - (-0.775)) < 1e-12 && Math.abs(t.y - 0.6) < 1e-12);
});
test('scopeFov_SmallCircle_PerceivedMagnificationIsFive', () => {
  // the circle shows its FOV in `size` px where the main view spreads its FOV over the screen height,
  // so the scope FOV must shrink by size/height too (#94 review): 5x on desktop and portrait phones
  const tanHalf = (deg) => Math.tan((deg * Math.PI) / 360);
  for (const [w, h] of [[1280, 720], [390, 844]]) {
    const size = scopeDiameter(w, h);
    const fov = scopeFov(55, SCOPE.magnification, size / h);
    const perceived = (tanHalf(55) / tanHalf(fov)) * (size / h);
    assert.ok(Math.abs(perceived - SCOPE.magnification) < 1e-9, `${w}x${h}: ${perceived}`);
  }
});
