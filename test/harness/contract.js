// Backend contract: a list of cases run against any PhysicsBackend.
// Each case creates its own bodies, removes them at the end, and returns
// { name, pass, detail }. Pure module: depends only on the backend handle.

export function runContract(phys) {
  const results = [];
  const cases = [
    restsOnGround,
    impulseChangesVelocity,
    staticDoesNotMove,
    sleepsWhenResting,
    collideReportsImpact,
    collideRemovalDeferred,
    mutateFromInsideCollide,
    restingContactUsesPairFriction,
    frictionOverrideSlidesAndRestores,
    groundHonoursPositionAndExtent,
    shapelessAnchorDoesNotCollide,
    distanceJointHoldsLength,
    fixedJointMovesTogether,
    fixedJointKeepsRelativePose,
    stopCollidingDropsContacts,
    bodyCountTracks,
    stack10Stands,
    unsupportedSleeperFalls,
    forceHoldsAgainstGravity,
    forceIsFrameRateIndependent,
    forcesAddUpAndExpire,
    removeBodyDropsPendingForce,
    zeroGravityFliesStraight,
    setGravityFactorRestoresFall,
    fastSphereDoesNotTunnelThinWall,
    spheroidLiesOnItsSide,
    spheroidOnItsTipFallsOver,
    spheroidHonoursMass,
  ];
  for (const c of cases) {
    try {
      const r = c(phys);
      results.push(r);
    } catch (e) {
      results.push({ name: c.name, pass: false, detail: 'threw: ' + e.message });
    }
  }
  return results;
}

function box(phys, half, mass, y, opts = {}) {
  return phys.addBody({
    shape: { kind: 'box', halfExtents: half },
    mass,
    material: opts.material || 'stone',
    position: { x: 0, y, z: 0 },
    isStatic: opts.isStatic || false,
    startAsleep: opts.startAsleep || false,
    linearDamping: opts.linearDamping,
    angularDamping: opts.angularDamping,
  });
}

function step(phys, seconds, dt = 1 / 60) {
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) phys.step(dt);
}

function restsOnGround(phys) {
  const g = ground(phys);
  const b = box(phys, [0.5, 0.5, 0.5], 1, 3);
  step(phys, 3);
  const y = b.position.y;
  cleanup(phys, [g, b]);
  const pass = Math.abs(y - 0.5) < 0.02;
  return { name: 'restsOnGround', pass, detail: `y=${y.toFixed(4)} expected ~0.5` };
}

function impulseChangesVelocity(phys) {
  const b = phys.addBody({ shape: { kind: 'sphere', radius: 0.5 }, mass: 2, material: 'ball', position: { x: 0, y: 0, z: 0 } });
  phys.applyImpulse(b, 4, 0, 0);
  const v = phys.getVelocity(b);
  cleanup(phys, [b]);
  const pass = Math.abs(v.x - 2) < 0.01;
  return { name: 'impulseChangesVelocity', pass, detail: `vx=${v.x.toFixed(4)} expected ~2` };
}

function staticDoesNotMove(phys) {
  const b = box(phys, [0.5, 0.5, 0.5], 5, 3, { isStatic: true });
  step(phys, 1);
  const y = b.position.y;
  const okStatic = b.mass === 0;
  cleanup(phys, [b]);
  const pass = Math.abs(y - 3) < 1e-6 && okStatic;
  return { name: 'staticDoesNotMove', pass, detail: `y=${y.toFixed(4)} static=${okStatic}` };
}


function sleepsWhenResting(phys) {
  const g = ground(phys);
  const b = box(phys, [0.5, 0.5, 0.5], 1, 3);
  step(phys, 5);
  const asleep = phys.isSleeping(b);
  phys.wake(b);
  const awake = !phys.isSleeping(b);
  cleanup(phys, [g, b]);
  const pass = asleep && awake;
  return { name: 'sleepsWhenResting', pass, detail: `asleep=${asleep} wake→awake=${awake}` };
}

function collideReportsImpact(phys) {
  const g = ground(phys);
  const b = phys.addBody({ shape: { kind: 'sphere', radius: 0.5 }, mass: 1, material: 'ball', position: { x: 0, y: 5, z: 0 } });
  let fired = false, speedOk = false, otherIsGround = false;
  phys.onCollide(b, (other, impactSpeed) => {
    if (fired) return;
    fired = true;
    speedOk = impactSpeed > 3;
    otherIsGround = other === g;
  });
  step(phys, 2);
  cleanup(phys, [g, b]);
  const pass = fired && speedOk && otherIsGround;
  return { name: 'collideReportsImpact', pass, detail: `fired=${fired} speedOk=${speedOk} otherIsGround=${otherIsGround}` };
}

