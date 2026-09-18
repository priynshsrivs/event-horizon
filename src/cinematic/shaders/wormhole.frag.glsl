varying vec2 vUv;
uniform float uTime;
uniform vec3 uColor;
uniform float uIntensity;
void main() {
  vec2 p = vUv - 0.5;
  float r = length(p) * 2.0;
  float ring = smoothstep(1.0, 0.18, r) * smoothstep(0.08, 0.32, abs(r - 0.62));
  float spiral = 0.5 + 0.5 * sin(atan(p.y,p.x) * 8.0 - r * 14.0 - uTime * 2.5);
  float glow = pow(max(0.0, 1.0-r), 2.5);
  float a = (ring * (0.45 + 0.55*spiral) + glow*0.35) * uIntensity;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor, a);
}
