import { missionCameraOffset } from "../physics/voyager.js";
import { FLARE_DURATION_MS, flareEnvelope } from "./effectTiming.js";
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
import CinematicPostFX from "../cinematic/components/CinematicPostFX.jsx";
import CinematicParticles from "../cinematic/components/CinematicParticles.jsx";
import CinematicShockwave from "../cinematic/components/CinematicShockwave.jsx";
import CinematicWormhole from "../cinematic/components/CinematicWormhole.jsx";
import CinematicAtmosphere from "../cinematic/components/CinematicAtmosphere.jsx";
import CinematicCameraRig from "../cinematic/components/CinematicCameraRig.jsx";
import BlackHoleCinematic from "./BlackHoleCinematic.jsx";
import Endurance from "./Endurance.jsx";
import Voyager from "./Voyager.jsx";
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
  compressedVisualRadius,
  moonOrbitVisualRadius,
  visualRadius,
} from "./coordinates.js";

const textureCache = new Map();
const textureRequests = new Map();
const textureLoaderManager = new THREE.LoadingManager();
const loader = new THREE.TextureLoader(textureLoaderManager);
loader.setCrossOrigin("anonymous");
const voyagerStoryFallback = {
  waypoints: [
    { year: 1977, label: "Earth Launch & Orbital Insertion" },
    { year: 1979, label: "Jupiter Flyby" },
    { year: 1980, label: "Saturn Flyby & Titan Diversion" },
    { year: 2012, label: "Heliopause / Interstellar Space" }
  ],
  display: { presentDistanceAU: 165, presentVelocityKMS: 17 }
};

const NASA_RUNTIME_TEXTURES = Object.freeze({
  mercury: "/cinematic/nasa/textures/Mercury/Mercury.webp",
  venus: "/cinematic/nasa/textures/Venus/Venus.webp",
  earth: "/cinematic/nasa/textures/Earth%20(B)/Earth%20(B).webp",
  moon: "/cinematic/nasa/textures/Moon/Moon.webp",
  mars: "/cinematic/nasa/textures/Mars/Mars.webp",
  jupiter: "/cinematic/nasa/textures/Jupiter/Jupiter.webp",
  saturn: "/cinematic/nasa/textures/Saturn/Saturn.webp",
  uranus: "/cinematic/nasa/textures/Uranus/Uranus.webp",
  neptune: "/cinematic/nasa/textures/Neptune/Neptune.webp",
  io: "/cinematic/nasa/textures/Jupiter%20-%20Io%20(A)/Jupiter%20-%20Io%20(A).webp",
  europa: "/cinematic/nasa/textures/Jupiter%20-%20Europa/Jupiter%20-%20Europa.webp",
  ganymede: "/cinematic/nasa/textures/Jupiter%20-%20Ganymede/Jupiter%20-%20Ganymede.webp",
  titan: "/cinematic/nasa/textures/Saturn%20-%20Titan/Saturn%20-%20Titan.webp",
  rhea: "/cinematic/nasa/textures/Saturn%20-%20Rhea/Saturn%20-%20Rhea.webp",
  dione: "/cinematic/nasa/textures/Saturn%20-%20Dione/Saturn%20-%20Dione.webp",
  enceladus: "/cinematic/nasa/textures/Saturn%20-%20Enceladus/Saturn%20-%20Enceladus.webp",
  starMap: "/cinematic/nasa/textures/Hipparcos%20Star%20Map/Hipparcos%20Star%20Map.webp",
});

const KNOWN_TEXTURE_URLS = Object.freeze({
  sun: "/textures/sun.jpg",
  mercury: "/textures/mercury.jpg",
  venus: "/textures/venus.jpg",
  earth: "/textures/earth.jpg",
  earth_clouds: "/textures/earth_clouds.jpg",
  earth_night: "/textures/earth_night.jpg",
  moon: "/textures/moon.jpg",
  mars: "/textures/mars.jpg",
  jupiter: "/textures/jupiter.jpg",
  saturn: "/textures/saturn.jpg",
  saturn_ring: "/textures/saturn_ring.png",
  uranus: "/textures/uranus.jpg",
  neptune: "/textures/neptune.jpg",
  galaxy: "/textures/galaxy.jpg",
  "blackhole-nasa": "/textures/blackhole-nasa.png",
  "nasa-blackhole-source": "/textures/nasa_blackhole_source.png",
  "nasa-red-giant": "/textures/nasa-presets/nasa-red-giant.png",
});

function textureCandidates(name) {
  if (!name) return [];

  const normalized = String(name).toLowerCase();
  const nasaKey = normalized.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const directNASA = NASA_RUNTIME_TEXTURES[normalized] || NASA_RUNTIME_TEXTURES[nasaKey];
  if (directNASA) return [directNASA];

  if (name.startsWith("nebula:")) {
    const id = name.slice("nebula:".length);
    const item = NEBULA_BACKGROUNDS.find((candidate) => candidate.id === id);
    return item?.url ? [item.url] : [];
  }

  if (KNOWN_TEXTURE_URLS[name]) {
    return [KNOWN_TEXTURE_URLS[name]];
  }

  if (name.startsWith("nasa-surfaces/")) {
    const key = name.slice("nasa-surfaces/").toLowerCase();
    if (NASA_RUNTIME_TEXTURES[key]) return [NASA_RUNTIME_TEXTURES[key]];
    return [`/textures/${name}.jpg`];
  }

  if (name.startsWith("nasa-presets/") || name.startsWith("nasa-")) {
    const base = name.startsWith("nasa-presets/") ? name.slice("nasa-presets/".length) : name;
    return [
      `/textures/nasa-presets/${base}.jpg`,
      `/textures/nasa-presets/${base}.png`,
    ];
  }

  return [
    `/textures/${name}.jpg`,
    `/textures/${name}.png`,
    `/textures/nasa-presets/${name}.jpg`,
    `/textures/nasa-presets/${name}.png`,
  ];
}


const NASA_BODY_TEXTURES = Object.freeze({
  asteroid: "nasa-asteroid",
  planet: "nasa-planet",
  "rogue planet": "nasa-rogue-planet",
  comet: "nasa-comet",
  star: "nasa-star",
  "red giant": "nasa-red-giant",
  "red supergiant": "nasa-red-supergiant",
  "white dwarf": "nasa-white-dwarf",
  "brown dwarf": "nasa-brown-dwarf",
  "neutron star": "nasa-neutron-star",
  magnetar: "nasa-magnetar",
  "dark matter halo": "nasa-dark-matter-halo",
});

const NASA_SURFACE_TEXTURES = Object.freeze({
  Mercury: "nasa-surfaces/mercury",
  mercury: "nasa-surfaces/mercury",

  Venus: "nasa-surfaces/venus",
  venus: "nasa-surfaces/venus",

  Mars: "nasa-surfaces/mars",
  mars: "nasa-surfaces/mars",

  Jupiter: "nasa-surfaces/jupiter",
  jupiter: "nasa-surfaces/jupiter",

  Saturn: "nasa-surfaces/saturn",
  saturn: "nasa-surfaces/saturn",

  Uranus: "nasa-surfaces/uranus",
  uranus: "nasa-surfaces/uranus",

  Neptune: "nasa-surfaces/neptune",
  neptune: "nasa-surfaces/neptune",
});

const BODIES_WITH_SURFACE_MAPS = new Set([
  "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune",
  "nasa-surfaces/mercury", "nasa-surfaces/venus", "nasa-surfaces/mars",
  "nasa-surfaces/jupiter", "nasa-surfaces/saturn", "nasa-surfaces/uranus",
  "nasa-surfaces/neptune",
  "nasa-asteroid", "nasa-planet", "nasa-rogue-planet", "nasa-star",
  "nasa-red-giant", "nasa-red-supergiant", "nasa-white-dwarf",
  "nasa-brown-dwarf", "nasa-neutron-star", "nasa-magnetar",
  "nasa-dark-matter-halo", "nasa-comet"
]);



function registerTextureStatus(name, status, extra = {}) {
  const registry = (window.__EVENT_HORIZON_TEXTURE_STATUS__ ||= {});
  registry[name] = { status, ...extra, time: performance.now() };
}

