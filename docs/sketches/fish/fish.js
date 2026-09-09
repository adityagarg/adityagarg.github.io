// --- Simulation ---
const NUM_FISH = 250;

// --- Perception ---
const VISION_RADIUS = 120;
const VISION_ANGLE = (270 * Math.PI) / 180; // ~270° in radians — blind spot is the rear 90°
const SEPARATION_RADIUS = 30;
const MIN_DISTANCE = 20; // below this, only separation applies — nothing fights it

// --- Steering weights ---
const W_COHESION = 0.5;
const W_SEPARATION = 1.8;
const W_ALIGNMENT = 1;

// --- Motion ---
const CRUISE_SPEED = 2;
const CRUISE_SPEED_VARIATION = 0.5; // per-fish speed spread (±)
const WANDER_NOISE_SCALE = 0.005; // how fast the wander angle evolves
const MAX_TURN_RATE = 0.08; // max radians/frame a fish can turn

// --- Flow field ---
const FLOW_NOISE_SCALE = 0.0015; // spatial frequency (large = broad currents)
const FLOW_TIME_SCALE = 0.0003; // how slowly the field evolves over time
const W_FLOW = 0.1; // weight of flow force

// --- Predator ---
const PREDATOR_RADIUS = 200; // flee radius around mouse
const PREDATOR_EAT_RADIUS = 30; // distance at which predator consumes a fish
const W_PREDATOR = 20.0; // flee force weight (1/d² — spikes near center)
const FLEE_SPEED_BOOST = 1.5; // speed multiplier at peak flee (1 = no boost, 2 = double)
const FLEE_DECAY = 0.93; // boost decay per frame when outside radius (~1.5s to fade)

// --- Food ---
const W_FOOD = 4.0; // attraction weight toward nearest pellet
const FOOD_RADIUS = 400; // perception radius — fish outside this ignore food
const EAT_RADIUS = 8; // distance at which a fish consumes a pellet
const BIRTH_COUNT = 4; // fish spawned near a fish that eats food
const MAX_FOOD_PELLETS = 20; // cap to avoid runaway spawning
const FOOD_COLOR = [255, 220, 80]; // warm yellow dot
const FOOD_PELLET_SIZE = 5; // visual size of the food pellet

// --- Rendering ---
const FISH_WIDTH = 4; // base size of fish body
const FISH_LENGTH = 4 * FISH_WIDTH; // length of the fish body
const TAIL_LENGTH = 1.5 * FISH_WIDTH; // how far the tail extends behind the body
const TAIL_WIDTH = 1.4 * FISH_WIDTH; // max lateral spread of the tail tip
const TAIL_FREQ = 0.18; // oscillation cycles per frame
const TAIL_AMPLITUDE = 0.4; // max tail swing in radians
const TAIL_ATTACH = 0.4; // fraction of body length/width behind center where tail attaches
const BODY_COLOR = [230, 235, 245];
const BACKGROUND_COLOR = [60, 110, 160];

// --- Shimmer (view-angle glint) ---
const SHIMMER_LIGHT_ANGLE = -Math.PI / 3; // virtual light direction
const SHIMMER_COLOR = [24, 53, 82]; // complement of BODY_COLOR — warm near-black

const SHIMMER_GLINT_STRENGTH = 0.8; // 0–1: how far to lerp toward SHIMMER_COLOR at peak
const SHIMMER_GLINT_SHARPNESS = 5; // higher = tighter flash window

// --- Motes (ambient drifting particles) ---
const NUM_MOTES = 200;
const MOTE_SIZE_MIN = 2;
const MOTE_SIZE_MAX = 6;
const MOTE_ALPHA_MIN = 30;
const MOTE_ALPHA_MAX = 80;
const MOTE_DRIFT = 0.5; // pixels/frame drift speed

// --- Touch ---
const DOUBLE_TAP_MS = 200;
let school = [];
let food = [];
let predatorMode = false;
let sharkHeading = 0; // persists between frames to avoid flicker when mouse is still
let pendingBirths = []; // positions queued during update(); flushed to school[] after loop
let motes = [];
let _lastTapTime = 0;
let _lastClickTime = 0;
let _lastTouchTime = 0;

