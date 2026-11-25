// Pure layout module for the brick industrial chimney target (#55, reshaped in #58): a
// tapering round brick shaft in running bond standing directly on the ground. No plinth,
// no crown. No THREE, no DOM.
// Boxes: { hx, hy, hz, x, y, z, ry, part, course }  // half extents + centre in base units,
// ry = yaw; part is always 'shaft'; course 0-based from the ground.
// brickFaceRects/visibleBrickAspect describe the texture: two brick courses per body (#64).
// Centred on x = 0, z = 0 with the ground at y = 0; index.html scales by TSCALE 2.
// Spec: docs/superpowers/specs/2026-11-25-issue-58-bigger-chimney-design.md

export const CHIMNEY = {
  segments: 12,
  shaftCourses: 43,
  courseHeight: 0.35,
  radiusBottom: 1.625,
  radiusTop: 0.9375,
  wallBottom: 0.375,
  wallTop: 0.225,
  sootCourses: 5,           // top shaft courses tinted by soot
  clearance: 0.002,         // tangential clearance per ring brick (#9)
  faceRows: 2,              // brick courses drawn on one body's texture, so bricks look elongated (#64)
};

const ROW_GAP = 0;      // courses touch exactly so waking the stack doesn't settle (#55)

export function chimneyLayout() {
  const boxes = [];
  for (let course = 0; course < CHIMNEY.shaftCourses; course++) {
    addRing(boxes, course, course % 2 === 1, shaftRadius(course), shaftWall(course), course * coursePitch());
  }
  return boxes;
}

export function coursePitch() {
  return CHIMNEY.courseHeight + ROW_GAP;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function shaftT(course) {
  return course / (CHIMNEY.shaftCourses - 1);
}

export function shaftRadius(course) {
  return lerp(CHIMNEY.radiusBottom, CHIMNEY.radiusTop, shaftT(course));
}

export function shaftWall(course) {
  return lerp(CHIMNEY.wallBottom, CHIMNEY.wallTop, shaftT(course));
}

export function isSoot(box) {
  return box.part === 'shaft' && box.course >= CHIMNEY.shaftCourses - CHIMNEY.sootCourses;
}

// One ring of bricks like setupCylinder: centre on the ring at yaw a, local x tangential,
// local z radial; the inner faces meet at the polygon vertices minus the clearance.
function addRing(boxes, course, staggered, radius, wall, bottomY) {
  const { segments, courseHeight, clearance } = CHIMNEY;
  const step = 2 * Math.PI / segments;
  const hx = (radius - wall) * Math.tan(step / 2) - clearance;
  for (let j = 0; j < segments; j++) {
    const a = j * step + (staggered ? step / 2 : 0);
    boxes.push({
      hx, hy: courseHeight / 2, hz: wall,
      x: radius * Math.sin(a), y: bottomY + courseHeight / 2, z: radius * Math.cos(a),
      ry: a, part: 'shaft', course,
    });
  }
}

// Brick rectangles of one chimney texture (#64): a mortar frame of joint/2 on every edge,
// so two bodies side by side show one full joint, and `rows` equal bricks separated by a
// full joint. Head joints stay at the body edges, so the running bond is unchanged.
export function brickFaceRects(width, height, rows, joint) {
  const h = (height - rows * joint) / rows;
  const rects = [];
  for (let i = 0; i < rows; i++) {
    rects.push({ x: joint / 2, y: joint / 2 + i * (h + joint), w: width - joint, h });
  }
  return rects;
}

// Visible length : height of one drawn brick of a body (#64).
export function visibleBrickAspect(box) {
  return (2 * box.hx) / ((2 * box.hy) / CHIMNEY.faceRows);
}
