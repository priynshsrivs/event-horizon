import React, { useRef, useState, useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Html,
  Line,
  Billboard,
  useProgress,
} from "@react-three/drei";
import * as THREE from "three";
import {
  Vector3,
  CelestialBody,
  isStar,
  TAU,
} from "../physics/PhysicsEngine.js";
import {
  mapPosition,
  unmapPosition,
  bodyPosition,
  visualRadius,
} from "./coordinates.js";

const textureCache = new Map();
const textureRequests = new Map();
const loader = new THREE.TextureLoader();
function useSafeTexture(name) {
  const [texture, setTexture] = useState(textureCache.get(name) || null);
  useEffect(() => {
    let alive = true;
    if (!name) {
      setTexture(null);
      return;
    }
    if (textureCache.has(name)) {
      setTexture(textureCache.get(name));
      return;
    }
    if (!textureRequests.has(name))
      textureRequests.set(
        name,
        new Promise((resolve) => {
          loader.load(
            `/textures/${name}.jpg`,
            (loaded) => {
              loaded.colorSpace = THREE.SRGBColorSpace;
              loaded.anisotropy = 4;
              textureCache.set(name, loaded);
              resolve(loaded);
            },
            undefined,
            () => resolve(null),
          );
        }),
      );
    textureRequests.get(name).then((loaded) => {
      if (alive) setTexture(loaded);
    });
    return () => {
      alive = false;
    };
  }, [name]);
  return texture;
}

function SpaceBackground() {
  const texture = useSafeTexture("galaxy");
  const { scene } = useThree();
  useEffect(() => {
    if (!texture) return;
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = texture;
    scene.backgroundIntensity = 0.7;
    // Put the photographed galactic center behind the initial system view;
    // this orientation remains fixed in space while the user moves the camera.
    scene.backgroundRotation.setFromQuaternion(
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(-13, -17, -21).normalize(),
      ),
    );
    return () => {
      scene.background = null;
    };
  }, [texture, scene]);
  const stars = useMemo(() => {
    const result = new Float32Array(1800 * 3);
    let seed = 21;
    const random = () =>
      (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (let i = 0; i < 1800; i++) {
      const z = random() * 2 - 1,
        angle = random() * TAU,
        r = 250;
      result.set(
        [
          r * Math.sqrt(1 - z * z) * Math.cos(angle),
          r * z,
          r * Math.sqrt(1 - z * z) * Math.sin(angle),
        ],
        i * 3,
      );
    }
    return result;
  }, []);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[stars, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#bbced9"
        size={0.14}
        transparent
        opacity={0.52}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

const glowVertex = `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const glowFragment = `varying vec2 vUv; uniform vec3 color; uniform float strength; void main(){float r=length(vUv-.5)*2.;float a=pow(max(0.,1.-r),3.)*strength;gl_FragColor=vec4(color,a);}`;

// Enhanced stellar surface shader with limb darkening and surface detail
const stellarVertex = `
  varying vec2 vUv;
  varying vec3 vNormal;
  void main(){
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const stellarFragment = `
  varying vec2 vUv;
  varying vec3 vNormal;
  uniform sampler2D map;
  uniform vec3 color;
  uniform float time;

  float noise(vec3 p){
    return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
  }

  void main(){
    vec3 base = texture2D(map, vUv).rgb * color;

    // Limb darkening effect
    float rim = 1.0 - abs(vNormal.z);
    rim = pow(rim, 2.2);
    base *= (0.7 + rim * 0.3);

    // Surface granulation (simplified)
    float gran = noise(vUv * 20.0 + time * 0.1) * 0.15;
    base += gran * color;

    gl_FragColor = vec4(base, 1.0);
  }
`;
function Glow({ color = "#f3ad65", size = 1, opacity = 0.6 }) {
  const uniforms = useMemo(
    () => ({
      color: { value: new THREE.Color(color) },
      strength: { value: opacity },
    }),
    [color, opacity],
  );
  return (
    <Billboard>
      <mesh scale={size}>
        <planeGeometry args={[2, 2]} />
        <shaderMaterial
          vertexShader={glowVertex}
          fragmentShader={glowFragment}
          uniforms={uniforms}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </Billboard>
  );
}

function DynamicSolarFlares({ body, radius }) {
  const ref = useRef();
  const flareCount = Math.min(8, Math.max(2, Math.floor(Math.log1p(body.radius) * 1.5)));

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.children.forEach((child, i) => {
        const time = clock.elapsedTime;
        const phase = (i / flareCount) * Math.PI * 2;
        const scale = 0.8 + Math.sin(time * 2 + phase) * 0.4;
        const yOffset = Math.cos(time * 1.5 + phase) * radius * 1.2;
        const xOffset = Math.sin(time * 1.2 + phase) * radius * 0.8;

        child.position.set(xOffset, yOffset, 0);
        child.scale.setScalar(scale);
        child.material.opacity = 0.6 + Math.sin(time * 3 + phase) * 0.3;
      });
    }
  });

  return (
    <group ref={ref}>
      {Array.from({ length: flareCount }).map((_, i) => (
        <Billboard key={i}>
          <mesh position={[radius * 0.8, radius * 0.6, 0]}>
            <planeGeometry args={[radius * 0.4, radius * 0.6]} />
            <meshBasicMaterial
              color="#ffcc66"
              transparent
              opacity={0.6}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </Billboard>
      ))}
    </group>
  );
}

