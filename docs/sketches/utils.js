// Helper function to convert a fractional opacity to a 0–255 value.
function opacity(val) {
  return val * 255;
}

// A simple textured background function that draws random points.
function textured_background() {
  let density = 5000;
  stroke(2, opacity(0.3));
  strokeWeight(1.5);
  for (let i = 0; i < density; i++) {
    point(random(width), random(height));
  }
}
