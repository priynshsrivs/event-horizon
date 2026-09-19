import React, { useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import vert from "../shaders/atmosphere.vert.glsl?raw";
import frag from "../shaders/atmosphere.frag.glsl?raw";

export default function CinematicAtmosphere({
  radius = 1,
  color = "#8ddff2",
  intensity = 0.8,
  quality = "medium",
  _reducedMotion = false,
}) {
  const { camera } = useThree();

  const segments =
    quality === "high" ? 64 :
    quality === "medium" ? 40 :
    24;

  const rings =
    quality === "high" ? 48 :
    quality === "medium" ? 28 :
    18;

  const uniforms = useMemo(
    () => ({
      uCameraPosition: { value: new THREE.Vector3() },
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: intensity },
    }),
    [color, intensity],
  );

  useFrame(() => {
    // The atmosphere is view-dependent, so the camera position still needs
    // updating even when motion reduction is enabled. There is no animated
    // time-based component here, so reducedMotion intentionally remains
    // visually identical and only documents the accessibility contract.
    uniforms.uCameraPosition.value.copy(camera.position);
  });

  return (
    <mesh
      scale={radius * 1.035}
      raycast={() => null}
    >
      <sphereGeometry args={[1, segments, rings]} />
      <shaderMaterial
        vertexShader={vert}
        fragmentShader={frag}
        uniforms={uniforms}
        transparent
        side={THREE.BackSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}
