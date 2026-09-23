import React, { Suspense, useMemo } from "react";
import { Html, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import Voyager from "./Voyager.jsx";

const VOYAGER_MODEL = "/cinematic/nasa/models/Voyager Probe (B)/Voyager Probe (B).glb";
const VOYAGER_ANTENNA = "/cinematic/nasa/models/Voyager Probe (B)/Voyager Probe (B) (antenna).glb";

function NASAAssetModel({ url, position, targetSize = 2.2, rotation = [0, 0, 0], selected = false, onSelect }) {
  const { scene } = useGLTF(url);

  const prepared = useMemo(() => {
    const root = scene.clone(true);

    root.traverse((node) => {
      if (!node.isMesh) return;
      node.castShadow = false;
      node.receiveShadow = true;
      if (node.material) {
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.forEach((material) => {
          material.transparent = false;
          material.depthWrite = true;
          material.needsUpdate = true;
        });
      }
    });

    // NASA GLB files are authored in real-world units. Normalize the imported
    // scene so the spacecraft has a stable readable size in Event Horizon's
    // presentation-space coordinates regardless of GLB root scale.
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z, 0.001);

    root.position.sub(center);
    root.scale.setScalar(targetSize / maxDimension);

    return root;
  }, [scene, targetSize]);

  return (
    <group
      position={position}
      rotation={rotation}
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.();
      }}
    >
      <primitive object={prepared} />
      <pointLight
        color="#b8fff4"
        intensity={1.35}
        distance={7}
        decay={2}
      />
      <Html
        position={[0, targetSize * 0.72, 0]}
        distanceFactor={16}
        style={{ pointerEvents: "none", whiteSpace: "nowrap" }}
      >
        <div
          style={{
            fontFamily: "IBM Plex Mono, monospace",
            fontSize: 9,
            letterSpacing: "0.14em",
            color: selected ? "#66f5df" : "#aac4c5",
            background: "rgba(3,9,14,.82)",
            border: `1px solid ${selected ? "rgba(102,245,223,.65)" : "rgba(125,180,184,.24)"}`,
            borderRadius: 4,
            padding: "3px 7px",
            backdropFilter: "blur(6px)",
          }}
        >
          {selected ? "NASA · VOYAGER 1 · TRACKING" : "NASA · VOYAGER 1"}
        </div>
      </Html>
    </group>
  );
}

function NASAAssetFallback({ position, selected, onSelect }) {
  // Keep the mission usable if a local GLB fails to decode. The procedural
  // Voyager is a fallback only; the NASA GLB is the primary spacecraft.
  return (
    <Voyager
      active
      selected={selected}
      position={position}
      scale={0.72}
      visible
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.();
      }}
    />
  );
}

export default function NASACinematicAssets({
  active = false,
  voyagerPosition = [0, 0, 0],
  selected = false,
  onSelect,
}) {
  if (!active) return null;

  return (
    <group>
      <Suspense
        fallback={
          <NASAAssetFallback
            position={voyagerPosition}
            selected={selected}
            onSelect={onSelect}
          />
        }
      >
        <NASAAssetModel
          url={VOYAGER_MODEL}
          position={voyagerPosition}
          targetSize={2.35}
          selected={selected}
          onSelect={onSelect}
        />
        <NASAAssetModel
          url={VOYAGER_ANTENNA}
          position={voyagerPosition}
          targetSize={0.92}
          rotation={[0, 0, 0]}
        />
      </Suspense>
    </group>
  );
}

useGLTF.preload(VOYAGER_MODEL);
useGLTF.preload(VOYAGER_ANTENNA);
