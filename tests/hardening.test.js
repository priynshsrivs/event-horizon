import test from "node:test";
import assert from "node:assert/strict";
import PhysicsEngine, { AU_M, BODY_PRESETS, blackbodyColor,
  stellarLuminosity, solarRadiusToAU, auToSolarRadii, calculateCollisionOutcome,
} from "../src/physics/PhysicsEngine.js";
import { readPreferences, writePreferences } from "../src/ui/preferences.js";

const near = (a, b, eps = 1e-12) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const quiet = () => {
  const e = new PhysicsEngine();
  e.settings.tides = e.settings.autoFlares = e.settings.magnetism = false;
  return e;
};

test("swept moving black-hole capture conserves mass, momentum, spin and grows horizon", () => {
  const e = quiet();
  e.gravityMultiplier = 0;
  e.softening = 0.1;
  const h = e.spawnBody("black hole", { mass: 5, velocity: [2, 0, 0], metadata: { visualSize: 5 } });
  const rs = h.radius;
  near(e.schwarzschildRadius(1) * AU_M, 2953.34, 1);
  e.spawnBody("planet", { mass: 0.1, radius: 1e-10, position: [-0.001, 0, 0], velocity: [100, 0, 0], angularVelocity: [0, 2, 0] });
  const before = e.getSystemDiagnostics();
  let captures = 0;
  e.on("bodyCaptured", () => captures++);
  e.step(100);
  assert.equal(e.bodies.length, 1);
  near(h.mass, before.totalMass);
  near(e.getSystemDiagnostics().linearMomentum.distanceTo(before.linearMomentum), 0);
  near(e.calculateAngularMomentumBudget().distanceTo(before.angularMomentum), 0);
  assert.ok(h.radius > rs);
  near(h.radius, e.schwarzschildRadius(h.mass));
  e.handlePortalsAndCaptures();
  assert.equal(captures, 1);
  e.recordHistory();
  assert.doesNotThrow(() => e.restoreState(e.saveState()));
});

test("grazing black-hole trajectory is not captured by mesh size or projectile radius", () => {
  const e = quiet(); e.gravityMultiplier = 0;
  const h = e.spawnBody("black hole", { metadata: { visualSize: 5 } });
  e.spawnBody("asteroid", { radius: h.radius * 100, position: [-0.001, h.radius * 1.1, 0], velocity: [100, 0, 0] });
  e.step();
  assert.equal(e.bodies.length, 2);
});

test("sequential captures update horizon and removed holes cannot capture ghosts", () => {
  const e = quiet();
  const h = e.spawnBody("black hole", { mass: 5 });
  let events = 0; e.on("bodyCaptured", () => events++);
  for (let i = 0; i < 3; i++) {
    e.spawnBody("black hole", { mass: 1, position: h.position });
    e.handlePortalsAndCaptures();
    assert.equal(e.bodies.length, 1);
    near(h.mass, 6 + i);
    near(h.radius, e.schwarzschildRadius(h.mass));
  }
  assert.equal(events, 3);
});

test("enlarged simulation capture region never reports a physical horizon crossing", () => {
  const e = quiet();
  const h = e.spawnBody("black hole", { metadata: { captureRadiusAU: 0.01 } });
  e.spawnBody("asteroid", { position: [0.005, 0, 0] });
  let physical = 0, simulated = 0;
  e.on("eventHorizonCrossed", () => physical++);
  e.on("captureRegionEntered", () => simulated++);
  e.handlePortalsAndCaptures();
  assert.equal(physical, 0); assert.equal(simulated, 1);
  assert.ok(h.radius < e.captureRadius(h));
});

test("dimensionless impact energy selects merge, partial and catastrophic outcomes", () => {
  const e = quiet();
  const a = e.spawnBody("asteroid", { mass: 1e-10, radius: 1e-6 });
  const b = e.spawnBody("asteroid", { mass: 1e-10, radius: 1e-6 });
  const binding = calculateCollisionOutcome(a, b).bindingEnergy;
  for (const [ratio, expected] of [[0.01, "merge"], [0.5, "partial"], [4, "catastrophic"]]) {
    b.velocity.x = Math.sqrt(2 * binding * ratio / (a.mass / 2));
    const result = calculateCollisionOutcome(a, b);
    near(result.ratio, ratio);
    assert.equal(result.catastrophic, expected === "catastrophic");
    assert.equal(result.fraction === 0, expected === "merge");
  }
});

