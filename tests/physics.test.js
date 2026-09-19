import test from "node:test";
import assert from "node:assert/strict";
import PhysicsEngine, {
  Vector3,
  CelestialBody,
  createSunEarthTestSystem,
  AU_M,
  G,
  auPerYearToMS,
} from "../src/physics/PhysicsEngine.js";

const close = (a, b, tolerance = 1e-10) =>
  assert.ok(
    Math.abs(a - b) <= tolerance,
    `${a} ≠ ${b} (tolerance ${tolerance})`,
  );
const momentum = (bodies) =>
  bodies.reduce((p, b) => p.addScaledVector(b.velocity, b.mass), new Vector3());
const quietEngine = () => {
  const e = new PhysicsEngine();
  e.settings.tides = false;
  e.settings.autoFlares = false;
  return e;
};

test("vector algebra, serialization and input safety", () => {
  assert.deepEqual(
    new Vector3(1, 0, 0).cross(new Vector3(0, 1, 0)).toArray(),
    [0, 0, 1],
  );
  close(new Vector3(3, 4, 0).length(), 5);
  const b = new CelestialBody({ mass: NaN, radius: -1, velocity: [1, 2, 3] });
  assert.ok(b.mass > 0 && b.radius > 0);
  assert.ok(b.clone().velocity instanceof Vector3);
});

test("one-year Earth orbit stays near 1 AU and conserves energy", () => {
  const e = createSunEarthTestSystem(),
    initial = e.getSystemDiagnostics().totalEnergy;
  close(
    auPerYearToMS(e.getBody("earth").velocity.length()) / 1000,
    29.785,
    0.02,
  );
  for (let i = 0; i < 32768; i++)
    e.step(undefined, { record: false, environment: false });
  close(
    e.getBody("earth").position.distanceTo(e.getBody("sun").position),
    1,
    2e-5,
  );
  close(e.getSystemDiagnostics().totalEnergy / initial, 1, 1e-8);
});

test("solar system is stable and Moon remains associated with Earth for a year", () => {
  const e = new PhysicsEngine();
  e.createScenario();
  e.settings.autoFlares = false;
  for (let i = 0; i < 32768; i++) e.step(undefined, { record: false });
  assert.equal(e.bodies.length, 10);
  const distance = e
    .getBody("moon")
    .position.distanceTo(e.getBody("earth").position);
  assert.ok(
    distance > 0.0018 && distance < 0.0034,
    `Moon distance ${distance}`,
  );
  close(
    e.getBody("earth").position.distanceTo(e.getBody("sun").position),
    1,
    0.02,
  );
  assert.ok(e.getSystemDiagnostics().linearMomentum.length() < 1e-12);
});

test("Sun mass and Jupiter perturb accelerations", () => {
  const e = createSunEarthTestSystem();
  e.calculateAccelerations();
  const initial = e.getBody("earth").acceleration.x;
  e.updateBody("sun", { mass: 2 });
  e.calculateAccelerations();
  close(e.getBody("earth").acceleration.x, initial * 2, 1e-10);
  e.spawnBody("planet", { mass: 0.001, position: [1.1, 0, 0] });
  e.calculateAccelerations();
  assert.ok(e.getBody("earth").acceleration.x > initial * 2);
  e.removeBody("earth");
  assert.doesNotThrow(() => e.step());
});

test("glancing merge conserves mass, linear and angular momentum and creates spin", () => {
  const e = quietEngine();
  const a = e.addBody({
    mass: 2e-6,
    radius: 0.01,
    position: [-0.01, 0, 0],
    velocity: [1, 0, 0.5],
  });
  const b = e.addBody({
    mass: 1e-6,
    radius: 0.01,
    position: [0.01, 0, 0],
    velocity: [-2, 0, 0],
  });
  const p = momentum(e.bodies),
    L = e.calculateAngularMomentumBudget();
  e.mergeBodies(a, b);
  close(a.mass, 3e-6);
  close(momentum(e.bodies).distanceTo(p), 0);
  close(e.calculateAngularMomentumBudget().distanceTo(L), 0, 1e-12);
  assert.ok(a.angularVelocity.length() > 0);
});

