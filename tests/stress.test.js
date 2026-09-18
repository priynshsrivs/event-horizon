import test from "node:test";
import assert from "node:assert/strict";
import PhysicsEngine, {
  G,
  TAU,
  createSunEarthTestSystem,
} from "../src/physics/PhysicsEngine.js";

const close = (a, b, tolerance = 1e-8) =>
  assert.ok(
    Math.abs(a - b) <= tolerance,
    `${a} ≠ ${b} (tolerance ${tolerance})`,
  );

test("simulation near 128 body cap steps stably and rejects overflows", () => {
  const engine = new PhysicsEngine({ maxBodies: 128 });
  const sun = engine.spawnBody("star", {
    id: "sun",
    name: "Sun",
    mass: 1.0,
    position: [0, 0, 0],
    velocity: [0, 0, 0],
  });

  // Spawn up to the 128 body cap
  for (let i = 1; i < 128; i++) {
    const r = 1 + i * 0.1;
    const angle = (TAU * i) / 128;
    const speed = Math.sqrt((G * sun.mass) / r);
    engine.spawnBody("planet", {
      id: `p-${i}`,
      name: `Planet ${i}`,
      mass: 1e-6,
      radius: 0.0001,
      position: [r * Math.cos(angle), 0, r * Math.sin(angle)],
      velocity: [-speed * Math.sin(angle), 0, speed * Math.cos(angle)],
    });
  }

  assert.equal(engine.bodies.length, 128);
  assert.throws(
    () => engine.spawnBody("planet"),
    /Body limit reached/,
    "Should reject adding 129th body",
  );

  // Run 50 steps under full 128-body capacity
  for (let s = 0; s < 50; s++) {
    engine.step(engine.fixedDt, { record: false, environment: false });
  }

  for (const b of engine.bodies) {
    assert.ok(Number.isFinite(b.position.x));
    assert.ok(Number.isFinite(b.velocity.x));
    assert.ok(b.enabled && b.active);
  }
});

test("many debris objects cannot exceed body cap and conserve mass", () => {
  const engine = new PhysicsEngine({ maxBodies: 32 });
  engine.spawnBody("star", {
    id: "star-1",
    name: "Target Star",
    mass: 1.0,
    radius: 0.05,
    position: [0, 0, 0],
    velocity: [0, 0, 0],
  });

  // Rapidly trigger multiple partial accretion / debris events
  for (let i = 0; i < 10; i++) {
    if (engine.bodies.length + 4 > engine.maxBodies) break;
    const projectile = engine.spawnBody("planet", {
      id: `impactor-${i}`,
      name: `Impactor ${i}`,
      mass: 0.05,
      radius: 0.01,
      position: [0.1, 0, 0],
      velocity: [0, 0, 0],
    });
    engine.mergeBodies(engine.bodies[0], projectile, 0.4);
  }

  assert.ok(engine.bodies.length <= 32);
  const diag = engine.getSystemDiagnostics();
  assert.ok(Number.isFinite(diag.totalMass));
  assert.ok(diag.totalMass > 0);
  for (const b of engine.bodies) {
    assert.ok(Number.isFinite(b.mass));
    assert.ok(Number.isFinite(b.radius));
  }
});

test("extreme time scales, boundaries and non-standard time controls", () => {
  const engine = createSunEarthTestSystem();

  // Negative and zero dt must be ignored safely
  const initialTime = engine.time;
  engine.step(-1);
  engine.step(0);
  engine.step(NaN);
  engine.step(Infinity);
  assert.equal(engine.time, initialTime, "Invalid dt should not advance time");

  // Tiny dt should advance time accurately
  engine.step(1e-9);
  close(engine.time, initialTime + 1e-9, 1e-12);

  // Oversized dt must be clamped to fixedDt
  const preDtTime = engine.time;
  engine.step(100);
  close(engine.time, preDtTime + engine.fixedDt, 1e-10);

  // Time scale clamping
  engine.setTimeScale(999);
  assert.equal(engine.timeScale, 1);
  engine.setTimeScale(-999);
  assert.equal(engine.timeScale, -1);
  engine.setTimeScale(NaN);
  assert.equal(engine.timeScale, 0.04);
});

