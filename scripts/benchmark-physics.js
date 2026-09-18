import { performance } from "node:perf_hooks";
import PhysicsEngine, { G, TAU } from "../src/physics/PhysicsEngine.js";

function createBenchmarkSystem(bodyCount) {
  const engine = new PhysicsEngine({ maxBodies: Math.max(128, bodyCount) });
  engine.settings.tides = true;
  engine.settings.collisions = true;
  engine.settings.autoFlares = false;

  const sun = engine.spawnBody("star", {
    id: "central-star",
    name: "Central Star",
    mass: 1.0,
    position: [0, 0, 0],
    velocity: [0, 0, 0],
  });

  for (let i = 1; i < bodyCount; i++) {
    const r = 0.4 + (i / bodyCount) * 20;
    const angle = (TAU * i) / (bodyCount - 1);
    const speed = Math.sqrt((G * sun.mass) / r);
    engine.spawnBody("planet", {
      id: `body-${i}`,
      name: `Planet ${i}`,
      mass: 1e-6 * (1 + (i % 5)),
      radius: 0.00004,
      position: [
        r * Math.cos(angle),
        ((i % 5) - 2) * 0.01 * r,
        r * Math.sin(angle),
      ],
      velocity: [-speed * Math.sin(angle), 0, speed * Math.cos(angle)],
    });
  }

  return engine;
}

function runBenchmark() {
  const benchmarkStart = performance.now();
  const TARGET_COUNTS = [10, 25, 50, 100, 128];
  const WARMUP_STEPS = 50;
  const MEASURED_STEPS = 1000;

  console.log("=".repeat(78));
  console.log("  EVENT HORIZON PHYSICS BENCHMARK");
  console.log(`  Steps per run: ${MEASURED_STEPS} (Warmup: ${WARMUP_STEPS})`);
  console.log("=".repeat(78));

  const results = [];

  for (const count of TARGET_COUNTS) {
    const engine = createBenchmarkSystem(count);

    // Warm up JIT
    for (let s = 0; s < WARMUP_STEPS; s++) {
      engine.step(engine.fixedDt, { record: false, environment: true });
    }

    // Benchmark loop
    const start = performance.now();
    for (let s = 0; s < MEASURED_STEPS; s++) {
      engine.step(engine.fixedDt, { record: false, environment: true });
    }
    const end = performance.now();

    const totalRuntimeMs = end - start;
    const avgStepTimeMs = totalRuntimeMs / MEASURED_STEPS;
    const stepsPerSecond = (MEASURED_STEPS / (totalRuntimeMs / 1000));

    results.push({
      "Bodies": count,
      "Steps": MEASURED_STEPS,
      "Total Time (ms)": Number(totalRuntimeMs.toFixed(2)),
      "Avg Step (ms)": Number(avgStepTimeMs.toFixed(4)),
      "Steps / sec": Math.round(stepsPerSecond),
    });
  }

  console.table(results);
  console.log(`Total benchmark wall time: ${(performance.now() - benchmarkStart).toFixed(2)} ms (including warm-up).`);
  console.log("=".repeat(78));
}

runBenchmark();
