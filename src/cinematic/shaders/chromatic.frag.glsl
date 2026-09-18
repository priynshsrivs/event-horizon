uniform sampler2D tDiffuse;
uniform float uStrength;
uniform vec2 uDirection;
varying vec2 vUv;
void main() {
  vec2 offset = uDirection * uStrength;
  float r = texture2D(tDiffuse, vUv + offset).r;
  float g = texture2D(tDiffuse, vUv).g;
  float b = texture2D(tDiffuse, vUv - offset).b;
  gl_FragColor = vec4(r,g,b,1.0);
}
