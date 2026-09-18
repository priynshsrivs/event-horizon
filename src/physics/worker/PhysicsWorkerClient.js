/**
 * Client-side interface to the Physics Web Worker.
 * Handles request correlation, async messaging, event dispatching, and state caching.
 */
export class PhysicsWorkerClient {
  constructor(options = {}) {
    this.worker =
      options.worker ||
      (typeof Worker !== "undefined"
        ? options.workerUrl ? new Worker(options.workerUrl, { type: "module" })
          : new Worker(new URL("./physicsWorker.js", import.meta.url), { type: "module" })
        : null);

    this._requestId = 0;
    this._pending = new Map();
    this._listeners = new Map();
    this.latestState = null;

    if (this.worker) {
      this._bindWorker(this.worker);
    }
  }

  _bindWorker(worker) {
    worker.onmessage = (event) => {
      const data = event.data || {};
      const { id, status, state, eventName, payload, error } = data;

      if (state) {
        this.latestState = state;
      }

      if (data.type === "EVENT" && eventName) {
        this.emit(eventName, payload);
        this.emit("*", { type: eventName, ...payload });
        return;
      }

      if (id && this._pending.has(id)) {
        const { resolve, reject } = this._pending.get(id);
        this._pending.delete(id);
        if (status === "OK") {
          resolve(data);
        } else {
          reject(new Error(error || "Worker operation failed"));
        }
      }
    };

    if (typeof worker.onerror === "function" || "onerror" in worker) {
      worker.onerror = (err) => {
        for (const { reject } of this._pending.values()) reject(new Error(err.message || "Worker failed"));
        this._pending.clear();
        this.emit("error", err);
      };
    }
  }

  _send(action, payload) {
    if (!this.worker) {
      return Promise.reject(new Error("No active worker available"));
    }

    const id = ++this._requestId;
    return new Promise((resolve, reject) => {
      this._pending.set(id, { resolve, reject });
      try { this.worker.postMessage({ id, action, payload }); }
      catch (error) { this._pending.delete(id); reject(error); }
    });
  }

  on(event, callback) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    this._listeners.get(event)?.delete(callback);
  }

  emit(event, payload = {}) {
    this._listeners.get(event)?.forEach((cb) => cb(payload));
  }

  async init(options = {}) {
    const res = await this._send("INIT", options);
    return res.state;
  }

  async step(dt, options) {
    const res = await this._send("STEP", { dt, options });
    return res.state;
  }

  async update(realDelta) {
    const res = await this._send("UPDATE", { realDelta });
    return res.state;
  }

  async addBody(data) {
    const res = await this._send("ADD_BODY", data);
    return res.body;
  }

  async spawnBody(type = "planet", overrides = {}) {
    const res = await this._send("SPAWN_BODY", { type, overrides });
    return res.body;
  }

  async removeBody(id) {
    const res = await this._send("REMOVE_BODY", { id });
    return res.removed;
  }

  async updateBody(bodyId, changes = {}) {
    const res = await this._send("UPDATE_BODY", { bodyId, changes });
    return res.body;
  }

  async pause() {
    const res = await this._send("PAUSE");
    return res.state;
  }

  async resume() {
    const res = await this._send("RESUME");
    return res.state;
  }

  async setTimeScale(value) {
    const res = await this._send("SET_TIME_SCALE", { value });
    return res.state;
  }

  async setGravityMultiplier(value) {
    const res = await this._send("SET_GRAVITY_MULTIPLIER", { value });
    return res.state;
  }

  async saveState() {
    const res = await this._send("SAVE_STATE");
    return res.savedState;
  }

  async restoreState(state, options) {
    const res = await this._send("RESTORE_STATE", { state, options });
    return res.state;
  }

  async getState() {
    const res = await this._send("GET_STATE");
    return res.state;
  }

  async predictTrajectory(bodyId, steps, horizon) {
    const res = await this._send("PREDICT_TRAJECTORY", {
      bodyId,
      steps,
      horizon,
    });
    return res.trajectory;
  }

  terminate() {
    for (const [, { reject }] of this._pending) {
      reject(new Error("Worker terminated"));
    }
    this._pending.clear();
    this._listeners.clear();
    if (this.worker && typeof this.worker.terminate === "function") {
      this.worker.terminate();
    }
    this.worker = null;
  }
}

export default PhysicsWorkerClient;
