attribute float aSize;
attribute float aPhase;

varying float vAlpha;

uniform float uTime;
uniform float uPixelRatio;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

  float depth = max(0.75, -mvPosition.z);

  gl_PointSize =
    aSize *
    uPixelRatio *
    (24.0 / depth);

  gl_Position = projectionMatrix * mvPosition;

  vAlpha = 0.64;
}
