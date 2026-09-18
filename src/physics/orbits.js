import { Vector3 } from "./Vector3.js";
import { CelestialBody } from "./CelestialBody.js";
import { G, TAU, AU_M, clamp } from "./constants.js";

/**
 * Calculates standard Keplerian orbital elements for a two-body pair in the XZ reference plane.
 */
export function calculateOrbitalElements(body, primary, gravityMultiplier = 1) {
  if (!body || !primary || body === primary) return null;
  const r = body.position.clone().sub(primary.position);
  const v = body.velocity.clone().sub(primary.velocity);
  const distance = r.length();
  const mu = G * gravityMultiplier * (body.mass + primary.mass);
  if (distance <= 0 || mu <= 0) return null;

  const h = r.clone().cross(v);
  const energy = v.lengthSq() / 2 - mu / distance;
  const e = v
    .clone()
    .cross(h)
    .divideScalar(mu)
    .sub(r.clone().divideScalar(distance))
    .length();
  const semiMajorAxis =
    Math.abs(energy) < 1e-15 ? Infinity : -mu / (2 * energy);

  return {
    semiMajorAxis,
    eccentricity: e,
    period: energy < 0 ? TAU * Math.sqrt(semiMajorAxis ** 3 / mu) : Infinity,
    specificOrbitalEnergy: energy,
    periapsis: h.lengthSq() / mu / (1 + e),
    apoapsis: energy < 0 ? semiMajorAxis * (1 + e) : Infinity,
    inclination: h.length()
      ? (Math.acos(clamp(-h.y / h.length(), -1, 1)) * 180) / Math.PI
      : 0,
    bound: energy < 0,
  };
}

/**
 * Integrates a test particle in an instantaneous frozen N-body field using Velocity Verlet.
 */
export function predictTrajectory(
  data,
  sources = [],
  steps = 96,
  horizon = 0.3,
  softening = 1e-8,
  gravityMultiplier = 1,
) {
  const b =
    data instanceof CelestialBody ? data.clone() : new CelestialBody(data);
  const result = [b.position.toArray()];
  const dt = horizon / clamp(steps, 2, 256);
  const activeSources = sources.filter(
    (s) => s.id !== b.id && s.enabled && s.active,
  );

  const acceleration = (position) => {
    const a = new Vector3();
    for (const s of activeSources) {
      const d = s.position.clone().sub(position);
      const r2 =
        d.lengthSq() +
        softening ** 2 +
        (s.metadata.softening || 0) ** 2;
      a.addScaledVector(
        d,
        (G * gravityMultiplier * s.mass) / (r2 * Math.sqrt(r2)),
      );
    }
    return a;
  };

  for (let i = 0; i < Math.min(steps, 256); i++) {
    const a = acceleration(b.position);
    b.velocity.addScaledVector(a, dt / 2);
    b.position.addScaledVector(b.velocity, dt);
    b.velocity.addScaledVector(acceleration(b.position), dt / 2);
    if (!b.position.toArray().every(Number.isFinite)) break;
    result.push(b.position.toArray());
  }

  return result;
}

