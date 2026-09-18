import test from "node:test";
import assert from "node:assert/strict";
import { PhysicsWorkerClient } from "../src/physics/worker/PhysicsWorkerClient.js";
import { handleMessage } from "../src/physics/worker/physicsWorker.js";
import { build } from "vite";
import { resolve } from "node:path";
import { readdirSync, readFileSync } from "node:fs";

function createMockWorker() {
  const worker = {
    onmessage: null,
    onerror: null,
    postMessage(data) {
      queueMicrotask(() => {
        handleMessage(data);
      });
    },
    terminate() {},
  };

  globalThis.self = {
    postMessage(msg) {
      queueMicrotask(() => {
        if (typeof worker.onmessage === "function") {
          worker.onmessage({ data: msg });
        }
      });
    },
  };

  return worker;
}

test("PhysicsWorkerClient lifecycle: init, spawn, step, pause, and state caching", async () => {
  const mockWorker = createMockWorker();
  const client = new PhysicsWorkerClient({ worker: mockWorker });

  const initialState = await client.init({ maxBodies: 64 });
  assert.ok(initialState);
  assert.equal(initialState.bodies.length, 0);
  assert.equal(initialState.time, 0);

  // Spawn sun
  const sun = await client.spawnBody("star", {
    name: "Sol",
    mass: 1.0,
    position: [0, 0, 0],
    velocity: [0, 0, 0],
  });
  assert.equal(sun.name, "Sol");
  assert.equal(client.latestState.bodies.length, 1);

  // Spawn earth
  const earth = await client.spawnBody("planet", {
    name: "Earth",
    mass: 3e-6,
    position: [1, 0, 0],
    velocity: [0, 6.2831853, 0],
  });
  assert.equal(earth.name, "Earth");
  assert.equal(client.latestState.bodies.length, 2);

  // Step the simulation
  const steppedState = await client.step(0.01);
  assert.ok(steppedState.time > 0);
  assert.equal(client.latestState.time, steppedState.time);

  // Pause and resume
  const pausedState = await client.pause();
  assert.equal(pausedState.paused, true);
  const resumedState = await client.resume();
  assert.equal(resumedState.paused, false);

  // Update body
  const updatedEarth = await client.updateBody(earth.id, { mass: 5e-6 });
  assert.equal(updatedEarth.mass, 5e-6);

  // Trajectory prediction
  const trajectory = await client.predictTrajectory(earth.id, 10, 0.1);
  assert.ok(Array.isArray(trajectory));
  assert.ok(trajectory.length > 0);
  assert.ok(trajectory.every(point => point.length === 3 && point.every(Number.isFinite)));

  // Save and restore
  const saved = await client.saveState();
  assert.ok(saved && saved.version === 1);

  await client.removeBody(earth.id);
  assert.equal(client.latestState.bodies.length, 1);

  await client.restoreState(saved);
  assert.equal(client.latestState.bodies.length, 2);

  client.terminate();
  await assert.rejects(() => client.getState(), /No active worker/);
});

test("PhysicsWorkerClient error propagation", async () => {
  const mockWorker = createMockWorker();
  const client = new PhysicsWorkerClient({ worker: mockWorker });

  // Calling step before init should reject
  await assert.rejects(
    () => client._send("INVALID_ACTION"),
    /Unknown action: INVALID_ACTION/,
  );

  client.terminate();
});

test("worker failure rejects pending requests instead of leaving callers hanging", async () => {
  const worker = { onerror: null, postMessage() {}, terminate() {} };
  const client = new PhysicsWorkerClient({ worker });
  const pending = client.init();
  worker.onerror({ message: "Worker load failed" });
  await assert.rejects(pending, /Worker load failed/);
  assert.equal(client._pending.size, 0);
  client.terminate();
});

test("production worker entry bundles its physics dependencies", async () => {
  const outDir = resolve("artifacts/worker-build");
  await build({ configFile: false, logLevel: "silent", build: {
    outDir, emptyOutDir: false, lib: {
      entry: resolve("src/physics/worker/PhysicsWorkerClient.js"), formats: ["es"], fileName: "client",
    },
  } });
  const workerFile = readdirSync(resolve(outDir, "assets")).find(name => name.startsWith("physicsWorker-"));
  assert.ok(workerFile);
  const code = readFileSync(resolve(outDir, "assets", workerFile), "utf8");
  assert.ok(code.includes("numericalWarning"));
  assert.ok(!code.includes('from "../PhysicsEngine.js"'));
});
