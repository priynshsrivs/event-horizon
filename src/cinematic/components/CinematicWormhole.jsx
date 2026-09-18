import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import vert from "../shaders/wormhole.vert.glsl?raw";
import frag from "../shaders/wormhole.frag.glsl?raw";

export default function CinematicWormhole({
  radius = 2,
  color = "#9c7cff",
  intensity = 1,
  speed = 1,
}) {
  const material = useRef();

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: intensity },
    }),
    [color, intensity],
  );

  useFrame(({ clock }) => {
    if (material.current) {
      material.current.uniforms.uTime.value =
        clock.elapsedTime * speed;
    }
  });

  return (
    <mesh scale={radius}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={material}
        vertexShader={vert}
        fragmentShader={frag}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}
