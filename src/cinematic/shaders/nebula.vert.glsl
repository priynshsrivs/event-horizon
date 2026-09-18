varying vec2 vUv;
uniform float uTime;
void main() {
  vUv = uv;
  vec3 p = position;
  p.z += sin(p.x * 1.8 + uTime * 0.12) * 0.12;
  p.x += cos(p.y * 1.2 + uTime * 0.08) * 0.08;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
