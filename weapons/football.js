// American football (#45): tuning and pure helpers. No engine, no DOM.
// The long axis is the local +Y axis, like the spear: the nose points along +Y.
// A real ball is 28 x 17 cm and 0.41 kg; it is drawn and simulated 2.4x larger so it
// reads next to the 0.64 m basketball, but keeps its real mass.

export const FOOTBALL = {
  mass: 0.4,
  halfLength: 0.34,
  radius: 0.206,
  spinRate: 25,        // rad/s about the long axis, ~4 revolutions per second
  alignGain: 6,        // 1/s: how fast the nose turns toward the flight direction
  speedBase: 20,      // m/s; a pass is thrown harder than the 18-40 m/s balls, or the light ball would not tip a barrel
  speedPower: 28,
};

const MIN_ALIGN_SPEED = 1;

export function footballSpeed(power) {
  const p = Math.min(Math.max(power, 0), 1);
  return FOOTBALL.speedBase + p * FOOTBALL.speedPower;
}

// world direction of the nose (local +Y) for orientation q
export function longAxis(q) {
  const { x, y, z, w } = q;
  return { x: 2 * (x * y - w * z), y: 1 - 2 * (x * x + z * z), z: 2 * (y * z + w * x) };
}

// rotation that turns local +Y onto the unit vector d
function noseToward(d) {
  const w = 1 + d.y;
  if (w < 1e-9) return { x: 1, y: 0, z: 0, w: 0 };   // straight down: half turn about X
  const n = Math.hypot(d.z, d.x, w);
  return { x: d.z / n, y: 0, z: -d.x / n, w: w / n };
}

// spiral pass: nose along the aim, spinning about the long axis
export function footballLaunch(dir, power) {
  const speed = footballSpeed(power);
  const s = FOOTBALL.spinRate;
  return {
    velocity: { x: dir.x * speed, y: dir.y * speed, z: dir.z * speed },
    quaternion: noseToward(dir),
    angularVelocity: { x: dir.x * s, y: dir.y * s, z: dir.z * s },
  };
}

// angle in degrees between the nose and the velocity
export function noseAngle(axis, velocity) {
  const v = Math.hypot(velocity.x, velocity.y, velocity.z);
  const c = (axis.x * velocity.x + axis.y * velocity.y + axis.z * velocity.z) / v;
  return Math.acos(Math.min(1, Math.max(-1, c))) * 180 / Math.PI;
}

// In flight: keep the spin about the long axis and replace the wobble with a turn of the nose
// toward the velocity at alignGain * sin(angle) rad/s, the stabilising torque of a spiral pass.
export function flightAngularVelocity(axis, omega, velocity) {
  const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
  if (speed < MIN_ALIGN_SPEED) return omega;
  const vx = velocity.x / speed, vy = velocity.y / speed, vz = velocity.z / speed;
  const spin = omega.x * axis.x + omega.y * axis.y + omega.z * axis.z;
  const k = FOOTBALL.alignGain;
  return {
    x: axis.x * spin + k * (axis.y * vz - axis.z * vy),
    y: axis.y * spin + k * (axis.z * vx - axis.x * vz),
    z: axis.z * spin + k * (axis.x * vy - axis.y * vx),
  };
}