// Approximate measured bulk properties; circular phase-offset initial conditions,
// not a dated ephemeris. Orbital plane is XZ; increasing orbital phase has
// angular momentum along -Y, which defines the reference normal for inclination.
export const SOLAR_DATA = [
  {
    name: "Mercury",
    mass: 1.6601e-7,
    radiusKm: 2439.7,
    orbit: 0.3871,
    angle: 0.4,
    rotationDays: 58.646,
    tilt: 0.034,
    temperature: 440,
    color: "#aba297",
    size: 0.045,
    albedo: 0.088,
    composition: ["Iron core", "Silicate mantle"],
    description:
      "The smallest planet. Its heavily cratered surface records billions of years of impacts, beneath an almost airless sky.",
  },
  {
    name: "Venus",
    mass: 2.4478e-6,
    radiusKm: 6051.8,
    orbit: 0.7233,
    angle: 2.3,
    rotationDays: -243.025,
    tilt: 2.64,
    temperature: 737,
    color: "#d6ba82",
    size: 0.07,
    albedo: 0.77,
    composition: ["Silicate rock", "Iron core", "Carbon dioxide atmosphere"],
    description:
      "A world wrapped in sulfuric-acid clouds. A powerful greenhouse effect makes Venus the hottest planet.",
    atmosphere: { dominantGas: "CO₂", surfacePressureBar: 92 },
  },
  {
    name: "Earth",
    mass: 3.00349e-6,
    radiusKm: 6371,
    orbit: 1,
    angle: 3.65,
    rotationDays: 0.99727,
    tilt: 23.44,
    temperature: 288,
    color: "#7bbad7",
    size: 0.085,
    albedo: 0.306,
    composition: ["Iron / nickel core", "Silicate mantle", "Liquid water"],
    description:
      "Our pale blue dot. The only known world with stable surface oceans and life, protected by a magnetic field and a nitrogen–oxygen atmosphere.",
    atmosphere: { dominantGas: "N₂ / O₂", surfacePressureBar: 1 },
  },
  {
    name: "Mars",
    mass: 3.2272e-7,
    radiusKm: 3389.5,
    orbit: 1.5237,
    angle: 5.5,
    rotationDays: 1.02596,
    tilt: 25.19,
    temperature: 210,
    color: "#ca8265",
    size: 0.06,
    albedo: 0.25,
    composition: ["Iron oxide dust", "Basalt", "Water ice"],
    description:
      "Rust-red deserts, giant volcanoes, and ancient riverbeds. Mars preserves evidence of a wetter past beneath its thin atmosphere.",
  },
  {
    name: "Jupiter",
    mass: 9.5458e-4,
    radiusKm: 69911,
    orbit: 5.2028,
    angle: 0.95,
    rotationDays: 0.41354,
    tilt: 3.13,
    temperature: 165,
    color: "#cbb298",
    size: 0.22,
    albedo: 0.503,
    composition: ["Hydrogen", "Helium", "Metallic hydrogen interior"],
    description:
      "The largest planet. Fast-moving cloud bands encircle a deep atmosphere, where the Great Red Spot has raged for centuries.",
  },
  {
    name: "Saturn",
    mass: 2.858e-4,
    radiusKm: 58232,
    orbit: 9.5388,
    angle: 3.2,
    rotationDays: 0.444,
    tilt: 26.73,
    temperature: 134,
    color: "#d0bf94",
    size: 0.185,
    albedo: 0.342,
    composition: ["Hydrogen", "Helium", "Water-ice rings"],
    description:
      "An extraordinary system of icy rings surrounds this low-density gas giant. Its many moons form a miniature planetary system.",
  },
  {
    name: "Uranus",
    mass: 4.366e-5,
    radiusKm: 25362,
    orbit: 19.191,
    angle: 4.7,
    rotationDays: 0.7183,
    tilt: 97.77,
    temperature: 76,
    color: "#9dcbd0",
    size: 0.13,
    albedo: 0.3,
    composition: ["Hydrogen", "Helium", "Water / ammonia / methane"],
    description:
      "An ice giant tipped onto its side. Its extreme axial tilt produces seasons that last decades.",
  },
  {
    name: "Neptune",
    mass: 5.151e-5,
    radiusKm: 24622,
    orbit: 30.061,
    angle: 5.95,
    rotationDays: 0.6713,
    tilt: 28.32,
    temperature: 72,
    color: "#5482cb",
    size: 0.125,
    albedo: 0.29,
    composition: ["Hydrogen", "Helium", "Methane"],
    description:
      "Cold, blue, and swept by supersonic winds. Neptune takes about 165 Earth years to complete one orbit.",
  },
];

