varying float vAlpha;
uniform float uWarp;
uniform float uPulse;

void main() {
  vec2 p = gl_PointCoord - 0.5;
  float d = length(p);
  float core = smoothstep(0.22, 0.0, d);
  float halo = smoothstep(0.5, 0.05, d) * (0.28 + uWarp * 0.22);

  // Slight vertical elongation sells acceleration without adding thousands
  // of mesh instances.
  float streak = smoothstep(0.5, 0.0, abs(p.x)) *
    smoothstep(0.5, 0.02, abs(p.y) * (1.0 - uWarp * 0.52));
  float shape = mix(core + halo, streak, min(1.0, uWarp * 0.85));

  float alpha = shape * vAlpha;
  if (alpha < 0.01) discard;

  vec3 color = mix(
    vec3(0.72, 0.90, 1.0),
    vec3(0.88, 0.96, 1.0),
    uPulse
  );
  gl_FragColor = vec4(color, alpha);
}
