// PhysicsBackend facade over cannon-es.
// createCannonBackend(CANNON): wraps cannon-es 1:1 so the game's physics
// behaviour is unchanged. Game code never touches CANNON directly after
// the migration — it only talks to the `phys` handle returned here.

import { MATERIALS, CONTACT_PAIRS, DEFAULT_CONTACT, contactFor } from './materials.js';

export function createCannonBackend(CANNON) {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.allowSleep = true;

  const mats = {};
  for (const name of MATERIALS) mats[name] = new CANNON.Material(name);
  for (const [a, b, c] of CONTACT_PAIRS) {
    world.addContactMaterial(new CANNON.ContactMaterial(mats[a], mats[b], { friction: c.friction, restitution: c.restitution }));
  }
  void DEFAULT_CONTACT; // cannon falls back to its internal default for unpaired

  const handles = new Set();

  function makeShape(spec) {
    if (spec.kind === 'box') return new CANNON.Box(new CANNON.Vec3(spec.halfExtents[0], spec.halfExtents[1], spec.halfExtents[2]));
    if (spec.kind === 'sphere') return new CANNON.Sphere(spec.radius);
    if (spec.kind === 'cylinder') return new CANNON.Cylinder(spec.radiusTop, spec.radiusBottom, spec.height, spec.segments);
    if (spec.kind === 'ground') return new CANNON.Plane();
    throw new Error('unknown shape kind: ' + spec.kind);
  }

  function addBody(spec) {
    const shape = makeShape(spec.shape);
    const isStatic = spec.isStatic || spec.mass === 0;
    const body = new CANNON.Body({
      mass: isStatic ? 0 : spec.mass,
      type: isStatic ? CANNON.Body.STATIC : CANNON.Body.DYNAMIC,
      material: mats[spec.material] || null,
      shape,
      position: new CANNON.Vec3(spec.position.x, spec.position.y, spec.position.z),
      linearDamping: spec.linearDamping,
      angularDamping: spec.angularDamping,
      sleepSpeedLimit: spec.sleepSpeedLimit,
      sleepTimeLimit: spec.sleepTimeLimit,
    });
    if (spec.quaternion) body.quaternion.set(spec.quaternion.x, spec.quaternion.y, spec.quaternion.z, spec.quaternion.w);
    if (spec.shape.kind === 'ground') body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(body);
    const handle = {
      raw: body,
      material: spec.material,
      mass: isStatic ? 0 : spec.mass,
      userData: spec.userData,
      _specMass: spec.mass,
      get position() { return body.position; },
      get quaternion() { return body.quaternion; },
    };
    body._handle = handle;
    handles.add(handle);
    if (spec.startAsleep) body.sleep();
    return handle;
  }

  function removeBody(h) {
    if (!h || !handles.has(h)) return;
    handles.delete(h);
    world.removeBody(h.raw);
  }

  function bodies() { return [...handles]; }
  function bodyCount() { return handles.size; }

  function step(dt) { world.step(1 / 240, dt, 10); }

  function getVelocity(h) { const v = h.raw.velocity; return { x: v.x, y: v.y, z: v.z }; }
  function setVelocity(h, x, y, z) { h.raw.velocity.set(x, y, z); }
  function getAngularVelocity(h) { const v = h.raw.angularVelocity; return { x: v.x, y: v.y, z: v.z }; }
  function setAngularVelocity(h, x, y, z) { h.raw.angularVelocity.set(x, y, z); }

  function setPosition(h, x, y, z) { h.raw.position.set(x, y, z); }
  function setQuaternion(h, x, y, z, w) { h.raw.quaternion.set(x, y, z, w); }

  function applyImpulse(h, x, y, z) {
    h.raw.wakeUp();
    // Preserve the pre-facade call: the game passed body.position as cannon's
    // relativePoint (lever arm), which adds spin. Kept identical so the cannon
    // path is the unchanged regression baseline (#9).
    h.raw.applyImpulse(new CANNON.Vec3(x, y, z), h.raw.position);
  }
  function applyForce(h, x, y, z) {
    h.raw.wakeUp();
    h.raw.applyForce(new CANNON.Vec3(x, y, z), h.raw.position);
  }

  function wake(h) { h.raw.wakeUp(); }
  function isSleeping(h) { return h.raw.sleepState === CANNON.Body.SLEEPING; }
  function isStatic(h) { return h.raw.type === CANNON.Body.STATIC; }
  function makeDynamic(h) {
    if (h.raw.type !== CANNON.Body.STATIC) return;
    h.raw.type = CANNON.Body.DYNAMIC;
    h.raw.mass = h._specMass || h.mass || 0;
    h.mass = h.raw.mass;
    h.raw.updateMassProperties();
    h.raw.wakeUp();
  }

  function onCollide(h, cb) {
    h.raw.addEventListener('collide', (e) => {
      const otherRaw = e.body === h.raw ? e.target : e.body;
      const other = otherRaw ? otherRaw._handle : null;
      const impactSpeed = Math.abs(e.contact.getImpactVelocityAlongNormal());
      const p = e.contact.bi.id === h.raw.id ? e.contact.ri : e.contact.rj;
      const point = { x: p.x, y: p.y, z: p.z };
      // translate to world point
      const wp = { x: h.raw.position.x + p.x, y: h.raw.position.y + p.y, z: h.raw.position.z + p.z };
      cb(other, impactSpeed, wp);
      void point;
    });
  }

  function addDistanceJoint(a, b, length) {
    const c = new CANNON.DistanceConstraint(a.raw, b.raw, length);
    world.addConstraint(c);
    return { raw: c, kind: 'distance' };
  }
  function addFixedJoint(a, b) {
    const c = new CANNON.LockConstraint(a.raw, b.raw);
    world.addConstraint(c);
    return { raw: c, kind: 'fixed' };
  }
  function removeJoint(j) {
    if (!j) return;
    world.removeConstraint(j.raw);
  }

  function destroy() {
    for (const h of [...handles]) world.removeBody(h.raw);
    handles.clear();
    for (const c of [...world.constraints]) world.removeConstraint(c);
  }

  return {
    name: 'cannon',
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
