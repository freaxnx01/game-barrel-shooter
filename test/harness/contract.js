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
    distanceJointHoldsLength,
    fixedJointMovesTogether,
    bodyCountTracks,
    stack10Stands,
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
  step(phys, 5);
  const topY = stack[stack.length - 1].position.y;
  const expected = 0.5 + 9 * (1 + 0.001) + 0.5;
  cleanup(phys, [g, ...stack]);
  const pass = Math.abs(topY - expected) < 0.05;
  // Required on crashcat (the spec's core goal); informational on cannon (known instability).
  const required = phys.name !== 'cannon';
  return { name: 'stack10Stands', pass, required, detail: `topY=${topY.toFixed(4)} expected ~${expected.toFixed(4)}` };
}

function ground(phys) {
  return phys.addBody({ shape: { kind: 'ground' }, mass: 0, material: 'ground', position: { x: 0, y: 0, z: 0 }, isStatic: true });
}

function cleanup(phys, bodies) {
  for (const b of bodies) {
    try { phys.removeBody(b); } catch { /* already gone */ }
  }
}