function collideRemovalDeferred(phys) {
  const g = ground(phys);
  const b = phys.addBody({ shape: { kind: 'sphere', radius: 0.5 }, mass: 1, material: 'ball', position: { x: 0, y: 5, z: 0 } });
  const toRemove = [];
  phys.onCollide(b, (other) => { toRemove.push(b); });
  step(phys, 1);
  for (const body of toRemove) phys.removeBody(body);
  const stillThere = phys.bodies().includes(b);
  cleanup(phys, [g]);
  const pass = !stillThere;
  return { name: 'collideRemovalDeferred', pass, detail: `removed=${!stillThere} (deferred after step)` };
}

// The game mutates the world from inside onCollide (paintball removes the
// projectile, harpoon adds a fixed joint, explosions apply impulses). The
// backend must make that safe: the next steps must not throw, the removal
// must take effect, and the world must keep simulating correctly.
function mutateFromInsideCollide(phys) {
  const g = ground(phys);
  const doomed = phys.addBody({ shape: { kind: 'sphere', radius: 0.5 }, mass: 1, material: 'ball', position: { x: -3, y: 3, z: 0 } });
  const harpoon = phys.addBody({ shape: { kind: 'sphere', radius: 0.5 }, mass: 1, material: 'ball', position: { x: 3, y: 3, z: 0 } });
  const kicked = box(phys, [0.5, 0.5, 0.5], 1, 0.5, { material: 'stone' });
  const created = [g, doomed, harpoon, kicked];
  let removed = false, joint = null;
  phys.onCollide(doomed, () => {
    if (removed) return;
    removed = true;
    phys.removeBody(doomed);
    phys.applyImpulse(kicked, 0, 3, 0);
  });
  phys.onCollide(harpoon, (other) => {
    if (joint || other !== g) return;
    joint = phys.addFixedJoint(harpoon, other);
  });
  try {
    step(phys, 1.5);
    const late = phys.addBody({ shape: { kind: 'box', halfExtents: [0.5, 0.5, 0.5] }, mass: 1, material: 'stone', position: { x: 0, y: 3, z: 3 } }); // reuses freed engine slots
    created.push(late);
    step(phys, 2);
    const gone = !phys.bodies().includes(doomed);
    const lateY = late.position.y;
    const harpoonVy = phys.getVelocity(harpoon).y;
    const pass = removed && gone && !!joint && Math.abs(lateY - 0.5) < 0.05 && Math.abs(harpoonVy) < 0.05;
    return { name: 'mutateFromInsideCollide', pass, detail: `removed=${removed} gone=${gone} joint=${!!joint} lateY=${lateY.toFixed(4)} harpoonVy=${harpoonVy.toFixed(4)}` };
  } finally {
    if (joint) phys.removeJoint(joint);
    cleanup(phys, created);
  }
}

// A box already resting on the ground (persisted contact) must slide with the
// materials.js pair friction: card/ground 0.9 stops short, ball/ground 0.4
// slides further. v0=2 → d = v0²/(2µg): 0.23 m at µ=0.9, 0.51 m at µ=0.4.
function restingContactUsesPairFriction(phys) {
  const g = ground(phys);
  const slide = (material) => {
    const b = phys.addBody({ shape: { kind: 'box', halfExtents: [0.5, 0.25, 0.5] }, mass: 1, material, position: { x: 0, y: 0.25, z: 0 }, linearDamping: 0, angularDamping: 0 });
    step(phys, 1);
    const x0 = b.position.x;
    phys.wake(b);
    phys.setVelocity(b, 2, 0, 0);
    step(phys, 2);
    const d = b.position.x - x0;
    phys.removeBody(b);
    return d;
  };
  const dCard = slide('card');
  const dBall = slide('ball');
  cleanup(phys, [g]);
  const pass = dCard > 0.15 && dCard < 0.33 && dBall > 0.4 && dBall < 0.65;
  return { name: 'restingContactUsesPairFriction', pass, detail: `card/ground d=${dCard.toFixed(3)} (~0.23) ball/ground d=${dBall.toFixed(3)} (~0.51)` };
}

