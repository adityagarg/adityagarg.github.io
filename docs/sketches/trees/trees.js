// Global constants

let defaultTrunkLength = p5.prototype.map(
  p5.prototype.windowHeight,
  761,
  857,
  38,
  60
);
const DEFAULT_TRUNK_LENGTH = p5.prototype.constrain(
  defaultTrunkLength,
  20,
  100
);
const TRUNK_WIDTH = 10;
const TRUNK_BASE_OFFSET = 100;
const TRUNK_OPACITY = opacity(1);

const MAX_BRANCH_ANGLE = Math.PI / 6;
// The following constants will be overridden by slider values when drawing branches.
const DEFAULT_LENGTH_MULTIPLIER = 0.9;
const DEFAULT_WIDTH_MULTIPLIER = 0.65;
const OPACITY_MULTIPLIER = 0.8;

const LEAF_WIDTH = 6;
const LEAF_HEIGHT = 6;
const LEAF_START_AFTER_LEVEL = 3;
const NUM_LEAVES_PER_LEVEL = 1;
const LEAF_MAX_DISTANCE_FROM_BRANCH = 10;

const NUM_LEVELS = 12;
const NUM_SPLITS = 2;

// Global slider variables and label variables
let lengthSlider, numLevelsSlider;
let lengthSliderLabel;

// Global variables for fade‑in effect
let trees = []; // will hold { branchBuffer, leavesBuffer, fadeAlphaBranch, fadeAlphaLeaves, state }

function draw_leaves(lb, x1, y1, x2, y2, num_leaves) {
  lb.push();
  lb.noStroke();
  lb.fill(193, 18, 31, opacity(0.6));
  for (let i = 1; i <= num_leaves; i++) {
    let t = i / (num_leaves + 1);
    let x =
      lb.lerp(x1, x2, t) +
      lb.random(-LEAF_MAX_DISTANCE_FROM_BRANCH, LEAF_MAX_DISTANCE_FROM_BRANCH);
    let y =
      lb.lerp(y1, y2, t) +
      lb.random(-LEAF_MAX_DISTANCE_FROM_BRANCH, LEAF_MAX_DISTANCE_FROM_BRANCH);
    let leafW = LEAF_WIDTH + lb.random(-LEAF_WIDTH / 3, LEAF_WIDTH / 3);
    let leafH = LEAF_HEIGHT + lb.random(-LEAF_HEIGHT / 3, LEAF_HEIGHT / 3);
    lb.ellipse(x, y, leafW, leafH);
  }
  lb.pop();
}

function draw_branch(bb, lb, length, angle, width, depth, alpha) {
  bb.strokeWeight(width);
  bb.stroke(47, 0, 0, alpha);
  if (depth === 0) return;

  let x_end = bb.cos(angle) * length;
  let y_end = bb.sin(angle) * length;
  bb.line(0, 0, x_end, y_end);

  if (depth < NUM_LEVELS - LEAF_START_AFTER_LEVEL) {
    draw_leaves(lb, 0, 0, x_end, y_end, NUM_LEAVES_PER_LEVEL);
  }

  bb.translate(x_end, y_end);
  lb.translate(x_end, y_end);
  for (let i = 0; i < NUM_SPLITS; i++) {
    let lengthMult = DEFAULT_LENGTH_MULTIPLIER + bb.random(-0.1, 0.1);
    let widthMult = DEFAULT_WIDTH_MULTIPLIER + bb.random(-0.2, 0.2);
    let newLength = length * lengthMult;
    let newWidth = width * widthMult;
    let deltaAngle = bb.random(-MAX_BRANCH_ANGLE, MAX_BRANCH_ANGLE);
    let newAngle = angle + deltaAngle;
    let newAlpha = alpha * OPACITY_MULTIPLIER;
    bb.push();
    lb.push();
    draw_branch(bb, lb, newLength, newAngle, newWidth, depth - 1, newAlpha);
    bb.pop();
    lb.pop();
  }
}

function draw_tree_buffer(bb, lb, x, y) {
  bb.stroke(47, 0, 0);
  bb.push();
  bb.translate(x, y);
  lb.translate(x, y);
  let trunk_length = lengthSlider.value();
  draw_branch(
    bb,
    lb,
    trunk_length,
    -bb.HALF_PI,
    TRUNK_WIDTH,
    NUM_LEVELS,
    TRUNK_OPACITY
  );
  bb.pop();
}

/* ========================
   p5.js Setup and Draw
   ======================== */

function setup() {
  createCanvas(windowWidth, windowHeight);
  background(255);
  textured_background();

  lengthSliderLabel = createDiv("tree size");
  lengthSliderLabel.class("slider-label");
  lengthSliderLabel.position(windowWidth - 105, windowHeight - 50);

  lengthSlider = createSlider(20, 100, DEFAULT_TRUNK_LENGTH, 5);

  lengthSlider.position(windowWidth - 150, windowHeight - 65);
  lengthSlider.style("width", "100px");
  lengthSlider.class("mySlider");
  lengthSlider.elt.addEventListener("mousedown", (e) => e.stopPropagation());
  lengthSlider.elt.addEventListener("touchstart", (e) => e.stopPropagation());
  lengthSlider.elt.addEventListener("touchmove", (e) => e.stopPropagation());
}

function draw() {
  // Animate each tree in parallel
  for (let t of trees) {
    if (t.state === "branch") {
      tint(255, t.fadeAlphaBranch);
      image(t.branchBuffer, 0, 0);
      noTint();

      t.fadeAlphaBranch += 8;
      if (t.fadeAlphaBranch >= 255) {
        // Branch fade done → lock it and move to leaves
        image(t.branchBuffer, 0, 0);
        t.state = "leaves";
      }
    } else if (t.state === "leaves") {
      tint(255, t.fadeAlphaLeaves);
      image(t.leavesBuffer, 0, 0);
      noTint();

      t.fadeAlphaLeaves += 0.75;
      if (t.fadeAlphaLeaves >= 255) {
        // Leaves fade done → lock them
        image(t.leavesBuffer, 0, 0);
        t.state = "done";
      }
    }
  }

  // Remove trees that are fully finished
  trees = trees.filter((t) => t.state !== "done");
}

function mousePressed() {
  if (mouseButton === RIGHT) {
    let ts = Date.now();
    // Uncomment the following line to save the canvas image:
    // saveCanvas('tree_' + ts, 'png');
  } else {
    // create an offscreen graphics buffer and draw the tree on it to animate slowly onto the main canvas
    branchBuffer = createGraphics(windowWidth, windowHeight);
    leavesBuffer = createGraphics(windowWidth, windowHeight);
    draw_tree_buffer(branchBuffer, leavesBuffer, mouseX, mouseY);

    // adding a new tree animation to the queue
    trees.push({
      branchBuffer: branchBuffer,
      leavesBuffer: leavesBuffer,
      fadeAlphaBranch: 0,
      fadeAlphaLeaves: 0,
      state: "branch", // or 'leaves' or 'done'
    });
  }
}

function touchStarted() {
  mousePressed();
  return false; // Prevents default behavior
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  background(255);
  textured_background();
}