test("catastrophic impact conserves total mass, COM and angular momentum with physical debris", () => {
  const e = quiet();
  e.spawnBody("asteroid", { mass: 1e-10, radius: 1e-6, position: [-5e-7, 0, 0], velocity: [10, 2, 0] });
  e.spawnBody("asteroid", { mass: 1e-10, radius: 1e-6, position: [5e-7, 0, 0], velocity: [-10, 0, 1] });
  const before = e.getSystemDiagnostics();
  let event = false; e.on("catastrophicDisruption", () => event = true);
  e.handleCollisions();
  const after = e.getSystemDiagnostics();
  assert.ok(event);
  assert.equal(e.bodies.filter(b => b.type === "debris").length, 8);
  near(after.totalMass, before.totalMass, 1e-24);
  near(after.linearMomentum.distanceTo(before.linearMomentum), 0, 1e-23);
  near(after.centerOfMass.distanceTo(before.centerOfMass), 0, 1e-20);
  near(after.angularMomentum.distanceTo(before.angularMomentum), 0, 1e-23);
  assert.ok(e.bodies.every(b => b.mass > 0 && b.radius > 0 && Number.isFinite(b.density)));
  for (let i = 0; i < 500; i++) e.step(undefined, { record: false });
  near(e.getSystemDiagnostics().totalMass, before.totalMass, 1e-23);
  assert.ok(e.bodies.length <= 128 && e.bodies.every(b => b.enabled));
});

test("swept bounce reverses a fast projectile and conserves linear/angular momentum", () => {
  const e = quiet(); e.gravityMultiplier = 0;
  const a = e.spawnBody("asteroid", { mass: 1e-8, radius: 1e-5, collisionMode: "bounce", position: [-0.001, 0, 0], velocity: [100, 0, 0] });
  e.spawnBody("asteroid", { mass: 2e-8, radius: 1e-5 });
  const before = e.getSystemDiagnostics();
  e.step();
  assert.ok(a.velocity.x < 0);
  near(e.getSystemDiagnostics().linearMomentum.distanceTo(before.linearMomentum), 0);
  near(e.getSystemDiagnostics().angularMomentum.distanceTo(before.angularMomentum), 0);
});

test("debris capacity fallback preserves mass at 128 bodies and repeated history restores", () => {
  const e = quiet();
  for (let i = 0; i < 128; i++) e.spawnBody("asteroid", { position: [i, 0, 0] });
  const mass = e.getSystemDiagnostics().totalMass;
  e.mergeBodies(e.bodies[0], e.bodies[1], 0.9);
  near(e.getSystemDiagnostics().totalMass, mass, 1e-25);
  assert.equal(e.bodies.length, 127);
  for (let i = 0; i < 170; i++) e.recordHistory();
  assert.equal(e.history.length, 160);
  for (const i of [0, 159, 50, 100]) {
    assert.ok(e.seekHistory(i));
    near(e.getSystemDiagnostics().totalMass, mass, 1e-25);
  }
});

test("Roche density scaling, distant stability and elongated tidal stream conservation", () => {
  const e = quiet(); e.settings.tides = true;
  const primary = e.spawnBody("white dwarf");
  const body = e.spawnBody("planet", { position: [1, 0, 0], velocity: [0, 0, 3], angularVelocity: [0, 5, 1] });
  const fluid = e.calculateRocheLimit(primary, body);
  near(fluid / e.calculateRocheLimit(primary, body, false), 2.44 / 1.26);
  const dense = body.clone(); dense.radius /= 2; dense.recalculateDensity();
  near(e.calculateRocheLimit(primary, dense), fluid / 2);
  e.updateEnvironment(0.001); assert.ok(e.getBody(body.id));
  body.position.set(0.001, 0, 0);
  const before = e.getSystemDiagnostics();
  e.time = 0.001; e.updateEnvironment(0.001);
  const fragments = e.bodies.filter(b => b.type === "debris");
  assert.equal(fragments.length, 8);
  assert.ok(fragments.every(b => b.position.y === 0 && b.position.z === 0));
  const after = e.getSystemDiagnostics();
  near(after.totalMass, before.totalMass);
  near(after.linearMomentum.distanceTo(before.linearMomentum), 0);
  near(after.angularMomentum.distanceTo(before.angularMomentum), 0);
});