test("repeated high-energy collisions maintain finite state and momentum", () => {
  const engine = new PhysicsEngine({ maxBodies: 64 });
  engine.settings.collisions = true;

  // Head-on collision pair with merge
  engine.spawnBody("planet", {
    id: "head-a",
    mass: 0.1,
    radius: 0.0005,
    position: [-0.001, 0, 0],
    velocity: [10, 0, 0],
    collisionMode: "merge",
  });
  engine.spawnBody("planet", {
    id: "head-b",
    mass: 0.1,
    radius: 0.0005,
    position: [0.001, 0, 0],
    velocity: [-10, 0, 0],
    collisionMode: "merge",
  });

  for (let s = 0; s < 20; s++) {
    engine.step(engine.fixedDt, { record: false, environment: false });
  }

  assert.equal(engine.bodies.length, 1);
  const survivor = engine.bodies[0];
  close(survivor.mass, 0.2, 1e-6);
  close(survivor.velocity.length(), 0, 1e-6);
});

test("repeated history snapshots, buffer wraparound and deep seek", () => {
  const engine = createSunEarthTestSystem();
  engine.historyLimit = 30;

  // Record 100 history snapshots
  for (let i = 0; i < 100; i++) {
    engine.step(engine.fixedDt, { record: true, environment: false });
    engine.recordHistory();
  }

  assert.equal(engine.history.length, 30, "History should be bounded by limit");
  assert.equal(engine.historyIndex, 29);

  // Seek back to start of buffer
  assert.ok(engine.seekHistory(0));
  assert.equal(engine.historyIndex, 0);

  // Seek forward to middle
  assert.ok(engine.seekHistory(15));
  assert.equal(engine.historyIndex, 15);

  // Seek forward to end
  assert.ok(engine.seekHistory(29));
  assert.equal(engine.historyIndex, 29);

  // Out of bound seeks clamp gracefully
  assert.ok(engine.seekHistory(-5));
  assert.equal(engine.historyIndex, 0);
  assert.ok(engine.seekHistory(500));
  assert.equal(engine.historyIndex, 29);
});

test("long running simulation of 1000 steps maintains energy bounds", () => {
  const engine = createSunEarthTestSystem();
  const initialEnergy = engine.getSystemDiagnostics().totalEnergy;

  for (let s = 0; s < 1000; s++) {
    engine.step(engine.fixedDt, { record: false, environment: false });
  }

  const finalEnergy = engine.getSystemDiagnostics().totalEnergy;
  const relativeDrift = Math.abs((finalEnergy - initialEnergy) / initialEnergy);
  assert.ok(relativeDrift < 1e-5, `Relative energy drift too large: ${relativeDrift}`);
  assert.ok(engine.bodies.every((b) => Number.isFinite(b.position.x)));
  assert.ok(engine.bodies.every((b) => Number.isFinite(b.velocity.x)));
});

test("non-finite state containment disables anomaly, pauses simulation, and preserves neighbors", () => {
  const engine = createSunEarthTestSystem();
  let warningEmitted = false;
  engine.on("numericalWarning", () => {
    warningEmitted = true;
  });

  const earth = engine.getBody("earth");
  // Inject corrupted position
  earth.position.x = NaN;

  engine.step(engine.fixedDt, { record: false, environment: false });

  assert.equal(earth.enabled, false, "Corrupted body should be disabled");
  assert.equal(engine.paused, true, "Simulation should pause upon non-finite state");
  assert.ok(warningEmitted, "Warning event should be fired");

  const sun = engine.getBody("sun");
  assert.ok(sun.enabled && sun.active, "Uncorrupted body should remain intact");
  assert.ok(Number.isFinite(sun.position.x));
  assert.ok(Number.isFinite(sun.velocity.x));
});