export function populateSolarSystem(engine) {
  const sun = engine.spawnBody("star", {
    id: "sun",
    name: "Sun",
    angularVelocity: [0, (TAU * 365.25) / 25.38, 0],
    metadata: {
      visualSize: 0.19,
      color: "#f8c584",
      texture: "sun",
      description:
        "A G-type main-sequence star containing 99.86% of the mass of the Solar System. Hydrogen fusion powers its light.",
      rotationDays: 25.38,
      nextFlareTime: 0.12,
    },
  });
  for (const d of SOLAR_DATA) {
    const speed = Math.sqrt((G * (1 + d.mass)) / d.orbit);
    engine.addBody({
      id: d.name.toLowerCase(),
      name: d.name,
      type: "planet",
      mass: d.mass,
      radius: (d.radiusKm * 1000) / AU_M,
      position: [d.orbit * Math.cos(d.angle), 0, d.orbit * Math.sin(d.angle)],
      velocity: [-speed * Math.sin(d.angle), 0, speed * Math.cos(d.angle)],
      angularVelocity: [0, (TAU * 365.25) / d.rotationDays, 0],
      axialTilt: d.tilt,
      temperature: d.temperature,
      albedo: d.albedo,
      composition: d.composition,
      atmosphere: d.atmosphere,
      metadata: {
        visualSize: d.size,
        color: d.color,
        texture: d.name.toLowerCase(),
        orbitRadius: d.orbit,
        primaryId: "sun",
        rotationDays: d.rotationDays,
        description: d.description,
      },
    });
  }
  const earth = engine.getBody("earth");
  const lunarDistance = 384400000 / AU_M;
  engine.addBody({
    id: "moon",
    name: "Moon",
    type: "moon",
    mass: 3.694e-8,
    radius: 1737400 / AU_M,
    position: earth.position.clone().add(new Vector3(lunarDistance, 0, 0)),
    velocity: earth.velocity
      .clone()
      .add(new Vector3(0, 0, Math.sqrt((G * earth.mass) / lunarDistance))),
    angularVelocity: [0, (TAU * 365.25) / 27.32, 0],
    temperature: 220,
    albedo: 0.12,
    composition: ["Silicate", "Basalt"],
    metadata: {
      visualSize: 0.023,
      color: "#b6b9be",
      texture: "moon",
      primaryId: "earth",
      rotationDays: 27.32,
      description:
        "Earth’s large natural satellite. Its familiar near side stays turned toward Earth through synchronous rotation.",
    },
  });
  const momentum = new Vector3();
  for (const b of engine.bodies) {
    if (b !== sun) momentum.addScaledVector(b.velocity, b.mass);
  }
  sun.velocity.copy(momentum).divideScalar(-sun.mass);
  return engine;
}

export function createSunEarthTestSystem(EngineClass) {
  const engine = new EngineClass();
  engine.settings.tides = false;
  engine.settings.autoFlares = false;
  engine.spawnBody("star", {
    id: "sun",
    name: "Sun",
    velocity: [0, 0, -TAU * 3.00349e-6],
  });
  engine.spawnBody("planet", {
    id: "earth",
    name: "Earth",
    position: [1, 0, 0],
    velocity: [0, 0, TAU],
  });
  engine.recordHistory();
  return engine;
}

/**
 * Real Keplerian orbital elements (J2000 epoch) for the eight major planets.
 */