test("stellar presets obey thermal luminosity, representative densities and radius units", () => {
  const ranges = { star: [1000, 2000], "red giant": [0.001, 1], "red supergiant": [1e-6, 0.01],
    "white dwarf": [1e8, 1e10], "brown dwarf": [1e4, 1e5], "neutron star": [1e17, 1e18], magnetar: [1e17, 1e18] };
  const e = quiet();
  for (const [type, [lo, hi]] of Object.entries(ranges)) {
    const b = e.spawnBody(type);
    assert.ok(b.density > lo && b.density < hi, `${type}: ${b.density}`);
    near(b.luminosity / stellarLuminosity(b.radius, b.temperature), 1);
    assert.ok(BODY_PRESETS[type].metadata.classification);
  }
  near(auToSolarRadii(solarRadiusToAU(50)), 50);
});

test("radiation and equilibrium temperature scale with luminosity, distance, albedo and emissivity", () => {
  const e = quiet(); const s = e.spawnBody("star");
  const p = e.spawnBody("planet", { position: [1, 0, 0] });
  const flux = e.calculateRadiation(p).flux, temp = e.calculateEquilibriumTemperature(p);
  const zone = e.calculateHabitableZone(s);
  s.luminosity = 16;
  near(e.calculateRadiation(p).flux / flux, 16);
  near(e.calculateEquilibriumTemperature(p) / temp, 2);
  near(e.calculateHabitableZone(s).outer / zone.outer, 4);
  p.position.x = 2;
  near(e.calculateRadiation(p).flux / flux, 4);
  p.emissivity = 0.25;
  near(e.calculateEquilibriumTemperature(p) / temp, 2);
  p.albedo = 1; assert.equal(e.calculateEquilibriumTemperature(p), 0);
});

test("Planckian RGB is bounded, cool orange and hot blue-white", () => {
  const cool = blackbodyColor(3000), sun = blackbodyColor(5772), hot = blackbodyColor(20000);
  assert.ok(cool[0] > cool[2] && sun[2] > cool[2] && hot[2] > hot[0]);
  for (const t of [NaN, -1, 1000, 5772, 40000, 1e6])
    assert.ok(blackbodyColor(t).every(c => Number.isFinite(c) && c >= 0 && c <= 1));
});

test("bad mass cannot contaminate a healthy neighbor and frame stepping stops on warning", () => {
  const e = quiet(); const bad = e.spawnBody("planet");
  const good = e.spawnBody("planet", { position: [1, 0, 0] });
  bad.mass = NaN; e.update(0.1);
  assert.equal(bad.enabled, false); assert.ok(good.enabled && Number.isFinite(good.velocity.x));
  assert.equal(e.lastSubsteps, 1); assert.equal(e.accumulator, 0);
});

test("preferences persist only validated settings and tolerate corrupt or unavailable storage", () => {
  const defaults = { sound: false, volume: 0.25, quality: "medium" };
  let data; const storage = { getItem: () => data, setItem: (_, v) => { data = v; } };
  assert.ok(writePreferences({ sound: true, volume: 2, quality: "bogus" }, storage));
  assert.deepEqual(readPreferences(defaults, storage), { sound: true, volume: 1, quality: "medium" });
  data = "broken"; assert.deepEqual(readPreferences(defaults, storage), defaults);
  assert.equal(writePreferences(defaults, { setItem() { throw Error("quota"); } }), false);
});

test("constructor resource bounds and malformed null imports are safe", () => {
  const e = new PhysicsEngine({ maxBodies: 10000, maxSubsteps: 10000, historyLimit: 10000, fixedDt: Infinity });
  assert.equal(e.maxBodies, 128); assert.equal(e.maxSubsteps, 128); assert.equal(e.historyLimit, 160);
  e.createScenario(); const before = JSON.stringify(e.saveState());
  assert.throws(() => e.restoreState({ version: 1, bodies: [null] }), /invalid bodies/);
  assert.equal(JSON.stringify(e.saveState()), before);
});

