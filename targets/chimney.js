// Pure layout module for the brick industrial chimney target (#55): a square stone
// plinth, a tapering round brick shaft in running bond and a corbelled crown. No THREE,
// no DOM.
// Boxes: { hx, hy, hz, x, y, z, ry, part, course }  // half extents + centre in base units,
// ry = yaw; part 'plinth' | 'shaft' | 'crown'; course 0-based within the part.
// Centred on x = 0, z = 0 with the ground at y = 0; index.html scales by TSCALE 2.
// Spec: docs/superpowers/specs/2026-11-24-issue-55-brick-chimney-design.md

export const CHIMNEY = {
  segments: 10,
  shaftCourses: 24,
  courseHeight: 0.35,
  radiusBottom: 1.3,
  radiusTop: 0.75,
  wallBottom: 0.30,
  wallTop: 0.18,
  plinthCourses: 2,
  plinthBlock: 1.1,
  plinthHeight: 0.45,
  crownCourses: 2,
  crownStep: 0.12,          // each crown course steps this far out in radius
  crownWalls: [0.30, 0.34], // half depth per crown course
  sootCourses: 3,           // top shaft courses tinted by soot; the crown always is
  clearance: 0.002,         // tangential clearance per ring brick (#9)
};

const ROW_GAP = 0.001;   // courses rest on each other instead of hovering a gap apart (#9)

export function chimneyLayout() {
  const boxes = [];
  const plinthTop = addPlinth(boxes);
  const shaftTop = addShaft(boxes, plinthTop);
  addCrown(boxes, shaftTop);
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
  if (box.part === 'crown') return true;
  return box.part === 'shaft' && box.course >= CHIMNEY.shaftCourses - CHIMNEY.sootCourses;
}

// Solid 3×3 grid of stone blocks per course; returns the y of the plinth's top face plus gap.
function addPlinth(boxes) {
  const { plinthCourses, plinthBlock, plinthHeight } = CHIMNEY;
  const pitch = plinthBlock + ROW_GAP;
  const rowPitch = plinthHeight + ROW_GAP;
  for (let course = 0; course < plinthCourses; course++) {
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        boxes.push({
          hx: plinthBlock / 2, hy: plinthHeight / 2, hz: plinthBlock / 2,
          x: i * pitch, y: course * rowPitch + plinthHeight / 2, z: j * pitch,
          ry: 0, part: 'plinth', course,
        });
      }
    }
  }
  return plinthCourses * rowPitch;
}

// One ring of bricks like setupCylinder: centre on the ring at yaw a, local x tangential,
// local z radial; the inner faces meet at the polygon vertices minus the clearance.
function addRing(boxes, part, course, staggered, radius, wall, bottomY) {
  const { segments, courseHeight, clearance } = CHIMNEY;
  const step = 2 * Math.PI / segments;
  const hx = (radius - wall) * Math.tan(step / 2) - clearance;
  for (let j = 0; j < segments; j++) {
    const a = j * step + (staggered ? step / 2 : 0);
    boxes.push({
      hx, hy: courseHeight / 2, hz: wall,
      x: radius * Math.sin(a), y: bottomY + courseHeight / 2, z: radius * Math.cos(a),
      ry: a, part, course,
    });
  }
}

function addShaft(boxes, bottomY) {
  for (let course = 0; course < CHIMNEY.shaftCourses; course++) {
    addRing(boxes, 'shaft', course, course % 2 === 1, shaftRadius(course), shaftWall(course), bottomY + course * coursePitch());
  }
  return bottomY + CHIMNEY.shaftCourses * coursePitch();
}

// The bond continues from the shaft: the crown's first course is staggered iff the shaft
// would have staggered its next course.
function addCrown(boxes, bottomY) {
  const { crownCourses, crownStep, crownWalls, radiusTop, shaftCourses } = CHIMNEY;
  for (let course = 0; course < crownCourses; course++) {
    const staggered = (shaftCourses + course) % 2 === 1;
    addRing(boxes, 'crown', course, staggered, radiusTop + crownStep * (course + 1), crownWalls[course], bottomY + course * coursePitch());
  }
}
