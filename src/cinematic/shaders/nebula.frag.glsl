varying vec2 vUv;
uniform float uTime;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uIntensity;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0,0.0)), f.x),
    mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), f.x),
    f.y
  );
}
void main() {
  vec2 p = vUv - 0.5;
  float r = length(p);
  float n = noise(vUv * 7.0 + uTime * 0.035);
  float cloud = smoothstep(0.65, 0.05, r) * smoothstep(0.15, 0.85, n);
  vec3 color = mix(uColorA, uColorB, n);
  gl_FragColor = vec4(color, cloud * uIntensity);
}
