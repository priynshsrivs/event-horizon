import React, { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import vert from "../shaders/shockwave.vert.glsl?raw";
import frag from "../shaders/shockwave.frag.glsl?raw";

/**
 * Screen-facing world-space shockwave.
 * Mount at the event position and remove it after durationMs.
 */
export default function CinematicShockwave({
  position = [0, 0, 0],
  color = "#a9e7ef",
  durationMs = 900,
  intensity = 1,
  onComplete,
}) {
  const material = useRef();
  const started = useRef(performance.now());

  const uniforms = useMemo(
    () => ({
      uProgress: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: intensity },
    }),
    [color, intensity],
  );

  useEffect(() => {
    started.current = performance.now();
  }, []);

  useFrame(() => {
    if (!material.current) return;
    const elapsed = performance.now() - started.current;
    const p = Math.min(1, elapsed / durationMs);
    const eased = 1 - Math.pow(1 - p, 3);
    material.current.uniforms.uProgress.value = eased;

    if (p >= 1) onComplete?.();
  });

  return (
    <mesh position={position}>
      <planeGeometry args={[8, 8]} />
      <shaderMaterial
        ref={material}
        vertexShader={vert}
        fragmentShader={frag}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