export const REAL_SOLAR_ELEMENTS = [
  {
    name: "Mercury",
    a: 0.387098,
    e: 0.20563,
    incDeg: 7.005,
    lanDeg: 48.331,
    argDeg: 29.124,
    trueAnomalyDeg: 174.796,
  },
  {
    name: "Venus",
    a: 0.723332,
    e: 0.00677,
    incDeg: 3.394,
    lanDeg: 76.68,
    argDeg: 54.884,
    trueAnomalyDeg: 50.115,
  },
  {
    name: "Earth",
    a: 1.0,
    e: 0.01671,
    incDeg: 0.0,
    lanDeg: 174.873,
    argDeg: 288.064,
    trueAnomalyDeg: 358.18,
  },
  {
    name: "Mars",
    a: 1.523679,
    e: 0.0934,
    incDeg: 1.85,
    lanDeg: 49.558,
    argDeg: 286.502,
    trueAnomalyDeg: 19.373,
  },
  {
    name: "Jupiter",
    a: 5.204267,
    e: 0.04849,
    incDeg: 1.303,
    lanDeg: 100.464,
    argDeg: 273.867,
    trueAnomalyDeg: 20.02,
  },
  {
    name: "Saturn",
    a: 9.582017,
    e: 0.05555,
    incDeg: 2.485,
    lanDeg: 113.665,
    argDeg: 339.392,
    trueAnomalyDeg: 317.54,
  },
  {
    name: "Uranus",
    a: 19.229411,
    e: 0.04638,
    incDeg: 0.773,
    lanDeg: 74.006,
    argDeg: 96.998,
    trueAnomalyDeg: 142.238,
  },
  {
    name: "Neptune",
    a: 30.069923,
    e: 0.00946,
    incDeg: 1.769,
    lanDeg: 131.784,
    argDeg: 273.187,
    trueAnomalyDeg: 256.228,
  },
];

/**
 * Converts 3D Keplerian orbital elements into Cartesian position and velocity vectors.
 * Coordinates are mapped with the primary orbital plane aligned to the X-Z plane.
 */
export function keplerianToCartesian({
  a,
  e,
  incDeg = 0,
  lanDeg = 0,
  argDeg = 0,
  trueAnomalyDeg = 0,
  primaryMass = 1,
  bodyMass = 0,
  gravityMultiplier = 1,
}) {
  const inc = (incDeg * Math.PI) / 180;
  const lan = (lanDeg * Math.PI) / 180;
  const arg = (argDeg * Math.PI) / 180;
  const nu = (trueAnomalyDeg * Math.PI) / 180;

  const mu = G * gravityMultiplier * (primaryMass + bodyMass);
  const p = a * (1 - e * e);
  const r = p / (1 + e * Math.cos(nu));
  const h = Math.sqrt(mu * p);

  // Orbital plane coordinates (xOrb toward periapsis, zOrb toward true anomaly 90 deg)
  const xOrb = r * Math.cos(nu);
  const zOrb = r * Math.sin(nu);
  const vxOrb = -Math.sin(nu) * Math.sqrt(mu / p);
  const vzOrb = (e + Math.cos(nu)) * Math.sqrt(mu / p);

  // Basis vectors in reference frame:
  // n = line of ascending nodes
  // m = tilted reference vector (in-plane rotated by inclination)
  const cosL = Math.cos(lan),
    sinL = Math.sin(lan);
  const cosI = Math.cos(inc),
    sinI = Math.sin(inc);
  const cosA = Math.cos(arg),
    sinA = Math.sin(arg);

  const nx = cosL,
    ny = 0,
    nz = sinL;
  const mx = -sinL * cosI,
    my = sinI,
    mz = cosL * cosI;

  // P vector (towards periapsis)
  const Px = cosA * nx + sinA * mx;
  const Py = cosA * ny + sinA * my;
  const Pz = cosA * nz + sinA * mz;

  // Q vector (90 deg advanced in orbit plane)
  const Qx = -sinA * nx + cosA * mx;
  const Qy = -sinA * ny + cosA * my;
  const Qz = -sinA * nz + cosA * mz;

  const position = new Vector3(
    xOrb * Px + zOrb * Qx,
    xOrb * Py + zOrb * Qy,
    xOrb * Pz + zOrb * Qz,
  );

  const velocity = new Vector3(
    vxOrb * Px + vzOrb * Qx,
    vxOrb * Py + vzOrb * Qy,
    vxOrb * Pz + vzOrb * Qz,
  );

  return { position, velocity };
}

