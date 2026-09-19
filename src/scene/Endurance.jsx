import React, { useRef } from "react";
import { Html, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";

function TarsPreview() {
  const ref = useRef();
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.7) * 0.25;
    ref.current.position.y = Math.sin(state.clock.elapsedTime * 1.4) * 0.025;
  });
  return (
    <group ref={ref}>
      <mesh>
        <boxGeometry args={[0.18, 0.48, 0.1]} />
        <meshStandardMaterial color="#9da5aa" metalness={0.7} roughness={0.34} />
      </mesh>
      <mesh position={[0, 0.16, 0.06]}>
        <boxGeometry args={[0.16, 0.08, 0.03]} />
        <meshStandardMaterial color="#515961" metalness={0.45} roughness={0.4} />
      </mesh>
      <mesh position={[0, -0.22, 0]}>
        <boxGeometry args={[0.22, 0.08, 0.13]} />
        <meshStandardMaterial color="#737c83" metalness={0.65} roughness={0.42} />
      </mesh>
    </group>
  );
}

export default function Endurance({
  position = [150, 20, -100],
  visible = true,
  onFocus,
}) {
  const root = useRef();
  useFrame((_, dt) => {
    if (!root.current) return;
    root.current.rotation.z += dt * 0.055;
    root.current.rotation.y += dt * 0.018;
  });
  if (!visible) return null;

  return (
    <group ref={root} position={position}>
      <mesh onClick={(e) => { e.stopPropagation(); onFocus?.(); }}>
        <torusGeometry args={[3.1, 0.18, 10, 48]} />
        <meshStandardMaterial color="#a9b1b5" metalness={0.82} roughness={0.35} />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]} onClick={(e) => { e.stopPropagation(); onFocus?.(); }}>
        <torusGeometry args={[2.2, 0.07, 8, 36]} />
        <meshStandardMaterial color="#58636a" metalness={0.72} roughness={0.42} />
      </mesh>
      {[-2.3, -0.8, 0.8, 2.3].map((x) => (
        <mesh key={x} position={[x, 0, 0]} onClick={(e) => { e.stopPropagation(); onFocus?.(); }}>
          <boxGeometry args={[0.34, 0.65, 0.42]} />
          <meshStandardMaterial color="#69757a" metalness={0.68} roughness={0.4} />
        </mesh>
      ))}
      <Line
        points={[[0, 0, 0], [0, 0, 5.2]]}
        color="#7ba5a5"
        transparent
        opacity={0.35}
      />
      <Html distanceFactor={12} position={[0, 3.8, 0]} style={{ pointerEvents: "none" }}>
        <div className="endurance-label">ENDURANCE · INTERSTELLAR EASTER EGG</div>
      </Html>
    </group>
  );
}

export { TarsPreview };
