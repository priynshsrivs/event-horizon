import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, Line } from "@react-three/drei";
import * as THREE from "three";

/**
 * Authentic 3D Voyager 1 Spacecraft Model
 *
 * Accurate reconstruction featuring:
 *  1. 3.7-meter High-Gain Antenna (HGA) parabolic dish with feed horn tripod.
 *  2. 10-sided Decagonal Bus wrapped in gold-foil thermal insulation blankets.
 *  3. The Golden Record mounted on the equipment bay.
 *  4. RTG (Radioisotope Thermoelectric Generator) power boom with 3 canisters.
 *  5. Science Instrument Scan Platform with cameras and spectrometers.
 *  6. Magnetometer lattice boom with sensor canisters.
 *  7. Plasma wave / PRA whip antennas.
 *  8. Attitude thruster clusters and Canopus star tracker.
 */
function VoyagerModel({ selected = false, active = false }) {
  const modelRef = useRef();

  useFrame((_, dt) => {
    if (!modelRef.current) return;
    // Gentle attitude stabilization drift
    modelRef.current.rotation.y += dt * 0.015;
    modelRef.current.rotation.z = Math.sin(performance.now() * 0.0003) * 0.04;
  });

  // Materials
  const dishMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#f4f5f7",
        roughness: 0.32,
        metalness: 0.12,
        side: THREE.DoubleSide,
      }),
    [],
  );

  const busGoldMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#d49a37",
        roughness: 0.28,
        metalness: 0.88,
      }),
    [],
  );

  const goldRecordMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#ffdf00",
        roughness: 0.14,
        metalness: 0.96,
      }),
    [],
  );

  const trussMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#333940",
        roughness: 0.45,
        metalness: 0.72,
      }),
    [],
  );

  const rtgMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#181c20",
        roughness: 0.52,
        metalness: 0.82,
      }),
    [],
  );

  const opticsMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#0a121d",
        roughness: 0.1,
        metalness: 0.9,
      }),
    [],
  );

  const beaconMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: selected ? "#72f0dd" : "#45d0ba",
      }),
    [selected],
  );

  return (
    <group ref={modelRef}>
      {/* ============================================================ */}
      {/* 1. HIGH-GAIN DISH ANTENNA (HGA)                              */}
      {/* ============================================================ */}
      <group position={[0, 0, 0.48]} rotation={[Math.PI / 2, 0, 0]}>
        {/* Parabolic reflector dish */}
        <mesh material={dishMaterial}>
          <cylinderGeometry args={[1.22, 0.18, 0.32, 48, 1, true]} />
        </mesh>
        {/* Dish inner hub cap */}
        <mesh position={[0, -0.12, 0]} material={trussMaterial}>
          <cylinderGeometry args={[0.22, 0.22, 0.08, 24]} />
        </mesh>
        {/* Dish rim reinforcement */}
        <mesh position={[0, 0.16, 0]} material={trussMaterial}>
          <torusGeometry args={[1.22, 0.018, 12, 48]} />
        </mesh>

        {/* Sub-reflector Feed Horn & 3-Strut Tripod */}
        <mesh position={[0, 0.62, 0]} material={trussMaterial}>
          <cylinderGeometry args={[0.075, 0.11, 0.14, 16]} />
        </mesh>
        <mesh position={[0, 0.71, 0]} material={beaconMaterial}>
          <sphereGeometry args={[0.025, 12, 12]} />
        </mesh>
        {[0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((angle, i) => (
          <mesh
            key={i}
            position={[
              Math.cos(angle) * 0.52,
              0.25,
              Math.sin(angle) * 0.52,
            ]}
            rotation={[
              Math.sin(angle) * 0.45,
              -angle,
              Math.cos(angle) * 0.45,
            ]}
            material={trussMaterial}
          >
            <cylinderGeometry args={[0.012, 0.012, 0.82, 8]} />
          </mesh>
        ))}
      </group>

      {/* ============================================================ */}
      {/* 2. CENTRAL 10-SIDED BUS (EQUIPMENT MODULE)                   */}
      {/* ============================================================ */}
      <group position={[0, 0, 0.18]} rotation={[Math.PI / 2, 0, 0]}>
        {/* Main decagon equipment bay with gold thermal blanketing */}
        <mesh material={busGoldMaterial}>
          <cylinderGeometry args={[0.48, 0.52, 0.36, 10]} />
        </mesh>
        {/* Top/bottom titanium structural rings */}
        <mesh position={[0, 0.18, 0]} material={trussMaterial}>
          <cylinderGeometry args={[0.49, 0.49, 0.03, 10]} />
        </mesh>
        <mesh position={[0, -0.18, 0]} material={trussMaterial}>
          <cylinderGeometry args={[0.53, 0.53, 0.03, 10]} />
        </mesh>
        {/* Propulsion module sphere (hydrazine fuel tank) inside */}
        <mesh position={[0, 0, 0]} material={trussMaterial}>
          <sphereGeometry args={[0.26, 16, 16]} />
        </mesh>
      </group>

      {/* ============================================================ */}
      {/* 3. THE GOLDEN RECORD ("Sounds of Earth")                      */}
      {/* ============================================================ */}
      <group position={[0.46, 0.02, 0.18]} rotation={[0, Math.PI / 2, 0]}>
        {/* Gold phonograph record disc */}
        <mesh material={goldRecordMaterial}>
          <cylinderGeometry args={[0.24, 0.24, 0.016, 36]} />
        </mesh>
        {/* Center record spindle / protective jacket cover plate */}
        <mesh position={[0, 0.01, 0]} material={goldRecordMaterial}>
          <cylinderGeometry args={[0.045, 0.045, 0.02, 16]} />
        </mesh>
        {/* Outer protective rim clamp */}
        <mesh material={trussMaterial}>
          <torusGeometry args={[0.24, 0.01, 8, 36]} />
        </mesh>
        {/* Phonograph sound grooves micro-groove ring */}
        <mesh position={[0, 0.009, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.08, 0.21, 32]} />
          <meshStandardMaterial
            color="#ffe84a"
            metalness={0.92}
            roughness={0.22}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* ============================================================ */}
      {/* 4. RTG POWER BOOM (Radioisotope Thermoelectric Generators)    */}
      {/* ============================================================ */}
      <group position={[-0.45, -0.22, 0.16]} rotation={[0.22, 0.15, 0.65]}>
        {/* Deployable truss boom structure */}
        <mesh position={[-0.72, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={trussMaterial}>
          <cylinderGeometry args={[0.032, 0.032, 1.45, 6]} />
        </mesh>
        {/* 3 RTG power units mounted in series with heat radiator fins */}
        {[-0.65, -1.02, -1.38].map((xOffset, i) => (
          <group key={i} position={[xOffset, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <mesh material={rtgMaterial}>
              <cylinderGeometry args={[0.11, 0.11, 0.32, 16]} />
            </mesh>
            {/* Cooling fins */}
            <mesh material={trussMaterial}>
              <cylinderGeometry args={[0.135, 0.135, 0.28, 8]} />
            </mesh>
            <mesh position={[0, 0.17, 0]} material={trussMaterial}>
              <sphereGeometry args={[0.065, 8, 8]} />
            </mesh>
          </group>
        ))}
      </group>

      {/* ============================================================ */}
      {/* 5. SCIENCE INSTRUMENT SCAN PLATFORM BOOM                     */}
      {/* ============================================================ */}
      <group position={[0.42, 0.28, 0.16]} rotation={[-0.2, -0.15, -0.6]}>
        {/* Science truss boom */}
        <mesh position={[0.68, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={trussMaterial}>
          <cylinderGeometry args={[0.03, 0.03, 1.36, 6]} />
        </mesh>
        {/* Steerable scan platform box */}
        <mesh position={[1.36, 0.06, 0]} material={trussMaterial}>
          <boxGeometry args={[0.28, 0.34, 0.32]} />
        </mesh>
        {/* Narrow-angle camera telescope barrel */}
        <mesh position={[1.42, 0.22, 0.1]} rotation={[Math.PI / 2, 0, 0]} material={opticsMaterial}>
          <cylinderGeometry args={[0.075, 0.09, 0.34, 16]} />
        </mesh>
        {/* Wide-angle camera lens */}
        <mesh position={[1.42, 0.18, -0.1]} rotation={[Math.PI / 2, 0, 0]} material={opticsMaterial}>
          <cylinderGeometry args={[0.05, 0.065, 0.22, 16]} />
        </mesh>
        {/* Spectrometer and detector canisters */}
        <mesh position={[1.48, -0.06, 0.08]} material={busGoldMaterial}>
          <cylinderGeometry args={[0.055, 0.055, 0.24, 12]} />
        </mesh>
        <mesh position={[1.48, -0.06, -0.08]} material={trussMaterial}>
          <boxGeometry args={[0.14, 0.18, 0.12]} />
        </mesh>
      </group>

      {/* ============================================================ */}
      {/* 6. MAGNETOMETER BOOM                                         */}
      {/* ============================================================ */}
      <group position={[0, -0.38, -0.1]} rotation={[-0.35, 0.2, 2.6]}>
        {/* Deployable 13m triangular lattice mast */}
        <mesh position={[0, 1.45, 0]} material={trussMaterial}>
          <cylinderGeometry args={[0.016, 0.016, 2.9, 4]} />
        </mesh>
        {/* Low-field magnetometer canister */}
        <mesh position={[0, 1.6, 0]} material={busGoldMaterial}>
          <cylinderGeometry args={[0.06, 0.06, 0.15, 12]} />
        </mesh>
        {/* High-field magnetometer canister at boom tip */}
        <mesh position={[0, 2.88, 0]} material={busGoldMaterial}>
          <cylinderGeometry args={[0.07, 0.07, 0.18, 12]} />
        </mesh>
      </group>

      {/* ============================================================ */}
      {/* 7. PLANETARY RADIO ASTRONOMY (PRA) WHIP ANTENNAS             */}
      {/* ============================================================ */}
      <Line
        points={[
          [0, 0.25, 0.1],
          [2.4, 1.8, 0.4],
        ]}
        color="#8aebe3"
        lineWidth={1.2}
        transparent
        opacity={0.7}
      />
      <Line
        points={[
          [0, -0.25, 0.1],
          [-2.1, -1.9, 0.3],
        ]}
        color="#8aebe3"
        lineWidth={1.2}
        transparent
        opacity={0.7}
      />

      {/* ============================================================ */}
      {/* 8. ATTITUDE THRUSTER CLUSTERS & SENSORS                      */}
      {/* ============================================================ */}
      {[-0.46, 0.46].map((x, i) => (
        <mesh key={i} position={[x, 0, 0.34]} material={trussMaterial}>
          <coneGeometry args={[0.028, 0.06, 8]} />
        </mesh>
      ))}

      {/* Canopus Star Tracker Baffle Tube */}
      <mesh position={[0, 0.44, 0.22]} rotation={[0.4, 0, 0]} material={opticsMaterial}>
        <cylinderGeometry args={[0.038, 0.045, 0.18, 12]} />
      </mesh>

      {/* Selection / Status Halo Indicator */}
      {(selected || active) && (
        <mesh position={[0, 0, 0.2]}>
          <torusGeometry args={[1.52, 0.016, 12, 64]} />
          <meshBasicMaterial
            color={selected ? "#52e8d3" : "#32b8aa"}
            transparent
            opacity={selected ? 0.78 : 0.35}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}
    </group>
  );
}

export default function Voyager({
  mission,
  active = false,
  progress = 0,
  position = [0, 0, 0],
  visible = true,
  selected = false,
  scale = 1,
  onClick,
}) {
  const rootGroup = useRef();
  const targetScale = useMemo(() => new THREE.Vector3(scale, scale, scale), [scale]);

  useFrame((_, dt) => {
    if (!rootGroup.current) return;
    rootGroup.current.scale.lerp(targetScale, Math.min(1, dt * 6));
  });

  if (!visible) return null;

  return (
    <group
      ref={rootGroup}
      position={position}
      scale={scale}
      onClick={onClick}
      renderOrder={45}
    >
      <VoyagerModel selected={selected} active={active} />

      {/* Distance and telemetry status HUD label */}
      <Html
        distanceFactor={22}
        position={[0, 1.85, 0]}
        style={{ pointerEvents: "none" }}
        center
      >
        <div
          style={{
            fontFamily: "IBM Plex Mono, monospace",
            fontSize: "9px",
            letterSpacing: "0.14em",
            color: selected ? "#5bf6df" : "#a2c7c5",
            background: "rgba(5, 12, 18, 0.82)",
            border: `1px solid ${selected ? "rgba(91, 246, 223, 0.65)" : "rgba(80, 150, 150, 0.3)"}`,
            borderRadius: "4px",
            padding: "3px 8px",
            whiteSpace: "nowrap",
            textShadow: "0 1px 4px rgba(0, 0, 0, 0.9)",
            backdropFilter: "blur(6px)",
            boxShadow: selected ? "0 0 12px rgba(91, 246, 223, 0.35)" : "none",
            transform: "translateY(-50%)",
            transition: "all 0.2s ease",
          }}
        >
          {selected ? "VOYAGER 1 · TRACKING" : "VOYAGER 1"}
        </div>
      </Html>
    </group>
  );
}