// setFriction overrides a body's contact friction until restoreFriction: a
// stone box (stone/ground 0.8, d ~0.25 m from v0=2) slides almost freely at
// friction 0.01 (d = v0²/(2µg) caps at the 2 s run, ~3.8 m), then stops short
// again once the pair friction is back.
function frictionOverrideSlidesAndRestores(phys) {
  const g = ground(phys);
  const b = phys.addBody({ shape: { kind: 'box', halfExtents: [0.5, 0.25, 0.5] }, mass: 1, material: 'stone', position: { x: 0, y: 0.25, z: 0 }, linearDamping: 0, angularDamping: 0 });
  step(phys, 1);
  const slide = () => {
    const x0 = b.position.x;
    phys.wake(b);
    phys.setVelocity(b, 2, 0, 0);
    step(phys, 2);
    return b.position.x - x0;
  };
  phys.setFriction(b, 0.01);
  const dSlip = slide();
  phys.restoreFriction(b);
  const dBack = slide();
  cleanup(phys, [g, b]);
  const pass = dSlip > 3 && dBack > 0.15 && dBack < 0.4;
  return { name: 'frictionOverrideSlidesAndRestores', pass, detail: `slip d=${dSlip.toFixed(3)} (>3) restored d=${dBack.toFixed(3)} (~0.25)` };
}

// Ground top surface sits at spec.position.y and spans far beyond the arena.
function groundHonoursPositionAndExtent(phys) {
  const g = phys.addBody({ shape: { kind: 'ground' }, mass: 0, material: 'ground', position: { x: 0, y: -2, z: 0 }, isStatic: true });
  const near = box(phys, [0.5, 0.5, 0.5], 1, 0);
  const far = phys.addBody({ shape: { kind: 'box', halfExtents: [0.5, 0.5, 0.5] }, mass: 1, material: 'stone', position: { x: 500, y: 0, z: -500 } });
  step(phys, 3);
  const nearY = near.position.y, farY = far.position.y;
  cleanup(phys, [g, near, far]);
  const pass = Math.abs(nearY + 1.5) < 0.05 && Math.abs(farY + 1.5) < 0.05;
  return { name: 'groundHonoursPositionAndExtent', pass, detail: `nearY=${nearY.toFixed(4)} farY=${farY.toFixed(4)} expected ~-1.5` };
}

// The wrecking-ball anchor is shapeless: it holds a joint but nothing hits it.
function shapelessAnchorDoesNotCollide(phys) {
  const g = ground(phys);
  const anchor = phys.addBody({ shape: { kind: 'none' }, mass: 0, material: 'heavy', position: { x: 0, y: 2, z: 0 }, isStatic: true });
  const falling = phys.addBody({ shape: { kind: 'sphere', radius: 0.5 }, mass: 1, material: 'stone', position: { x: 0, y: 5, z: 0 } });
  let hitAnchor = false;
  phys.onCollide(falling, (other) => { if (other === anchor) hitAnchor = true; });
  const bob = phys.addBody({ shape: { kind: 'sphere', radius: 0.3 }, mass: 1, material: 'ball', position: { x: 5, y: 2, z: 0 } });
  const swingAnchor = phys.addBody({ shape: { kind: 'none' }, mass: 0, material: 'heavy', position: { x: 5, y: 4, z: 0 }, isStatic: true });
  const j = phys.addDistanceJoint(bob, swingAnchor, 2);
  step(phys, 3);
  const fallY = falling.position.y;
  const dist = Math.abs(bob.position.y - swingAnchor.position.y);
  phys.removeJoint(j);
  cleanup(phys, [g, anchor, falling, bob, swingAnchor]);
  const pass = !hitAnchor && fallY < 1 && Math.abs(dist - 2) < 0.05;
  return { name: 'shapelessAnchorDoesNotCollide', pass, detail: `hitAnchor=${hitAnchor} fallY=${fallY.toFixed(4)} jointDist=${dist.toFixed(4)}` };
}

function distanceJointHoldsLength(phys) {
  const anchor = phys.addBody({ shape: { kind: 'box', halfExtents: [0.1, 0.1, 0.1] }, mass: 0, material: 'stone', position: { x: 0, y: 4, z: 0 }, isStatic: true });
  const b = phys.addBody({ shape: { kind: 'sphere', radius: 0.3 }, mass: 1, material: 'ball', position: { x: 0, y: 2, z: 0 } });
  const j = phys.addDistanceJoint(anchor, b, 2);
  step(phys, 2);
  const dy = b.position.y - anchor.position.y;
  const dist = Math.abs(dy);
  phys.removeJoint(j);
  cleanup(phys, [anchor, b]);
  const pass = Math.abs(dist - 2) < 0.05;
  return { name: 'distanceJointHoldsLength', pass, detail: `dist=${dist.toFixed(4)} expected ~2` };
}

