import React, { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import * as THREE from "three";

/*
 * Official NASA/JPL-Caltech Voyager spacecraft render.
 * Source:
 * https://www.jpl.nasa.gov/images/pia14111-model-of-voyager-artist-concept/
 *
 * The render is displayed as a billboard so the mission view uses the
 * actual spacecraft appearance rather than a hand-built low-poly mesh.
 */
const NASA_VOYAGER_IMAGE =
  "https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia26/pia26353/PIA26353.jpg";

const fragmentShader = `
uniform sampler2D map;
varying vec2 vUv;

void main() {
  vec4 tex = texture2D(map, vUv);

  // PIA26353 is a NASA/JPL artist concept with a dark space background.
  // Remove the dark background while retaining the illuminated spacecraft.
  float luminance = dot(tex.rgb, vec3(0.2126, 0.7152, 0.0722));
  float alpha = smoothstep(0.025, 0.115, luminance);

  // Stars and dust in the artwork stay extremely faint rather than forming
  // an opaque rectangle around the spacecraft.
  alpha *= smoothstep(0.035, 0.18, luminance);

  if (alpha < 0.012) discard;

  vec3 color = pow(max(tex.rgb, vec3(0.0)), vec3(0.94));
  gl_FragColor = vec4(color, alpha * 0.92);
}
`;


const vertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

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
  const [texture, setTexture] = useState(null);
  const group = useRef();

  useEffect(() => {
    let alive = true;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");

    loader.load(
      NASA_VOYAGER_IMAGE,
      (loaded) => {
        if (!alive) {
          loaded.dispose();
          return;
        }
        loaded.colorSpace = THREE.SRGBColorSpace;
        loaded.minFilter = THREE.LinearFilter;
        loaded.magFilter = THREE.LinearFilter;
        loaded.generateMipmaps = false;
        loaded.needsUpdate = true;
        setTexture(loaded);
      },
      undefined,
      () => {
        if (alive) setTexture(null);
      },
    );

    return () => {
      alive = false;
    };
  }, []);

  useFrame((_, dt) => {
    if (!group.current || !active) return;
    group.current.rotation.z += dt * 0.025;
    group.current.scale.lerp(
      new THREE.Vector3(scale, scale, scale),
      Math.min(1, dt * 5),
    );
  });

  if (!visible) return null;

  return (
    <group
      ref={group}
      position={position}
      scale={scale}
      onClick={onClick}
      renderOrder={40}
    >
      <Billboard>
        <mesh>
          <planeGeometry args={[1.68, 0.945]} />
          {texture ? (
            <shaderMaterial
              uniforms={{ map: { value: texture } }}
              vertexShader={vertexShader}
              fragmentShader={fragmentShader}
              transparent
              depthWrite={false}
              depthTest={true}
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          ) : (
            <meshBasicMaterial
              color={selected ? "#dffaf3" : "#b8d9d6"}
              transparent
              opacity={0.12}
              depthWrite={false}
            />
          )}
        </mesh>

        <mesh position={[0, -0.015, 0.01]}>
          <ringGeometry args={[0.50, 0.512, 64]} />
          <meshBasicMaterial
            color={selected ? "#b9f5ed" : "#86bfc0"}
            transparent
            opacity={selected ? 0.75 : active ? 0.18 : 0.10}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </Billboard>
    </group>
  );
}