/**
 * Initializes a full 3D Solar System using real Keplerian orbital elements
 * (inclinations, eccentricities, arguments of periapsis, ascending nodes).
 */
export function populateRealisticSolarSystem(engine) {
  const sun = engine.spawnBody("star", {
    id: "sun",
    name: "Sun",
    angularVelocity: [0, (TAU * 365.25) / 25.38, 0],
    metadata: {
      visualSize: 0.19,
      color: "#f8c584",
      texture: "sun",
      description:
        "A G-type main-sequence star containing 99.86% of the mass of the Solar System. Hydrogen fusion powers its light.",
      rotationDays: 25.38,
      nextFlareTime: 0.12,
    },
  });

  const elementsMap = new Map(REAL_SOLAR_ELEMENTS.map((el) => [el.name, el]));

  for (const d of SOLAR_DATA) {
    const el = elementsMap.get(d.name);
    let position, velocity;
    if (el) {
      const state = keplerianToCartesian({
        a: el.a,
        e: el.e,
        incDeg: el.incDeg,
        lanDeg: el.lanDeg,
        argDeg: el.argDeg,
        trueAnomalyDeg: el.trueAnomalyDeg,
        primaryMass: sun.mass,
        bodyMass: d.mass,
        gravityMultiplier: engine.gravityMultiplier,
      });
      position = [state.position.x, state.position.y, state.position.z];
      velocity = [state.velocity.x, state.velocity.y, state.velocity.z];
    } else {
      const speed = Math.sqrt((G * (1 + d.mass)) / d.orbit);
      position = [d.orbit * Math.cos(d.angle), 0, d.orbit * Math.sin(d.angle)];
      velocity = [-speed * Math.sin(d.angle), 0, speed * Math.cos(d.angle)];
    }

    engine.addBody({
      id: d.name.toLowerCase(),
      name: d.name,
      type: "planet",
      mass: d.mass,
      radius: (d.radiusKm * 1000) / AU_M,
      position,
      velocity,
      angularVelocity: [0, (TAU * 365.25) / d.rotationDays, 0],
      axialTilt: d.tilt,
      temperature: d.temperature,
      albedo: d.albedo,
      composition: d.composition,
      atmosphere: d.atmosphere,
      metadata: {
        visualSize: d.size,
        color: d.color,
        texture: d.name.toLowerCase(),
        orbitRadius: el ? el.a : d.orbit,
        primaryId: "sun",
        rotationDays: d.rotationDays,
        description: d.description,
        orbitalElements: el || null,
      },
    });
  }

  const earth = engine.getBody("earth");
  const lunarDistance = 384400000 / AU_M;
  engine.addBody({
    id: "moon",
    name: "Moon",
    type: "moon",
    mass: 3.694e-8,
    radius: 1737400 / AU_M,
    position: earth.position.clone().add(new Vector3(lunarDistance, 0, 0)),
    velocity: earth.velocity
      .clone()
      .add(new Vector3(0, 0, Math.sqrt((G * earth.mass) / lunarDistance))),
    angularVelocity: [0, (TAU * 365.25) / 27.32, 0],
    temperature: 220,
    albedo: 0.12,
    composition: ["Silicate", "Basalt"],
    metadata: {
      visualSize: 0.023,
      color: "#b6b9be",
      texture: "moon",
      primaryId: "earth",
      rotationDays: 27.32,
      description:
        "Earth’s large natural satellite. Its familiar near side stays turned toward Earth through synchronous rotation.",
    },
  });

  const momentum = new Vector3();
  for (const b of engine.bodies) {
    if (b !== sun) momentum.addScaledVector(b.velocity, b.mass);
  }
  sun.velocity.copy(momentum).divideScalar(-sun.mass);
  return engine;
}