class Fish {
  constructor(x, y) {
    this.position = createVector(x, y);
    this.noiseSeed = random(1000); // unique noise slice per fish
    this.cruiseSpeed =
      CRUISE_SPEED + random(-CRUISE_SPEED_VARIATION, CRUISE_SPEED_VARIATION);
    const angle = random(TWO_PI);
    this.velocity = p5.Vector.fromAngle(angle).mult(this.cruiseSpeed);
    this.fleeBoost = 0; // decaying speed multiplier; set by steer(), decayed by update()
    this.isFleeing = false; // true if within PREDATOR_RADIUS
    this.turnRate = 0; // 0–1 fraction of MAX_TURN_RATE, updated each frame
  }

  // Compute all steering forces (cohesion + separation + alignment + wander).
  // neighbors: array of { j, d } — pre-computed, each pair checked once.
  steer(neighbors) {
    let avgPos = createVector(0, 0); // for cohesion
    let avgVel = createVector(0, 0); // for alignment
    let sepForce = createVector(0, 0); // for separation
    let tooClose = false; // if neighbor within MIN_DISTANCE

    for (const { j, d } of neighbors) {
      avgPos.add(school[j].position);
      avgVel.add(school[j].velocity);

      if (d < SEPARATION_RADIUS) {
        const away = p5.Vector.sub(this.position, school[j].position);
        away.div(d * d); // 1/dist² weighting
        sepForce.add(away);
      }

      if (d < MIN_DISTANCE) tooClose = true;
    }

    sepForce.mult(W_SEPARATION);

    let cohesionForce = createVector(0, 0);
    let alignForce = createVector(0, 0);
    if (neighbors.length > 0) {
      // Alignment always applies
      avgVel.div(neighbors.length);
      avgVel.setMag(this.cruiseSpeed);
      alignForce = p5.Vector.sub(avgVel, this.velocity).mult(W_ALIGNMENT);

      // Cohesion suppressed when too close
      if (!tooClose) {
        avgPos.div(neighbors.length);
        const desired = p5.Vector.sub(avgPos, this.position);
        desired.setMag(this.cruiseSpeed);
        cohesionForce = p5.Vector.sub(desired, this.velocity).mult(W_COHESION);
      }
    }

    // Wander: a small noise-driven rotation force.
    // Scaled by isolation so fish inside a school stay stable.
    const isolation = 1 / (1 + neighbors.length);
    const wanderAngle =
      map(
        noise(this.noiseSeed + frameCount * WANDER_NOISE_SCALE),
        0,
        1,
        -0.05,
        0.05,
      ) * isolation;
    const wanderForce = p5.Vector.fromAngle(
      this.velocity.heading() + wanderAngle,
    )
      .mult(this.cruiseSpeed)
      .sub(this.velocity);

    // Flow field: sample 2D Perlin noise at this fish's position + time offset.
    const t = frameCount * FLOW_TIME_SCALE;
    const flowX =
      noise(
        this.position.x * FLOW_NOISE_SCALE,
        this.position.y * FLOW_NOISE_SCALE,
        t,
      ) - 0.5;
    const flowY =
      noise(
        this.position.x * FLOW_NOISE_SCALE + 1000,
        this.position.y * FLOW_NOISE_SCALE + 1000,
        t,
      ) - 0.5;
    const flowDesired = createVector(flowX, flowY).setMag(this.cruiseSpeed);
    const flowForce = p5.Vector.sub(flowDesired, this.velocity).mult(W_FLOW);

    // Predator flee: if predatorMode, check distance to mouse.
    // Flee force uses 1/d² weighting so panic spikes when very close.
    // Cohesion and alignment suppressed so fish scatter independently;
    // separation kept so they don't pile into each other while fleeing.
    let fleeForce = createVector(0, 0);
    this.isFleeing = false;
    if (predatorMode) {
      const pd = dist(this.position.x, this.position.y, mouseX, mouseY);
      if (pd < PREDATOR_RADIUS && pd > 0) {
        this.isFleeing = true;
        const away = p5.Vector.sub(this.position, createVector(mouseX, mouseY));
        away.div(pd * pd);
        fleeForce = away.copy().mult(W_PREDATOR);
        cohesionForce.set(0, 0);
        alignForce.set(0, 0);
      }
    }

    // Food attraction: suppressed while fleeing — fish ignore food in a panic.
    let foodForce = createVector(0, 0);
    if (!this.isFleeing && food.length > 0) {
      let nearestDist = Infinity;
      let nearestPellet = null;
      for (const pellet of food) {
        const fd = dist(this.position.x, this.position.y, pellet.x, pellet.y);
        if (fd < nearestDist) {
          nearestDist = fd;
          nearestPellet = pellet;
        }
      }
      if (nearestPellet !== null && nearestDist < FOOD_RADIUS) {
        const desired = p5.Vector.sub(nearestPellet, this.position).setMag(
          this.cruiseSpeed,
        );
        foodForce = p5.Vector.sub(desired, this.velocity).mult(W_FOOD);
      }
    }

    return p5.Vector.add(
      cohesionForce,
      p5.Vector.add(
        alignForce,
        p5.Vector.add(
          sepForce,
          p5.Vector.add(
            wanderForce,
            p5.Vector.add(flowForce, p5.Vector.add(foodForce, fleeForce)),
          ),
        ),
      ),
    );
  }

