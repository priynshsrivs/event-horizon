varying float vAlpha;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float d = length(p);
  float core = smoothstep(0.22, 0.0, d);
  float halo = smoothstep(0.5, 0.05, d) * 0.28;
  float alpha = (core + halo) * vAlpha;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(0.72, 0.9, 1.0, alpha);
}