test("black hole capture region and physical contact prevent slingshot escapes", () => {
  const e = new PhysicsEngine();
  const h = e.spawnBody("black hole", { mass: 5, metadata: { captureRadiusAU: 0.05 } });
  e.spawnBody("planet", {
    mass: 1e-6,
    radius: 0.0001,
    position: [-0.1, 0.02, 0],
    velocity: [5, 0, 0],
  });
  let captured = false;
  e.on("bodyCaptured", () => (captured = true));
  for (let s = 0; s < 200; s++) e.step();
  assert.ok(captured);
  assert.equal(e.bodies.length, 1);
  assert.equal(e.bodies[0].id, h.id);

  const e2 = new PhysicsEngine();
  e2.settings.tides = false;
  const h2 = e2.spawnBody("black hole", { mass: 5 });
  e2.spawnBody("star", {
    mass: 1.0,
    radius: 0.005,
    position: [-0.01, 0.002, 0],
    velocity: [10, 0, 0],
  });
  let starCaptured = false;
  e2.on("bodyCaptured", () => (starCaptured = true));
  for (let s = 0; s < 100; s++) e2.step();
  assert.ok(starCaptured);
  assert.equal(e2.bodies.length, 1);
  assert.equal(e2.bodies[0].id, h2.id);
});

test("tidal stress ratio is invariant with respect to gravityMultiplier", () => {
  const e1 = new PhysicsEngine();
  e1.setGravityMultiplier(1);
  const primary = e1.spawnBody("star", { mass: 1 });
  const sat = e1.spawnBody("planet", { mass: 3e-6, position: [0.01, 0, 0] });
  const stress1 = e1.calculateTidalEffects(sat, primary).stressRatio;

  const e5 = new PhysicsEngine();
  e5.setGravityMultiplier(5);
  const p5 = e5.spawnBody("star", { mass: 1 });
  const s5 = e5.spawnBody("planet", { mass: 3e-6, position: [0.01, 0, 0] });
  const stress5 = e5.calculateTidalEffects(s5, p5).stressRatio;

  near(stress1, stress5, 1e-10);
});

test("multi-body bounce respects collision cooldown and isolates single-step contacts", () => {
  const e = new PhysicsEngine();
  e.gravityMultiplier = 0;
  e.settings.tides = false;
  const a = e.addBody({ id: "a", mass: 1e-6, radius: 0.001, position: [0, 0, 0], collisionMode: "bounce" });
  const b = e.addBody({ id: "b", mass: 1e-6, radius: 0.001, position: [0.0015, 0, 0], collisionMode: "bounce" });
  e.addBody({ id: "c", mass: 1e-6, radius: 0.001, position: [0.0016, 0, 0], collisionMode: "bounce" });

  let collisionCount = 0;
  e.on("collision", () => collisionCount++);
  e.step();

  // In a single step, body a should only bounce with one body (b) due to cooldown isolation
  assert.equal(collisionCount, 1);
  assert.ok(a.metadata.collisionCooldown > e.time);
  assert.ok(b.metadata.collisionCooldown > e.time);
});

test("black hole merger and supernova collapse compute Kerr spin and bounded rotation", () => {
  const e = new PhysicsEngine();
  e.gravityMultiplier = 0;
  e.settings.tides = false;
  const bh = e.spawnBody("black hole", { mass: 5, position: [0, 0, 0], velocity: [0, 0, 0] });
  e.spawnBody("planet", {
    mass: 0.1,
    position: [bh.radius * 0.5, 0, 0],
    velocity: [0, 5, 0],
  });
  e.step();
  assert.equal(e.bodies.length, 1);
  assert.ok(bh.metadata.kerrSpin !== undefined);
  assert.ok(Math.abs(bh.metadata.kerrSpin) <= 0.998);

  const eStar = new PhysicsEngine();
  const massiveStar = eStar.spawnBody("star", {
    mass: 25,
    angularVelocity: [0, 2, 0],
  });
  const remnant = eStar.triggerSupernova(massiveStar.id);
  assert.equal(remnant.type, "black hole");
  assert.ok(remnant.metadata.kerrSpin !== undefined);
  assert.ok(Math.abs(remnant.metadata.kerrSpin) <= 0.998);
});

test("solar flare direction vector is strictly normalized unit vector", () => {
  const e = new PhysicsEngine();
  const star = e.spawnBody("star");
  for (let i = 0; i < 20; i++) {
    const flare = e.triggerSolarFlare(star.id);
    const [x, y, z] = flare.direction;
    near(Math.hypot(x, y, z), 1.0, 1e-10);
  }
});