function fixedJointMovesTogether(phys) {
  const a = box(phys, [0.5, 0.5, 0.5], 1, 3);
  const c = box(phys, [0.5, 0.5, 0.5], 1, 3.7);
  const j = phys.addFixedJoint(a, c);
  phys.applyImpulse(a, 0, 2, 0);
  step(phys, 0.5);
  const va = phys.getVelocity(a);
  const vc = phys.getVelocity(c);
  const relVel = Math.hypot(va.x - vc.x, va.y - vc.y, va.z - vc.z);
  phys.removeJoint(j);
  cleanup(phys, [a, c]);
  const pass = relVel < 0.2;
  return { name: 'fixedJointMovesTogether', pass, detail: `relVel=${relVel.toFixed(4)} expected < 0.2` };
}

// #78: the joint must hold the pose it was made at, not pull the two centres together
function fixedJointKeepsRelativePose(phys) {
  const add = (x) => phys.addBody({ shape: { kind: 'box', halfExtents: [0.2, 0.2, 0.2] }, mass: 1, material: 'stone', position: { x, y: 5, z: 0 } });
  const a = add(0), c = add(0.7);
  const j = phys.addFixedJoint(a, c);
  step(phys, 0.5);
  const d = Math.hypot(c.position.x - a.position.x, c.position.y - a.position.y, c.position.z - a.position.z);
  phys.removeJoint(j);
  cleanup(phys, [a, c]);
  const pass = Math.abs(d - 0.7) < 0.05;
  return { name: 'fixedJointKeepsRelativePose', pass, detail: `d=${d.toFixed(4)} expected ~0.7` };
}

// #78: a body that stopped colliding falls through the ground and reports no contact
function stopCollidingDropsContacts(phys) {
  const g = ground(phys);
  const b = box(phys, [0.2, 0.2, 0.2], 1, 2);
  let hits = 0;
  phys.onCollide(b, () => { hits++; });
  phys.stopColliding(b);
  step(phys, 1.5);
  const y = b.position.y;
  cleanup(phys, [g, b]);
  const pass = y < -1 && hits === 0;
  return { name: 'stopCollidingDropsContacts', pass, detail: `y=${y.toFixed(3)} hits=${hits} expected y < -1, 0 hits` };
}

function bodyCountTracks(phys) {
  const start = phys.bodyCount();
  const bs = [box(phys, [0.5, 0.5, 0.5], 1, 3), box(phys, [0.5, 0.5, 0.5], 1, 3), box(phys, [0.5, 0.5, 0.5], 1, 3)];
  const afterAdd = phys.bodyCount();
  for (const b of bs) phys.removeBody(b);
  const afterRemove = phys.bodyCount();
  const pass = afterAdd === start + 3 && afterRemove === start;
  return { name: 'bodyCountTracks', pass, detail: `start=${start} +3→${afterAdd} remove→${afterRemove}` };
}

function stack10Stands(phys) {
  const g = ground(phys);
  const stack = [];
  for (let i = 0; i < 10; i++) {
    stack.push(box(phys, [0.5, 0.5, 0.5], 1, 0.5 + i * (1 + 0.001), { startAsleep: true }));
  }
  for (const b of stack) phys.wake(b); // actually simulate the stack, not a sleeping snapshot
  step(phys, 5);
  const topY = stack[stack.length - 1].position.y;
  const expected = 0.5 + 9 * (1 + 0.001); // center of the top box
  cleanup(phys, [g, ...stack]);
  const pass = Math.abs(topY - expected) < 0.05;
  return { name: 'stack10Stands', pass, detail: `topY=${topY.toFixed(4)} expected ~${expected.toFixed(4)}` };
}

function unsupportedSleeperFalls(phys) {
  const g = ground(phys);
  const base = box(phys, [0.5, 0.5, 0.5], 1, 0.5, { startAsleep: true });
  // 4 cm above the base, like the brick rows the game builds: asleep and not touching it
  const top = box(phys, [0.5, 0.5, 0.5], 1, 1.54, { startAsleep: true });
  phys.wake(base);
  phys.setVelocity(base, 12, 0, 0); // knocked out from under the top box
  step(phys, 2);
  const topY = top.position.y;
  cleanup(phys, [g, base, top]);
  const pass = topY < 1.0;
  return { name: 'unsupportedSleeperFalls', pass, detail: `topY=${topY.toFixed(4)} expected < 1 (fallen to the ground)` };
}

