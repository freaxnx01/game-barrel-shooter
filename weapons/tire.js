export const TIRE = {
  radius: 0.8,
  width: 0.55,
  mass: 40,
  spawnAhead: 2.5,
  baseSpeed: 8,
  speedRange: 12,
  resist: 2.0,
  tipSpeed: 2.5,
  tipAxleMax: Math.PI / 6,
  tipSpin: 1.5,
  leanRate: Math.PI / 3,   // rad/s while the tip is driven
  leanUntil: Math.PI / 7,  // ~26°, past the ~19° balance point of a 1.6 × 0.55 m tire
};

function horizDir(v) {
  const len = Math.hypot(v.x, v.z);
  return { x: len > 1e-9 ? v.x / len : 0, z: len > 1e-9 ? v.z / len : 0, len };
}

function quatFromUnitVectors(fx, fy, fz, tx, ty, tz) {
  const r = fx * tx + fy * ty + fz * tz + 1;
  let x, y, z;
  if (r <= 1e-6) {
    if (Math.abs(fx) > Math.abs(fz)) { x = -fy; y = fx; z = 0; }
    else { x = 0; y = -fz; z = fy; }
  } else {
    x = fy * tz - fz * ty;
    y = fz * tx - fx * tz;
    z = fx * ty - fy * tx;
  }
  const w = r;
  const len = Math.hypot(x, y, z, w) || 1;
  return { x: x / len, y: y / len, z: z / len, w: w / len };
}

export function tireLaunch(camPos, aim, camForward, power) {
  let dir = horizDir(aim);
  if (dir.len < 0.1) dir = horizDir(camForward);
  if (dir.len < 1e-9) { dir = { x: 0, z: -1, len: 1 }; }
  const speed = TIRE.baseSpeed + TIRE.speedRange * power;
  const velocity = { x: dir.x * speed, y: 0, z: dir.z * speed };
  const position = {
    x: camPos.x + dir.x * TIRE.spawnAhead,
    y: TIRE.radius + 0.01,
    z: camPos.z + dir.z * TIRE.spawnAhead,
  };
  const angularVelocity = {
    x: velocity.z / TIRE.radius,
    y: 0,
    z: -velocity.x / TIRE.radius,
  };
  const axleLen = Math.hypot(velocity.z, -velocity.x);
  const ax = axleLen > 1e-9 ? velocity.z / axleLen : 0;
  const az = axleLen > 1e-9 ? -velocity.x / axleLen : -1;
  const quaternion = quatFromUnitVectors(0, 1, 0, ax, 0, az);
  return { position, velocity, angularVelocity, quaternion };
}

export function rollingStep(velocity, angularVelocity, dt) {
  const speed = Math.hypot(velocity.x, velocity.z);
  const decel = TIRE.resist * dt;
  const newSpeed = Math.max(speed - decel, 0);
  const factor = speed > 1e-9 ? newSpeed / speed : 0;
  return {
    velocity: { x: velocity.x * factor, y: velocity.y, z: velocity.z * factor },
    angularVelocity: {
      x: angularVelocity.x * factor,
      y: angularVelocity.y * factor,
      z: angularVelocity.z * factor,
    },
  };
}

export function axleTilt(quaternion) {
  const { x, z } = quaternion;
  const ry = 1 - 2 * (x * x + z * z);
  return Math.asin(Math.max(-1, Math.min(1, Math.abs(ry))));
}

export function shouldTip(velocity, quaternion, alreadyTipped) {
  if (alreadyTipped) return false;
  const speed = Math.hypot(velocity.x, velocity.z);
  if (speed >= TIRE.tipSpeed) return false;
  return axleTilt(quaternion) < TIRE.tipAxleMax;
}

export function tipSpin(velocity, rand) {
  const h = Math.hypot(velocity.x, velocity.z);
  if (h < 1e-9) return { x: 0, y: 0, z: 0 };
  const sign = rand < 0.5 ? -1 : 1;
  const m = TIRE.tipSpin * sign;
  return { x: (velocity.x / h) * m, y: 0, z: (velocity.z / h) * m };
}
// rotate the tire by leanRate * dt about a horizontal world axis (the roll direction)
export function leanStep(quaternion, axis, dt) {
  const half = TIRE.leanRate * dt / 2, s = Math.sin(half);
  const r = { x: axis.x * s, y: axis.y * s, z: axis.z * s, w: Math.cos(half) };
  const q = quaternion;
  return {
    x: r.w * q.x + r.x * q.w + r.y * q.z - r.z * q.y,
    y: r.w * q.y - r.x * q.z + r.y * q.w + r.z * q.x,
    z: r.w * q.z + r.x * q.y - r.y * q.x + r.z * q.w,
    w: r.w * q.w - r.x * q.x - r.y * q.y - r.z * q.z,
  };
}

// centre height of a tire leaning by `tilt` with its lower tread edge on the ground
export function restHeight(tilt) {
  return TIRE.radius * Math.cos(tilt) + TIRE.width / 2 * Math.sin(tilt);
}