test("3D bounce separates, conserves momentum and friction transfers spin", () => {
  const e = quietEngine();
  const a = e.addBody({
    mass: 1,
    radius: 1,
    position: [0, 0, 0],
    velocity: [1, 1, 1],
  });
  const b = e.addBody({
    mass: 2,
    radius: 1,
    position: [1.5, 0, 0],
    velocity: [-1, 0, 0],
  });
  const p = momentum(e.bodies);
  e.bounceBodies(a, b);
  assert.ok(a.position.distanceTo(b.position) >= 2);
  close(momentum(e.bodies).distanceTo(p), 0);
  assert.ok(a.angularVelocity.length() > 0);
});

test("partial accretion conserves total mass, momentum and angular momentum", () => {
  const e = quietEngine();
  const a = e.addBody({ mass: 1e-6, radius: 0.001, velocity: [1, 0, 1] });
  const b = e.addBody({
    mass: 1e-6,
    radius: 0.001,
    position: [0.001, 0, 0],
    velocity: [-1, 0, 0],
  });
  const p = momentum(e.bodies),
    L = e.calculateAngularMomentumBudget();
  e.mergeBodies(a, b, 0.3);
  assert.equal(e.bodies.length, 9);
  close(e.getSystemDiagnostics().totalMass, 2e-6, 1e-18);
  close(momentum(e.bodies).distanceTo(p), 0, 1e-18);
  close(e.calculateAngularMomentumBudget().distanceTo(L), 0, 1e-16);
});

test("tidal fragments conserve mass and center-of-mass momentum", () => {
  const e = quietEngine(),
    a = e.spawnBody("planet", { velocity: [2, 3, 4] }),
    mass = a.mass,
    p = momentum(e.bodies);
  e.applyTidalDisruption(a.id);
  assert.equal(e.bodies.length, 8);
  close(e.getSystemDiagnostics().totalMass, mass, 1e-18);
  close(momentum(e.bodies).distanceTo(p), 0, 1e-18);
});

test("wormhole transit preserves speed and cooldown prevents a loop", () => {
  const e = quietEngine(),
    [a, b] = e.spawnWormholePair();
  const traveler = e.spawnBody("asteroid", {
    position: a.position,
    velocity: [1, 2, 3],
  });
  let events = 0;
  e.on("wormholeTransit", () => events++);
  e.handlePortalsAndCaptures();
  close(traveler.velocity.length(), Math.sqrt(14));
  assert.ok(traveler.position.distanceTo(b.position) < 0.3);
  e.handlePortalsAndCaptures();
  assert.equal(events, 1);
});

test("black hole event horizon captures and preserves mass", () => {
  const e = quietEngine(),
    hole = e.spawnBody("black hole"),
    asteroid = e.spawnBody("asteroid", { position: [hole.radius * 0.5, 0, 0] });
  const mass = hole.mass + asteroid.mass;
  let captured = false;
  e.on("bodyCaptured", () => (captured = true));
  e.handlePortalsAndCaptures();
  assert.equal(e.bodies.length, 1);
  assert.ok(captured);
  close(hole.mass, mass);
});

test("manual and automatic solar flares fire, expose neighbors, and expire", () => {
  const e = createSunEarthTestSystem();
  e.settings.autoFlares = true;
  let events = 0;
  e.on("solarFlare", () => events++);
  assert.ok(e.triggerSolarFlare("Sun"));
  assert.ok(e.getBody("earth").metadata.solarFlareExposure > 0);
  e.time = 0.11;
  e.updateEnvironment(0.01);
  assert.equal(events, 2);
  e.settings.autoFlares = false;
  e.time = 1;
  e.updateEnvironment(0.01);
  assert.equal(e.getBody("sun").metadata.activeSolarFlare, undefined);
});

test("supernova creates physical ejecta and compact remnant with conserved mass", () => {
  const e = quietEngine(),
    star = e.spawnBody("star", { mass: 10, velocity: [1, 2, 3] }),
    p = momentum(e.bodies);
  const remnant = e.triggerSupernova(star.id);
  assert.equal(remnant.type, "neutron star");
  assert.equal(e.bodies.length, 13);
  close(e.getSystemDiagnostics().totalMass, 10, 1e-12);
  close(momentum(e.bodies).distanceTo(p), 0, 1e-10);
});

