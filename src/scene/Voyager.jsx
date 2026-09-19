import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export default function Voyager({ mission, active = false, progress = 0, position = [0, 0, 0], visible = true, selected = false, scale = 1, onClick }) {
  const waypointIndex = mission?.waypoints?.length
    ? Math.min(mission.waypoints.length - 1, Math.floor(progress * mission.waypoints.length))
    : 0;
  const waypoint = mission?.waypoints?.[waypointIndex];
  const distanceAU = (mission?.display?.presentDistanceAU || 165) * progress;
  const velocityKms = active ? (mission?.display?.presentVelocityKMS || 17) : 0;

  const group = useRef();
  const antenna = useMemo(() => new THREE.Vector3(0, 0, 1), []);

  useFrame((_, dt) => {
    if (!group.current) return;
    group.current.rotation.y += dt * 0.18;
    group.current.rotation.x += dt * 0.035;
  });

  if (!visible) return null;

  return (

    <group ref={group} position={position} scale={scale} onClick={onClick}>
      <mesh castShadow>
        <cylinderGeometry args={[0.18, 0.18, 0.035, 16]} />
        <meshStandardMaterial color="#c7ccd2" metalness={0.75} roughness={0.32} />
      </mesh>
      <mesh position={[0, 0.02, 0.11]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.34, 24]} />
        <meshStandardMaterial color="#dfe5e8" metalness={0.55} roughness={0.28} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0.36, 0, 0]}>
        <boxGeometry args={[0.72, 0.055, 0.34]} />
        <meshStandardMaterial color="#6e7881" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]} position={[-0.36, 0, 0]}>
        <boxGeometry args={[0.72, 0.055, 0.34]} />
        <meshStandardMaterial color="#6e7881" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.02, -0.27]}>
        <cylinderGeometry args={[0.045, 0.045, 0.48, 12]} />
        <meshStandardMaterial color="#9ba4aa" metalness={0.65} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.02, -0.53]}>
        <sphereGeometry args={[0.065, 12, 8]} />
        <meshStandardMaterial color="#bfc5c9" metalness={0.4} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.03, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.29, 0.34, 24]} />
        <meshBasicMaterial
          color={selected ? "#b9f5ed" : "#86bfc0"}
          transparent
          opacity={selected ? 0.9 : 0.52}
        />
      </mesh>
      {active && (
        <sprite position={[0, 0.7, 0]}>
          <spriteMaterial color="#9fe7df" transparent opacity={0.08} />
        </sprite>
      )}
      <lineSegments position={[0, 0.02, 0.18]}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([0, 0, 0, antenna.x * 0.42, antenna.y * 0.42, antenna.z * 0.42])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#d9e2e4" />
      </lineSegments>
      {active && waypoint && (
        <group position={[0, 0.62, 0]}>
          <sprite scale={[0.001, 0.001, 0.001]} />
        </group>
      )}
    </group>
  );
}