// Per frame: applyForce(...) then step(dt). (The game calls step first, which only adds a constant
// one-frame lag of force, not a different rate; the tests start with the force to measure the rate.)
function hoverDrift(phys, fps) {
  const m = 5;
  const b = phys.addBody({ shape: { kind: 'box', halfExtents: [0.5, 0.5, 0.5] }, mass: m, material: 'wood', position: { x: 0, y: 10, z: 0 } });
  for (let i = 0; i < fps; i++) { phys.applyForce(b, 0, 9.82 * m, 0); phys.step(1 / fps); }
  const dy = b.position.y - 10;
  cleanup(phys, [b]);
  return dy;
}

function forceHoldsAgainstGravity(phys) {
  const drifts = [30, 60, 120].map((fps) => hoverDrift(phys, fps));
  const pass = drifts.every((d) => Math.abs(d) < 0.05);
  return { name: 'forceHoldsAgainstGravity', pass, detail: `dy@30/60/120fps=${drifts.map((d) => d.toFixed(3)).join('/')} expected ~0` };
}

function liftHeight(phys, fps) {
  const m = 5;
  const b = phys.addBody({ shape: { kind: 'box', halfExtents: [0.5, 0.5, 0.5] }, mass: m, material: 'wood', position: { x: 0, y: 10, z: 0 } });
  for (let i = 0; i < fps * 0.5; i++) { phys.applyForce(b, 0, 30 * m + 9.82 * m, 0); phys.step(1 / fps); }
  const y = b.position.y - 10;
  cleanup(phys, [b]);
  return y;
}

function forceIsFrameRateIndependent(phys) {
  const ys = [30, 60, 120].map((fps) => liftHeight(phys, fps));
  const ref = ys[1];
  const pass = ref > 1 && ys.every((y) => Math.abs(y - ref) / ref < 0.05);
  return { name: 'forceIsFrameRateIndependent', pass, detail: `lift@30/60/120fps=${ys.map((y) => y.toFixed(3)).join('/')} expected within 5%` };
}

function forcesAddUpAndExpire(phys) {
  const m = 2;
  const mk = () => phys.addBody({ shape: { kind: 'sphere', radius: 0.5 }, mass: m, material: 'ball', position: { x: 0, y: 50, z: 0 } });
  const one = mk(), two = mk();
  // gravity cancelled so only the test force acts
  phys.applyForce(one, 10 * m, 9.82 * m, 0);
  phys.applyForce(two, 5 * m, 9.82 * m / 2, 0); phys.applyForce(two, 5 * m, 9.82 * m / 2, 0);
  phys.step(1 / 60);
  const v1 = phys.getVelocity(one).x, v2 = phys.getVelocity(two).x;
  phys.step(1 / 60); // no new applyForce: velocity must not grow
  const v1b = phys.getVelocity(one).x;
  cleanup(phys, [one, two]);
  const pass = Math.abs(v1 - v2) < 0.02 && v1 > 0.1 && Math.abs(v1b - v1) < 0.02;
  return { name: 'forcesAddUpAndExpire', pass, detail: `v1=${v1.toFixed(3)} v2=${v2.toFixed(3)} next=${v1b.toFixed(3)}` };
}

function removeBodyDropsPendingForce(phys) {
  const b = phys.addBody({ shape: { kind: 'sphere', radius: 0.5 }, mass: 1, material: 'ball', position: { x: 0, y: 5, z: 0 } });
  phys.applyForce(b, 1, 1, 1);
  phys.removeBody(b);
  let threw = null;
  try { phys.step(1 / 60); } catch (e) { threw = e.message; }
  return { name: 'removeBodyDropsPendingForce', pass: threw === null, detail: threw === null ? 'step ok' : 'threw: ' + threw };
}

function zeroGravityFliesStraight(phys) {
  const b = phys.addBody({ shape: { kind: 'sphere', radius: 0.1 }, mass: 1, material: 'heavy',
    position: { x: 0, y: 5, z: 0 }, fast: true, gravityFactor: 0 });
  phys.setVelocity(b, 0, 0, -200);
  step(phys, 0.1);
  const y = b.position.y, z = b.position.z;
  cleanup(phys, [b]);
  const pass = Math.abs(y - 5) < 0.001 && z < -19 && z > -21;
  return { name: 'zeroGravityFliesStraight', pass, detail: `y=${y.toFixed(4)} z=${z.toFixed(2)} expected y=5, z~-20` };
}

