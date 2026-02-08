// Constants
let y;
let timeSpeed = 1;
let targetTimeSpeed = 1;
let lerpFactor = 0.1;

let accumulatedTime = 0;
let lastFrameTime = 0;
let domeRadius = 80;
let groundHeight = 50;
let umbrellaActive = false;
let lastTapTime = 0;
let tapThreshold = 300;

function updateUmbrellaSize() {
  domeRadius = min(width, height) * 0.08;
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  background(255);
  lastFrameTime = millis();
  noCursor();
  updateUmbrellaSize();
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

function umbrella_surface_y(x, rx, ry) {
  let dx = x - mouseX;
  if (abs(dx) > rx) {
    return null;
  }
  let nx = dx / rx;
  return mouseY - ry * sqrt(1 - nx * nx);
}

function umbrella_splash(x, y, strength) {
  noFill();
  stroke(255, 180);
  let splash_w = map(strength, 0, 1, 6, 20);
  let splash_h = map(strength, 0, 1, 2, 8);
  ellipse(x, y, splash_w, splash_h);
}

function draw() {
  background(0, 0, 0);

  // // lightning effect
  // if (random() < 0.005) {
  //   background(255);
  //   return;
  // }

  timeSpeed = lerp(timeSpeed, targetTimeSpeed, lerpFactor);

  let now = millis();
  let delta = (now - lastFrameTime) * 0.002; // base speed
  accumulatedTime += delta * timeSpeed;
  lastFrameTime = now;

  let t = accumulatedTime;

  for (let x = 0; x < width; x += 2) {
    let offset_noise = noise(x);
    let speed_noise = noise(x + 1000);
    let offset = offset_noise * 2 * height; // start delay
    let speedMultiplier = map(speed_noise, 0, 1, 80 * 2, 160 * 4); // speed range

    let y = (pow(t, 1) * speedMultiplier + offset) % height;
    opacity_val = map(offset_noise, 0, 1, 0.1, 0.7);
    raindrop_length = map(speed_noise, 0, 1, 8, 12);

    let w = map(speed_noise, 0, 1, 1.2, 1.5);

    randomFloor = map(noise(x), 0, 1, 0, groundHeight);

    let drop_tip_y = y + raindrop_length;
    let opacity_multiplier = 1;
    if (umbrellaActive) {
      let domeRX = domeRadius * 1.25;
      let domeRY = domeRadius * 0.85;
      let surface_y = umbrella_surface_y(x, domeRX, domeRY);
      if (surface_y !== null && drop_tip_y >= surface_y) {
        if (drop_tip_y <= mouseY) {
          umbrella_splash(x, surface_y, speed_noise);
        }
        let vertical_fade = constrain(
          map(drop_tip_y, surface_y, height, 0, 0.7),
          0,
          1,
        );
        let horizontal_fade = constrain(
          map(abs(x - mouseX), 0, domeRX, 1, 1.4),
          1,
          1.5,
        );
        opacity_multiplier = vertical_fade * horizontal_fade;
      }
    }

    if (drop_tip_y >= height - (groundHeight - randomFloor)) {
      noFill();
      stroke(255, opacity(0.2 * opacity_multiplier));
      drop_radius = map(speed_noise, 0, 1, 5, 15);
      drop_height = map(speed_noise, 0, 1, 1, 3);
      ellipse(
        x,
        height - (groundHeight - randomFloor),
        drop_radius,
        drop_height,
      );
      continue;
    }
    rain_drop(x, y, raindrop_length, w, opacity_val * opacity_multiplier);
  }

  if (umbrellaActive) {
    // Umbrella outline
    noFill();
    stroke(255, opacity(0.9));
    strokeWeight(0.7);

    let domeRX = domeRadius * 1.25;
    let domeRY = domeRadius * 0.85;
    arc(mouseX, mouseY, domeRX * 2, domeRY * 2, PI, PI * 2);

    // Umbrella cap
    stroke(255, 200);
    strokeWeight(2);
    let shaft_bottom_y = mouseY + domeRY * 0.15;
    line(mouseX, mouseY, mouseX, shaft_bottom_y);

    // Umbrella handle
    stroke(255, 200);
    strokeWeight(2);
    let handle_top_y = shaft_bottom_y;
    let handle_len = domeRadius * 1.1;
    let handle_x = mouseX;
    line(handle_x, handle_top_y, handle_x, handle_top_y + handle_len);
    noFill();
    arc(
      handle_x + domeRadius * 0.15,
      handle_top_y + handle_len,
      domeRadius * 0.3,
      domeRadius * 0.3,
      0,
      PI,
    );
    strokeWeight(1);
  }
}

function mousePressed() {
  if (mouseButton === RIGHT) {
    let ts = Date.now();
  } else {
    let now = millis();
    if (now - lastTapTime <= tapThreshold) {
      umbrellaActive = !umbrellaActive;
      lastTapTime = 0;
      return;
    }
    lastTapTime = now;
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
  updateUmbrellaSize();
}