  // Main force application and movement update for the fish.
  update(steerForce) {
    const oldHeading = this.velocity.heading();

    this.velocity.add(steerForce);

    // Cap turn rate: clamp angular change to MAX_TURN_RATE radians/frame.
    // Wrap delta to [-PI, PI] to handle the 0/2PI boundary correctly.
    let delta = this.velocity.heading() - oldHeading;
    if (delta > PI) delta -= TWO_PI;
    if (delta < -PI) delta += TWO_PI;
    // EMA smoothing: shimmer decays over a few frames rather than jittering per-frame
    const rawRate = Math.min(Math.abs(delta), MAX_TURN_RATE) / MAX_TURN_RATE;
    this.turnRate = 0.85 * this.turnRate + 0.15 * rawRate;
    // Flee boost: spike to 1 when fleeing, decay multiplicatively otherwise.
    // Applied to speed after turn-rate cap so direction change is still capped
    // but fish can move faster than cruiseSpeed during panic.
    if (this.isFleeing) {
      this.fleeBoost = 1;
    } else {
      this.fleeBoost *= FLEE_DECAY;
    }
    const speed = this.cruiseSpeed * (1 + FLEE_SPEED_BOOST * this.fleeBoost);

    if (abs(delta) > MAX_TURN_RATE) {
      this.velocity = p5.Vector.fromAngle(
        oldHeading + Math.sign(delta) * MAX_TURN_RATE,
      ).mult(speed);
    } else {
      this.velocity.setMag(speed);
    }

    this.position.add(this.velocity);

    // Consume any pellet within EAT_RADIUS; spawn BIRTH_COUNT fish on each eat
    for (let k = food.length - 1; k >= 0; k--) {
      if (
        dist(this.position.x, this.position.y, food[k].x, food[k].y) <
        EAT_RADIUS
      ) {
        food.splice(k, 1);
        for (let b = 0; b < BIRTH_COUNT; b++) {
          // Scatter births randomly within a small radius of the eating fish
          pendingBirths.push(
            this.position.copy().add(p5.Vector.random2D().mult(random(10, 25))),
          );
        }
      }
    }

    // Wrap at edges
    if (this.position.x < 0) this.position.x += width;
    if (this.position.x > width) this.position.x -= width;
    if (this.position.y < 0) this.position.y += height;
    if (this.position.y > height) this.position.y -= height;
  }

