import React, { useMemo, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Effect, EffectAttribute } from 'postprocessing';
import * as THREE from 'three';
import { Uniform, Vector2, Vector3 } from 'three';
import { bodyPosition } from './coordinates.js';
import { visualEinsteinRadius } from '../physics/lensing.js';

const shader = `
uniform vec2 lensCenter;
uniform float lensRadius;
uniform float lensDepth;
uniform float aspect;
uniform float detail;
uniform float cinematicBoost;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  outputColor = inputColor;
  if (lensRadius <= 0.0) return;
  float boost = 1.0 + cinematicBoost * 1.65;
  vec2 delta = (uv - lensCenter) * vec2(aspect, 1.0);
  float r = length(delta);
  float depth = readDepth(uv);
  // Geometry in front of the lens and its opaque horizon stay sharp.
  if (depth < lensDepth - 0.00001 || r < lensRadius * 0.23 || r > lensRadius * 5.0) return;
  float taper = 1.0 - smoothstep(lensRadius * 3.0, lensRadius * 5.0, r);
  // Thin-lens equation beta = theta - theta_E^2 / theta (alpha ~ 1/b).
  vec2 source = uv - delta / vec2(aspect,1.0) *
    (lensRadius*lensRadius*boost) / max(r*r, 0.000001) * taper;
  vec4 bent = texture2D(inputBuffer, clamp(source, vec2(0.001), vec2(0.999)));
  if (detail > 0.5) {
    vec2 tangent = vec2(-delta.y,delta.x) / max(r,0.00001) / vec2(aspect,1.0) * 0.0007;
    bent = (bent * 2.0 + texture2D(inputBuffer, clamp(source+tangent,vec2(0.001),vec2(0.999))) + texture2D(inputBuffer, clamp(source-tangent,vec2(0.001),vec2(0.999)))) * 0.25;
  }
  // Ring structure comes from remapped background light, not a painted halo.
  outputColor = mix(inputColor, bent, smoothstep(lensRadius*0.23,lensRadius*0.32,r));
}
`;

export default function GravitationalLensing({ engine, settings }) {
  const effect = useMemo(() => new Effect('GravitationalLensing', shader, {
    attributes: EffectAttribute.DEPTH,
    uniforms: new Map([
      ['lensCenter', new Uniform(new Vector2())], ['lensRadius', new Uniform(0)],
      ['lensDepth', new Uniform(1)], ['aspect', new Uniform(1)], ['detail', new Uniform(0)],
      ['cinematicBoost', new Uniform(0)],
    ]),
  }), []);
  const point = useMemo(() => new Vector3(), []);
  const cinematicBoost = useRef(0);
  const cinematicTarget = useRef(0);

  useEffect(() => {
    const onTransition = (event) => {
      const detail = event.detail || {};
      if (detail.type !== "black-hole") {
        cinematicBoost.current = 0;
        return;
      }
      cinematicTarget.current = detail.phase === "idle" ? 0 : 1;
    };
    window.addEventListener("event-horizon:transition", onTransition);
    return () => window.removeEventListener("event-horizon:transition", onTransition);
  }, []);

  useEffect(() => () => effect.dispose(), [effect]);
  useFrame(({ camera, size }) => {
    const u = effect.uniforms;
    u.get('lensRadius').value = 0;
    cinematicBoost.current = THREE.MathUtils.lerp(cinematicBoost.current, cinematicTarget.current, 0.08);
    if (!settings.lensing || settings.quality === 'low') return;
    let best = null, nearest = Infinity;
    for (const body of engine.bodies) {
      if (body.type !== 'black hole' || !body.active || !body.enabled) continue;
      point.set(...bodyPosition(body, engine, settings.compressed));
      const distance = point.distanceTo(camera.position);
      point.project(camera);
      if (point.z < -1 || point.z > 1 || Math.abs(point.x) > 1.3 || Math.abs(point.y) > 1.3 || distance >= nearest) continue;
      nearest = distance; best = body;
      u.get('lensCenter').value.set(point.x*0.5+0.5, point.y*0.5+0.5);
      u.get('lensDepth').value = point.z*0.5+0.5;
    }
    if (best) u.get('lensRadius').value = visualEinsteinRadius(best.mass, nearest);
    const proximity = window.__EVENT_HORIZON_BLACK_HOLE_CINEMATIC__?.lensing || 0;
    u.get('cinematicBoost').value = THREE.MathUtils.clamp(Math.max(cinematicBoost.current, proximity), 0, 1);
    u.get('aspect').value = size.width / size.height;
    u.get('detail').value = settings.quality === 'high' ? 1 : 0;
  });
  return <primitive object={effect} dispose={null} />;
}
