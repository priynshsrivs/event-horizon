import test from "node:test";
import assert from "node:assert/strict";
import PhysicsEngine, { TAU } from "../src/physics/PhysicsEngine.js";
import { mapPosition } from "../src/scene/coordinates.js";

function findPrimary(body, engine) {
  if (body.metadata?.primaryId) {
    const p = engine.getBody(body.metadata.primaryId);
    if (p && p !== body) return p;
  }
  const sun = engine.getBody("sun");
  if (sun && sun !== body) return sun;
  let dominant = null,
    maxMass = 0;
  for (const b of engine.bodies) {
    if (b !== body && b.enabled && b.active && b.mass > maxMass) {
      maxMass = b.mass;
      dominant = b;
    }
  }
  return dominant;
}

function computeOrbitPoints(body, engine, compressed = true) {
  const primary = findPrimary(body, engine);
  if (!primary || primary === body || body.type === "moon") return null;
  const elements = engine.calculateOrbitalElements(body, primary);
  if (
    !elements?.bound ||
    elements.eccentricity > 0.98 ||
    elements.semiMajorAxis > 1000
  )
    return null;

  const r = body.position.clone().sub(primary.position),
    v = body.velocity.clone().sub(primary.velocity),
    normal = r.clone().cross(v).normalize();
  const x = r.clone().normalize(),
    y = normal.clone().cross(x).normalize();
  const mu =
    4 * Math.PI ** 2 * engine.gravityMultiplier * (body.mass + primary.mass);
  const ev = v.clone().cross(r.clone().cross(v)).divideScalar(mu).sub(x),
    omega = Math.atan2(ev.dot(y), ev.dot(x));

  const segments = 180;
  const positions = new Float32Array(segments * 3);
  const isMoon = body.type === "moon";
  const scaleFactor = isMoon && compressed ? 160 : 1;

  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * TAU;
    const distance =
      (elements.semiMajorAxis * (1 - elements.eccentricity ** 2)) /
      (1 + elements.eccentricity * Math.cos(a - omega));

    if (isMoon && compressed) {
      const center = mapPosition(primary.position, compressed);
      positions[i * 3] =
        center[0] +
        (x.x * Math.cos(a) + y.x * Math.sin(a)) * distance * scaleFactor;
      positions[i * 3 + 1] =
        center[1] +
        (x.y * Math.cos(a) + y.y * Math.sin(a)) * distance * scaleFactor;
      positions[i * 3 + 2] =
        center[2] +
        (x.z * Math.cos(a) + y.z * Math.sin(a)) * distance * scaleFactor;
    } else {
      const mapped = mapPosition(
        primary.position
          .clone()
          .addScaledVector(x, distance * Math.cos(a))
          .addScaledVector(y, distance * Math.sin(a)),
        compressed,
      );
      positions[i * 3] = mapped[0];
      positions[i * 3 + 1] = mapped[1];
      positions[i * 3 + 2] = mapped[2];
    }
  }
  return positions;
}

test("orbit path generation produces valid closed loops for all planets", () => {
  const engine = new PhysicsEngine();
  engine.createScenario("solar");

  const planets = [
    "mercury",
    "venus",
    "earth",
    "mars",
    "jupiter",
    "saturn",
    "uranus",
    "neptune",
  ];

  for (const id of planets) {
    const body = engine.getBody(id);
    assert.ok(body, `Body ${id} must exist in solar system`);
    const positions = computeOrbitPoints(body, engine, true);
    assert.ok(positions, `Orbit positions for ${id} must not be null`);
    assert.equal(positions.length, 180 * 3, `Orbit must have 180 3D vertices`);

    // Verify all coordinates are finite numbers
    for (let i = 0; i < positions.length; i++) {
      assert.ok(
        Number.isFinite(positions[i]),
        `Position index ${i} for ${id} must be a finite number (got ${positions[i]})`
      );
    }

    // Verify loop closure: start and end points must be within reasonable floating-point closeness
    const dx = positions[0] - positions[(179 * 3)];
    const dz = positions[2] - positions[(179 * 3) + 2];
    const stepDist = Math.hypot(
      positions[3] - positions[0],
      positions[5] - positions[2]
    );
    const closureDist = Math.hypot(dx, dz);
    assert.ok(
      closureDist <= stepDist * 1.5,
      `Orbit loop must be continuous and closed for ${id}`
    );
  }

  const moon = engine.getBody("moon");
  assert.equal(
    computeOrbitPoints(moon, engine, true),
    null,
    "Moons must not render standalone orbits in macro view"
  );
});

test("orbit path falls back to dominant primary when primaryId is missing", () => {
  const engine = new PhysicsEngine();
  engine.spawnBody("star", { mass: 2, position: [0, 0, 0] });
  const satellite = engine.spawnBody("planet", {
    mass: 1e-6,
    position: [2, 0, 0],
    velocity: [0, 0, Math.sqrt((4 * Math.PI ** 2 * 2) / 2)],
  });
  // primaryId is intentionally not set
  delete satellite.metadata.primaryId;

  const positions = computeOrbitPoints(satellite, engine, false);
  assert.ok(positions, "Orbit must calculate around dominant primary");
  assert.equal(positions.length, 180 * 3);
  for (let i = 0; i < positions.length; i++) {
    assert.ok(Number.isFinite(positions[i]));
  }
});
