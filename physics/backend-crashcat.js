// PhysicsBackend facade over crashcat.
// createCrashcatBackend(cc): wraps crashcat, where `cc` is the module namespace
// from `import('https://esm.sh/crashcat@0.0.5')`. Game code talks only to the
// returned handle, exactly as it does with the cannon backend.

import { contactFor, DEFAULT_CONTACT } from './materials.js';

export function createCrashcatBackend(cc) {
  cc.registerAll();

  const settings = cc.createWorldSettings();
  settings.gravity = [0, -9.82, 0];
  const BP_MOVING = cc.addBroadphaseLayer(settings);
  const BP_STATIC = cc.addBroadphaseLayer(settings);
  const LAYER_MOVING = cc.addObjectLayer(settings, BP_MOVING);
  const LAYER_STATIC = cc.addObjectLayer(settings, BP_STATIC);
  cc.enableCollision(settings, LAYER_MOVING, LAYER_STATIC);
  cc.enableCollision(settings, LAYER_MOVING, LAYER_MOVING);

  const world = cc.createWorld(settings);

  const handles = new Set();        // PBody handles
  const byId = new Map();           // engine body.id → handle (for listener lookup)
  const collideCbs = new Map();      // handle → onCollide callback
  const joints = new Set();

  function makeShape(spec) {
    if (spec.kind === 'box') return cc.box.create({ halfExtents: spec.halfExtents });
    if (spec.kind === 'sphere') return cc.sphere.create({ radius: spec.radius });
    if (spec.kind === 'cylinder') return cc.cylinder.create({ halfHeight: spec.height / 2, radius: spec.radiusTop });
    if (spec.kind === 'ground') return cc.box.create({ halfExtents: [100, 0.5, 100] });
    throw new Error('unknown shape kind: ' + spec.kind);
  }

  function addBody(spec) {
    const isStatic = spec.isStatic || spec.mass === 0;
    const motionType = isStatic ? cc.MotionType.STATIC : cc.MotionType.DYNAMIC;
    const objectLayer = isStatic ? LAYER_STATIC : LAYER_MOVING;
    const opts = {
      shape: makeShape(spec.shape),
      motionType,
      objectLayer,
      position: [spec.position.x, spec.position.y, spec.position.z],
      userData: null, // holds the handle (see below); game userData lives on the handle
    };
    if (!isStatic) {
      opts.mass = spec.mass;
      if (spec.linearDamping != null) opts.linearDamping = spec.linearDamping;
      if (spec.angularDamping != null) opts.angularDamping = spec.angularDamping;
    }
    if (spec.fast) opts.motionQuality = cc.MotionQuality.LINEAR_CAST;
    if (spec.friction != null) opts.friction = spec.friction;
    if (spec.restitution != null) opts.restitution = spec.restitution;
    const body = cc.rigidBody.create(world, opts);
    if (spec.quaternion) {
      cc.rigidBody.setQuaternion(world, body, [spec.quaternion.x, spec.quaternion.y, spec.quaternion.z, spec.quaternion.w], false);
    }
    if (spec.shape.kind === 'ground') {
      // ground box top sits at y=0
      cc.rigidBody.setPosition(world, body, [0, -0.5, 0], false);
    }
    const handle = {
      raw: body,
      material: spec.material,
      mass: isStatic ? 0 : spec.mass,
      userData: spec.userData,
      _specMass: spec.mass,
      _pos: { x: spec.position.x, y: spec.position.y, z: spec.position.z },
      _quat: { x: 0, y: 0, z: 0, w: 1 },
      get position() { syncTransform(this); return this._pos; },
      get quaternion() { syncTransform(this); return this._quat; },
    };
    body.userData = handle;
    byId.set(body.id, handle);
    handles.add(handle);
    if (spec.startAsleep) cc.rigidBody.sleep(world, body);
    return handle;
  }

  function syncTransform(h) {
    const p = h.raw.position;
    h._pos.x = p[0]; h._pos.y = p[1]; h._pos.z = p[2];
    const q = h.raw.quaternion;
    h._quat.x = q[0]; h._quat.y = q[1]; h._quat.z = q[2]; h._quat.w = q[3];
  }

  function removeBody(h) {
    if (!h || !handles.has(h)) return;
    handles.delete(h);
    collideCbs.delete(h);
    byId.delete(h.raw.id);
    cc.rigidBody.remove(world, h.raw);
  }

  function bodies() { return [...handles]; }
  function bodyCount() { return handles.size; }

  let accumulator = 0;
  const FIXED = 1 / 240;
  function step(dt) {
    accumulator += dt;
    let n = 0;
    while (accumulator >= FIXED && n < 10) {
      cc.updateWorld(world, listener, FIXED);
      accumulator -= FIXED;
      n++;
    }
    if (n === 10) accumulator = 0;
  }

  function getVelocity(h) { const v = h.raw.motionProperties.linearVelocity; return { x: v[0], y: v[1], z: v[2] }; }
  function setVelocity(h, x, y, z) { cc.rigidBody.setLinearVelocity(world, h.raw, [x, y, z]); }
  function getAngularVelocity(h) { const v = h.raw.motionProperties.angularVelocity; return { x: v[0], y: v[1], z: v[2] }; }
  function setAngularVelocity(h, x, y, z) { cc.rigidBody.setAngularVelocity(world, h.raw, [x, y, z]); }

  function setPosition(h, x, y, z) { cc.rigidBody.setPosition(world, h.raw, [x, y, z], false); }
  function setQuaternion(h, x, y, z, w) { cc.rigidBody.setQuaternion(world, h.raw, [x, y, z, w], false); }

  function applyImpulse(h, x, y, z) {
    cc.rigidBody.wake(world, h.raw);
    cc.rigidBody.addImpulse(world, h.raw, [x, y, z]);
  }
  function applyForce(h, x, y, z) {
    cc.rigidBody.wake(world, h.raw);
    cc.rigidBody.addForce(world, h.raw, [x, y, z], true);
  }

  function wake(h) { cc.rigidBody.wake(world, h.raw); }
  function isSleeping(h) { return !!h.raw.sleeping; }
  function isStatic(h) { return h.raw.motionType === cc.MotionType.STATIC; }
  function makeDynamic(h) {
    if (h.raw.motionType === cc.MotionType.STATIC) {
      cc.rigidBody.setMotionType(world, h.raw, cc.MotionType.DYNAMIC, true);
      cc.rigidBody.setObjectLayer(world, h.raw, LAYER_MOVING);
      h.mass = h._specMass || h.mass || 0;
    }
  }

  function onCollide(h, cb) { collideCbs.set(h, cb); }

  // ---- listener: material pairs + contact dispatch ----
  const wp = [0, 0, 0];
  const listener = {
    onContactAdded(bodyA, bodyB, manifold, settings) {
      const ha = byId.get(bodyA.id);
      const hb = byId.get(bodyB.id);
      const c = (ha && hb) ? contactFor(ha.material, hb.material) : DEFAULT_CONTACT;
      settings.combinedFriction = c.friction;
      settings.combinedRestitution = c.restitution;
      // dispatch per-body collide callbacks
      const n = manifold.worldSpaceNormal; // [x,y,z], points A→B
      const va = bodyA.motionProperties ? bodyA.motionProperties.linearVelocity : [0, 0, 0];
      const vb = bodyB.motionProperties ? bodyB.motionProperties.linearVelocity : [0, 0, 0];
      const rvx = va[0] - vb[0], rvy = va[1] - vb[1], rvz = va[2] - vb[2];
      const impactSpeed = Math.abs(rvx * n[0] + rvy * n[1] + rvz * n[2]);
      cc.getWorldSpaceContactPointOnA(wp, manifold, 0);
      const point = { x: wp[0], y: wp[1], z: wp[2] };
      if (ha && collideCbs.has(ha)) {
        try { collideCbs.get(ha)(hb, impactSpeed, point); } catch (e) { console.error(e); }
      }
      if (hb && collideCbs.has(hb)) {
        try { collideCbs.get(hb)(ha, impactSpeed, point); } catch (e) { console.error(e); }
      }
    },
  };

  function addDistanceJoint(a, b, length) {
    const pa = [a.position.x, a.position.y, a.position.z];
    const pb = [b.position.x, b.position.y, b.position.z];
    const j = cc.distanceConstraint.create(world, {
      bodyIdA: a.raw.id, bodyIdB: b.raw.id,
      pointA: pa, pointB: pb,
      minDistance: length, maxDistance: length,
      space: cc.ConstraintSpace.WORLD,
    });
    joints.add(j);
    return { raw: j, kind: 'distance' };
  }
  function addFixedJoint(a, b) {
    const pa = [a.position.x, a.position.y, a.position.z];
    const pb = [b.position.x, b.position.y, b.position.z];
    const j = cc.fixedConstraint.create(world, {
      bodyIdA: a.raw.id, bodyIdB: b.raw.id,
      point1: pa, point2: pb,
      axisX1: [1, 0, 0], axisY1: [0, 1, 0],
      axisX2: [1, 0, 0], axisY2: [0, 1, 0],
      space: cc.ConstraintSpace.WORLD,
    });
    joints.add(j);
    return { raw: j, kind: 'fixed' };
  }
  function removeJoint(j) {
    if (!j) return;
    joints.delete(j);
    const mod = j.kind === 'distance' ? cc.distanceConstraint : cc.fixedConstraint;
    mod.remove(world, j.raw);
  }

  function destroy() {
    for (const j of [...joints]) {
      const mod = j.kind === 'distance' ? cc.distanceConstraint : cc.fixedConstraint;
      try { mod.remove(world, j.raw); } catch {}
    }
    joints.clear();
    for (const h of [...handles]) {
      try { cc.rigidBody.remove(world, h.raw); } catch {}
    }
    handles.clear();
    byId.clear();
    collideCbs.clear();
    accumulator = 0;
  }

  return {
    name: 'crashcat',
    addBody, removeBody, bodies, bodyCount,
    step,
    getVelocity, setVelocity, getAngularVelocity, setAngularVelocity,
    setPosition, setQuaternion,
    applyImpulse, applyForce,
    wake, isSleeping, isStatic, makeDynamic,
    onCollide,
    addDistanceJoint, addFixedJoint, removeJoint,
    destroy,
  };
}
