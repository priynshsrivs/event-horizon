import React, { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";

export const NASA_MODEL_PATHS = Object.freeze({
  voyager: "/cinematic/nasa/models/Voyager Probe (B)/Voyager Probe (B).glb",
  cassini: "/cinematic/nasa/models/Cassini Assembly/Cassini Assembly.glb",
  saturnV: "/cinematic/nasa/models/Saturn V/Saturn V.glb",
  perseverance: "/cinematic/nasa/models/Mars 2020 Perseverance Rover/Mars 2020 Perseverance Rover.glb",
});

function GLBInstance({ src, position, rotation, scale, animate, animationSpeed, ...rest }) {
  const root = useRef();
  const gltf = useGLTF(src);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  useEffect(() => {
    scene.traverse((object) => {
      if (!object.isMesh) return;
      object.frustumCulled = true;
      object.castShadow = false;
      object.receiveShadow = false;
    });
  }, [scene]);

  useFrame((_, dt) => {
    if (!animate || !root.current) return;
    root.current.rotation.y += dt * animationSpeed;
  });

  return <primitive ref={root} object={scene} position={position} rotation={rotation} scale={scale} {...rest} />;
}

class SafeBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { this.props.onError?.(error); }
  render() { return this.state.failed ? this.props.fallback ?? null : this.props.children; }
}

export default function NASAModel({
  src,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  visible = true,
  animate = false,
  animationSpeed = 0.12,
  fallback = null,
  onError,
}) {
  if (!visible) return null;
  return (
    <SafeBoundary fallback={fallback} onError={onError}>
      <Suspense fallback={null}>
        <GLBInstance
          src={src}
          position={position}
          rotation={rotation}
          scale={scale}
          animate={animate}
          animationSpeed={animationSpeed}
        />
      </Suspense>
    </SafeBoundary>
  );
}

for (const path of Object.values(NASA_MODEL_PATHS)) {
  useGLTF.preload(path);
}