function SelectionRing({ radius, selected }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = clock.elapsedTime * 0.13;
  });
  return (
    <Billboard>
      <group ref={ref}>
        {[0, Math.PI].map((start) => (
          <mesh key={start}>
            <ringGeometry
              args={[radius * 1.38, radius * 1.39, 64, 1, start, 2.3]}
            />
            <meshBasicMaterial
              color={selected ? "#a8e0e3" : "#ffffff"}
              transparent
              opacity={0.8}
              side={THREE.DoubleSide}
              depthTest={false}
            />
          </mesh>
        ))}
      </group>
    </Billboard>
  );
}

function SaturnRings({ radius }) {
  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {Array.from({ length: 11 }, (_, i) => (
        <mesh key={i}>
          <ringGeometry
            args={[radius * (1.35 + i * 0.09), radius * (1.42 + i * 0.09), 96]}
          />
          <meshStandardMaterial
            color={["#b6a887", "#857963", "#ddcba0", "#a79a7d"][i % 4]}
            transparent
            opacity={i === 6 ? 0.12 : 0.68}
            roughness={1}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

function EarthLayers({ radius }) {
  const clouds = useSafeTexture("earth_clouds"),
    night = useSafeTexture("earth_night");
  return (
    <>
      {night && (
        <mesh>
          <sphereGeometry args={[radius * 1.002, 40, 28]} />
          <meshBasicMaterial
            map={night}
            transparent
            blending={THREE.AdditiveBlending}
            opacity={0.32}
            depthWrite={false}
          />
        </mesh>
      )}
      {clouds && (
        <mesh>
          <sphereGeometry args={[radius * 1.012, 40, 28]} />
          <meshStandardMaterial
            map={clouds}
            alphaMap={clouds}
            transparent
            opacity={0.28}
            depthWrite={false}
          />
        </mesh>
      )}
      <mesh>
        <sphereGeometry args={[radius * 1.025, 40, 28]} />
        <meshBasicMaterial
          color="#72b7e7"
          transparent
          opacity={0.045}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}

function BlackHoleVisual({ body, radius, settings, engine }) {
  const ref = useRef(),
    galaxy = useSafeTexture("galaxy");
  const uniforms = useMemo(
    () => ({
      sky: { value: galaxy },
      strength: {
        value:
          engine.calculateGravitationalLensing(
            body,
            engine.schwarzschildRadius(body.mass) * 6,
          ) * 0.16,
      },
      tick: { value: 0 },
    }),
    [galaxy, body, engine],
  );
  const dragRate = Math.min(
    0.6,
    Math.log1p(
      Math.abs(
        engine.calculateFrameDragging(
          body,
          engine.schwarzschildRadius(body.mass) * 5,
        ),
      ),
    ) * 0.015,
  );
  useFrame((_, dt) => {
    if (ref.current)
      ref.current.rotation.z +=
        dt * (settings.frameDragging ? 0.04 + dragRate : 0.04);
    uniforms.tick.value += dt;
  });
  // Background-only lensing impostor: sample the actual Milky Way map with a
  // radial deflection. This is an artistic screen-aligned approximation, not GR.
  return (
    <>
      <mesh>
        <sphereGeometry args={[radius, 48, 32]} />
        <meshBasicMaterial color="#000003" />
      </mesh>
      {settings.lensing && galaxy && (
        <Billboard>
          <mesh scale={radius * 3.5}>
            <planeGeometry args={[2, 2]} />
            <shaderMaterial
              transparent
              depthWrite={false}
              uniforms={uniforms}
              vertexShader={glowVertex}
              fragmentShader={`varying vec2 vUv;uniform sampler2D sky;uniform float strength;uniform float tick;void main(){vec2 p=vUv-.5;float r=length(p);vec2 warp=p*(1.+strength/max(.015,r*r));vec3 c=texture2D(sky,vec2(atan(warp.y,warp.x)/6.283+.5+tick*.002,length(warp)*.5)).rgb;float a=smoothstep(.14,.19,r)*(1.-smoothstep(.3,.49,r));gl_FragColor=vec4(c*1.5,a*.75);}`}
            />
          </mesh>
        </Billboard>
      )}
      <group rotation={[0.2, 0, 0.24]}>
        <group ref={ref} rotation={[-Math.PI / 2, 0, 0]}>
          {Array.from({ length: 9 }, (_, i) => (
            <mesh key={i}>
              <ringGeometry
                args={[
                  radius * (1.55 + i * 0.17),
                  radius * (1.64 + i * 0.17),
                  96,
                  1,
                  i * 0.4,
                  TAU - 0.2,
                ]}
              />
              <meshBasicMaterial
                color={i < 3 ? "#ffe5b7" : "#d98652"}
                side={THREE.DoubleSide}
                transparent
                opacity={0.8 - i * 0.065}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
          ))}
        </group>
      </group>
      <Billboard>
        <mesh>
          <torusGeometry args={[radius * 1.12, radius * 0.025, 8, 96]} />
          <meshBasicMaterial color="#fff0d3" />
        </mesh>
      </Billboard>
      <Glow size={radius * 3.5} color="#ac6131" opacity={0.24} />
    </>
  );
}

function ExoticVisual({ body, radius }) {
  const ref = useRef();
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 1.2;
  });
  if (body.type === "wormhole")
    return (
      <group ref={ref} rotation={[0.6, 0, 0.2]}>
        {[1, 1.18, 1.4].map((scale, i) => (
          <mesh key={scale} rotation={[i * 0.7, i * 0.3, 0]}>
            <torusGeometry args={[radius * scale, radius * 0.035, 8, 72]} />
            <meshBasicMaterial
              color={i % 2 ? "#7ce7f4" : "#ad94ff"}
              transparent
              opacity={0.8}
            />
          </mesh>
        ))}
        <Glow color="#8b7bdd" size={radius * 2} opacity={0.8} />
      </group>
    );
  if (body.type === "neutron star" || body.type === "magnetar")
    return (
      <group ref={ref} rotation={[0, 0, 0.45]}>
        {[-1, 1].map((sign) => (
          <mesh
            key={sign}
            position={[0, sign * radius * 3.5, 0]}
            rotation={[sign < 0 ? Math.PI : 0, 0, 0]}
          >
            <coneGeometry args={[radius * 1.6, radius * 7, 24, 1, true]} />
            <meshBasicMaterial
              color={body.type === "magnetar" ? "#c6a2ff" : "#8cd5fa"}
              transparent
              opacity={0.13}
              side={THREE.DoubleSide}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        ))}
      </group>
    );
  return null;
}

function PlanetBody({ body, engine, selected, onSelect, settings, building }) {
  const group = useRef(),
    surface = useRef(),
    deformed = useRef(),
    cometTail = useRef(),
    light = useRef();
  const [hover, setHover] = useState(false),
    texture = useSafeTexture(body.metadata.texture);
  const radius = visualRadius(body),
    star = isStar(body),
    color = body.metadata.color || "#8cb8c7";
  const axis = useMemo(() => new THREE.Vector3(1, 0, 0), []),
    direction = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    if (!group.current) return;
    group.current.position.set(
      ...bodyPosition(body, engine, settings.compressed),
    );
    if (surface.current && !engine.paused) {
      const spin =
        Math.sign(body.angularVelocity.y || 1) *
        Math.min(
          0.45,
          0.08 + Math.log1p(Math.abs(body.angularVelocity.y)) * 0.022,
        );
      surface.current.rotation.y +=
        dt * spin * (body.metadata.localTimeFactor ?? 1);
    }
    if (deformed.current) {
      const stretch = body.metadata.tidalStretch || 1,
        primary = engine.getBody(body.metadata.tidalPrimaryId);
      deformed.current.scale.set(
        stretch,
        1 / Math.sqrt(stretch),
        1 / Math.sqrt(stretch),
      );
      if (primary) {
        direction
          .set(...bodyPosition(primary, engine, settings.compressed))
          .sub(group.current.position)
          .normalize();
        deformed.current.quaternion.setFromUnitVectors(axis, direction);
      }
    }
    if (light.current)
      light.current.intensity = 18 + (body.metadata.activeSolarFlare ? 6 : 0);
    if (cometTail.current) {
      const primary = engine.getBody(body.metadata.nearestStarId),
        length = body.metadata.tailLength || 0.05;
      if (primary) {
        direction
          .set(...bodyPosition(primary, engine, settings.compressed))
          .sub(group.current.position)
          .normalize()
          .negate();
        cometTail.current.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          direction,
        );
        cometTail.current.scale.y = length;
      }
    }
    if (surface.current?.material && !star && body.type !== "black hole")
      surface.current.material.emissiveIntensity =
        (body.metadata.impactGlowUntil || 0) > engine.time ? 0.9 : 0.025;
  });
  if (body.type === "dark matter halo" && !settings.darkMatter) return null;
  return (
    <group ref={group}>
      {body.type === "black hole" ? (
        <BlackHoleVisual
          body={body}
          radius={radius}
          settings={settings}
          engine={engine}
        />
      ) : (
        <group ref={deformed}>
          <group rotation={[0, 0, (body.axialTilt * Math.PI) / 180]}>
            <mesh
              ref={surface}
              onClick={(e) => {
                if (!building) {
                  e.stopPropagation();
                  onSelect(body.id);
                }
              }}
              onPointerOver={(e) => {
                if (!building) {
                  e.stopPropagation();
                  setHover(true);
                  document.body.style.cursor = "pointer";
                }
              }}
              onPointerOut={() => {
                setHover(false);
                document.body.style.cursor = "";
              }}
            >
              <sphereGeometry
                args={[
                  radius,
                  settings.quality === "low" ? 24 : 48,
                  settings.quality === "low" ? 16 : 32,
                ]}
              />
              {star ? (
                <meshBasicMaterial
                  key={texture?.uuid || "fallback"}
                  map={texture}
                  color={texture ? "#ffe5bf" : color}
                  toneMapped={false}
                />
              ) : (
                <meshStandardMaterial
                  key={texture?.uuid || "fallback"}
                  map={texture}
                  color={texture ? "#ffffff" : color}
                  roughness={0.92}
                  metalness={0.03}
                  emissive={color}
                  emissiveIntensity={0.025}
                  transparent={
                    body.type === "dark matter halo" || body.type === "wormhole"
                  }
                  opacity={
                    body.type === "dark matter halo"
                      ? 0.055
                      : body.type === "wormhole"
                        ? 0.12
                        : 1
                  }
                  depthWrite={body.type !== "dark matter halo"}
                />
              )}
              {body.id === "earth" && <EarthLayers radius={radius} />}
            </mesh>
            {body.metadata.texture === "saturn" && (
              <SaturnRings radius={radius} />
            )}
          </group>
        </group>
      )}
      {body.type === "black hole" && (
        <mesh
          onClick={(e) => {
            if (!building) {
              e.stopPropagation();
              onSelect(body.id);
            }
          }}
        >
          <sphereGeometry args={[radius * 1.5, 16, 12]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
      {star && (
        <>
          <Glow color={color} size={radius * 3.8} opacity={0.28} />
          {(body.id === "sun" ||
            engine.bodies.filter(isStar).indexOf(body) < 3) && (
            <pointLight
              ref={light}
              color={color}
              intensity={18}
              decay={0.3}
              distance={100}
            />
          )}
        </>
      )}
      <ExoticVisual body={body} radius={radius} />
      {body.type === "comet" && (
        <group ref={cometTail}>
          <mesh position={[0, 0.5, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.12, 1, 16]} />
            <meshBasicMaterial
              color="#b8e4e7"
              transparent
              opacity={0.2}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          <mesh position={[0, 0.7, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.035, 1.4, 12]} />
            <meshBasicMaterial
              color="#72bcea"
              transparent
              opacity={0.25}
              depthWrite={false}
            />
          </mesh>
        </group>
      )}
      {body.type === "debris" && (
        <mesh>
          <dodecahedronGeometry args={[radius * 0.8, 0]} />
          <meshStandardMaterial
            color={body.metadata.color || "#a8a8a8"}
            roughness={0.95}
            metalness={0.1}
            emissive={body.metadata.color || "#333333"}
            emissiveIntensity={(body.metadata.impactGlowUntil || 0) > engine.time ? 0.6 : 0}
          />
        </mesh>
      )}
      {(selected || hover) && (
        <SelectionRing radius={radius} selected={selected} />
      )}
      {settings.labels &&
        body.type !== "debris" &&
        (engine.bodies.length < 30 || body.metadata.texture || selected) && (
          <Html
            center
            position={[radius * 1.5, radius * 1.7, 0]}
            distanceFactor={undefined}
            zIndexRange={[2, 0]}
            style={{ pointerEvents: building ? "none" : "auto" }}
          >
            <button
              className={`planet-label ${selected ? "selected" : ""}`}
              onClick={() => onSelect(body.id)}
            >
              <i style={{ background: color }} />
              {body.name}
              {selected && <span>TRACKING</span>}
            </button>
          </Html>
        )}
    </group>
  );
}

function OrbitPath({ body, engine, compressed, revision }) {
  const points = useMemo(() => {
    const primary = engine.getBody(body.metadata.primaryId || "sun");
    if (!primary || primary === body || body.type === "moon") return [];
    const elements = engine.calculateOrbitalElements(body, primary);
    if (
      !elements?.bound ||
      elements.eccentricity > 0.97 ||
      elements.semiMajorAxis > 500
    )
      return [];
    const r = body.position.clone().sub(primary.position),
      v = body.velocity.clone().sub(primary.velocity),
      normal = r.clone().cross(v).normalize();
    const x = r.clone().normalize(),
      y = normal.clone().cross(x).normalize();
    const mu =
      4 * Math.PI ** 2 * engine.gravityMultiplier * (body.mass + primary.mass);
    const ev = v.clone().cross(r.clone().cross(v)).divideScalar(mu).sub(x),
      omega = Math.atan2(ev.dot(y), ev.dot(x));
    const result = [];
    for (let i = 0; i <= 180; i++) {
      const a = (i / 180) * TAU,
        distance =
          (elements.semiMajorAxis * (1 - elements.eccentricity ** 2)) /
          (1 + elements.eccentricity * Math.cos(a - omega));
      result.push(
        mapPosition(
          primary.position
            .clone()
            .addScaledVector(x, distance * Math.cos(a))
            .addScaledVector(y, distance * Math.sin(a)),
          compressed,
        ),
      );
    }
    return result;
  }, [body, engine, compressed, revision]);
  return points.length ? (
    <Line
      points={points}
      color={body.metadata.color || "#536472"}
      lineWidth={0.6}
      transparent
      opacity={0.21}
    />
  ) : null;
}

function HabitableZone({ engine, compressed }) {
  const stars = engine.bodies.filter((b) => b.luminosity > 0.01);
  return (
    <>
      {stars.slice(0, 5).map((star) => {
        const zone = engine.calculateHabitableZone(star),
          factor = (r) => (compressed ? 4 * Math.log1p(r) : r);
        return (
          <group
            key={star.id}
            position={mapPosition(star.position, compressed)}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <mesh>
              <ringGeometry
                args={[factor(zone.inner), factor(zone.outer), 128]}
              />
              <meshBasicMaterial
                color="#60b799"
                side={THREE.DoubleSide}
                transparent
                opacity={0.075}
                depthWrite={false}
              />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

function Effect({ effect, engine, compressed }) {
  const ref = useRef(),
    light = useRef(),
    particles = useRef(),
    materials = useRef([]),
    started = useRef(performance.now());
  const flare = effect.type === "solarFlare",
    nova = effect.type === "supernova",
    radius = effect.radius || 0.25;
  const particlePositions = useMemo(() => new Float32Array(64 * 3), []);
  const strands = useMemo(
    () =>
      Array.from({ length: 4 }, (_, i) => {
        const points = [];
        for (let j = 0; j <= 40; j++) {
          const t = j / 40;
          points.push([
            radius * (0.5 + Math.sin(t * Math.PI) * (2 + i * 0.24)),
            radius * (-0.7 + 1.4 * t),
            Math.sin(t * Math.PI) * radius * i * 0.3,
          ]);
        }
        return points;
      }),
    [radius],
  );
  useFrame(() => {
    if (!ref.current) return;
    const age = (performance.now() - started.current) / 1000,
      duration = flare ? 5 : nova ? 7 : 3,
      t = age / duration;
    const star = engine.getBody(effect.bodyId),
      position = star
        ? mapPosition(star.position, compressed)
        : mapPosition(effect.position, compressed);
    ref.current.position.set(...position);
    ref.current.visible = t <= 1;
    ref.current.scale.setScalar(
      flare
        ? 1 + Math.sin(Math.min(t, 1) * Math.PI) * 0.4
        : 0.1 + t * (nova ? 12 : 3),
    );
    materials.current.forEach((m, i) => {
      if (m) m.opacity = Math.max(0, 1 - t) * (i === 1 ? 0.12 : 0.8);
    });
    if (particles.current) {
      const positions = particles.current.geometry.attributes.position;
      for (let i = 0; i < 64; i++) {
        const z = 1 - (2 * (i + 0.5)) / 64,
          angle = i * 2.399963,
          r = radius * (1.1 + t * (flare ? 3 : 2)) * (0.7 + (i % 7) / 10);
        positions.setXYZ(
          i,
          Math.sqrt(1 - z * z) * Math.cos(angle) * r,
          z * r,
          Math.sqrt(1 - z * z) * Math.sin(angle) * r,
        );
      }
      positions.needsUpdate = true;
    }
    if (light.current)
      light.current.intensity = Math.max(0, (1 - t) * (nova ? 30 : 7));
  });
  return (
    <group ref={ref}>
      {flare ? (
        <group rotation={effect.rotation || [0, 0, 0]}>
          {strands.map((points, i) => (
            <Line
              ref={(line) => (materials.current[i + 2] = line?.material)}
              key={i}
              points={points}
              color={i < 2 ? "#ffe4aa" : "#f18b47"}
              lineWidth={i === 0 ? 3 : 1.4}
              transparent
              opacity={0.8}
            />
          ))}
          <Glow size={radius * 3} color="#ffb666" />
        </group>
      ) : (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius * 2, radius * 0.035, 8, 96]} />
          <meshBasicMaterial
            ref={(m) => (materials.current[0] = m)}
            color={nova ? "#ffd3ad" : "#ed9862"}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}
      <mesh>
        <sphereGeometry args={[radius * (flare ? 1.5 : 2), 24, 16]} />
        <meshBasicMaterial
          ref={(m) => (materials.current[1] = m)}
          color="#ffd9a3"
          transparent
          opacity={0.08}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <points ref={particles}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[particlePositions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          ref={(m) => (materials.current[6] = m)}
          color="#ffcc8b"
          size={radius * 0.05}
          sizeAttenuation
          transparent
          opacity={0.8}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <pointLight ref={light} color="#ffc59a" distance={nova ? 30 : 5} />
    </group>
  );
}

function CameraController({
  engine,
  selectedId,
  homeToken,
  settings,
  controls,
  building,
  panelOpen,
  storyMode,
}) {
  const { camera, size } = useThree();
  const target = useRef(new THREE.Vector3()),
    offset = useRef(new THREE.Vector3()),
    previous = useRef(new THREE.Vector3()),
    moving = useRef(true),
    focused = useRef(null),
    shake = useRef({ intensity: 0, duration: 0, elapsed: 0 });
  const temp = useMemo(() => new THREE.Vector3(), []),
    reduced = useMemo(
      () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      [],
    );

  useEffect(() => {
    const handleEngulfment = (event) => {
      shake.current = {
        intensity: event.intensity || 1,
        duration: event.duration || 0.6,
        elapsed: 0,
      };
    };
    engine.on("blackHoleEngulfment", handleEngulfment);
    return () => engine.off("blackHoleEngulfment", handleEngulfment);
  }, [engine]);

  useEffect(() => {
    moving.current = true;
    focused.current = selectedId;
    previous.current.set(0, 0, 0);
  }, [selectedId, homeToken, settings.compressed, size.width, size.height]);
  useEffect(() => {
    // Compose the focused object in the unobscured part of the canvas.
    if (panelOpen || storyMode)
      camera.setViewOffset(
        size.width,
        size.height,
        storyMode || size.width < 560 ? 0 : size.width < 850 ? 105 : 75,
        storyMode
          ? size.height * 0.17
          : size.width < 560
            ? size.height * 0.22
            : 0,
        size.width,
        size.height,
      );
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    return () => camera.clearViewOffset();
  }, [camera, panelOpen, storyMode, size.width, size.height]);
  useFrame((_, dt) => {
    const orbit = controls.current;
    if (!orbit) return;

    // Apply screen shake
    if (shake.current.elapsed < shake.current.duration) {
      shake.current.elapsed += dt;
      const progress = shake.current.elapsed / shake.current.duration;
      const decay = Math.cos(progress * Math.PI) * 0.5; // Fade out over time
      const intensity = shake.current.intensity * decay;

      const shakeX = (Math.random() - 0.5) * intensity * 0.02;
      const shakeY = (Math.random() - 0.5) * intensity * 0.02;
      const shakeZ = (Math.random() - 0.5) * intensity * 0.01;

      camera.position.add(new THREE.Vector3(shakeX, shakeY, shakeZ));
    }

    const body = engine.getBody(selectedId);
    if (body) {
      target.current.set(...bodyPosition(body, engine, settings.compressed));
      const r = visualRadius(body),
        distance = Math.max(
          r * 7,
          body.type === "black hole"
            ? r * 10
            : storyMode && body.id === "proto-earth"
              ? 4
              : 0.5,
        );
      offset.current.set(distance * 0.9, distance * 0.4, distance);
      orbit.minDistance = r * 1.8;
      if (!moving.current) {
        temp.copy(target.current).sub(previous.current);
        camera.position.add(temp);
        orbit.target.add(temp);
      }
    } else {
      target.current.set(0, 0, 0);
      offset.current
        .set(
          settings.compressed ? 13 : 37,
          settings.compressed ? 17 : 45,
          settings.compressed ? 21 : 58,
        )
        .multiplyScalar(Math.max(1, (1.25 * size.height) / size.width));
      orbit.minDistance = 0.1;
      if (focused.current) {
        moving.current = true;
        focused.current = null;
      }
    }
    if (moving.current) {
      const alpha = reduced ? 1 : 1 - Math.exp(-dt * 3.3);
      orbit.target.lerp(target.current, alpha);
      temp.copy(target.current).add(offset.current);
      camera.position.lerp(temp, alpha);
      if (camera.position.distanceTo(temp) < 0.015) moving.current = false;
    }
    previous.current.copy(target.current);
    orbit.enabled = !building;
    orbit.update();
  });
  return null;
}

function BuildPlacement({ engine, type, settings, onPlace, onReadout }) {
  const { camera, raycaster, pointer, gl } = useThree(),
    ghost = useRef(),
    arrow = useRef(),
    start = useRef(null),
    hit = useMemo(() => new THREE.Vector3(), []);
  const plane = useMemo(
      () => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
      [],
    ),
    velocity = useRef(new Vector3()),
    position = useRef(new Vector3());
  const [trajectory, setTrajectory] = useState([]),
    last = useRef(0);
  useEffect(() => {
    const down = (e) => {
      if (e.button !== 0) return;
      raycaster.setFromCamera(pointer, camera);
      if (raycaster.ray.intersectPlane(plane, hit)) {
        start.current = hit.clone();
        position.current = unmapPosition(hit, settings.compressed);
      }
    };
    const up = (e) => {
      if (e.button !== 0 || !start.current) return;
      onPlace(type, position.current.clone(), velocity.current.clone());
      start.current = null;
    };
    const cancel = () => {
      start.current = null;
    };
    gl.domElement.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    window.addEventListener("blur", cancel);
    return () => {
      gl.domElement.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("blur", cancel);
    };
  }, [
    camera,
    engine,
    gl,
    hit,
    onPlace,
    plane,
    pointer,
    raycaster,
    settings.compressed,
    type,
  ]);
  useFrame(({ clock }) => {
    raycaster.setFromCamera(pointer, camera);
    if (!raycaster.ray.intersectPlane(plane, hit)) return;
    const visual = start.current || hit;
    if (!start.current) {
      position.current = unmapPosition(hit, settings.compressed);
      velocity.current.set(0, 0, 0);
    } else {
      const end = unmapPosition(hit, settings.compressed);
      velocity.current.copy(end).sub(position.current).multiplyScalar(3);
    }
    ghost.current?.position.copy(visual);
    if (arrow.current) {
      const direction = hit.clone().sub(visual),
        length = direction.length();
      arrow.current.position.copy(visual);
      arrow.current.setDirection(
        length ? direction.normalize() : new THREE.Vector3(1, 0, 0),
      );
      arrow.current.setLength(Math.max(length, 0.001), 0.16, 0.08);
    }
    if (clock.elapsedTime - last.current > 0.1) {
      last.current = clock.elapsedTime;
      const body = new CelestialBody({
        position: position.current,
        velocity: velocity.current,
      });
      setTrajectory(
        engine
          .predictTrajectory(body, 80, 0.15)
          .map((p) => mapPosition(Vector3.from(p), settings.compressed)),
      );
      onReadout({
        speed: velocity.current.length(),
        position: position.current.toArray(),
      });
    }
  });
  return (
    <>
      <gridHelper
        args={[40, 40, "#2b4f5b", "#142731"]}
        position={[0, -0.01, 0]}
      />
      <mesh ref={ghost}>
        <sphereGeometry args={[0.1, 24, 16]} />
        <meshBasicMaterial
          color="#9de0db"
          transparent
          opacity={0.5}
          wireframe
        />
      </mesh>
      <arrowHelper
        ref={arrow}
        args={[new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, "#92e1d8"]}
      />
      {trajectory.length > 1 && (
        <Line
          points={trajectory}
          color="#8adad4"
          dashed
          dashSize={0.07}
          gapSize={0.06}
          lineWidth={1}
          transparent
          opacity={0.7}
        />
      )}
    </>
  );
}

function Scene({
  engine,
  selectedId,
  onSelect,
  settings,
  homeToken,
  buildTool,
  onPlace,
  onReadout,
  sceneRevision,
  effects,
  onFrame,
  panelOpen,
  storyMode,
}) {
  const controls = useRef(),
    frameSample = useRef({ frames: 0, elapsed: 0 });
  const [orbitRevision, setOrbitRevision] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setOrbitRevision((n) => n + 1), 1200);
    return () => clearInterval(interval);
  }, []);
  useFrame((_, dt) => {
    engine.update(dt);
    frameSample.current.frames++;
    frameSample.current.elapsed += dt;
    if (frameSample.current.elapsed > 1) {
      onFrame(
        Math.round(frameSample.current.frames / frameSample.current.elapsed),
      );
      frameSample.current = { frames: 0, elapsed: 0 };
    }
  }, -2);
  const bodies = engine.getBodies();
  return (
    <>
      <SpaceBackground />
      <ambientLight intensity={0.25} />
      <hemisphereLight args={["#acc3d9", "#1c1713", 0.42]} />
      {settings.orbits &&
        bodies
          .filter((b) => b.type === "planet")
          .map((body) => (
            <OrbitPath
              key={body.id}
              body={body}
              engine={engine}
              compressed={settings.compressed}
              revision={`${orbitRevision}-${sceneRevision}`}
            />
          ))}
      {settings.habitable && (
        <HabitableZone engine={engine} compressed={settings.compressed} />
      )}
      {bodies.map((body) => (
        <PlanetBody
          key={body.id}
          body={body}
          engine={engine}
          selected={selectedId === body.id}
          onSelect={onSelect}
          settings={settings}
          building={!!buildTool}
        />
      ))}
      {settings.links &&
        bodies
          .filter((b) => b.type === "wormhole")
          .map((body) => {
            const peer = bodies.find(
              (b) =>
                b !== body &&
                b.metadata.wormholeLink === body.metadata.wormholeLink,
            );
            return peer && body.id < peer.id ? (
              <Line
                key={body.id}
                points={[
                  mapPosition(body.position, settings.compressed),
                  mapPosition(peer.position, settings.compressed),
                ]}
                color="#8475c6"
                dashed
                dashSize={0.06}
                gapSize={0.1}
                transparent
                opacity={0.4}
              />
            ) : null;
          })}
      {effects.map((effect) => (
        <Effect
          key={effect.id}
          effect={effect}
          engine={engine}
          compressed={settings.compressed}
        />
      ))}
      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={0.07}
        maxDistance={200}
        enablePan
        zoomSpeed={0.8}
        rotateSpeed={0.6}
      />
      <CameraController
        engine={engine}
        selectedId={selectedId}
        homeToken={homeToken}
        settings={settings}
        controls={controls}
        building={!!buildTool}
        panelOpen={panelOpen}
        storyMode={storyMode}
      />
      {buildTool && (
        <BuildPlacement
          engine={engine}
          type={buildTool}
          settings={settings}
          onPlace={onPlace}
          onReadout={onReadout}
        />
      )}
    </>
  );
}

export default function Universe(props) {
  return (
    <>
      <Canvas
        className={props.buildTool ? "universe placing" : "universe"}
        camera={{ position: [13, 17, 21], fov: 43, near: 0.005, far: 1000 }}
        dpr={props.settings.quality === "high" ? [1, 1.75] : [1, 1.25]}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        }}
        onCreated={({ gl }) => {
          gl.setClearColor("#060a10");
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1;
        }}
      >
        <Scene {...props} />
      </Canvas>
      <LoadingStatus />
    </>
  );
}

function LoadingStatus() {
  const { active, progress } = useProgress();
  return active ? (
    <div className="asset-status" role="status">
      Loading observatory maps · {Math.round(progress)}%
    </div>
  ) : null;
}
