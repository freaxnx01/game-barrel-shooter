// Backend contract: a list of cases run against any PhysicsBackend.
// Each case creates its own bodies, removes them at the end, and returns
// { name, pass, detail }. Pure module: depends only on the backend handle.

export function runContract(phys) {
  const results = [];
  const cases = [
    restsOnGround,
    impulseChangesVelocity,
    staticDoesNotMove,
    makeDynamicFalls,
    sleepsWhenResting,
    collideReportsImpact,
    collideRemovalDeferred,
    mutateFromInsideCollide,
    restingContactUsesPairFriction,
    groundHonoursPositionAndExtent,
    makeDynamicUsesSpecMass,
    shapelessAnchorDoesNotCollide,
    distanceJointHoldsLength,
    fixedJointMovesTogether,
    bodyCountTracks,
    stack10Stands,
    unsupportedSleeperFalls,
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
  const okStatic = phys.isStatic(b) && b.mass === 0;
  cleanup(phys, [b]);
  const pass = Math.abs(y - 3) < 1e-6 && okStatic;
  return { name: 'staticDoesNotMove', pass, detail: `y=${y.toFixed(4)} static=${okStatic}` };
}

function makeDynamicFalls(phys) {
  const b = box(phys, [0.5, 0.5, 0.5], 1, 3, { isStatic: true });
  phys.makeDynamic(b);
  step(phys, 1);
  const y = b.position.y;
  cleanup(phys, [b]);
  const pass = y < 2.9;
  return { name: 'makeDynamicFalls', pass, detail: `y=${y.toFixed(4)} expected < 2.9` };
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
  // cannon-es corrupts its own step when a body is removed mid-step; the game
  // defers removal there instead (explode → setTimeout), so cannon is skipped.
  if (phys.name === 'cannon') {
    return { name: 'mutateFromInsideCollide', pass: false, required: false, detail: 'skipped: cannon-es cannot mutate mid-step (known)' };
  }
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
// Required on crashcat; informational on cannon, whose iterative friction
// stops a sliding box almost instantly regardless of µ.
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
  const required = phys.name !== 'cannon';
  return { name: 'restingContactUsesPairFriction', pass, required, detail: `card/ground d=${dCard.toFixed(3)} (~0.23) ball/ground d=${dBall.toFixed(3)} (~0.51)` };
}

// Ground top surface sits at spec.position.y and spans far beyond the arena
// (cannon's plane is infinite).
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

function makeDynamicUsesSpecMass(phys) {
  const b = box(phys, [0.5, 0.5, 0.5], 2, 3, { isStatic: true });
  phys.makeDynamic(b);
  phys.applyImpulse(b, 4, 0, 0);
  const vx = phys.getVelocity(b).x;
  cleanup(phys, [b]);
  const pass = Math.abs(vx - 2) < 0.01 && b.mass === 2;
  return { name: 'makeDynamicUsesSpecMass', pass, detail: `vx=${vx.toFixed(4)} expected ~2 (mass 2) h.mass=${b.mass}` };
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
  // Required on crashcat (the spec's core goal); informational on cannon (known instability).
  const required = phys.name !== 'cannon';
  return { name: 'stack10Stands', pass, required, detail: `topY=${topY.toFixed(4)} expected ~${expected.toFixed(4)}` };
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

function ground(phys) {
  return phys.addBody({ shape: { kind: 'ground' }, mass: 0, material: 'ground', position: { x: 0, y: 0, z: 0 }, isStatic: true });
}

function cleanup(phys, bodies) {
  for (const b of bodies) {
    try { phys.removeBody(b); } catch { /* already gone */ }
  }
}
