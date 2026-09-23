import React, { Suspense, useMemo, useRef } from "react";
import { Html, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const NASA_MODELS = {
  voyager: "/cinematic/nasa/models/Voyager Probe (B)/Voyager Probe (B).glb",
  voyagerAntenna: "/cinematic/nasa/models/Voyager Probe (B)/Voyager Probe (B) (antenna).glb",
  cassini: "/cinematic/nasa/models/Cassini Assembly/Cassini Assembly.glb",
  saturnV: "/cinematic/nasa/models/Saturn V/Saturn V.glb",
  perseverance: "/cinematic/nasa/models/Mars 2020 Perseverance Rover/Mars 2020 Perseverance Rover.glb",
};

function Model({ url, position, scale = 1, rotation = [0, 0, 0], label, selected, onSelect }) {
  const { scene } = useGLTF(url);
  const clone = useMemo(() => {
    const root = scene.clone(true);
    root.traverse((node) => {
      if (!node.isMesh) return;
      node.castShadow = false;
      node.receiveShadow = false;
    });
    return root;
  }, [scene]);
  return (
    <group position={position} rotation={rotation} scale={scale}
      onClick={(e) => { e.stopPropagation(); onSelect?.(); }}>
      <primitive object={clone} />
      <Html position={[0, 1.8, 0]} distanceFactor={18} style={{ pointerEvents: "none", whiteSpace: "nowrap" }}>
        <div style={{
          fontFamily: "IBM Plex Mono, monospace",
          fontSize: 9,
          letterSpacing: "0.14em",
          color: selected ? "#66f5df" : "#aac4c5",
          background: "rgba(3,9,14,.78)",
          border: `1px solid ${selected ? "rgba(102,245,223,.6)" : "rgba(125,180,184,.22)"}`,
          borderRadius: 4, padding: "3px 7px", backdropFilter: "blur(6px)"
        }}>{selected ? `NASA · ${label} · TRACKING` : `NASA · ${label}`}</div>
      </Html>
    </group>
  );
}

function AssetFallback({ label }) {
  return <Html center style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 9, color: "#7fa4a7" }}>
    NASA ASSET OFFLINE · {label}
  </Html>;
}

export default function NASACinematicAssets({ active = false, onSelect }) {
  const group = useRef();
  useFrame((_, dt) => {
    if (!group.current || !active) return;
    group.current.rotation.y += dt * 0.015;
  });
  if (!active) return null;

  return (
    <group ref={group}>
      <Suspense fallback={<AssetFallback label="CINEMATIC KIT" />}>
        <Model url={NASA_MODELS.voyager} position={[-8, 1.4, 2]} scale={1.1} label="VOYAGER 1" onSelect={() => onSelect?.("voyager-1")} />
        <Model url={NASA_MODELS.cassini} position={[8, 1.2, -1]} scale={0.9} label="CASSINI" onSelect={() => onSelect?.("cassini")} />
        <Model url={NASA_MODELS.saturnV} position={[-3, 1.1, -10]} scale={0.75} rotation={[0, 0.2, 0]} label="SATURN V" onSelect={() => onSelect?.("saturn-v")} />
        <Model url={NASA_MODELS.perseverance} position={[3, 0.8, -7]} scale={0.65} rotation={[0, -0.8, 0]} label="PERSEVERANCE" onSelect={() => onSelect?.("perseverance")} />
      </Suspense>
    </group>
  );
}

Object.values(NASA_MODELS).forEach((url) => {
  try { useGLTF.preload(url); } catch {}
});