function loadTexture(name) {
  if (!textureRequests.has(name)) {
    registerTextureStatus(name, "loading");
    textureRequests.set(
      name,
      (async () => {
        for (const url of textureCandidates(name)) {
          try {
            const loaded = await new Promise((resolve, reject) => {
              loader.load(url, resolve, undefined, reject);
            });
            loaded.colorSpace = THREE.SRGBColorSpace;
            loaded.flipY = !name?.startsWith("nebula:");
            loaded.wrapS = THREE.ClampToEdgeWrapping;
            loaded.wrapT = THREE.ClampToEdgeWrapping;
            loaded.anisotropy = 4;
            loaded.needsUpdate = true;
            textureCache.set(name, loaded);
            registerTextureStatus(name, "loaded", { url });
            return loaded;
          } catch {
            // Try the next supported extension without surfacing a browser error.
          }
        }
        registerTextureStatus(name, "missing", { candidates: textureCandidates(name) });
        textureCache.set(name, null);
        return null;
      })(),
    );
  }
  return textureRequests.get(name);
}

// Boot uses the same cache as the first scene render, not just the browser's
// image cache. A failed required asset can be retried from the boot screen.
export async function preloadRequiredTexture(name) {
  if (textureCache.has(name) && !textureCache.get(name)) {
    textureCache.delete(name);
    textureRequests.delete(name);
  }
  const texture = await loadTexture(name);
  if (!texture) throw new Error(`Required texture ${name} failed to load`);
  return texture;
}

function useSafeTexture(name) {
  const [texture, setTexture] = useState(textureCache.get(name) || null);
  useEffect(() => {
    let alive = true;
    if (!name) {
      setTexture(null);
      return undefined;
    }
    if (textureCache.has(name)) {
      setTexture(textureCache.get(name));
      return undefined;
    }
    loadTexture(name).then((loaded) => {
      if (alive) setTexture(loaded);
    });
    return () => {
      alive = false;
    };
  }, [name]);
  return texture;
}

function usePrefersReducedMotion() {
  const get = () =>
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [reduced, setReduced] = useState(get);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(media.matches);
    onChange();
    media.addEventListener?.("change", onChange);
    media.addListener?.(onChange);
    return () => {
      media.removeEventListener?.("change", onChange);
      media.removeListener?.(onChange);
    };
  }, []);
  return reduced;
}

function AnimatedStarLayer({
  count,
  radius,
  size,
  opacity,
  speed,
  seed = 1,
  color = "#bbced9",
  reduced = false,
}) {
  const group = useRef();
  const points = useRef();
  const material = useRef();
  const geometry = useMemo(() => {
    const position = new Float32Array(count * 3);
    let state = seed >>> 0;
    const random = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
    for (let i = 0; i < count; i++) {
      const z = random() * 2 - 1;
      const angle = random() * TAU;
      const r = radius * (0.78 + random() * 0.22);
      position.set(
        [
          r * Math.sqrt(1 - z * z) * Math.cos(angle),
          r * z,
          r * Math.sqrt(1 - z * z) * Math.sin(angle),
        ],
        i * 3,
      );
    }
    return position;
  }, [count, radius, seed]);

  useFrame(({ clock }, dt) => {
    if (!group.current) return;
    if (!reduced) {
      group.current.rotation.y += dt * speed;
      group.current.rotation.x += dt * speed * 0.11;
      if (material.current) {
        // Stable star field: no global opacity oscillation.
        material.current.opacity = opacity;
      }
    } else if (material.current) {
      material.current.opacity = opacity;
    }
  });

  return (
    <group ref={group}>
      <points ref={points}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[geometry, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={material}
          color={color}
          size={size}
          transparent
          opacity={opacity}
          sizeAttenuation
          depthWrite={false}
        />
      </points>
    </group>
  );
}

function CinematicDust({ settings, reduced }) {
  const group = useRef();
  const material = useRef();
  const count = settings.quality === "low" ? 120 : settings.quality === "medium" ? 260 : 520;
  const data = useMemo(() => {
    let state = 9137;
    const random = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const position = new Float32Array(count * 3);
    const phase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const angle = random() * TAU;
      const r = 12 + random() * 85;
      const y = (random() - 0.5) * 38;
      position.set([Math.cos(angle) * r, y, Math.sin(angle) * r], i * 3);
      phase[i] = random() * TAU;
    }
    return { position, phase };
  }, [count]);

  useFrame(({ clock }, dt) => {
    if (!group.current || reduced) return;
    group.current.rotation.y += dt * 0.0025;
    group.current.rotation.z = Math.sin(clock.elapsedTime * 0.035) * 0.015;
    if (material.current) material.current.opacity = 0.065;
  });

  return (
    <points ref={group}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.position, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={material}
        color="#89a6b4"
        size={0.022}
        transparent
        opacity={0.065}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

const NEBULA_BACKGROUNDS = [
  {
    id: "orion",
    name: "Orion Nebula",
    url: "https://science.nasa.gov/wp-content/uploads/2023/04/hubble-nebula-orion-nebula-display-jpg.webp",
    opacity: 0.34,
    rotation: [0.15, -0.35, 0],
  },
  {
    id: "carina",
    name: "Carina Nebula",
    url: "https://science.nasa.gov/wp-content/uploads/2023/04/c92-1-jpg.webp",
    opacity: 0.27,
    rotation: [-0.10, 0.55, 0],
  },
  {
    id: "pillars",
    name: "Pillars of Creation",
    url: "https://assets.science.nasa.gov/dynamicimage/assets/science/missions/webb/outreach/migrated/2022/STScI-01GK2KMYS6HADS6ND8NRHG53RP.png?crop=faces%2Cfocalpoint&fit=clip&h=1872&w=2000",
    opacity: 0.20,
    rotation: [0.08, 0.18, 0],
  },
  {
    id: "ring",
    name: "Ring Nebula",
    url: "https://science.nasa.gov/wp-content/uploads/2023/07/ring-nebula.jpg",
    opacity: 0.24,
    rotation: [0, -0.50, 0.08],
  },
];

function SpaceBackground({ settings, voyagerActive = false, nebulaId = null }) {
  const galaxy = useSafeTexture("galaxy");
  const { scene, camera } = useThree();
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    scene.background = new THREE.Color("#020307");
    scene.backgroundIntensity = 1;
    scene.backgroundBlurriness = 0;

    return () => {
      scene.background = null;
    };
  }, [scene]);

  const nebulaTexture = useSafeTexture(nebulaId ? `nebula:${nebulaId}` : null);

  useFrame(() => {
    const distance = camera.position.length();

    /*
     * The Milky Way is the actual WebGL scene background.
     * It therefore does not depend on a world-space plane being
     * inside the camera frustum.
     */
    const galaxyFade = THREE.MathUtils.smoothstep(
      distance,
      80,
      760,
    );

    const galaxyStrength =
      settings.quality === "high"
        ? 0.92
        : settings.quality === "medium"
          ? 0.80
          : 0.68;
    const galaxyModeMultiplier = voyagerActive ? 0.04 : 1;

    if (nebulaTexture) {
      if (scene.background !== nebulaTexture) {
        scene.background = nebulaTexture;
      }
      scene.backgroundIntensity = 0.62;
      scene.backgroundBlurriness = 0;
    } else if (galaxy) {
      if (scene.background !== galaxy) {
        scene.background = galaxy;
      }

      scene.backgroundIntensity =
        Math.max(
          0,
          galaxyFade *
            galaxyStrength *
            galaxyModeMultiplier *
            1,
        );

      scene.backgroundBlurriness = 0;
    } else {
      if (!scene.background?.isColor) {
        scene.background = new THREE.Color("#020307");
      }

      scene.backgroundIntensity = 1;
      scene.backgroundBlurriness = 0;
    }

    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty(
        "--eh-solar-bg-opacity",
        String((0.48 * (1 - galaxyFade)).toFixed(3)),
      );
    }
  });

  const density =
    settings.quality === "low"
      ? 460
      : settings.quality === "medium"
        ? 920
        : 1500;

  return (
    <group>
      <AnimatedStarLayer
        count={Math.floor(density * 0.5)}
        radius={245}
        size={0.11}
        opacity={0.34}
        speed={0.0015}
        seed={21}
        reduced={reduced}
      />

      <AnimatedStarLayer
        count={Math.floor(density * 0.33)}
        radius={180}
        size={0.19}
        opacity={0.26}
        speed={-0.0022}
        seed={77}
        color="#a5c6d4"
        reduced={reduced}
      />

      <AnimatedStarLayer
        count={Math.floor(density * 0.17)}
        radius={130}
        size={0.28}
        opacity={0.16}
        speed={0.0035}
        seed={131}
        color="#d4b98f"
        reduced={reduced}
      />

      <AnimatedStarLayer
        count={Math.floor(density * 0.12)}
        radius={1200}
        size={0.28}
        opacity={0.075}
        speed={0.00055}
        seed={314}
        color="#8da9c9"
        reduced={reduced}
      />

      <CinematicDust settings={settings} reduced={reduced} />
    </group>
  );
}

