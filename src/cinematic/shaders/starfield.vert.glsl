attribute float aSize;
attribute float aPhase;

varying float vAlpha;

uniform float uTime;
uniform float uPixelRatio;
uniform float uWarp;
uniform float uPulse;

void main() {
  vec3 p = position;
  float radial = length(p);
  vec3 dir = radial > 0.0001 ? normalize(p) : vec3(0.0, 0.0, 1.0);

  // During a cinematic warp the stars temporarily bloom outward from the
  // viewer. The displacement stays bounded so the normal simulation remains
  // stable and the effect is purely visual.
  p += dir * (uWarp * 9.0 + uPulse * 2.2);

  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  float depth = max(0.75, -mvPosition.z);

  gl_PointSize =
    aSize *
    uPixelRatio *
    (24.0 / depth) *
    (1.0 + uWarp * 2.7 + uPulse * 1.4);

  gl_Position = projectionMatrix * mvPosition;
  vAlpha = 0.64 + uWarp * 0.28 + uPulse * 0.12;
}
