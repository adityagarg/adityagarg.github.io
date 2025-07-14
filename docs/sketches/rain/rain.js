// Constants
let y;
let timeSpeed = 1;
let targetTimeSpeed = 1;
let lerpFactor = 0.1; // Easing factor for smooth transition of time speed

let accumulatedTime = 0;
let lastFrameTime = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  background(255);
  lastFrameTime = millis();
}

function isHover(x, y) {
  return (
    mouseX > x - 1 * CELL_WIDTH &&
    mouseX < x + 1 * CELL_WIDTH &&
    mouseY > y - 1 * CELL_HEIGHT &&
    mouseY < y + 1 * CELL_HEIGHT
  );
}

function rain_drop(x, y, length, width, opacity_val) {
  fill(255, opacity(opacity_val));
  noStroke();
  triangle(x, y, x - width, y + length, x + width, y + length);
}

function draw() {
  background(0, 0, 0);

  timeSpeed = lerp(timeSpeed, targetTimeSpeed, lerpFactor);

  let now = millis();
  let delta = (now - lastFrameTime) * 0.002; // base speed
  accumulatedTime += delta * timeSpeed;
  lastFrameTime = now;

  let t = accumulatedTime;

  for (let x = 0; x < width; x += 2) {
    let offset_noise = noise(x);
    let speed_noise = noise(x + 1000); // shifted input space
    let offset = offset_noise * 2 * height; // start delay
    let speedMultiplier = map(speed_noise, 0, 1, 80 * 2, 160 * 4); // speed range

    let y = (pow(t, 1) * speedMultiplier + offset) % height;
    opacity_val = map(offset_noise, 0, 1, 0.1, 0.7);
    raindrop_length = map(speed_noise, 0, 1, 8, 12);

    let w = map(speed_noise, 0, 1, 1.2, 1.5);
    rain_drop(x, y, raindrop_length, w, opacity_val);
  }
}

function mousePressed() {
  if (mouseButton === RIGHT) {
    let ts = Date.now();
  } else {
    lerpFactor = 0.1;
    targetTimeSpeed = 0.1;
  }
}

function mouseReleased() {
  if (mouseButton === RIGHT) {
  } else {
    lerpFactor = 0.2;
    targetTimeSpeed = 1;
  }
}

function touchStarted() {
  mousePressed();
  return false; // Prevents default behavior
}

function touchEnded() {
  mouseReleased();
  return false; // Prevents default behavior
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  background(255);
  textured_background();
}
