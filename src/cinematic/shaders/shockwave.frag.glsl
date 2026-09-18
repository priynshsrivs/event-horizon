varying vec2 vUv;
uniform float uProgress;
uniform vec3 uColor;
uniform float uIntensity;
void main() {
  vec2 p = vUv - 0.5;
  float r = length(p) * 2.0;
  float ring = 1.0 - smoothstep(0.0, 0.16, abs(r - uProgress));
  float fade = 1.0 - smoothstep(0.72, 1.05, uProgress);
  float a = ring * fade * uIntensity;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor, a);
}
