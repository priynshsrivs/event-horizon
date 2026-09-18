varying vec3 vNormal;
varying vec3 vWorldPosition;
uniform vec3 uCameraPosition;
uniform vec3 uColor;
uniform float uIntensity;
void main() {
  vec3 viewDir = normalize(uCameraPosition - vWorldPosition);
  float rim = pow(1.0 - max(0.0, dot(vNormal, viewDir)), 3.2);
  float alpha = rim * uIntensity;
  if (alpha < 0.005) discard;
  gl_FragColor = vec4(uColor, alpha);
}
