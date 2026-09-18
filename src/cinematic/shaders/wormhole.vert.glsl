varying vec2 vUv;
uniform float uTime;
void main() {
  vUv = uv;
  vec3 p = position;
  float r = length(p.xy);
  float twist = uTime * 0.45 + r * 3.0;
  float c = cos(twist), s = sin(twist);
  p.xy = mat2(c,-s,s,c) * p.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);
}
