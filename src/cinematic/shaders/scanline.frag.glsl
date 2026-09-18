uniform sampler2D tDiffuse;
uniform float uTime;
uniform float uStrength;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  float line = sin((vUv.y + uTime * 0.015) * 900.0) * 0.5 + 0.5;
  float vignette = smoothstep(1.2, 0.25, length(vUv - 0.5));
  c.rgb *= 1.0 - line * uStrength * 0.055;
  c.rgb *= 0.94 + vignette * 0.06;
  gl_FragColor = c;
}