const glowVertex = `
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const glowFragment = `
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  uniform vec3 color;
  uniform float strength;
  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    float rim = 1.0 - abs(dot(normalize(vWorldNormal), viewDir));
    float alpha = pow(max(0.0, rim), 2.35) * strength;
    gl_FragColor = vec4(color, alpha);
  }
`;

/*
 * Stable glow implementation.
 *
 * The previous glow was a screen-facing transparent plane. At high zoom it
 * could move between texture/depth samples while Bloom was evaluating the
 * frame, which produced intermittent shimmer. This version is a real shell
 * around the body, does not write depth, is never culled, and never animates
 * unless a caller explicitly opts in with a pulse.
 */
function Glow({ color = "#f3ad65", size = 1, opacity = 0.6, pulse = 0, envelope }) {
  const uniforms = useMemo(
    () => ({
      color: { value: new THREE.Color(color) },
      strength: { value: opacity },
    }),
    [color, opacity],
  );

  const reduced = usePrefersReducedMotion();
  const phase = useMemo(() => 0.37, []);

  useFrame(({ clock }) => {
    if (envelope) {
      uniforms.strength.value = opacity * envelope.current;
      return;
    }
    const target = pulse && !reduced
      ? opacity * (1 + Math.sin(clock.elapsedTime * 1.35 + phase) * pulse)
      : opacity;
    uniforms.strength.value += (target - uniforms.strength.value) * 0.08;
  });

  return (
    <mesh
      scale={size}
      frustumCulled={false}
      renderOrder={20}
      raycast={() => null}
    >
      <sphereGeometry args={[1, 48, 32]} />
      <shaderMaterial
        vertexShader={glowVertex}
        fragmentShader={glowFragment}
        uniforms={uniforms}
        transparent
        side={THREE.FrontSide}
        blending={THREE.AdditiveBlending}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}

function SelectionRing({ radius, selected }) {
  const ref = useRef();
  const reduced = usePrefersReducedMotion();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    if (reduced) {
      ref.current.rotation.z = 0;
      ref.current.scale.setScalar(1);
      return;
    }
    const pulse = selected ? 1 + Math.sin(clock.elapsedTime * 1.9) * 0.035 : 1;
    ref.current.rotation.z = clock.elapsedTime * (selected ? 0.17 : 0.08);
    ref.current.scale.setScalar(pulse);
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
              opacity={selected ? 0.82 : 0.5}
              side={THREE.DoubleSide}
              depthTest={false}
              blending={selected ? THREE.AdditiveBlending : THREE.NormalBlending}
            />
          </mesh>
        ))}
      </group>
    </Billboard>
  );
}

function SaturnRings({ radius }) {
  const group = useRef();
  const reduced = usePrefersReducedMotion();
  useFrame((_, dt) => {
    if (group.current && !reduced) {
      group.current.rotation.z += dt * 0.012;
      group.current.scale.setScalar(1);
    }
  });
  const bands = [
    [1.35, 1.47, "#b6a887", 0.58],
    [1.49, 1.56, "#857963", 0.5],
    [1.59, 1.7, "#ddcba0", 0.64],
    [1.72, 1.79, "#a79a7d", 0.34],
    [1.82, 1.98, "#cdbb91", 0.52],
  ];
  return (
    <group
      ref={group}
      rotation={[-Math.PI / 2, 0, 0]}
      renderOrder={3}
    >
      {bands.map(([inner, outer, color, opacity], i) => (
        <mesh key={i} renderOrder={3 + i}>
          <ringGeometry args={[radius * inner, radius * outer, 128]} />
          <meshStandardMaterial
            color={color}
            transparent
            opacity={opacity}
            roughness={1}
            side={THREE.DoubleSide}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
          />
        </mesh>
      ))}
    </group>
  );
}

const earthNightVertex = `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  void main() {
    vUv = uv;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const earthNightFragment = `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  uniform sampler2D nightMap;
  uniform vec3 sunDirection;
  uniform float opacity;
  void main() {
    float light = dot(normalize(vWorldNormal), normalize(sunDirection));
    float nightMask = 1.0 - smoothstep(-0.10, 0.16, light);
    vec4 sampled = texture2D(nightMap, vUv);
    float alpha = sampled.a * nightMask * opacity;
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(sampled.rgb * 1.55, alpha);
  }
`;

function EarthLayers({ radius, body, engine, settings }) {
  const clouds = useSafeTexture("earth_clouds");
  const night = useSafeTexture("earth_night");
  const nightRef = useRef();
  const cloudRef = useRef();
  const sunDirection = useMemo(() => new THREE.Vector3(1, 0, 0), []);
  const sunWorld = useMemo(() => new THREE.Vector3(), []);
  const earthWorld = useMemo(() => new THREE.Vector3(), []);

  const nightUniforms = useMemo(
    () => ({
      nightMap: { value: night },
      sunDirection: { value: sunDirection.clone() },
      opacity: { value: 0.48 },
    }),
    [night],
  );

  const cloudUniforms = useMemo(
    () => ({
      cloudMap: { value: clouds },
      cloudOpacity: {
        value: settings.quality === "high" ? 0.78 : 0.62,
      },
    }),
    [clouds, settings.quality],
  );

  const reduced = usePrefersReducedMotion();
  useFrame((_, dt) => {
    if (settings.quality === "low") return;
    const sun = engine.bodies.find(
      (candidate) => candidate !== body && isStar(candidate) && candidate.luminosity > 0,
    );
    if (!sun) return;
    sunWorld.set(...bodyPosition(sun, engine, settings.compressed));
    earthWorld.set(...bodyPosition(body, engine, settings.compressed));
    sunDirection.copy(sunWorld).sub(earthWorld).normalize();
    if (nightRef.current?.material?.uniforms?.sunDirection)
      nightRef.current.material.uniforms.sunDirection.value.copy(sunDirection);
    if (!reduced && cloudRef.current) cloudRef.current.rotation.y += dt * 0.008;
    if (nightRef.current?.material?.uniforms?.opacity)
      nightRef.current.material.uniforms.opacity.value = 0.48;
  });

  if (settings.quality === "low") return null;

  return (
    <>
      {night && (
        <mesh ref={nightRef} renderOrder={2}>
          <sphereGeometry args={[radius * 1.008, settings.quality === "medium" ? 40 : 56, settings.quality === "medium" ? 28 : 40]} />
          <shaderMaterial
            uniforms={nightUniforms}
            vertexShader={earthNightVertex}
            fragmentShader={earthNightFragment}
            transparent
            depthTest={true}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.FrontSide}
          />
        </mesh>
      )}
      {clouds && (
        <mesh
          ref={cloudRef}
          renderOrder={4}
          rotation={[0, 0.02, 0]}
          scale={[1.024, 1.024, 1.024]}
        >
          <sphereGeometry
            args={[
              radius,
              settings.quality === "medium" ? 48 : 64,
              settings.quality === "medium" ? 32 : 48,
            ]}
          />

          <shaderMaterial
            transparent
            depthTest={true}
            depthWrite={false}
            side={THREE.FrontSide}
            uniforms={cloudUniforms}
            vertexShader={`
              varying vec2 vCloudUv;

              void main() {
                vCloudUv = uv;

                gl_Position =
                  projectionMatrix *
                  modelViewMatrix *
                  vec4(position, 1.0);
              }
            `}
            fragmentShader={`
              uniform sampler2D cloudMap;
              uniform float cloudOpacity;

              varying vec2 vCloudUv;

              void main() {
                float cloud = texture2D(
                  cloudMap,
                  vCloudUv
                ).r;

                /*
                  NASA's cloud texture is a grayscale
                  cloud-density map.

                  Dark pixels = transparent.
                  Bright pixels = visible cloud.
                */
                cloud = smoothstep(
                  0.18,
                  0.58,
                  cloud
                );

                float alpha =
                  cloud *
                  cloudOpacity;

                if (alpha < 0.025) discard;

                gl_FragColor = vec4(
                  0.96,
                  0.985,
                  1.0,
                  alpha
                );
              }
            `}
          />
        </mesh>
      )}
      {settings.quality !== "low" && (
        <CinematicAtmosphere
          radius={radius}
          color="#79cfff"
          intensity={settings.quality === "high" ? 0.32 : 0.24}
          quality={settings.quality}
          reducedMotion={reduced}
        />
      )}
    </>
  );
}

