import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import PhysicsEngine, {
  BODY_PRESETS,
  G,
  Vector3,
  createSunEarthTestSystem,
} from "../src/physics/PhysicsEngine.js";
import { initializeChapter, CHAPTERS } from "../src/physics/story.js";
import { bodyPosition, visualRadius } from "../src/scene/coordinates.js";

test("malformed presentation metadata cannot poison physics or render transforms", () => {
  const e = new PhysicsEngine();
  const body = e.addBody({
    type: {},
    position: [1, 0, 0],
    composition: [{ bad: true }, "Silicate"],
    metadata: {
      visualSize: "invalid",
      displayScale: "invalid",
      tidalStretch: "invalid",
      localTimeFactor: "invalid",
      softening: "invalid",
      description: {},
      customPayload: { keep: true },
    },
  });
  e.step();
  assert.equal(body.type, "planet");
  assert.deepEqual(body.composition, ["Silicate"]);
  assert.ok(bodyPosition(body, e).every(Number.isFinite));
  assert.ok(Number.isFinite(visualRadius(body)));
  assert.equal(body.metadata.description, undefined);
  assert.deepEqual(body.clone().metadata.customPayload, { keep: true });
});

test("all thirteen local texture files contain JPEG data", () => {
  const files = readdirSync(
    new URL("../public/textures/", import.meta.url),
  ).filter((f) => f.endsWith(".jpg"));
  assert.equal(files.length, 13);
  for (const file of files) {
    const data = readFileSync(
      new URL(`../public/textures/${file}`, import.meta.url),
    );
    assert.equal(data[0], 0xff, file);
    assert.equal(data[1], 0xd8, file);
    assert.ok(data.length > 10000, file);
  }
});

test("all eight story chapters initialize and step without invalid body state", () => {
  const e = new PhysicsEngine();
  for (let chapter = 0; chapter < CHAPTERS.length; chapter++) {
    initializeChapter(e, chapter);
    assert.ok(e.bodies.length > 0);
    for (let i = 0; i < 256; i++) e.step(undefined, { record: false });
    for (const b of e.bodies)
      assert.ok(
        [
          ...b.position.toArray(),
          ...b.velocity.toArray(),
          b.mass,
          b.radius,
        ].every(Number.isFinite),
        `${chapter}: ${b.name}`,
      );
  }
});

test("controlled Theia impact produces actual collision, spin and mass-conserving ejecta", () => {
  const e = new PhysicsEngine();
  initializeChapter(e, 5);
  const mass = e.getSystemDiagnostics().totalMass;
  let impact = false;
  e.on("partialAccretion", () => (impact = true));
  for (let i = 0; i < 4000; i++) e.step(undefined, { record: false });
  assert.ok(impact);
  assert.ok(e.bodies.some((b) => b.type === "debris"));
  assert.ok(!e.getBody("theia"));
  assert.ok(e.getBody("proto-earth").angularVelocity.length() > 0);
  assert.ok(Math.abs(e.getSystemDiagnostics().totalMass - mass) < 1e-18);
});

test("swept collision detects a fast projectile crossing a physical radius", () => {
  const e = new PhysicsEngine();
  e.settings.tides = false;
  e.setGravityMultiplier(0);
  e.addBody({
    id: "target",
    mass: 1e-6,
    radius: 0.00001,
    collisionMode: "merge",
  });
  e.addBody({
    mass: 1e-12,
    radius: 1e-7,
    position: [-0.001, 0, 0],
    velocity: [100, 0, 0],
  });
  e.step();
  assert.equal(e.bodies.length, 1);
});

test("automatic Roche disruption and magnetar metallic selectivity work", () => {
  const e = new PhysicsEngine();
  e.settings.autoFlares = false;
  const primary = e.spawnBody("white dwarf");
  const victim = e.spawnBody("planet", { position: [0.001, 0, 0] });
  e.time = 0.001;
  assert.ok(e.calculateTidalEffects(victim, primary).stressRatio > 1.5);
  e.updateEnvironment(0.0001);
  assert.ok(!e.getBody(victim.id));
  assert.ok(e.bodies.some((b) => b.type === "debris"));
  const m = new PhysicsEngine();
  m.settings.tides = false;
  m.spawnBody("magnetar");
  const metal = m.spawnBody("asteroid", { position: [0.01, 0, 0] });
  const ice = m.spawnBody("comet", {
    position: [0, 0.01, 0],
    composition: ["Water ice"],
  });
  m.updateEnvironment(0.001);
  assert.ok(metal.velocity.length() > 0);
  assert.equal(ice.velocity.length(), 0);
});

test("all exotic presets have distinct types, finite properties and meaningful densities", () => {
  const e = new PhysicsEngine();
  for (const type of Object.keys(BODY_PRESETS)) {
    const b = e.spawnBody(type);
    assert.equal(b.type, type);
    assert.ok(b.mass > 0 && b.radius > 0 && Number.isFinite(b.density));
  }
  assert.ok(e.bodies.find((b) => b.type === "asteroid").density < 4000);
  assert.ok(e.bodies.find((b) => b.type === "comet").density < 1000);
  const hole = e.spawnBody("black hole", { mass: 30 });
  assert.equal(hole.radius, e.schwarzschildRadius(30));
});

test("binary initial conditions have a stationary barycenter and circular speed", () => {
  const e = new PhysicsEngine(),
    bodies = e.spawnBinary(new Vector3(), 2, 1);
  assert.ok(e.getSystemDiagnostics().linearMomentum.length() < 1e-12);
  assert.ok(e.getSystemDiagnostics().centerOfMass.length() < 1e-12);
  assert.ok(Math.abs(bodies[0].velocity.length() - Math.sqrt(G / 4)) < 1e-12);
});

test("ten-year Solar System run retains all planets and bounded energy drift", () => {
  const e = new PhysicsEngine();
  e.createScenario();
  e.settings.autoFlares = false;
  const energy = e.getSystemDiagnostics().totalEnergy;
  for (let i = 0; i < 327680; i++) e.step(undefined, { record: false });
  assert.equal(e.bodies.length, 10);
  assert.ok(Math.abs(e.getSystemDiagnostics().totalEnergy / energy - 1) < 1e-5);
  assert.ok(
    e.getBody("moon").position.distanceTo(e.getBody("earth").position) < 0.0035,
  );
});

test("reverse playback replays bounded history and never integrates dissipative physics backwards", () => {
  const e = createSunEarthTestSystem();
  for (let i = 0; i < 2000; i++) e.step();
  const time = e.time,
    count = e.historyIndex;
  e.setTimeScale(-0.04);
  for (let i = 0; i < 20; i++) e.update(0.02);
  assert.ok(e.time < time);
  assert.ok(e.historyIndex < count);
});

test("non-finite integration is contained rather than propagating to the renderer", () => {
  const e = new PhysicsEngine();
  const b = e.spawnBody("asteroid");
  b.velocity.x = Number.MAX_VALUE;
  e.step();
  e.step();
  e.step();
  // Very large but finite values are still allowed; force a non-finite motion input.
  b.velocity.x = Infinity;
  e.step();
  assert.ok(e.paused);
  assert.equal(b.enabled, false);
  assert.ok(b.position.toArray().every(Number.isFinite));
});
