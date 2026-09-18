import { Vector3, G, TAU, EARTH_RADIUS_M, AU_M } from "./PhysicsEngine.js";

export const CHAPTERS = [
  {
    title: "Before the first light",
    era: "01 · SINGULARITY",
    duration: 16,
    caption:
      "A beginning beyond our equations. This abstract scene is an illustration, not a simulation of a cosmological singularity.",
  },
  {
    title: "A universe unfolds",
    era: "02 · INFLATION",
    duration: 20,
    caption:
      "Space expands. This outward-moving particle field illustrates expansion; it does not model spacetime or the Big Bang.",
  },
  {
    title: "The dark ages end",
    era: "03 · FIRST STARS",
    duration: 24,
    caption:
      "Gravity draws matter together. The first stars illuminate the cosmos. These interacting bodies show gravitational clustering at an illustrative scale.",
  },
  {
    title: "The Sun’s first dawn",
    era: "04 · SOLAR NEBULA",
    duration: 24,
    caption:
      "A rotating cloud becomes a disk. Material orbits a young Sun and begins to accrete. Collision radii are enlarged to make formation visible.",
  },
  {
    title: "Worlds in the making",
    era: "05 · PLANET FORMATION",
    duration: 24,
    caption:
      "Growing worlds sweep through a restless disk. Impacts merge some bodies and scatter others; the N-body collision engine drives these encounters.",
  },
  {
    title: "An impact changes Earth",
    era: "06 · THEIA",
    duration: 28,
    caption:
      "A Mars-mass world approaches proto-Earth at an angle. This reduced impact model creates ejecta; it cannot predict the hydrodynamics of Moon formation.",
  },
  {
    title: "Our celestial neighborhood",
    era: "07 · STABILIZATION",
    duration: 22,
    caption:
      "A guided transition to the modern Solar System. These near-circular initial orbits use measured approximate masses and distances, not a dated ephemeris.",
  },
  {
    title: "The universe is yours",
    era: "08 · SANDBOX",
    duration: 16,
    caption:
      "One star. Eight planets. Countless possible futures. Leave the guided sequence and create your own experiment.",
  },
];

export function initializeChapter(engine, index) {
  engine.createScenario(index >= 6 ? "solar" : "empty");
  engine.seed = 442 + index;
  engine.settings.autoFlares = true;
  engine.settings.tides = index >= 6;
  engine.fixedDt = index === 5 ? 1 / 2097152 : 1 / 32768;
  engine.timeScale = index === 5 ? 0.00006 : 0.04;
  engine.paused = false;
  if (index === 0) {
    engine.spawnBody("star", {
      id: "origin",
      name: "First light",
      mass: 1e-8,
      radius: 0.000001,
      metadata: { visualSize: 0.3, color: "#eee4ff", solarActivity: 0.1 },
    });
  } else if (index === 1) {
    engine.gravityMultiplier = 0;
    for (let i = 0; i < 56; i++) {
      const angle = TAU * engine.random(),
        z = engine.random() * 2 - 1,
        direction = new Vector3(
          Math.sqrt(1 - z * z) * Math.cos(angle),
          z,
          Math.sqrt(1 - z * z) * Math.sin(angle),
        );
      engine.spawnBody("asteroid", {
        name: "Primordial matter",
        mass: 1e-12,
        position: direction
          .clone()
          .multiplyScalar(0.01 + engine.random() * 0.2),
        velocity: direction.multiplyScalar(2 + engine.random() * 6),
        collisionMode: "ignore",
        metadata: { visualSize: 0.025, color: i % 3 ? "#a6c9e5" : "#e8bda2" },
      });
    }
  } else if (index === 2) {
    for (let i = 0; i < 30; i++) {
      const angle = TAU * engine.random(),
        r = 0.5 + engine.random() * 2;
      engine.spawnBody("star", {
        name: `Protostar ${i + 1}`,
        mass: 0.003,
        radius: 0.02,
        luminosity: 0.01,
        position: [
          r * Math.cos(angle),
          (engine.random() - 0.5) * 0.5,
          r * Math.sin(angle),
        ],
        velocity: [-Math.sin(angle) * 0.3, 0, Math.cos(angle) * 0.3],
        metadata: { visualSize: 0.05, color: i % 2 ? "#ffd3a0" : "#9bcced" },
      });
    }
  } else if (index === 3 || index === 4) {
    const primary = engine.spawnBody("star", {
      id: "sun",
      name: "Young Sun",
      metadata: { texture: "sun" },
    });
    const belt = engine.spawnBelt({
      primary,
      count: 48,
      inner: 0.5,
      outer: 2.5,
    });
    for (const b of belt) {
      b.mass = 1e-7;
      b.radius = index === 3 ? 0.022 : 0.07;
      b.metadata.visualSize = index === 3 ? 0.025 : 0.06;
      b.collisionMode = index === 3 ? "merge" : "auto";
      b.velocity.multiplyScalar(0.7 + engine.random() * 0.45);
      b.recalculateDensity();
    }
    engine.timeScale = 0.07;
  } else if (index === 5) {
    // Physical Earth/Theia radii and masses; scene coordinates are enlarged 1500×.
    const earth = engine.spawnBody("planet", {
      id: "proto-earth",
      name: "Proto Earth",
      mass: 3.00349e-6,
      radius: EARTH_RADIUS_M / AU_M,
      position: [0, 0, 0],
      collisionMode: "auto",
      metadata: { texture: "earth", visualSize: 0.15, displayScale: 1500 },
    });
    engine.spawnBody("planet", {
      id: "theia",
      name: "Theia",
      mass: 3.2272e-7,
      radius: 3389500 / AU_M,
      position: [0.00055, 0, 0.000025],
      velocity: [-0.45, 0, -0.015],
      metadata: { texture: "mars", visualSize: 0.08, displayScale: 1500 },
    });
    earth.metadata.description =
      "A controlled oblique giant impact. Spatial display scale: 1500×. Ejecta is a reduced particle model.";
  }
  engine.history = [];
  engine.historyIndex = -1;
  engine.recordHistory();
  engine.emit("simulationReset");
  return index === 0 ? "origin" : index === 5 ? "proto-earth" : null;
}
