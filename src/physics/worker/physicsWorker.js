/**
 * Web Worker entrypoint for off-thread physics integration.
 * Wraps PhysicsEngine and communicates via a structured message protocol.
 */
import PhysicsEngine from "../PhysicsEngine.js";

let engine = null;

function serializeBody(b) {
  return {
    id: b.id,
    name: b.name,
    type: b.type,
    mass: b.mass,
    radius: b.radius,
    position: [b.position.x, b.position.y, b.position.z],
    velocity: [b.velocity.x, b.velocity.y, b.velocity.z],
    angularVelocity: [
      b.angularVelocity.x,
      b.angularVelocity.y,
      b.angularVelocity.z,
    ],
    rotation: [b.rotation.x, b.rotation.y, b.rotation.z],
    active: b.active,
    enabled: b.enabled,
    density: b.density,
    luminosity: b.luminosity,
    metadata: { ...b.metadata },
  };
}

function getStateSnapshot(extra = {}) {
  if (!engine) return null;
  return {
    time: engine.time,
    paused: engine.paused,
    timeScale: engine.timeScale,
    gravityMultiplier: engine.gravityMultiplier,
    bodies: engine.bodies.map(serializeBody),
    diagnostics: engine.getSystemDiagnostics(),
    ...extra,
  };
}

function handleEvent(eventName, payload) {
  const cleanPayload = {};
  for (const [k, v] of Object.entries(payload || {})) {
    if (v && typeof v.serialize === "function") {
      cleanPayload[k] = v.serialize();
    } else if (v && typeof v.toArray === "function") {
      cleanPayload[k] = v.toArray();
    } else if (Array.isArray(v)) {
      cleanPayload[k] = v.map((item) =>
        item && typeof item.serialize === "function" ? item.serialize() : item,
      );
    } else if (typeof v !== "function") {
      cleanPayload[k] = v;
    }
  }
  post({
    type: "EVENT",
    eventName,
    payload: cleanPayload,
  });
}

function hookEvents() {
  const forwarded = [
    "numericalWarning",
    "partialAccretion",
    "advancedCollision",
    "bodyMerged",
    "debrisGenerated",
    "solarFlare",
    "supernova",
    "tidalDisruption",
    "wormholeTransit",
    "wormholeExit",
    "blackHoleCapture",
    "simulationReset",
  ];
  for (const name of forwarded) {
    engine.on(name, (payload) => handleEvent(name, payload));
  }
}

function post(msg) {
  if (typeof self !== "undefined" && typeof self.postMessage === "function") {
    self.postMessage(msg);
  }
}

export function handleMessage(data) {
  const { id, action, payload } = data || {};

  try {
    switch (action) {
      case "INIT": {
        engine = new PhysicsEngine(payload || {});
        hookEvents();
        post({ id, status: "OK", state: getStateSnapshot() });
        break;
      }

      case "STEP": {
        if (!engine) throw new Error("Worker physics engine not initialized");
        const { dt, options } = payload || {};
        engine.step(dt, options);
        post({ id, status: "OK", state: getStateSnapshot() });
        break;
      }

      case "UPDATE": {
        if (!engine) throw new Error("Worker physics engine not initialized");
        const { realDelta } = payload || {};
        engine.update(realDelta);
        post({ id, status: "OK", state: getStateSnapshot() });
        break;
      }

      case "ADD_BODY": {
        if (!engine) throw new Error("Worker physics engine not initialized");
        const body = engine.addBody(payload);
        post({
          id,
          status: "OK",
          body: serializeBody(body),
          state: getStateSnapshot(),
        });
        break;
      }

      case "SPAWN_BODY": {
        if (!engine) throw new Error("Worker physics engine not initialized");
        const { type, overrides } = payload || {};
        const body = engine.spawnBody(type, overrides);
        post({
          id,
          status: "OK",
          body: serializeBody(body),
          state: getStateSnapshot(),
        });
        break;
      }

      case "REMOVE_BODY": {
        if (!engine) throw new Error("Worker physics engine not initialized");
        const removed = engine.removeBody(payload.id);
        post({ id, status: "OK", removed, state: getStateSnapshot() });
        break;
      }

      case "UPDATE_BODY": {
        if (!engine) throw new Error("Worker physics engine not initialized");
        const { bodyId, changes } = payload || {};
        const body = engine.updateBody(bodyId, changes);
        post({
          id,
          status: "OK",
          body: body ? serializeBody(body) : null,
          state: getStateSnapshot(),
        });
        break;
      }

      case "PAUSE": {
        if (!engine) throw new Error("Worker physics engine not initialized");
        engine.pause();
        post({ id, status: "OK", state: getStateSnapshot() });
        break;
      }

      case "RESUME": {
        if (!engine) throw new Error("Worker physics engine not initialized");
        engine.resume();
        post({ id, status: "OK", state: getStateSnapshot() });
        break;
      }

      case "SET_TIME_SCALE": {
        if (!engine) throw new Error("Worker physics engine not initialized");
        engine.setTimeScale(payload.value);
        post({ id, status: "OK", state: getStateSnapshot() });
        break;
      }

      case "SET_GRAVITY_MULTIPLIER": {
        if (!engine) throw new Error("Worker physics engine not initialized");
        engine.setGravityMultiplier(payload.value);
        post({ id, status: "OK", state: getStateSnapshot() });
        break;
      }

      case "SAVE_STATE": {
        if (!engine) throw new Error("Worker physics engine not initialized");
        const state = engine.saveState();
        post({ id, status: "OK", savedState: state });
        break;
      }

      case "RESTORE_STATE": {
        if (!engine) throw new Error("Worker physics engine not initialized");
        engine.restoreState(payload.state, payload.options);
        post({ id, status: "OK", state: getStateSnapshot() });
        break;
      }

      case "GET_STATE": {
        if (!engine) throw new Error("Worker physics engine not initialized");
        post({ id, status: "OK", state: getStateSnapshot() });
        break;
      }

      case "PREDICT_TRAJECTORY": {
        if (!engine) throw new Error("Worker physics engine not initialized");
        const { bodyId, steps, horizon } = payload || {};
        const body = engine.getBody(bodyId);
        const trajectory = body
          ? engine.predictTrajectory(body, steps, horizon)
          : [];
        post({
          id,
          status: "OK",
          trajectory: trajectory.map((p) => [p.x, p.y, p.z]),
        });
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    post({ id, status: "ERROR", error: error.message });
  }
}

if (typeof self !== "undefined") {
  self.onmessage = (event) => handleMessage(event.data);
}