function BlackHoleVisual({ body, radius, settings, engine }) {
  return (
    <BlackHoleCinematic
      body={body}
      radius={radius}
      settings={settings}
      engine={engine}
    />
  );
}

function ExoticVisual({ body, radius }) {
  const ref = useRef();
  const reduced = usePrefersReducedMotion();
  useFrame(({ clock }, dt) => {
    if (!ref.current || reduced) return;
    ref.current.rotation.y += dt * (body.type === "wormhole" ? 0.6 : 1.2);
    const pulse = 1 + Math.sin(clock.elapsedTime * 1.8) * 0.035;
    ref.current.scale.setScalar(pulse);
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


function EHAtmosphericBands({
  radius,
  textureName,
  settings,
  speed = 0.012,
  opacity = 0.11,
}) {
  const ref = useRef();
  const texture = useSafeTexture(textureName);
  const reduced = usePrefersReducedMotion();

  useFrame((_, dt) => {
    if (!ref.current || reduced) return;

    ref.current.rotation.y += dt * speed;
  });

  if (!texture || settings.quality === "low")
    return null;

  return (
    <mesh
      ref={ref}
      scale={[1.02, 1.02, 1.02]}
      renderOrder={4}
    >
      <sphereGeometry
        args={[
          radius,
          settings.quality === "medium"
            ? 40
            : 56,
          settings.quality === "medium"
            ? 28
            : 40,
        ]}
      />

      <meshStandardMaterial
        map={texture}
        transparent
        opacity={opacity}
        roughness={0.72}
        metalness={0}
        depthWrite={false}
        side={THREE.FrontSide}
      />
    </mesh>
  );
}

function PlanetBody({ body, engine, selected, onSelect, settings, building }) {
  const group = useRef(),
    surface = useRef(),
    deformed = useRef(),
    cometTail = useRef(),
    light = useRef();
  const [hover, setHover] = useState(false);

  const textureName =
    NASA_SURFACE_TEXTURES[body.metadata.texture] ||
    body.metadata.texture ||
    NASA_BODY_TEXTURES[body.type];

  const texture = useSafeTexture(textureName);
  const normalTexture = useSafeTexture(
    textureName ? `${textureName}_normal` : null
  );
  const roughnessTexture = useSafeTexture(
    textureName ? `${textureName}_roughness` : null
  );
  const radius = visualRadius(body),
    star = isStar(body),
    color = body.metadata.color || "#8cb8c7";
  const axis = useMemo(() => new THREE.Vector3(1, 0, 0), []),
    direction = useMemo(() => new THREE.Vector3(), []);
  const reduced = usePrefersReducedMotion();

  // Selective cinematic atmospheric rims.
  // Earth keeps its dedicated EarthLayers system.
  const cinematicAtmosphere =
    body.metadata.texture === "mars"
      ? { color: "#e58a6b", intensity: 0.18 }
      : body.metadata.texture === "neptune"
        ? { color: "#69c9ff", intensity: 0.34 }
        : body.metadata.texture === "uranus"
          ? { color: "#9be8e8", intensity: 0.27 }
          : null;

  useFrame(({ clock }, dt) => {
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
    if (light.current) {
      // Keep the star's actual light steady. Flare energy is represented by
      // the star surface/glow and cinematic effects rather than by a large
      // per-frame point-light jump, which can make bloom visibly shimmer.
      const targetIntensity = 18;
      light.current.intensity = targetIntensity;
    }
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
                }
              }}
              onPointerOut={() => {
                setHover(false);
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
                  map={body.metadata.stellarEvolutionPhase ? null : texture}
                  color={body.metadata.stellarEvolutionPhase ? color : (texture ? "#ffe5bf" : color)}
                  toneMapped={false}
                />
              ) : (
                <meshStandardMaterial
                  map={texture}
                  normalMap={normalTexture || null}
                  normalScale={
                    normalTexture
                      ? [0.34, 0.34]
                      : [0, 0]
                  }
                  roughnessMap={
                    roughnessTexture || null
                  }
                  color={texture ? "#ffffff" : color}
                  roughness={0.82}
                  metalness={0}
                  emissive={color}
                  emissiveIntensity={0.025}
                  transparent={
                    body.type === "dark matter halo" || body.type === "wormhole"
                  }
                  opacity={
                    body.type === "dark matter halo"
                      ? 0.12
                      : body.type === "wormhole"
                        ? 0.12
                        : 1
                  }
                  depthWrite={body.type !== "dark matter halo"}
                />
              )}
              {body.id === "earth" && (
                <EarthLayers
                  radius={radius}
                  body={body}
                  engine={engine}
                  settings={settings}
                />
              )}
            </mesh>
            {body.metadata.texture === "saturn" && (
              <SaturnRings radius={radius} />
            )}
          </group>

          {(body.metadata.texture === "jupiter" ||
            body.metadata.texture === "saturn" ||
            body.metadata.texture === "uranus" ||
            body.metadata.texture === "neptune") && (
            <EHAtmosphericBands
              radius={radius}
              textureName={textureName}
              settings={settings}
              speed={
                body.metadata.texture === "jupiter"
                  ? 0.018
                  : body.metadata.texture === "saturn"
                    ? 0.010
                    : body.metadata.texture === "uranus"
                      ? 0.007
                      : 0.014
              }
              opacity={
                body.metadata.texture === "jupiter"
                  ? 0.13
                  : body.metadata.texture === "saturn"
                    ? 0.10
                    : 0.09
              }
            />
          )}
        </group>
      )}

      {cinematicAtmosphere && settings.quality !== "low" && (
        <CinematicAtmosphere
          radius={radius}
          color={cinematicAtmosphere.color}
          intensity={
            settings.quality === "high"
              ? cinematicAtmosphere.intensity
              : cinematicAtmosphere.intensity * 0.78
          }
          quality={settings.quality}
          reducedMotion={reduced}
        />
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
          {settings.quality !== "low" && (
            <Glow
              color={color}
              size={
                body.id === "sun"
                  ? radius * 0.72
                  : body.type === "red supergiant"
                    ? radius * 1.35
                    : body.type === "red giant"
                      ? radius * 1.45
                      : radius * 1.25
              }
              opacity={
                body.id === "sun"
                  ? 0.075
                  : body.type === "red supergiant"
                    ? 0.14
                    : body.type === "red giant"
                      ? 0.16
                      : 0.18
              }
              pulse={body.metadata.activeSolarFlare ? 0.04 : 0}
            />
          )}
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

function MoonOrbitPath({ body, engine }) {
  const group = useRef();
  const points = useMemo(() => Array.from({ length: 129 }, (_, i) => {
    const angle = (i / 128) * TAU;
    return [Math.cos(angle), 0, Math.sin(angle)];
  }), []);
  const [relative, velocity, normal, up] = useMemo(() => [
    new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(),
    new THREE.Vector3(0, 1, 0),
  ], []);

  useFrame(() => {
    if (!group.current) return;
    const primary = engine.getBody(body.metadata.primaryId);
    group.current.visible = !!primary;
    if (!primary) return;
    // Physics advances at priority -2. Move the guide with its parent in the
    // same frame as the Moon instead of baking Earth's position into vertices.
    group.current.position.set(...mapPosition(primary.position, true));
    group.current.scale.setScalar(moonOrbitVisualRadius(primary));
    relative.copy(body.position).sub(primary.position);
    velocity.copy(body.velocity).sub(primary.velocity);
    normal.crossVectors(relative, velocity);
    if (normal.lengthSq() > 1e-20) {
      group.current.quaternion.setFromUnitVectors(up, normal.normalize());
    }
  });

  return (
    <group ref={group}>
      <Line points={points} color={body.metadata.color || "#536472"}
        lineWidth={0.6} transparent opacity={0.24} renderOrder={12} />
    </group>
  );
}

function OrbitPath(props) {
  return props.body.type === "moon" && props.compressed
    ? <MoonOrbitPath body={props.body} engine={props.engine} />
    : <KeplerOrbitPath {...props} />;
}

function KeplerOrbitPath({ body, engine, compressed, revision }) {
  const points = useMemo(() => {
    const primary = engine.getBody(body.metadata.primaryId || "sun");
    if (!primary || primary === body) return [];

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
      opacity={0.24}
      renderOrder={12}
    />
  ) : null;
}

function HabitableZone({ engine, compressed }) {
  const stars = engine.bodies.filter((b) => b.luminosity > 0.01);
  return (
    <>
      {stars.slice(0, 5).map((star) => {
        const zone = engine.calculateHabitableZone(star),
          factor = (r) => (compressed ? compressedVisualRadius(r) : r);
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

function Effect({ effect, engine, compressed, settings }) {
  const ref = useRef(),
    light = useRef(),
    particles = useRef(),
    core = useRef(),
    shell = useRef(),
    shell2 = useRef(),
    shockwave = useRef(),
    materials = useRef([]),
    started = useRef(performance.now()),
    flareStrength = useRef(0);

  const reduced = usePrefersReducedMotion();
  const flare = effect.type === "solarFlare",
    nova = effect.type === "supernova",
    impactWave = effect.type === "impactWave",
    collision = effect.type === "collision",
    tidal = effect.type === "tidalDisruption",
    radius = effect.radius || 0.25;

  const cinematicShockwave = (() => {
    if (nova) {
      return {
        color: "#fff1cf",
        durationMs: 2900,
        intensity: 1.7,
        scale: 3.2,
      };
    }
    if (tidal) {
      return {
        color: "#a88cff",
        durationMs: 1100,
        intensity: 0.9,
        scale: 1.55,
      };
    }
    if (flare) {
      return null;
    }
    if (impactWave) {
      return {
        color: "#a9e7ef",
        durationMs: 1000,
        intensity: 0.85,
        scale: 1.35,
      };
    }
    if (collision) {
      return {
        color: "#d9f7ff",
        durationMs: 800,
        intensity: 0.55,
        scale: 0.9,
      };
    }
    return null;
  })();

  const PARTICLE_COUNT = nova ? 160 : 64;
  const particlePositions = useMemo(
    () => new Float32Array(PARTICLE_COUNT * 3),
    [PARTICLE_COUNT],
  );
  const particleDirections = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => {
        const u = (i + 0.5) / PARTICLE_COUNT;
        const z = 1 - 2 * u;
        const angle = i * 2.399963229728653;
        const s = Math.sqrt(Math.max(0, 1 - z * z));
        return new THREE.Vector3(
          s * Math.cos(angle),
          z,
          s * Math.sin(angle),
        );
      }),
    [PARTICLE_COUNT],
  );

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

    const age = (performance.now() - started.current) / 1000;
    const duration = flare ? FLARE_DURATION_MS / 1000 : nova ? 3.15 : 3;
    const t = reduced ? 1 : THREE.MathUtils.clamp(age / duration, 0, 1);
    flareStrength.current = reduced ? 0 : flareEnvelope(age * 1000);

    const star = engine.getBody(effect.bodyId);
    const position = star
      ? mapPosition(star.position, compressed)
      : mapPosition(effect.position, compressed);

    ref.current.position.set(...position);
    ref.current.visible = age <= duration;

    if (nova) {
      // Three-stage supernova: violent stellar swelling -> collapse/flash -> expanding ejecta.
      const growth = THREE.MathUtils.smootherstep(t, 0.02, 0.48);
      const burst = THREE.MathUtils.smootherstep(t, 0.40, 0.68);
      const expansion = THREE.MathUtils.smootherstep(t, 0.50, 1);
      const fade = 1 - THREE.MathUtils.smoothstep(t, 0.68, 1);

      const swollen = THREE.MathUtils.lerp(0.75, 7.5, growth);
      const collapse = THREE.MathUtils.lerp(7.5, 0.22, burst);
      const coreScale = t < 0.48 ? swollen : collapse;

      if (core.current) {
        core.current.scale.setScalar(coreScale);
        core.current.rotation.x += 0.035;
        core.current.rotation.y += 0.052;
        core.current.rotation.z += 0.021;
      }

      if (shell.current) {
        const s = THREE.MathUtils.lerp(0.5, 1 + expansion * 13, expansion);
        shell.current.scale.setScalar(s);
        shell.current.rotation.y += 0.008;
        shell.current.rotation.z -= 0.005;
      }

      if (shell2.current) {
        const s = THREE.MathUtils.lerp(0.25, 1 + expansion * 9, expansion);
        shell2.current.scale.setScalar(s);
        shell2.current.rotation.x -= 0.006;
      }

      if (shockwave.current) {
        shockwave.current.scale.setScalar(
          THREE.MathUtils.lerp(0.08, 1 + expansion * 18, expansion),
        );
        shockwave.current.material.opacity =
          Math.sin(Math.min(1, expansion) * Math.PI) * 0.8 * fade;
      }

      if (particles.current && settings.quality !== "low") {
        const positions = particles.current.geometry.attributes.position;
        const travel = THREE.MathUtils.lerp(0.2, 16, expansion);
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const d = particleDirections[i];
          const turbulence =
            1 +
            Math.sin(i * 4.7 + age * 8) * 0.08 +
            Math.sin(i * 1.91 + age * 13) * 0.04;
          const dist =
            radius *
            travel *
            turbulence *
            (0.55 + ((i * 17) % 23) / 23);
          positions.setXYZ(
            i,
            d.x * dist,
            d.y * dist,
            d.z * dist,
          );
        }
        positions.needsUpdate = true;
      }

      if (materials.current[0])
        materials.current[0].opacity =
          Math.max(0, 1 - expansion * 0.75) * (0.55 + burst * 0.45);
      if (materials.current[1])
        materials.current[1].opacity = 0.08 + burst * 0.42 + expansion * 0.05;
      if (materials.current[6])
        materials.current[6].opacity = Math.max(0, expansion * fade) * 0.95;

      if (light.current) {
        const flash = Math.pow(Math.max(0, 1 - t / 0.72), 2);
        light.current.intensity =
          3 + flash * 95 + expansion * 5 * fade;
      }
    } else {
      /*
       * Solar-flare visuals must expand and fade once.
       * The previous sine-based scale returned to its starting size at the
       * end of the flare, which could read as a blink when Bloom/Glow was
       * composited over the Sun. Keep the flare monotonic: one expansion,
       * one fade, no oscillation.
       */
      const flareProgress = THREE.MathUtils.smootherstep(t, 0, 1);
      ref.current.scale.setScalar(
        flare
          ? 1 + flareProgress * 0.55
          : 0.1 + t * 3,
      );

      materials.current.forEach((m, i) => {
        if (!m) return;
        const fade = flare ? flareStrength.current : Math.pow(Math.max(0, 1 - t), 0.72);
        m.opacity = fade * (i === 1 ? 0.12 : 0.8);
      });

      if (particles.current && settings.quality !== "low") {
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
        light.current.intensity = flare ? flareStrength.current * 2 : Math.max(0, (1 - t) * 7);
    }
  });

  return (
    <group ref={ref}>
      {cinematicShockwave && !reduced && (
        <CinematicShockwave
          key={`shockwave-${effect.id}`}
          position={[0, 0, 0]}
          color={cinematicShockwave.color}
          durationMs={cinematicShockwave.durationMs}
          intensity={cinematicShockwave.intensity}
        />
      )}

      {nova ? (
        <>
          <mesh ref={core}>
            <icosahedronGeometry args={[radius * 0.58, 4]} />
            <meshBasicMaterial
              color="#fff7dc"
              transparent
              opacity={0.98}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>

          <mesh ref={shell} scale={0.01}>
            <sphereGeometry args={[radius * 0.72, 32, 24]} />
            <meshBasicMaterial
              ref={(m) => (materials.current[0] = m)}
              color="#ff9d55"
              transparent
              opacity={0.7}
              depthWrite={false}
              side={THREE.BackSide}
              blending={THREE.AdditiveBlending}
            />
          </mesh>

          <mesh ref={shell2} scale={0.01}>
            <sphereGeometry args={[radius * 1.05, 28, 20]} />
            <meshBasicMaterial
              color="#ffdf9a"
              transparent
              opacity={0.3}
              depthWrite={false}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
            />
          </mesh>

          <mesh ref={shockwave}>
            <sphereGeometry args={[radius * 0.9, 32, 20]} />
            <meshBasicMaterial
              color="#ffe5b8"
              transparent
              opacity={0}
              depthWrite={false}
              side={THREE.BackSide}
              blending={THREE.AdditiveBlending}
            />
          </mesh>

          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[radius * 1.5, radius * 0.045, 8, 96]} />
            <meshBasicMaterial
              color="#fff0ca"
              transparent
              opacity={0.7}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </>
      ) : flare ? (
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
          <Glow size={radius * 3} color="#ffb666" opacity={0.12} envelope={flareStrength} />
        </group>
      ) : (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius * 2, radius * 0.035, 8, 96]} />
          <meshBasicMaterial
            ref={(m) => (materials.current[0] = m)}
            color="#ed9862"
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}

      {!nova && (
        <mesh>
          <sphereGeometry args={[radius * 2, 24, 16]} />
          <meshBasicMaterial
            ref={(m) => (materials.current[1] = m)}
            color="#ffd9a3"
            transparent
            opacity={0.08}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}

      {settings.quality !== "low" && (
        <points ref={particles}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[particlePositions, 3]}
            />
          </bufferGeometry>
          <pointsMaterial
            ref={(m) => (materials.current[6] = m)}
            color={nova ? "#ffd8a1" : "#ffcc8b"}
            size={radius * (nova ? 0.045 : 0.05)}
            sizeAttenuation
            transparent
            opacity={0.8}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      )}

      <pointLight
        ref={light}
        color={nova ? "#fff0c4" : "#ffc59a"}
        distance={nova ? 45 : 5}
      />
    </group>
  );
}

const VOYAGER_DISPLAY_WAYPOINTS = [
  [4.6, 0.3, 0.0],   // 1977: launch
  [9.6, 0.8, -0.6],  // 1979: Jupiter
  [14.8, 1.2, -1.5], // 1980: Saturn
  [22, 1.8, -3],     // 1990: Pale Blue Dot
  [31, 2.6, -5.8],   // 2012: heliopause
  [38, 3.4, -7],     // present
  [46, 4.2, -9],     // continued outward journey
];

function sampleVoyagerDisplayPosition(progress = 0) {
  const p = THREE.MathUtils.clamp(progress, 0, 1);
  const scaled = p * (VOYAGER_DISPLAY_WAYPOINTS.length - 1);
  const index = Math.min(
    VOYAGER_DISPLAY_WAYPOINTS.length - 2,
    Math.floor(scaled),
  );
  const local = THREE.MathUtils.smoothstep(scaled - index, 0, 1);
  const a = VOYAGER_DISPLAY_WAYPOINTS[index];
  const b = VOYAGER_DISPLAY_WAYPOINTS[index + 1];

  return a.map((v, i) => THREE.MathUtils.lerp(v, b[i], local));
}

function voyagerDisplayPosition(_body, progress = 0) {
  return sampleVoyagerDisplayPosition(progress);
}

function voyagerProgressTangent(progress = 0) {
  const a = sampleVoyagerDisplayPosition(Math.max(0, progress - 0.002));
  const b = sampleVoyagerDisplayPosition(Math.min(1, progress + 0.002));
  return new THREE.Vector3(...b).sub(new THREE.Vector3(...a)).normalize();
}

function VoyagerJourneyContext({ progress = 0 }) {
  const markers = [
    { label: "EARTH", position: VOYAGER_DISPLAY_WAYPOINTS[0], size: 0.16, color: "#79b7d8" },
    { label: "JUPITER", position: VOYAGER_DISPLAY_WAYPOINTS[1], size: 0.28, color: "#d6b98a" },
    { label: "SATURN", position: VOYAGER_DISPLAY_WAYPOINTS[2], size: 0.24, color: "#d9caa5" },
    { label: "INTERSTELLAR", position: VOYAGER_DISPLAY_WAYPOINTS[4], size: 0.14, color: "#9be5df" },
  ];

  return (
    <group>
      <Line
        points={VOYAGER_DISPLAY_WAYPOINTS}
        color="#83c9c7"
        transparent
        opacity={0.18}
        lineWidth={1}
        dashed
        dashSize={0.18}
        gapSize={0.14}
      />
      {markers.map((marker, index) => (
        <group key={marker.label} position={marker.position}>
          <mesh>
            <sphereGeometry args={[marker.size, 20, 14]} />
            <meshBasicMaterial
              color={marker.color}
              transparent
              opacity={index === 3 ? 0.22 : 0.42}
              depthWrite={false}
            />
          </mesh>
          <Html
            position={[marker.size * 1.8, marker.size * 1.8, 0]}
            distanceFactor={9}
            style={{
              color: marker.color,
              fontFamily: "IBM Plex Mono, monospace",
              fontSize: "9px",
              letterSpacing: "0.14em",
              opacity: index === 3 ? 0.55 : 0.72,
              pointerEvents: "none",
              whiteSpace: "nowrap",
            }}
          >
            {marker.label}
          </Html>
        </group>
      ))}
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
  effects = [],
  enduranceFocused = false,
  voyagerActive = false,
  voyagerProgress = 0,
  nebulaId = null,
}) {
  const { camera, size } = useThree();
  const target = useRef(new THREE.Vector3()),
    desired = useRef(new THREE.Vector3()),
    offset = useRef(new THREE.Vector3()),
    previous = useRef(new THREE.Vector3()),
    moving = useRef(true),
    focused = useRef(null),
    focusPulse = useRef(1),
    positionVelocity = useRef(new THREE.Vector3()),
    targetVelocity = useRef(new THREE.Vector3()),
    temp = useMemo(() => new THREE.Vector3(), []),
    right = useMemo(() => new THREE.Vector3(), []),
    up = useMemo(() => new THREE.Vector3(), []),
    userZoomed = useRef(false),
    navigationDive = useRef(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const onTransition = (event) => {
      const detail = event.detail || {};
      if (detail.type !== "camera-dive") return;
      if (detail.phase === "out") {
        const orbit = controls.current;
        const distance = Math.max(1, camera.position.distanceTo(orbit?.target || target.current));
        navigationDive.current = {
          phase: "out",
          startedAt: performance.now(),
          serial: detail.nonce,
          base: camera.position.clone(),
          amount: THREE.MathUtils.clamp(distance * 0.09, 0.65, 2.8),
        };
      } else if (detail.phase === "in" && navigationDive.current) {
        navigationDive.current.phase = "in";
        navigationDive.current.startedAt = performance.now();
      } else if (detail.phase === "idle") {
        navigationDive.current = null;
      }
    };
    window.addEventListener("event-horizon:transition", onTransition);
    return () => window.removeEventListener("event-horizon:transition", onTransition);
  }, [camera]);

  useEffect(() => {
    moving.current = true;
    userZoomed.current = false;
    focused.current = selectedId;
    focusPulse.current = reduced ? 0 : 1;
    positionVelocity.current.set(0, 0, 0);
    targetVelocity.current.set(0, 0, 0);
    previous.current.set(0, 0, 0);
  }, [selectedId, homeToken, settings.compressed, size.width, size.height, reduced, enduranceFocused, voyagerActive]);

  useEffect(() => {
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

  useEffect(() => {
    const orbit = controls.current;
    if (!orbit?.domElement) return undefined;

    const onWheel = () => {
      userZoomed.current = true;
      moving.current = false;
      positionVelocity.current.set(0, 0, 0);
      targetVelocity.current.set(0, 0, 0);
    };

    orbit.domElement.addEventListener("wheel", onWheel, { passive: true });
    return () => orbit.domElement.removeEventListener("wheel", onWheel);
  }, []);

  useFrame((state, dt) => {
    const orbit = controls.current;
    if (!orbit) return;

    const body = engine.getBody(selectedId);
    const voyager = engine.getBody("voyager-1");
    if (voyagerActive && voyager) {
      target.current.set(...sampleVoyagerDisplayPosition(voyagerProgress));
      offset.current.set(...missionCameraOffset(voyagerProgress));
      orbit.minDistance = 0.35;
    } else if (enduranceFocused) {
      target.current.set(150, 20, -100);
      offset.current.set(8.5, 5.2, 11.5);
      orbit.minDistance = 0.5;
    } else if (body) {
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
      orbit.minDistance = Math.max(r * 1.85, 0.35);
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

    if (voyagerActive && voyager) {
      // Mission playback continuously drives both the target and camera.
      // Do not let the ordinary Solar-System focus state fight the journey.
      const voyagerDesired = desired.current.copy(target.current).add(offset.current);
      const cameraFollow = reduced ? 1 : 1 - Math.exp(-dt * 3.8);
      const targetFollow = reduced ? 1 : 1 - Math.exp(-dt * 5.5);

      camera.position.lerp(voyagerDesired, cameraFollow);
      orbit.target.lerp(target.current, targetFollow);
      camera.lookAt(orbit.target);
      moving.current = true;
      userZoomed.current = false;
      positionVelocity.current.set(0, 0, 0);
      targetVelocity.current.set(0, 0, 0);
    } else if (moving.current) {
      const stiffness = reduced ? 999 : 24;
      const damping = reduced ? 999 : 9.5;
      focusPulse.current = Math.max(0, focusPulse.current - dt * (reduced ? 8 : 2.8));
      const approach = 1 + focusPulse.current * 0.08;
      desired.current.copy(target.current).addScaledVector(offset.current, approach);

      if (!userZoomed.current) {
        temp.copy(desired.current).sub(camera.position);
        positionVelocity.current.addScaledVector(temp, stiffness * dt);
        positionVelocity.current.multiplyScalar(Math.exp(-damping * dt));
        camera.position.addScaledVector(positionVelocity.current, dt);
      } else {
        positionVelocity.current.set(0, 0, 0);
      }

      temp.copy(target.current).sub(orbit.target);
      targetVelocity.current.addScaledVector(temp, stiffness * dt);
      targetVelocity.current.multiplyScalar(Math.exp(-damping * dt));
      orbit.target.addScaledVector(targetVelocity.current, dt);

      if (
        (!userZoomed.current &&
          camera.position.distanceTo(desired.current) < 0.012 &&
          positionVelocity.current.lengthSq() < 0.00004) ||
        userZoomed.current
      ) {
        moving.current = false;
        positionVelocity.current.set(0, 0, 0);
        targetVelocity.current.set(0, 0, 0);
      }
    }

    orbit.enabled = !building && !voyagerActive;

    if (navigationDive.current && !reduced) {
      const dive = navigationDive.current;
      const age = performance.now() - dive.startedAt;
      const phaseDuration = dive.phase === "out" ? 360 : 460;
      const p = THREE.MathUtils.clamp(age / phaseDuration, 0, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      camera.getWorldDirection(temp).normalize();

      if (dive.phase === "out") {
        camera.position.copy(dive.base).addScaledVector(temp, dive.amount * eased);
      } else {
        camera.position.lerp(dive.base, eased);
        if (p >= 1) navigationDive.current = null;
      }
    }

    orbit.update();

    const recent = effects.findLast((effect) => effect.type !== "solarFlare");
    if (recent) {
      const age = (Date.now() - recent.at) / 1000;
      const duration = 1.0;
      if (age >= 0 && age < duration && !reduced) {
        const envelope = Math.pow(1 - age / duration, 2);
        const intensity =
          recent.type === "supernova" ? 0.065 : recent.type === "solarFlare" ? 0.018 : 0.032;
        const n1 = Math.sin(state.clock.elapsedTime * 72.0) * envelope * intensity;
        const n2 = Math.cos(state.clock.elapsedTime * 61.0) * envelope * intensity * 0.7;
        right.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
        up.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
        camera.position.addScaledVector(right, n1);
        camera.position.addScaledVector(up, n2);
      }
    }

    previous.current.copy(target.current);
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
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", cancel);
    gl.domElement.addEventListener("contextmenu", cancel);
    return () => {
      gl.domElement.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", cancel);
      gl.domElement.removeEventListener("contextmenu", cancel);
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
        args={[600, 120, "#2b4f5b", "#142731"]}
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

function ScreenCinematicFX({ effects, settings }) {
  const group = useRef();
  const flash = useRef();
  const ring = useRef();
  const red = useRef();
  const cyan = useRef();
  const blue = useRef();
  const { camera, size } = useThree();
  const reduced = usePrefersReducedMotion();
  const direction = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }) => {
    if (!group.current) return;
    camera.getWorldDirection(direction);
    group.current.position.copy(camera.position).addScaledVector(direction, 1.0);
    group.current.quaternion.copy(camera.quaternion);
    const height = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
    const width = height * (size.width / Math.max(size.height, 1));
    group.current.scale.set(width / 2, height / 2, 1);

    const latest = effects.findLast((effect) => effect.type !== "solarFlare");
    const age = latest ? Math.max(0, (Date.now() - latest.at) / 1000) : 999;
    const duration = latest?.type === "supernova" ? 3.15 : 1.05;
    if (!latest || age >= duration || reduced) {
      if (flash.current) flash.current.material.opacity = reduced ? 0 : 0;
      if (ring.current) ring.current.material.opacity = 0;
      if (red.current) red.current.material.opacity = 0;
      if (cyan.current) cyan.current.material.opacity = 0;
      if (blue.current) blue.current.material.opacity = 0;
      return;
    }

    const t = age / duration;
    const impact =
      latest.type === "supernova" ? 1 :
      latest.type === "solarFlare" ? 0.48 :
      latest.type === "tidalDisruption" ? 0.68 : 0.62;
    const flashAmount = Math.pow(Math.max(0, 1 - t * 2.6), 2) * impact * 0.18;
    const wave = Math.min(1.6, 0.15 + THREE.MathUtils.smootherstep(t, 0, 0.92) * 1.75);
    const ringOpacity = Math.sin(Math.min(1, t) * Math.PI) * (1 - t * 0.35) * impact * 0.38;
    const aberration = Math.sin(Math.min(1, t) * Math.PI) * impact * 0.018;

    if (flash.current) flash.current.material.opacity = flashAmount;
    if (ring.current) {
      ring.current.scale.setScalar(wave);
      ring.current.material.opacity = ringOpacity;
    }
    if (red.current) {
      red.current.position.x = aberration * -1.2;
      red.current.material.opacity = aberration;
    }
    if (cyan.current) {
      cyan.current.position.x = aberration;
      cyan.current.material.opacity = aberration;
    }
    if (blue.current) {
      blue.current.position.x = aberration * 0.7;
      blue.current.material.opacity = aberration * 0.8;
    }
  });

  return (
    <group ref={group} renderOrder={999}>
      <mesh ref={flash}>
        <planeGeometry args={[2, 2]} />
        <meshBasicMaterial
          color="#f7e5c6"
          transparent
          opacity={0}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh ref={ring} position={[0, 0, 0.01]}>
        <ringGeometry args={[0.28, 0.292, 96]} />
        <meshBasicMaterial
          color="#a8e4e5"
          transparent
          opacity={0}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh ref={red} position={[0, 0, -0.01]}>
        <planeGeometry args={[2.02, 2.02]} />
        <meshBasicMaterial
          color="#ff5f67"
          transparent
          opacity={0}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh ref={cyan} position={[0, 0, -0.012]}>
        <planeGeometry args={[2, 2]} />
        <meshBasicMaterial
          color="#6fe9ff"
          transparent
          opacity={0}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh ref={blue} position={[0, 0, -0.014]}>
        <planeGeometry args={[2.01, 2.01]} />
        <meshBasicMaterial
          color="#8a7dff"
          transparent
          opacity={0}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

function BlackHoleCinematicSystem({ engine, settings, reducedMotion }) {
  const { camera } = useThree();
  const state = useRef({ startedAt: 0, phase: "idle", nonce: 0 });
  const scratch = useMemo(() => ({
    point: new THREE.Vector3(),
    tangent: new THREE.Vector3(),
  }), []);

  useEffect(() => {
    const onTransition = (event) => {
      const detail = event.detail || {};
      if (detail.type !== "black-hole") return;
      state.current = {
        startedAt: performance.now(),
        phase: detail.phase || "idle",
        nonce: detail.nonce ?? 0,
      };
    };
    window.addEventListener("event-horizon:transition", onTransition);
    return () => window.removeEventListener("event-horizon:transition", onTransition);
  }, []);

  useFrame(({ clock }, dt) => {
    let nearest = null;
    let nearestDistance = Infinity;
    for (const body of engine.bodies) {
      if (body.type !== "black hole" || !body.active || !body.enabled) continue;
      scratch.point.set(...bodyPosition(body, engine, settings.compressed));
      const distance = scratch.point.distanceTo(camera.position);
      if (distance < nearestDistance) {
        nearest = body;
        nearestDistance = distance;
      }
    }

    const proximity = nearest
      ? THREE.MathUtils.smoothstep(THREE.MathUtils.clamp(1 - nearestDistance / 32, 0, 1), 0, 1)
      : 0;
    const transitionActive = state.current.phase !== "idle";
    const age = performance.now() - state.current.startedAt;
    const transitionStrength = transitionActive
      ? Math.sin(THREE.MathUtils.clamp(age / 1100, 0, 1) * Math.PI)
      : 0;

    window.__EVENT_HORIZON_BLACK_HOLE_CINEMATIC__ = {
      active: !!nearest,
      bodyId: nearest?.id || null,
      distance: nearestDistance,
      proximity,
      transitionStrength,
      lensing: THREE.MathUtils.clamp(proximity * 1.2 + transitionStrength * 0.7, 0, 1),
      reducedMotion,
      time: clock.elapsedTime,
    };

    if (!nearest || reducedMotion || proximity < 0.14) return;

    const target = bodyPosition(nearest, engine, settings.compressed);
    scratch.point.copy(camera.position).sub(target).normalize();
    scratch.tangent.set(-scratch.point.z, 0, scratch.point.x);
    if (scratch.tangent.lengthSq() > 0.0001) {
      scratch.tangent.normalize();
      camera.position.addScaledVector(
        scratch.tangent,
        Math.sin(clock.elapsedTime * 0.35) * dt * proximity * 0.04
      );
    }
  });

  useEffect(() => () => {
    delete window.__EVENT_HORIZON_BLACK_HOLE_CINEMATIC__;
  }, []);

  return null;
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
  enduranceVisible = true,
  enduranceFocused = false,
  onEnduranceFocus,
  voyagerActive = false,
  voyagerProgress = 0,
  nebulaId = null,
}) {
  const reducedMotion = usePrefersReducedMotion();
  const cinematicIntensity = Math.min(
    1,
    effects.reduce((max, effect) => {
      // Routine flares stay local to their star, without changing the entire
      // scene's bloom, grain, or chromatic aberration on every event.
      if (effect.type === "solarFlare") return max;
      const weight =
        effect.type === "supernova"
          ? 1
          : effect.type === "tidalDisruption"
            ? 0.85
            : effect.type === "solarFlare"
              ? 0.7
              : effect.type === "impactWave"
                ? 0.65
                : effect.type === "collision"
                  ? 0.55
                  : 0.35;
      return Math.max(max, weight);
    }, 0),
  );

  const controls = useRef(),
    frameSample = useRef({ frames: 0, elapsed: 0 });
  const [orbitRevision, setOrbitRevision] = useState(0);
  const [cameraInteracting, setCameraInteracting] = useState(false);

  // Bloom/chromatic aberration can shimmer on high-frequency textures while
  // the camera is actively changing scale/orientation. Disable only the
  // post-processing stage during the gesture; the actual 3D scene keeps
  // rendering normally. Re-enable shortly after the gesture ends.
  useEffect(() => {
    const orbit = controls.current;
    if (!orbit) return undefined;

    let reenableTimer = null;

    const onStart = () => {
      if (reenableTimer) {
        clearTimeout(reenableTimer);
        reenableTimer = null;
      }
      setCameraInteracting(true);
    };

    const onEnd = () => {
      if (reenableTimer) clearTimeout(reenableTimer);
      reenableTimer = setTimeout(() => {
        reenableTimer = null;
        setCameraInteracting(false);
      }, 140);
    };

    orbit.addEventListener?.("start", onStart);
    orbit.addEventListener?.("end", onEnd);

    return () => {
      if (reenableTimer) clearTimeout(reenableTimer);
      orbit.removeEventListener?.("start", onStart);
      orbit.removeEventListener?.("end", onEnd);
    };
  }, []);
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
  const voyagerBody = engine.getBody("voyager-1");
  return (
    <>
      <Endurance visible={enduranceVisible} onFocus={onEnduranceFocus} />
            <SpaceBackground settings={settings} voyagerActive={voyagerActive} nebulaId={nebulaId} />

      {!voyagerActive && (
        <CinematicParticles
          quality={settings.quality === "high" ? "medium" : "low"}
          radius={80}
          reducedMotion={reducedMotion}
        />
      )}

      <BlackHoleCinematicSystem
        engine={engine}
        settings={settings}
        reducedMotion={reducedMotion}
      />

      <ambientLight intensity={0.25} />
      <hemisphereLight args={["#acc3d9", "#1c1713", 0.42]} />
      {!voyagerActive && settings.orbits &&
        bodies
          .filter((b) => b.type === "planet" || b.type === "moon")
          .map((body) => (
            <OrbitPath
              key={body.id}
              body={body}
              engine={engine}
              compressed={settings.compressed}
              revision={`${orbitRevision}-${sceneRevision}`}
            />
          ))}
      {!voyagerActive && settings.habitable && (
        <HabitableZone engine={engine} compressed={settings.compressed} />
      )}
      {!voyagerActive && bodies.map((body) => (
        body.id === "voyager-1" ? null : <PlanetBody
          key={body.id}
          body={body}
          engine={engine}
          selected={selectedId === body.id}
          onSelect={onSelect}
          settings={settings}
          building={!!buildTool}
        />
      ))}
      {voyagerActive && <VoyagerJourneyContext progress={voyagerProgress} />}
      {voyagerActive && engine.getBody("voyager-1") && (
        <Voyager
          mission={voyagerStoryFallback}
          active
          progress={voyagerProgress}
          position={sampleVoyagerDisplayPosition(voyagerProgress)}
          selected={selectedId === "voyager-1"}
          visible
          scale={0.72}
          onClick={(e) => { e.stopPropagation(); onSelect("voyager-1"); }}
        />
      )}
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
          settings={settings}
        />
      ))}
      <fog attach="fog" args={["#060a10", settings.quality === "high" ? 130 : settings.quality === "medium" ? 105 : 85, 520]} />
      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={0.07}
        maxDistance={5000}
        enablePan
        enableZoom
        zoomSpeed={2.5}
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
        effects={effects}
        enduranceFocused={enduranceFocused}
        voyagerActive={voyagerActive}
        voyagerProgress={voyagerProgress}
      />
      <CinematicCameraRig />
      <ScreenCinematicFX effects={effects} settings={settings} />

      <CinematicPostFX
        engine={engine}
        settings={settings}
        quality={settings.quality}
        intensity={cinematicIntensity}
        reducedMotion={reducedMotion}
        enabled={settings.quality === "high" || (settings.quality === "medium" && settings.lensing)}
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
        style={{ touchAction: props.buildTool ? "none" : "auto" }}
        camera={{ position: [13, 17, 21], fov: 43, near: 0.2, far: 5000 }}
        dpr={
          props.settings.quality === "high"
            ? [1, 1.75]
            : props.settings.quality === "medium"
              ? [1, 1.25]
              : [0.75, 1]
        }
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: "high-performance",
          logarithmicDepthBuffer: false,
        }}
        onCreated={({ gl }) => {
          gl.setClearColor("#060a10");
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = props.settings.quality === "high" ? 1.04 : 0.98;
          gl.outputColorSpace = THREE.SRGBColorSpace;
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