test("Sun-mass supernova request becomes planetary nebula white dwarf", () => {
  const e = quietEngine();
  const sun = e.spawnBody("star", { id: "sun", name: "Sun", mass: 1 });
  const planet = e.spawnBody("planet", {
    id: "planet-under-test",
    position: [1, 0, 0],
    velocity: [0, 6.28, 0],
    metadata: { primaryId: "sun" },
  });
  const remnant = e.triggerSupernova("sun");
  assert.equal(remnant.type, "white dwarf");
  assert.ok(remnant.mass >= 0.54 && remnant.mass <= 0.6);
  assert.equal(remnant.metadata.planetaryNebula, true);
  assert.ok(planet.metadata.orbitAdjustedForStellarMassLoss);
});

test("deep time evolves a one-solar-mass star into a red giant without corrupting physics", () => {
  const e = quietEngine();
  const sun = e.spawnBody("star", {
    id: "sun",
    name: "Sun",
    mass: 1,
    position: [0, 0, 0],
    metadata: { initialMass: 1 },
  });
  const earth = e.spawnBody("planet", {
    id: "earth",
    position: [1, 0, 0],
    velocity: [0, 6.28, 0],
    metadata: { primaryId: "sun" },
  });
  e.fastForwardDeepTime(5e9);
  assert.equal(e.time, 5e9);
  assert.equal(sun.type, "red giant");
  assert.ok(sun.radius / (696700000 / AU_M) >= 199);
  assert.ok(sun.temperature <= 3000 + 1e-6);
  assert.ok(sun.luminosity > 1000);
  assert.equal(e.getBody("earth"), undefined);
});

test("history, branch, save/restore and trajectory prediction preserve vector types and live state", () => {
  const e = createSunEarthTestSystem(),
    saved = JSON.stringify(e.saveState());
  assert.ok(e.predictTrajectory(e.getBody("earth")).length > 5);
  assert.equal(JSON.stringify(e.saveState()), saved);
  e.createBranch("A");
  e.updateBody("sun", { mass: 2 });
  e.recordHistory();
  assert.ok(e.undo());
  close(e.getBody("sun").mass, 1);
  assert.ok(e.redo());
  close(e.getBody("sun").mass, 2);
  e.restoreBranch("A");
  close(e.getBody("sun").mass, 1);
  assert.ok(e.getBody("sun").velocity instanceof Vector3);
  const invalid = e.saveState();
  invalid.bodies[0].mass = -1;
  assert.throws(() => e.restoreState(invalid));
  close(e.getBody("sun").mass, 1);
});

test("bounded substeps, history, IDs, pause, and invalid time controls", () => {
  const e = createSunEarthTestSystem();
  e.setTimeScale(Infinity);
  close(e.timeScale, 0.04);
  e.setTimeScale(1);
  e.update(100);
  assert.ok(e.lastSubsteps <= e.maxSubsteps);
  assert.ok(e.droppedTime > 0);
  e.pause();
  const time = e.time;
  e.update(1);
  close(e.time, time);
  assert.throws(() => e.addBody({ id: "earth" }));
  for (let i = 0; i < 200; i++) e.recordHistory();
  assert.equal(e.history.length, e.historyLimit);
});

test("orbital and radiation helpers have physical magnitudes and handle unbound trajectories", () => {
  const e = createSunEarthTestSystem(),
    earth = e.getBody("earth"),
    sun = e.getBody("sun");
  close(e.calculateOrbitalElements(earth, sun).period, 1, 0.0001);
  close(e.calculateRadiation(earth).flux, 1361, 2);
  close(e.calculateEquilibriumTemperature(earth), 255, 2);
  earth.velocity.set(0, 0, 20);
  assert.equal(e.calculateOrbitalElements(earth, sun).bound, false);
  assert.equal(e.calculateOrbitalElements(earth, sun).period, Infinity);
  close(e.schwarzschildRadius(1) * AU_M, 2953.34, 1);
});
