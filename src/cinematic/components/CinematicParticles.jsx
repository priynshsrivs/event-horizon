import React, { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import starVert from "../shaders/starfield.vert.glsl?raw";
import starFrag from "../shaders/starfield.frag.glsl?raw";

/**
 * GPU-friendly ambient particle field.
 * Mount inside the existing R3F Canvas.
 */
export default function CinematicParticles({
  quality = "medium",
  radius = 90,
  reducedMotion = false,
}) {
  const points = useRef();
  const material = useRef();
  const cinematic = useRef({ type: null, strength: 0, phase: "idle", nonce: 0 });

  const count =
    quality === "low" ? 900 : quality === "high" ? 4200 : 2200;

  const data = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);

    let seed = 71237;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    for (let i = 0; i < count; i++) {
      const z = rand() * 2 - 1;
      const angle = rand() * Math.PI * 2;
      const r = radius * (0.35 + rand() * 0.65);
      const y = (rand() - 0.5) * radius * 0.65;
      positions[i * 3] = r * Math.sqrt(1 - z * z) * Math.cos(angle);
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = r * Math.sqrt(1 - z * z) * Math.sin(angle);
      sizes[i] = 0.45 + rand() * 1.8;
      phases[i] = rand() * Math.PI * 2;
    }

    return { positions, sizes, phases };
  }, [count, radius]);

  useEffect(() => {
    const onTransition = (event) => {
      const detail = event.detail || {};
      if (!detail.type) return;
      cinematic.current = {
        type: detail.type,
        strength: detail.phase === "idle" ? 0 : 1,
        phase: detail.phase,
        nonce: detail.nonce ?? 0,
      };
    };
    window.addEventListener("event-horizon:transition", onTransition);
    return () => window.removeEventListener("event-horizon:transition", onTransition);
  }, []);

  useFrame(({ clock, gl }, dt) => {
    if (!points.current || !material.current) return;

    if (!reducedMotion) {
      points.current.rotation.y += dt * 0.0025;
      points.current.rotation.x += dt * 0.00055;
    }

    const fx = cinematic.current;
    const activeType = fx.type;
    const wave = !reducedMotion && fx.strength > 0
      ? Math.sin(clock.elapsedTime * 8.5) * 0.5 + 0.5
      : 0;

    const warp =
      activeType === "warp" || activeType === "camera-dive" || activeType === "starfield"
        ? fx.strength * (0.72 + wave * 0.28)
        : 0;

    material.current.uniforms.uTime.value = clock.elapsedTime;
    material.current.uniforms.uWarp.value = warp;
    material.current.uniforms.uPulse.value =
      activeType === "black-hole" ? fx.strength : 0;
    material.current.uniforms.uPixelRatio.value =
      Math.min(1.5, gl.getPixelRatio());
  });

  return (
    <points ref={points} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[data.positions, 3]}
        />
        <bufferAttribute
          attach="attributes-aSize"
          args={[data.sizes, 1]}
        />
        <bufferAttribute
          attach="attributes-aPhase"
          args={[data.phases, 1]}
        />
      </bufferGeometry>

      <shaderMaterial
        ref={material}
        vertexShader={starVert}
        fragmentShader={starFrag}
        uniforms={{
          uTime: { value: 0 },
          uPixelRatio: { value: 1 },
          uWarp: { value: 0 },
          uPulse: { value: 0 },
        }}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