function setGravityFactorRestoresFall(phys) {
  const b = phys.addBody({ shape: { kind: 'sphere', radius: 0.1 }, mass: 1, material: 'heavy',
    position: { x: 0, y: 50, z: 0 }, gravityFactor: 0 });
  step(phys, 0.5);
  const hovered = b.position.y;
  phys.setGravityFactor(b, 1);
  step(phys, 0.5);
  const fell = b.position.y;
  cleanup(phys, [b]);
  const pass = Math.abs(hovered - 50) < 0.001 && fell < 50 - 1;
  return { name: 'setGravityFactorRestoresFall', pass, detail: `hover y=${hovered.toFixed(3)}, after y=${fell.toFixed(3)}` };
}

function fastSphereDoesNotTunnelThinWall(phys) {
  // 240 m/s moves 1 m per 1/240 s step; the wall is 0.1 m thick. Sweep the start phase over one step.
  let stopped = 0, n = 0;
  for (let d = 8; d < 8.84; d += 0.021) {
    n++;
    const wall = phys.addBody({ shape: { kind: 'box', halfExtents: [3, 3, 0.05] }, mass: 0, isStatic: true,
      material: 'stone', position: { x: 0, y: 1, z: -d } });
    const b = phys.addBody({ shape: { kind: 'sphere', radius: 0.14 }, mass: 1.2, material: 'heavy',
      position: { x: 0, y: 1, z: 0 }, fast: true, gravityFactor: 0 });
    phys.setVelocity(b, 0, 0, -240);
    step(phys, 0.5);
    if (b.position.z > -d) stopped++;
    cleanup(phys, [b, wall]);
  }
  return { name: 'fastSphereDoesNotTunnelThinWall', pass: stopped === n, detail: `stopped ${stopped}/${n}` };
}

// 'spheroid' (#45): a convex hull of a prolate spheroid, long axis along local Y.
const SPHEROID = { kind: 'spheroid', halfLength: 0.34, radius: 0.2 };
const QUARTER_X = { x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 };   // long axis horizontal

function spheroid(phys, y, quaternion) {
  return phys.addBody({ shape: SPHEROID, mass: 0.4, material: 'ball', position: { x: 0, y, z: 0 }, quaternion });
}

function upTilt(q) {
  return Math.acos(Math.min(1, Math.abs(1 - 2 * (q.x * q.x + q.z * q.z)))) * 180 / Math.PI;
}

function spheroidLiesOnItsSide(phys) {
  const g = ground(phys);
  const b = spheroid(phys, 1, QUARTER_X);
  step(phys, 4);
  const y = b.position.y, tilt = upTilt(b.quaternion);
  cleanup(phys, [g, b]);
  const pass = Math.abs(y - SPHEROID.radius) < 0.02 && tilt > 80;
  return { name: 'spheroidLiesOnItsSide', pass, detail: `y=${y.toFixed(4)} expected ~${SPHEROID.radius}, axis ${tilt.toFixed(1)}° from vertical` };
}

// Stood on its tip with a 3° lean, an egg falls over; a sphere or a box would not tell.
function spheroidOnItsTipFallsOver(phys) {
  const g = ground(phys);
  const lean = 3 * Math.PI / 180;
  const b = spheroid(phys, SPHEROID.halfLength + 0.01, { x: Math.sin(lean / 2), y: 0, z: 0, w: Math.cos(lean / 2) });
  step(phys, 4);
  const y = b.position.y, tilt = upTilt(b.quaternion);
  cleanup(phys, [g, b]);
  const pass = y < SPHEROID.radius + 0.03 && tilt > 80;
  return { name: 'spheroidOnItsTipFallsOver', pass, detail: `y=${y.toFixed(4)} axis ${tilt.toFixed(1)}° from vertical` };
}

function spheroidHonoursMass(phys) {
  const b = spheroid(phys, 50);
  phys.applyImpulse(b, 0.4, 0, 0);
  const vx = phys.getVelocity(b).x;
  cleanup(phys, [b]);
  return { name: 'spheroidHonoursMass', pass: Math.abs(vx - 1) < 0.01, detail: `impulse 0.4 → vx=${vx.toFixed(4)} expected 1 (mass 0.4)` };
}

function ground(phys) {
  return phys.addBody({ shape: { kind: 'ground' }, mass: 0, material: 'ground', position: { x: 0, y: 0, z: 0 }, isStatic: true });
}

function cleanup(phys, bodies) {
  for (const b of bodies) {
    try { phys.removeBody(b); } catch { /* already gone */ }
  }
}
