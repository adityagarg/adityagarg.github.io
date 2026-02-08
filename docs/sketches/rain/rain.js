// Constants
let y;
let timeSpeed = 1;
let targetTimeSpeed = 1;
let lerpFactor = 0.1;
let baseSpeed = 0.002;
let baseSpeedMin = 0.0008;
let baseSpeedMax = 0.005;
let baseSpeedDragScale = 0.00001;

let accumulatedTime = 0;
let lastFrameTime = 0;
let domeRadius = 80;
let groundHeight = 50;
let umbrellaActive = false;
let lastTapTime = 0;
let tapThreshold = 300;
let wind_base = 0.8;
let windDragStartX = 0;
let windBaseOnPress = 0;
let windDragging = false;
let speedDragStartY = 0;
let baseSpeedOnPress = 0;
let bgColor = [15, 15, 15];
let rainColor = [255, 255, 255];

function updateUmbrellaSize() {
  domeRadius = min(width, height) * 0.08;
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  background(...bgColor);
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
  fill(...rainColor, opacity(opacity_val));
  noStroke();
  triangle(x, y, x - width, y + length, x + width, y + length);
}

function umbrella_surface_y(x, rx, ry, center_x) {
  let dx = x - center_x;
  if (abs(dx) > rx) {
    return null;
  }
  let nx = dx / rx;
  return mouseY - ry * sqrt(1 - nx * nx);
}

function umbrella_splash(x, y, strength) {
  noFill();
  opacity_val = map(strength, 0, 1, 0.3, 0.8);
  stroke(...rainColor, opacity(opacity_val));
  let splash_w = map(strength, 0, 1, 6, 15);
  let splash_h = map(strength, 0, 1, 2, 8);
  ellipse(x, y, splash_w, splash_h);
}

function draw() {
  background(...bgColor);

  // // lightning effect
  // if (random() < 0.005) {
  //   background(255);
  //   return;
  // }

  timeSpeed = lerp(timeSpeed, targetTimeSpeed, lerpFactor);

  let now = millis();
  let delta = (now - lastFrameTime) * baseSpeed; // base speed
  accumulatedTime += delta * timeSpeed;
  lastFrameTime = now;

  let t = accumulatedTime;

  for (let x = 0; x < width; x += 2) {
    let offset_noise = noise(x);
    let speed_noise = noise(x + 1000);
    let wind_jitter = map(offset_noise, 0, 1, -0.15, 0.15);
    let wind = wind_base + wind_jitter;
    let offset = offset_noise * 2 * height; // start delay
    let speedMultiplier = map(speed_noise, 0, 1, 80 * 2, 160 * 4); // speed range

    let y = (pow(t, 1) * speedMultiplier + offset) % height;
    let wind_offset = wind * y * 0.2;
    let drop_x = (x + wind_offset) % width;
    if (drop_x < 0) {
      drop_x += width;
    }
    opacity_val = map(offset_noise, 0, 1, 0.1, 0.7);
    raindrop_length = map(speed_noise, 0, 1, 8, 12);

    let w = map(speed_noise, 0, 1, 1.2, 1.5);

    randomFloor = map(noise(x), 0, 1, 0, groundHeight);

    let drop_tip_y = y + raindrop_length;
    let opacity_multiplier = 1;
    if (umbrellaActive) {
      let domeRX = domeRadius * 1.25;
      let domeRY = domeRadius * 0.85;
      let wind_shear_max = constrain(wind_base, -5, 5) * domeRadius * 0.8;
      let wind_shear = map(drop_tip_y, mouseY, height, 0, wind_shear_max);
      wind_shear = constrain(
        wind_shear,
        min(0, wind_shear_max),
        max(0, wind_shear_max),
      );
      let mask_x = drop_x - wind_shear;
      let surface_y = umbrella_surface_y(mask_x, domeRX, domeRY, mouseX);
      if (surface_y !== null && drop_tip_y >= surface_y) {
        if (drop_tip_y <= mouseY) {
          umbrella_splash(mask_x, surface_y, speed_noise);
        }
        let vertical_fade = constrain(
          map(drop_tip_y, surface_y, height, 0, 0.6),
          0,
          0.6,
        );
        let horizontal_fade = constrain(
          map(abs(mask_x - mouseX), 0, domeRX, 0.4, 1.2),
          0.4,
          1.2,
        );
        opacity_multiplier = vertical_fade * horizontal_fade;
      }
    }

    if (drop_tip_y >= height - (groundHeight - randomFloor)) {
      noFill();
      stroke(...rainColor, opacity(0.2 * opacity_multiplier));
      drop_radius = map(speed_noise, 0, 1, 5, 15);
      drop_height = map(speed_noise, 0, 1, 1, 3);
      ellipse(
        drop_x,
        height - (groundHeight - randomFloor),
        drop_radius,
        drop_height,
      );
      continue;
    }
    rain_drop(drop_x, y, raindrop_length, w, opacity_val * opacity_multiplier);
  }

  if (umbrellaActive) {
    // Umbrella outline
    noFill();
    stroke(...rainColor, opacity(0.9));
    strokeWeight(0.7);

    let domeRX = domeRadius * 1.25;
    let domeRY = domeRadius * 0.85;
    arc(mouseX, mouseY, domeRX * 2, domeRY * 2, PI, PI * 2);

    // Umbrella cap
    stroke(...rainColor, 200);
    strokeWeight(2);
    let shaft_bottom_y = mouseY + domeRY * 0.15;
    line(mouseX, mouseY, mouseX, shaft_bottom_y);

    // Umbrella handle
    stroke(...rainColor, 200);
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
    windDragging = true;
    windDragStartX = mouseX;
    windBaseOnPress = wind_base;
    speedDragStartY = mouseY;
    baseSpeedOnPress = baseSpeed;
    lerpFactor = 0.1;
    targetTimeSpeed = 0.1;
  }
}

function mouseDragged() {
  if (!windDragging || mouseButton === RIGHT) {
    return;
  }
  let dragDelta = mouseX - windDragStartX;
  let dragDeltaY = mouseY - speedDragStartY;
  wind_base = constrain(windBaseOnPress + dragDelta * 0.01, -5, 5);
  baseSpeed = constrain(
    baseSpeedOnPress + dragDeltaY * baseSpeedDragScale,
    baseSpeedMin,
    baseSpeedMax,
  );
}

function mouseReleased() {
  if (mouseButton === RIGHT) {
  } else {
    windDragging = false;
    lerpFactor = 0.2;
    targetTimeSpeed = 1;
  }
}

function touchStarted() {
  mousePressed();
  return false; // Prevents default behavior
}

function touchMoved() {
  mouseDragged();
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
