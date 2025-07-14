CELL_WIDTH = 30;
RAIN_LENGTH = 15;
RAIN_SPEED = 20;

NOISE_SCALE = 0.9;

let y;

function setup() {
  createCanvas(windowWidth, windowHeight);
  background(255);
  y = random(height);
}

function isHover(x, y) {
  return (
    mouseX > x - 1 * CELL_WIDTH &&
    mouseX < x + 1 * CELL_WIDTH &&
    mouseY > y - 1 * CELL_HEIGHT &&
    mouseY < y + 1 * CELL_HEIGHT
  );
}

function draw() {
  background(0, 0, 0);

  let t = millis() * 0.002;
  let dropCount = 100;
  strokeWeight(1.5);

  for (let x = 0; x < width; x += 2) {
    let offset_noise = noise(x);
    let speed_noise = noise(x + 1000); // shifted input space
    let offset = offset_noise * 2 * height; // start delay
    let speedMultiplier = map(speed_noise, 0, 1, 80 * 2, 160 * 4); // speed range

    let y = (pow(t, 1) * speedMultiplier + offset) % height;
    opacity_val = map(offset_noise, 0, 1, 0.1, 0.7);
    raindrop_length = map(speed_noise, 0, 1, 8, 15);

    stroke(255, opacity(opacity_val));
    line(x, y, x, y + raindrop_length);
  }
}

function mousePressed() {
  if (mouseButton === RIGHT) {
    let ts = Date.now();
  } else {
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