  draw() {
    push();
    const heading = this.velocity.heading();
    translate(this.position.x, this.position.y);
    rotate(heading);
    noStroke();
    // Peaks when the fish is broadside to the virtual light — scales catch it.
    const broadside = Math.abs(Math.sin(heading - SHIMMER_LIGHT_ANGLE));
    const t =
      Math.pow(broadside, SHIMMER_GLINT_SHARPNESS) *
      SHIMMER_GLINT_STRENGTH *
      this.turnRate *
      this.turnRate *
      this.turnRate;
    const [r, g, b] = BODY_COLOR;
    const [sr, sg, sb] = SHIMMER_COLOR;
    fill(r + (sr - r) * t, g + (sg - g) * t, b + (sb - b) * t);

    // Body: ellipse centered slightly forward so tail has room behind
    ellipse(FISH_LENGTH * 0.1, 0, FISH_LENGTH, FISH_WIDTH);

    // Tail: triangle that oscillates side to side.
    const tailAngle =
      sin(frameCount * TAIL_FREQ + this.noiseSeed) * TAIL_AMPLITUDE;
    const tailBaseX = -FISH_LENGTH * TAIL_ATTACH; // rear of body
    const tailTipX = tailBaseX - TAIL_LENGTH;
    const tailTipY = TAIL_WIDTH * sin(tailAngle);
    triangle(
      tailBaseX,
      FISH_WIDTH * TAIL_ATTACH,
      tailBaseX,
      -FISH_WIDTH * TAIL_ATTACH,
      tailTipX,
      tailTipY,
    );

    pop();
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  for (let i = 0; i < NUM_FISH; i++) {
    school.push(new Fish(random(width), random(height)));
  }
  for (let i = 0; i < NUM_MOTES; i++) {
    const m = createVector(random(width), random(height));
    m.sz = random(MOTE_SIZE_MIN, MOTE_SIZE_MAX);
    m.alpha = random(MOTE_ALPHA_MIN, MOTE_ALPHA_MAX);
    motes.push(m);
  }
}

// Drifts each mote one step along the flow field, wraps edges, then draws it.
function drawMotes() {
  const t = frameCount * FLOW_TIME_SCALE;
  const [br, bg, bb] = BACKGROUND_COLOR;
  noStroke();
  for (const m of motes) {
    fill(br + 80, bg + 60, bb + 50, m.alpha);
    const fx =
      (noise(m.x * FLOW_NOISE_SCALE, m.y * FLOW_NOISE_SCALE, t) - 0.5) * 2;
    const fy =
      (noise(m.x * FLOW_NOISE_SCALE + 1000, m.y * FLOW_NOISE_SCALE + 1000, t) -
        0.5) *
      2;
    m.x += fx * MOTE_DRIFT;
    m.y += fy * MOTE_DRIFT;
    if (m.x < 0) m.x += width;
    if (m.x > width) m.x -= width;
    if (m.y < 0) m.y += height;
    if (m.y > height) m.y -= height;
    ellipse(m.x, m.y, m.sz);
  }
}

function buildNeighbors(school) {
  const neighbors = Array.from({ length: school.length }, () => []);
  for (let i = 0; i < school.length; i++) {
    for (let j = i + 1; j < school.length; j++) {
      const d = dist(
        school[i].position.x,
        school[i].position.y,
        school[j].position.x,
        school[j].position.y,
      );
      if (d < VISION_RADIUS) {
        // Vision cone check: only add neighbor if it falls within VISION_ANGLE
        // of the perceiving fish's heading.
        const halfAngle = VISION_ANGLE / 2;
        const toJ = p5.Vector.sub(school[j].position, school[i].position);
        const toI = p5.Vector.sub(school[i].position, school[j].position);
        if (abs(p5.Vector.angleBetween(school[i].velocity, toJ)) < halfAngle) {
          neighbors[i].push({ j, d });
        }
        if (abs(p5.Vector.angleBetween(school[j].velocity, toI)) < halfAngle) {
          neighbors[j].push({ j: i, d });
        }
      }
    }
  }
  return neighbors;
}

function draw() {
  background(...BACKGROUND_COLOR);
  drawMotes();

  // Pass 1: compute neighbor lists once for all fish (each pair checked once)
  const neighbors = buildNeighbors(school);

  // Pass 2a: compute steering forces using frozen neighbor data
  const forces = school.map((fish, i) => fish.steer(neighbors[i]));

  // Pass 2b: apply forces, move, draw
  for (let i = 0; i < school.length; i++) {
    school[i].update(forces[i]);
    school[i].draw();
  }

  // Flush births queued during update()
  for (const pos of pendingBirths) {
    school.push(new Fish(pos.x, pos.y));
  }
  pendingBirths = [];

  // Predator eats fish on contact (only when predator mode is active)
  if (predatorMode) {
    for (let i = school.length - 1; i >= 0; i--) {
      if (
        dist(school[i].position.x, school[i].position.y, mouseX, mouseY) <
        PREDATOR_EAT_RADIUS
      ) {
        school.splice(i, 1);
      }
    }
  }

  // Draw food pellets
  noStroke();
  for (const pellet of food) {
    drawFoodPellet(pellet);
  }

  // Draw shark cursor when predator mode is active
  if (predatorMode) {
    const dx = mouseX - pmouseX;
    const dy = mouseY - pmouseY;
    if (dx * dx + dy * dy > 15) {
      // only update heading when mouse moved >2px
      sharkHeading = atan2(dy, dx);
    }
    drawShark(mouseX, mouseY, sharkHeading);
  }
}

// Draws a single food pellet
function drawFoodPellet(pellet) {
  const BLOB_STEPS = 36;
  const outerR = FOOD_PELLET_SIZE;
  const [r, g, b] = FOOD_COLOR;

  // Gentle float offset — render position drifts independently of logical position
  // so attraction force and consumption radius are unaffected.
  const floatX = cos(frameCount * 0.025 + pellet.y * 0.02) * 5;
  const floatY = sin(frameCount * 0.03 + pellet.x * 0.02) * 8;
  const rx = pellet.x + floatX;
  const ry = pellet.y + floatY;

  const grad = drawingContext.createRadialGradient(rx, ry, 0, rx, ry, outerR);
  grad.addColorStop(0, `rgba(${r},${g},${b},0.9)`);
  grad.addColorStop(0.4, `rgba(${r},${g},${b},0.5)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);

  drawingContext.fillStyle = grad;
  noStroke();
  beginShape();
  for (let i = 0; i < BLOB_STEPS; i++) {
    const a = (TWO_PI * i) / BLOB_STEPS;
    const nx = cos(a) * 0.5 + pellet.x * 0.003;
    const ny = sin(a) * 0.5 + pellet.y * 0.003;
    const radius =
      outerR + map(noise(nx, ny), 0, 1, -outerR * 0.3, outerR * 0.3);
    vertex(rx + cos(a) * radius, ry + sin(a) * radius);
  }
  endShape(CLOSE);
}

function mouseClicked() {
  if (Date.now() - _lastTouchTime < 500) return; // synthetic mouse event after touch
  const now = Date.now();
  const rapid = now - _lastClickTime < DOUBLE_TAP_MS;
  _lastClickTime = now;
  if (rapid) return; // second click of a double-click — let doubleClicked() handle it
  if (food.length < MAX_FOOD_PELLETS) {
    food.push(createVector(mouseX, mouseY));
  }
}

function doubleClicked() {
  if (Date.now() - _lastTouchTime < 500) return; // touchStarted already handled it
  predatorMode = !predatorMode;
  if (predatorMode) noCursor();
  else cursor(ARROW);
}

// Single tap = food drop; double tap = food drop + predator toggle.
function touchStarted() {
  const now = Date.now();
  if (now - _lastTapTime < DOUBLE_TAP_MS) {
    predatorMode = !predatorMode;
    if (predatorMode) noCursor();
    else cursor(ARROW);
  }
  _lastTapTime = now;
  _lastTouchTime = now;
  if (food.length < MAX_FOOD_PELLETS) {
    food.push(createVector(mouseX, mouseY));
  }
  return false; // prevent scroll/zoom
}

// Top-down whale shark
function drawShark(x, y, heading) {
  push();
  translate(x, y);
  rotate(heading);
  noStroke();
  fill(35, 45, 55);

  const L = 42;
  const W = 13;

  // One loop tracing: nose → upper pectoral → long narrow body →
  // upper tail lobe → tail notch → lower tail lobe → lower body → lower pectoral → nose
  beginShape();
  curveVertex(-L * 0.75, W * 0.1); // ghost (= last real pt)
  curveVertex(L, 0); // nose — blunt head
  curveVertex(L * 0.7, -W * 0.65); // upper head
  curveVertex(L * 0.45, -W * 1.1); // pectoral leading edge (close to head)
  curveVertex(L * 0.25, -W * 1.9); // pectoral tip
  curveVertex(L * 0.05, -W * 1.0); // pectoral trailing edge
  curveVertex(-L * 0.1, -W * 0.38); // body narrows quickly
  curveVertex(-L * 0.55, -W * 0.14); // long narrow body
  curveVertex(-L * 0.75, -W * 0.1); // tail stock
  curveVertex(-L * 1.05, -W * 0.65); // upper tail lobe
  curveVertex(-L * 0.9, 0); // tail notch centre
  curveVertex(-L * 1.05, W * 0.5); // lower tail lobe
  curveVertex(-L * 0.75, W * 0.1); // tail stock lower
  curveVertex(-L * 0.55, W * 0.14); // long narrow body
  curveVertex(-L * 0.1, W * 0.38); // body widens
  curveVertex(L * 0.05, W * 1.0); // pectoral trailing edge
  curveVertex(L * 0.25, W * 1.9); // pectoral tip
  curveVertex(L * 0.45, W * 1.1); // pectoral leading edge
  curveVertex(L * 0.7, W * 0.65); // lower head
  curveVertex(L, 0); // ghost (= nose)
  endShape(CLOSE);

  pop();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
m;
