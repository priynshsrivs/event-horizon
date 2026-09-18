import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import CinematicParticles from "./CinematicParticles.jsx";

/**
 * Drop inside the existing Canvas for the opening 3D sequence.
 * It is deliberately scene-only: the React/CSS title can remain outside.
 */
export default function CinematicIntro3D({
  quality = "medium",
  reducedMotion = false,
  active = true,
}) {
  const rig = useRef();
  const core = useRef();
  const ringA = useRef();
  const ringB = useRef();

  const stars = useMemo(() => {
    const result = [];
    let seed = 88991;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    const count = quality === "low" ? 12 : quality === "high" ? 30 : 20;

    for (let i = 0; i < count; i++) {
      const radius = 7 + rand() * 18;
      const angle = rand() * Math.PI * 2;
      result.push({
        position: [
          Math.cos(angle) * radius,
          (rand() - 0.5) * 10,
          Math.sin(angle) * radius,
        ],
        scale: 0.08 + rand() * 0.22,
      });
    }
    return result;
  }, [quality]);

  useFrame(({ clock }, dt) => {
    if (!active) return;

    const t = clock.elapsedTime;

    if (rig.current && !reducedMotion) {
      rig.current.position.z = Math.sin(t * 0.12) * 0.6;
      rig.current.rotation.y += dt * 0.025;
    }

    if (core.current) {
      const pulse = 1 + Math.sin(t * 1.3) * 0.045;
      core.current.scale.setScalar(pulse);
    }

    if (ringA.current && !reducedMotion) {
      ringA.current.rotation.x += dt * 0.22;
      ringA.current.rotation.z += dt * 0.12;
    }

    if (ringB.current && !reducedMotion) {
      ringB.current.rotation.x -= dt * 0.13;
      ringB.current.rotation.y += dt * 0.17;
    }
  });

  return (
    <group ref={rig} position={[0, 0, -7]}>
      <CinematicParticles
        quality={quality}
        radius={70}
        reducedMotion={reducedMotion}
      />

      <mesh ref={core}>
        <sphereGeometry args={[1.35, 48, 32]} />
        <meshBasicMaterial
          color="#bcecff"
          toneMapped={false}
        />
      </mesh>

      <mesh scale={1.65}>
        <sphereGeometry args={[1, 48, 32]} />
        <meshBasicMaterial
          color="#6cd8ef"
          transparent
          opacity={0.12}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={ringA} rotation={[0.7, 0.2, 0.2]}>
        <torusGeometry args={[2.1, 0.025, 12, 160]} />
        <meshBasicMaterial
          color="#9fe8f1"
          transparent
          opacity={0.62}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <mesh ref={ringB} rotation={[-0.8, 0.4, -0.2]}>
        <torusGeometry args={[3.1, 0.012, 10, 180]} />
        <meshBasicMaterial
          color="#8c7be8"
          transparent
          opacity={0.28}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {stars.map((star, index) => (
        <mesh
          key={index}
          position={star.position}
          scale={star.scale}
        >
          <sphereGeometry args={[1, 8, 8]} />
          <meshBasicMaterial
            color="#d7f5ff"
            transparent
            opacity={0.42}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}
