/**
 * Event Horizon simulation kernel. No renderer, DOM, React or Three.js dependencies.
 * Positions/radii: AU. Mass: M☉. Time: Julian years. Temperature: kelvin.
 * Velocity: AU/yr, angular velocity: rad/yr. SI is used only at named boundaries.
 * Newtonian point-mass dynamics are integrated with velocity Verlet. Collisions,
 * tides, stellar evolution and magnetic effects are intentionally reduced models.
 */
export const AU_M = 149597870700;
export const SOLAR_MASS_KG = 1.98847e30;
export const SOLAR_RADIUS_M = 6.957e8;
export const EARTH_MASS_KG = 5.9722e24;
export const EARTH_RADIUS_M = 6.371e6;
export const JULIAN_YEAR_SECONDS = 31557600;
export const DAY_SECONDS = 86400;
export const C_M_PER_S = 299792458;
export const G_SI = 6.6743e-11;
export const SOLAR_LUMINOSITY_W = 3.828e26;
export const G = 4 * Math.PI ** 2;
export const TAU = Math.PI * 2;
export const auToMeters = (x) => x * AU_M;
export const metersToAU = (x) => x / AU_M;
export const solarMassesToKg = (x) => x * SOLAR_MASS_KG;
export const kgToSolarMasses = (x) => x / SOLAR_MASS_KG;
export const auPerYearToMS = (x) => (x * AU_M) / JULIAN_YEAR_SECONDS;
export const msToAUPerYear = (x) => (x * JULIAN_YEAR_SECONDS) / AU_M;
export const yearsToSeconds = (x) => x * JULIAN_YEAR_SECONDS;
export const secondsToYears = (x) => x / JULIAN_YEAR_SECONDS;
export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const finite = (x, fallback = 0) =>
  Number.isFinite(Number(x)) ? Number(x) : fallback;
const jsonClone = (x) => JSON.parse(JSON.stringify(x));
const STARS = new Set([
  "star",
  "red giant",
  "red supergiant",
  "white dwarf",
  "brown dwarf",
  "neutron star",
  "magnetar",
]);
export const isStar = (body) => STARS.has(body.type);

export class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.set(x, y, z);
  }
  set(x, y, z) {
    this.x = finite(x);
    this.y = finite(y);
    this.z = finite(z);
    return this;
  }
  copy(v) {
    return this.set(v.x, v.y, v.z);
  }
  clone() {
    return new Vector3(this.x, this.y, this.z);
  }
  add(v) {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }
  sub(v) {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }
  addScaledVector(v, s) {
    this.x += v.x * s;
    this.y += v.y * s;
    this.z += v.z * s;
    return this;
  }
  multiplyScalar(s) {
    this.x *= s;
    this.y *= s;
    this.z *= s;
    return this;
  }
  divideScalar(s) {
    return this.multiplyScalar(s ? 1 / s : 0);
  }
  dot(v) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }
  cross(v) {
    const { x, y, z } = this;
    return this.set(y * v.z - z * v.y, z * v.x - x * v.z, x * v.y - y * v.x);
  }
  lengthSq() {
    return this.dot(this);
  }
  length() {
    return Math.sqrt(this.lengthSq());
  }
  normalize() {
    return this.divideScalar(this.length());
  }
  distanceToSquared(v) {
    return (this.x - v.x) ** 2 + (this.y - v.y) ** 2 + (this.z - v.z) ** 2;
  }
  distanceTo(v) {
    return Math.sqrt(this.distanceToSquared(v));
  }
  setLength(n) {
    return this.normalize().multiplyScalar(n);
  }
  negate() {
    return this.multiplyScalar(-1);
  }
  lerp(v, t) {
    this.x += (v.x - this.x) * t;
    this.y += (v.y - this.y) * t;
    this.z += (v.z - this.z) * t;
    return this;
  }
  toArray() {
    return [this.x, this.y, this.z];
  }
  fromArray(a) {
    return this.set(a[0], a[1], a[2]);
  }
  static from(v) {
    return Array.isArray(v)
      ? new Vector3().fromArray(v)
      : new Vector3(v?.x, v?.y, v?.z);
  }
}

export class CelestialBody {
  constructor(data = {}) {
    this.id = String(
      data.id ||
        `body-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`,
    );
    this.name = String(data.name || "Untitled body");
    this.type = typeof data.type === "string" ? data.type : "planet";
    this.mass = clamp(finite(data.mass, 3.003e-6), 1e-20, 1e9);
    this.radius = clamp(finite(data.radius, EARTH_RADIUS_M / AU_M), 1e-12, 1e5);
    if (this.type === "black hole")
      this.radius =
        (2 * G_SI * this.mass * SOLAR_MASS_KG) / C_M_PER_S ** 2 / AU_M;
    for (const key of [
      "position",
      "velocity",
      "acceleration",
      "rotation",
      "angularVelocity",
    ])
      this[key] = Vector3.from(data[key]);
    this.spin = finite(data.spin, this.angularVelocity.y);
    this.axialTilt = finite(data.axialTilt);
    this.temperature = clamp(finite(data.temperature, 288), 0, 1e9);
    this.luminosity = clamp(finite(data.luminosity), 0, 1e12);
    this.albedo = clamp(finite(data.albedo, 0.3), 0, 1);
    this.emissivity = clamp(finite(data.emissivity, 1), 0.01, 1);
    this.composition = Array.isArray(data.composition)
      ? data.composition
          .filter((value) => typeof value === "string")
          .slice(0, 32)
      : ["Silicate", "Iron"];
    this.atmosphere = data.atmosphere ? jsonClone(data.atmosphere) : null;
    this.charge = finite(data.charge);
    this.collisionMode = [
      "ignore",
      "bounce",
      "merge",
      "destroy",
      "auto",
    ].includes(data.collisionMode)
      ? data.collisionMode
      : "auto";
    this.active = data.active !== false;
    this.enabled = data.enabled !== false;
    this.metadata =
      data.metadata &&
      typeof data.metadata === "object" &&
      !Array.isArray(data.metadata)
        ? jsonClone(data.metadata)
        : {};
    // Saves may contain user-authored metadata. Keep extension fields, but bound
    // the values that participate in equations or renderer transforms.
    for (const [key, fallback, min, max] of [
      ["softening", 0, 0, 1e5],
      ["visualSize", 0.06, 0.001, 5],
      ["displayScale", 1, 0.001, 1e6],
      ["tidalStretch", 1, 0.2, 3],
      ["localTimeFactor", 1, 0, 1],
      ["localTime", 0, 0, 1e12],
      ["tailLength", 0.05, 0, 5],
      ["kerrSpin", 0, -0.998, 0.998],
      ["solarActivity", 1, 0.01, 100],
      ["magneticFieldStrength", 1e10, 0, 1e12],
    ])
      if (key in this.metadata)
        this.metadata[key] = clamp(
          finite(this.metadata[key], fallback),
          min,
          max,
        );
    for (const key of ["description", "texture", "color"])
      if (key in this.metadata && typeof this.metadata[key] !== "string")
        delete this.metadata[key];
    this.recalculateDensity();
  }
  calculateDensity() {
    return (
      solarMassesToKg(this.mass) /
      ((4 / 3) * Math.PI * auToMeters(this.radius) ** 3)
    );
  }
  recalculateDensity() {
    this.density = this.calculateDensity();
    return this.density;
  }
  escapeVelocity() {
    return Math.sqrt((2 * G * this.mass) / this.radius);
  }
  serialize() {
    const data = { ...this };
    for (const key of [
      "position",
      "velocity",
      "acceleration",
      "rotation",
      "angularVelocity",
    ])
      data[key] = this[key].toArray();
    return jsonClone(data);
  }
  clone() {
    return CelestialBody.restore(this.serialize());
  }
  static restore(data) {
    return new CelestialBody(data);
  }
}

export const BODY_PRESETS = {
  asteroid: {
    mass: 2e-14,
    radius: 1e-7,
    temperature: 190,
    metadata: { color: "#938e85", visualSize: 0.035 },
    composition: ["Silicate", "Iron", "Nickel"],
  },
  planet: {
    mass: 3.003e-6,
    radius: EARTH_RADIUS_M / AU_M,
    temperature: 288,
    metadata: { color: "#70b3c7", visualSize: 0.085 },
  },
  "rogue planet": {
    mass: 9.54e-4,
    radius: 0.00047,
    temperature: 70,
    metadata: { color: "#6d87bb", visualSize: 0.14 },
  },
  comet: {
    mass: 3e-17,
    radius: 2e-8,
    temperature: 80,
    composition: ["Water ice", "Silicate", "Carbon dioxide"],
    metadata: { color: "#b2ebef", visualSize: 0.035 },
  },
  star: {
    mass: 1,
    radius: SOLAR_RADIUS_M / AU_M,
    luminosity: 1,
    temperature: 5772,
    composition: ["Hydrogen", "Helium"],
    metadata: { color: "#ffc77a", visualSize: 0.2, solarActivity: 1 },
  },
  "red giant": {
    mass: 2,
    radius: 0.2,
    luminosity: 100,
    temperature: 3500,
    composition: ["Hydrogen", "Helium"],
    metadata: { color: "#ff7754", visualSize: 0.4 },
  },
  "red supergiant": {
    mass: 15,
    radius: 3,
    luminosity: 60000,
    temperature: 3600,
    composition: ["Hydrogen", "Helium"],
    metadata: { color: "#fa583c", visualSize: 3.1 },
  },
  "white dwarf": {
    mass: 0.6,
    radius: 0.00005,
    luminosity: 0.01,
    temperature: 17000,
    composition: ["Carbon", "Oxygen"],
    metadata: { color: "#d9edff", visualSize: 0.07 },
  },
  "brown dwarf": {
    mass: 0.04,
    radius: 0.00047,
    luminosity: 0.0001,
    temperature: 1400,
    composition: ["Hydrogen", "Helium"],
    metadata: { color: "#a36043", visualSize: 0.12 },
  },
  "neutron star": {
    mass: 1.4,
    radius: 12000 / AU_M,
    luminosity: 0.001,
    temperature: 600000,
    composition: ["Neutron-rich matter"],
    metadata: { color: "#abe6ff", visualSize: 0.065 },
  },
  magnetar: {
    mass: 1.7,
    radius: 12000 / AU_M,
    luminosity: 0.01,
    temperature: 1e6,
    composition: ["Neutron-rich matter"],
    metadata: {
      color: "#c6b0ff",
      visualSize: 0.07,
      magneticFieldStrength: 1e10,
    },
  },
  "black hole": {
    mass: 5,
    radius: (2 * G_SI * 5 * SOLAR_MASS_KG) / C_M_PER_S ** 2 / AU_M,
    temperature: 0,
    composition: ["Compact gravitational source"],
    metadata: { color: "#e8a874", visualSize: 0.17, kerrSpin: 0.6 },
  },
  wormhole: {
    mass: 1e-15,
    radius: 0.15,
    collisionMode: "ignore",
    metadata: { color: "#ad9fff", visualSize: 0.17 },
  },
  "dark matter halo": {
    mass: 3,
    radius: 5,
    collisionMode: "ignore",
    temperature: 0,
    composition: ["Hypothetical dark matter"],
    metadata: { color: "#8a7fcc", visualSize: 3, softening: 3 },
  },
};

export class PhysicsEngine {
  constructor(options = {}) {
    this.bodies = [];
    this.time = 0;
    this.paused = false;
    // 0.04 yr/s ≈ 14.6 days per real second; UI states this explicitly.
    this.timeScale = 0.04;
    this.gravityMultiplier = 1;
    this.fixedDt = options.fixedDt || 1 / 32768;
    this.maxSubsteps = options.maxSubsteps || 128;
    this.softening = 1e-8;
    this.maxBodies = options.maxBodies || 128;
    this.accumulator = 0;
    this.droppedTime = 0;
    this.lastSubsteps = 0;
    this.events = new Map();
    this.history = [];
    this.historyIndex = -1;
    this.historyLimit = options.historyLimit || 160;
    this.historyInterval = options.historyInterval || 0.01;
    this.lastHistoryTime = 0;
    this.branches = new Map();
    this.settings = {
      collisions: true,
      tides: true,
      relativityEnabled: false,
      autoFlares: true,
      magnetism: true,
    };
    this.seed = 2026;
    this._environmentCounter = 0;
    this.initialState = null;
  }
  random() {
    this.seed = (1664525 * this.seed + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  on(event, callback) {
    if (!this.events.has(event)) this.events.set(event, new Set());
    this.events.get(event).add(callback);
    return () => this.off(event, callback);
  }
  off(event, callback) {
    this.events.get(event)?.delete(callback);
  }
  emit(event, payload = {}) {
    this.events.get(event)?.forEach((callback) => callback(payload));
    this.events
      .get("*")
      ?.forEach((callback) =>
        callback({ type: event, time: this.time, ...payload }),
      );
  }
  addBody(data) {
    if (this.bodies.length >= this.maxBodies)
      throw new Error(
        `Body limit reached (${this.maxBodies}). Remove bodies before adding more.`,
      );
    const body = data instanceof CelestialBody ? data : new CelestialBody(data);
    if (this.getBody(body.id))
      throw new Error(`Duplicate body identifier: ${body.id}`);
    this.bodies.push(body);
    this.emit("bodyAdded", { body });
    return body;
  }
  spawnBody(type = "planet", overrides = {}) {
    const preset = BODY_PRESETS[type] || BODY_PRESETS.planet;
    return this.addBody({
      ...preset,
      ...overrides,
      type,
      name: overrides.name || type.replace(/\b\w/g, (x) => x.toUpperCase()),
      metadata: { ...preset.metadata, ...overrides.metadata },
    });
  }
  getBody(id) {
    return this.bodies.find((b) => b.id === id || b.name === id);
  }
  getBodies() {
    return this.bodies;
  }
  removeBody(id) {
    const body = this.getBody(id);
    if (!body) return false;
    this.bodies.splice(this.bodies.indexOf(body), 1);
    this.emit("bodyRemoved", { body });
    return true;
  }
  updateBody(id, changes) {
    const body = this.getBody(id);
    if (!body) return null;
    const safe = new CelestialBody({
      ...body.serialize(),
      ...changes,
      id: body.id,
      metadata: { ...body.metadata, ...changes.metadata },
    });
    Object.assign(body, safe);
    this.emit("bodyUpdated", { body });
    return body;
  }
  clearBodies() {
    this.bodies = [];
    this.emit("simulationReset");
  }
  pause() {
    this.paused = true;
    this.accumulator = 0;
  }
  resume() {
    this.paused = false;
  }
  setTimeScale(value) {
    this.timeScale = clamp(finite(value, 0.04), -1, 1);
    this.accumulator = 0;
  }
  setGravityMultiplier(value) {
    this.gravityMultiplier = clamp(finite(value, 1), 0, 10);
  }
  calculateAccelerations() {
    const bodies = this.bodies,
      effectiveG = G * this.gravityMultiplier,
      soft2 = this.softening ** 2;
    for (const b of bodies) b.acceleration.set(0, 0, 0);
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i];
      if (!a.active || !a.enabled) continue;
      for (let j = i + 1; j < bodies.length; j++) {
        const b = bodies[j];
        if (!b.active || !b.enabled) continue;
        const x = b.position.x - a.position.x,
          y = b.position.y - a.position.y,
          z = b.position.z - a.position.z;
        // Plummer softening also supplies the explicitly extended halo gravity model.
        const r2 =
          x * x +
          y * y +
          z * z +
          soft2 +
          (a.metadata.softening || b.metadata.softening || 0) ** 2;
        let f = effectiveG / (r2 * Math.sqrt(r2));
        if (
          this.settings.relativityEnabled &&
          (a.type === "black hole" || b.type === "black hole")
        ) {
          // Bounded radial 1PN-inspired visualization model, NOT a GR integrator.
          f *=
            1 +
            Math.min(
              0.1,
              (3 * this.schwarzschildRadius(a.mass + b.mass)) / Math.sqrt(r2),
            );
        }
        a.acceleration.x += x * f * b.mass;
        a.acceleration.y += y * f * b.mass;
        a.acceleration.z += z * f * b.mass;
        b.acceleration.x -= x * f * a.mass;
        b.acceleration.y -= y * f * a.mass;
        b.acceleration.z -= z * f * a.mass;
      }
    }
  }
  step(dt = this.fixedDt, { record = true, environment = true } = {}) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, this.fixedDt);
    this.calculateAccelerations();
    for (const b of this.bodies) {
      if (!b.active || !b.enabled) continue;
      b._previous = b._previous || new Vector3();
      b._previous.copy(b.position);
      b.velocity.addScaledVector(b.acceleration, dt / 2);
      b.position.addScaledVector(b.velocity, dt);
    }
    this.calculateAccelerations();
    for (const b of this.bodies) {
      if (!b.active || !b.enabled) continue;
      b.velocity.addScaledVector(b.acceleration, dt / 2);
      if (
        ![
          b.position.x,
          b.position.y,
          b.position.z,
          b.velocity.x,
          b.velocity.y,
          b.velocity.z,
        ].every(Number.isFinite)
      ) {
        b.position.copy(b._previous || new Vector3());
        b.velocity.set(0, 0, 0);
        b.acceleration.set(0, 0, 0);
        b.enabled = false;
        this.pause();
        this.emit("numericalWarning", {
          body: b,
          message:
            "Non-finite motion detected. Body disabled and simulation paused.",
        });
        continue;
      }
      b.rotation.addScaledVector(b.angularVelocity, dt);
      b.metadata.localTime =
        (b.metadata.localTime || 0) + dt * (b.metadata.localTimeFactor ?? 1);
    }
    this.time += dt;
    this.handlePortalsAndCaptures();
    if (this.settings.collisions) this.handleCollisions();
    if (environment && ++this._environmentCounter % 16 === 0)
      this.updateEnvironment(dt * 16);
    if (record && this.time - this.lastHistoryTime >= this.historyInterval)
      this.recordHistory();
  }
  update(realDelta) {
    if (this.paused) return;
    const delta = clamp(finite(realDelta), 0, 0.1);
    if (this.timeScale < 0) {
      this.accumulator += delta * Math.abs(this.timeScale);
      if (this.accumulator >= this.historyInterval) {
        this.accumulator = 0;
        if (!this.undo()) this.pause();
      }
      return;
    }
    this.accumulator += delta * this.timeScale;
    const max = this.fixedDt * this.maxSubsteps;
    if (this.accumulator > max) {
      this.droppedTime += this.accumulator - max;
      this.accumulator = max;
    }
    this.lastSubsteps = 0;
    while (
      this.accumulator >= this.fixedDt &&
      this.lastSubsteps < this.maxSubsteps
    ) {
      this.step();
      this.accumulator -= this.fixedDt;
      this.lastSubsteps++;
    }
  }
  // Swept relative segment prevents small, fast projectiles tunneling between steps.
  closestApproach(a, b) {
    const ap = a._previous || a.position,
      bp = b._previous || b.position;
    const x = bp.x - ap.x,
      y = bp.y - ap.y,
      z = bp.z - ap.z;
    const dx = b.position.x - a.position.x - x,
      dy = b.position.y - a.position.y - y,
      dz = b.position.z - a.position.z - z;
    const length2 = dx * dx + dy * dy + dz * dz;
    const t = length2 ? clamp(-(x * dx + y * dy + z * dz) / length2, 0, 1) : 1;
    return Math.hypot(x + dx * t, y + dy * t, z + dz * t);
  }
  handlePortalsAndCaptures() {
    for (const source of [...this.bodies]) {
      if (!source.enabled || !source.active) continue;
      if (source.type === "black hole") {
        const horizon = this.schwarzschildRadius(source.mass);
        for (const b of [...this.bodies])
          if (
            b !== source &&
            b.active &&
            b.enabled &&
            b.type !== "wormhole" &&
            this.closestApproach(source, b) <= horizon &&
            this.getBody(b.id)
          ) {
            this.emit("eventHorizonCrossed", { body: b, primary: source });
            this.mergeBodies(source, b, 0);
            this.emit("bodyCaptured", { body: b, primary: source });
          }
      }
      if (source.type === "wormhole") {
        const target = this.bodies.find(
          (b) =>
            b !== source &&
            b.type === "wormhole" &&
            b.metadata.wormholeLink === source.metadata.wormholeLink,
        );
        if (!target) continue;
        for (const b of this.bodies)
          if (
            b.type !== "wormhole" &&
            b.enabled &&
            b.active &&
            (b.metadata.portalCooldownUntil || 0) <= this.time &&
            this.closestApproach(source, b) < source.radius
          ) {
            const direction = b.velocity.length()
              ? b.velocity.clone().normalize()
              : new Vector3(1, 0, 0);
            b.position
              .copy(target.position)
              .addScaledVector(direction, target.radius * 1.3 + b.radius);
            b._previous?.copy(b.position);
            b.metadata.portalCooldownUntil = this.time + 0.02;
            this.emit("wormholeTransit", { body: b, source, target });
          }
      }
    }
  }
  handleCollisions() {
    const bodies = [...this.bodies],
      consumed = new Set();
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i];
      if (
        consumed.has(a.id) ||
        !a.active ||
        !a.enabled ||
        a.collisionMode === "ignore" ||
        (a.metadata.collisionCooldown || 0) > this.time
      )
        continue;
      for (let j = i + 1; j < bodies.length; j++) {
        const b = bodies[j];
        if (
          consumed.has(b.id) ||
          !b.active ||
          !b.enabled ||
          b.collisionMode === "ignore" ||
          (b.metadata.collisionCooldown || 0) > this.time
        )
          continue;
        if (this.closestApproach(a, b) > a.radius + b.radius) continue;
        this.emit("collision", { a, b, position: a.position.clone() });
        if (a.collisionMode === "destroy" || b.collisionMode === "destroy") {
          this.removeBody(a.id);
          this.removeBody(b.id);
          consumed.add(a.id);
          consumed.add(b.id);
          break;
        }
        if (a.collisionMode === "bounce" || b.collisionMode === "bounce") {
          this.bounceBodies(a, b);
          continue;
        }
        const speed = a.velocity.distanceTo(b.velocity);
        const escape = Math.sqrt(
          (2 * G * this.gravityMultiplier * (a.mass + b.mass)) /
            (a.radius + b.radius),
        );
        const ratio = speed / Math.max(escape, 1e-10);
        const fraction =
          a.collisionMode === "merge" || b.collisionMode === "merge"
            ? 0
            : clamp((ratio - 0.9) * 0.15, 0, 0.45);
        const survivor = a.mass >= b.mass ? a : b,
          victim = survivor === a ? b : a;
        this.mergeBodies(survivor, victim, fraction);
        consumed.add(victim.id);
        // Each body resolves at most one impact per step to avoid stale-pair cascades.
        consumed.add(survivor.id);
        break;
      }
    }
  }
  bounceBodies(a, b, restitution = 0.55, friction = 0.2) {
    const n = b.position.clone().sub(a.position).normalize();
    if (!n.lengthSq()) n.set(1, 0, 0);
    const ra = n.clone().multiplyScalar(a.radius),
      rb = n.clone().multiplyScalar(-b.radius);
    const va = a.velocity.clone().add(a.angularVelocity.clone().cross(ra));
    const vb = b.velocity.clone().add(b.angularVelocity.clone().cross(rb));
    const relative = vb.sub(va),
      normalSpeed = relative.dot(n),
      inverseMass = 1 / a.mass + 1 / b.mass;
    const inertiaA = 0.4 * a.mass * a.radius ** 2,
      inertiaB = 0.4 * b.mass * b.radius ** 2;
    if (normalSpeed < 0) {
      const j = (-(1 + restitution) * normalSpeed) / inverseMass;
      const impulse = n.clone().multiplyScalar(j);
      const tangent = relative.clone().addScaledVector(n, -normalSpeed),
        tangentSpeed = tangent.length();
      if (tangentSpeed > 0) {
        tangent.divideScalar(tangentSpeed);
        const jt = Math.min(
          friction * j,
          tangentSpeed /
            (inverseMass + a.radius ** 2 / inertiaA + b.radius ** 2 / inertiaB),
        );
        impulse.addScaledVector(tangent, -jt);
      }
      a.velocity.addScaledVector(impulse, -1 / a.mass);
      b.velocity.addScaledVector(impulse, 1 / b.mass);
      a.angularVelocity.addScaledVector(
        ra.clone().cross(impulse),
        -1 / inertiaA,
      );
      b.angularVelocity.addScaledVector(
        rb.clone().cross(impulse),
        1 / inertiaB,
      );
    }
    const overlap =
      Math.max(0, a.radius + b.radius - a.position.distanceTo(b.position)) +
      1e-10;
    a.position.addScaledVector(n, (-overlap * b.mass) / (a.mass + b.mass));
    b.position.addScaledVector(n, (overlap * a.mass) / (a.mass + b.mass));
    a.metadata.collisionCooldown = b.metadata.collisionCooldown =
      this.time + this.fixedDt * 2;
    this.emit("impactWave", { position: a.position.clone(), intensity: 0.5 });
  }
  calculateAngularMomentumBudget(
    bodies = this.bodies,
    origin = new Vector3(),
    velocity = new Vector3(),
  ) {
    const L = new Vector3();
    for (const b of bodies) {
      L.add(
        b.position
          .clone()
          .sub(origin)
          .cross(b.velocity.clone().sub(velocity).multiplyScalar(b.mass)),
      );
      L.addScaledVector(b.angularVelocity, 0.4 * b.mass * b.radius ** 2);
    }
    return L;
  }
  mergeBodies(a, b, ejectFraction = 0) {
    if (!this.getBody(a.id) || !this.getBody(b.id) || a === b) return a;
    const total = a.mass + b.mass,
      oldMass = a.mass;
    const center = a.position
      .clone()
      .multiplyScalar(a.mass)
      .addScaledVector(b.position, b.mass)
      .divideScalar(total);
    const velocity = a.velocity
      .clone()
      .multiplyScalar(a.mass)
      .addScaledVector(b.velocity, b.mass)
      .divideScalar(total);
    const L = this.calculateAngularMomentumBudget([a, b], center, velocity);
    const speed = a.velocity.distanceTo(b.velocity);
    const heat =
      0.1 *
      0.5 *
      solarMassesToKg((a.mass * b.mass) / total) *
      auPerYearToMS(speed) ** 2;
    let ejectMass = total * ejectFraction;
    if (this.bodies.length + 7 > this.maxBodies) ejectMass = 0;
    a.mass = total - ejectMass;
    a.radius =
      a.type === "black hole"
        ? this.schwarzschildRadius(a.mass)
        : Math.cbrt(((a.radius ** 3 + b.radius ** 3) * a.mass) / total);
    a.position.copy(center);
    a.velocity.copy(velocity);
    a.angularVelocity.copy(L).divideScalar(0.4 * a.mass * a.radius ** 2);
    a.metadata.impactHeatJ = heat;
    a.metadata.impactTemperatureSpike = clamp(
      heat / (solarMassesToKg(a.mass) * 800),
      0,
      1e6,
    );
    a.temperature = clamp(
      a.temperature + a.metadata.impactTemperatureSpike,
      0,
      1e7,
    );
    a.metadata.impactGlowUntil = this.time + 0.01;
    a.metadata.collisionCooldown = this.time + this.fixedDt * 4;
    if (isStar(a)) a.luminosity *= (a.mass / oldMass) ** 3;
    a.recalculateDensity();
    this.removeBody(b.id);
    if (ejectMass > 0) {
      // Opposite radial pairs preserve COM/momentum; retained spin carries the pair's L.
      this.generateDebris(
        a,
        ejectMass,
        Math.max(speed * 0.5, a.escapeVelocity()),
        8,
      );
      this.emit("partialAccretion", { body: a, mass: ejectMass });
    }
    this.emit("advancedCollision", {
      body: a,
      outcome: ejectMass ? "Partial accretion + ejecta" : "Accretion",
      impactSpeed: speed,
    });
    this.emit("bodyMerged", { body: a, removed: b, position: center });
    this.emit("impactWave", {
      position: center,
      intensity: clamp(speed / 10, 0.3, 3),
    });
    return a;
  }
  generateDebris(source, mass, speed, requestedCount = 8, spread = 2.5) {
    let count = Math.min(requestedCount, this.maxBodies - this.bodies.length);
    count -= count % 2;
    if (count < 2) return [];
    const fragments = [],
      radius = source.radius * Math.cbrt(mass / source.mass / count) * 0.7;
    for (let i = 0; i < count / 2; i++) {
      const angle = (TAU * i) / (count / 2),
        y = (this.random() - 0.5) * 0.7;
      const direction = new Vector3(
        Math.cos(angle),
        y,
        Math.sin(angle),
      ).normalize();
      for (const sign of [-1, 1])
        fragments.push(
          this.addBody({
            name: `${source.name} ejecta`,
            type: "debris",
            mass: mass / count,
            radius,
            position: source.position
              .clone()
              .addScaledVector(direction, sign * source.radius * spread),
            velocity: source.velocity
              .clone()
              .addScaledVector(direction, sign * speed),
            temperature: Math.min(source.temperature, 5000),
            composition: source.composition,
            metadata: {
              visualSize: 0.018,
              color: "#e9aa79",
              collisionCooldown: this.time + this.fixedDt * 32,
              fragment: true,
              displayScale: source.metadata.displayScale || 1,
            },
          }),
        );
    }
    this.emit("debrisGenerated", { fragments });
    return fragments;
  }
  calculateRocheLimit(primary, satellite, fluid = true) {
    return (
      (fluid ? 2.44 : 1.26) *
      primary.radius *
      Math.cbrt(primary.density / Math.max(satellite.density, 1e-20))
    );
  }
  calculateTidalEffects(body, primary) {
    const distance = Math.max(
      body.position.distanceTo(primary.position),
      primary.radius,
    );
    const tidalAcceleration =
      (2 * G * this.gravityMultiplier * primary.mass * body.radius) /
      distance ** 3;
    const selfGravity = (G * body.mass) / body.radius ** 2;
    return {
      distance,
      tidalAcceleration,
      rocheLimit: this.calculateRocheLimit(primary, body),
      rigidRocheLimit: this.calculateRocheLimit(primary, body, false),
      stressRatio: tidalAcceleration / Math.max(selfGravity, 1e-30),
      primaryId: primary.id,
    };
  }
  applyTidalDisruption(id) {
    const body = typeof id === "object" ? id : this.getBody(id);
    if (!body || this.bodies.length + 7 > this.maxBodies) return [];
    this.removeBody(body.id);
    const fragments = this.generateDebris(
      body,
      body.mass,
      body.escapeVelocity() * 0.3,
      8,
      3,
    );
    // Restore intrinsic spin budget in fragments; radial expansion adds no angular momentum.
    const totalI = fragments.reduce(
      (sum, f) => sum + 0.4 * f.mass * f.radius ** 2,
      0,
    );
    const L = body.angularVelocity
      .clone()
      .multiplyScalar(0.4 * body.mass * body.radius ** 2);
    if (totalI)
      for (const f of fragments) f.angularVelocity.copy(L).divideScalar(totalI);
    this.emit("tidalDisruption", {
      body,
      fragments,
      position: body.position.clone(),
    });
    return fragments;
  }
  schwarzschildRadius(mass) {
    return metersToAU((2 * G_SI * solarMassesToKg(mass)) / C_M_PER_S ** 2);
  }
  calculateRelativity(body, primary) {
    const r = Math.max(body.position.distanceTo(primary.position), 1e-20),
      rs = this.schwarzschildRadius(primary.mass);
    const gravitationalTimeFactor = Math.sqrt(Math.max(0, 1 - rs / r));
    const velocityTimeFactor = Math.sqrt(
      Math.max(
        0,
        1 -
          (auPerYearToMS(body.velocity.distanceTo(primary.velocity)) /
            C_M_PER_S) **
            2,
      ),
    );
    return {
      schwarzschildRadius: rs,
      photonSphere: 1.5 * rs,
      isco: 3 * rs,
      gravitationalTimeFactor,
      velocityTimeFactor,
      combinedApproximateTimeFactor:
        gravitationalTimeFactor * velocityTimeFactor,
    };
  }
  calculateGravitationalLensing(body, impactParameter) {
    return clamp(
      (2 * this.schwarzschildRadius(body.mass)) /
        Math.max(impactParameter, 1e-20),
      0,
      2,
    );
  }
  calculateFrameDragging(body, distance) {
    // Kerr-inspired weak-field angular rate in rad/yr, with dimensionless spin parameter χ.
    const m = solarMassesToKg(body.mass),
      r = auToMeters(Math.max(distance, this.schwarzschildRadius(body.mass)));
    const J =
      (clamp(body.metadata.kerrSpin || 0, -0.998, 0.998) * G_SI * m * m) /
      C_M_PER_S;
    return ((2 * G_SI * J) / (C_M_PER_S ** 2 * r ** 3)) * JULIAN_YEAR_SECONDS;
  }
  calculateRadiation(body) {
    let flux = 0;
    for (const star of this.bodies)
      if (star !== body && star.enabled && star.active && star.luminosity > 0)
        flux +=
          (star.luminosity * SOLAR_LUMINOSITY_W) /
          (4 *
            Math.PI *
            auToMeters(
              Math.max(star.radius, star.position.distanceTo(body.position)),
            ) **
              2);
    return { flux, earthRelative: flux / 1361 };
  }
  calculateEquilibriumTemperature(body) {
    return Math.pow(
      (this.calculateRadiation(body).flux * (1 - body.albedo)) /
        (4 * 5.670374419e-8 * body.emissivity),
      0.25,
    );
  }
  calculateHabitableZone(star) {
    return {
      inner: Math.sqrt(star.luminosity / 1.1),
      outer: Math.sqrt(star.luminosity / 0.53),
    };
  }
  atmosphericRetention(body, molecularMassAMU = 28) {
    const thermalSpeed = Math.sqrt(
      (3 * 1.380649e-23 * body.temperature) /
        (molecularMassAMU * 1.6605390666e-27),
    );
    const ratio =
      auPerYearToMS(body.escapeVelocity()) / Math.max(thermalSpeed, 1);
    return { thermalSpeed, escapeRatio: ratio, likelyRetained: ratio > 6 };
  }
  classifyExoplanet(body) {
    const m = solarMassesToKg(body.mass) / EARTH_MASS_KG;
    return m > 50
      ? "Gas giant"
      : m > 10
        ? "Ice giant / mini-Neptune"
        : m > 2
          ? "Super-Earth"
          : "Terrestrial / rocky";
  }
  stellarModel(mass) {
    const luminosity =
      mass < 0.43
        ? 0.23 * mass ** 2.3
        : mass < 2
          ? mass ** 4
          : 1.5 * mass ** 3.5;
    const radius = (mass ** 0.8 * SOLAR_RADIUS_M) / AU_M,
      temperature = 5772 * (luminosity / mass ** 1.6) ** 0.25;
    return {
      luminosity,
      radius,
      temperature,
      spectralType:
        temperature > 30000
          ? "O"
          : temperature > 10000
            ? "B"
            : temperature > 7500
              ? "A"
              : temperature > 6000
                ? "F"
                : temperature > 5200
                  ? "G"
                  : temperature > 3700
                    ? "K"
                    : "M",
    };
  }
  updateEnvironment(dt) {
    const sources = this.bodies.filter((b) => b.enabled && b.active);
    for (const body of [...sources]) {
      if (!this.getBody(body.id)) continue;
      if (isStar(body)) {
        if (
          body.metadata.activeSolarFlare &&
          body.metadata.activeSolarFlare.endTime < this.time
        )
          delete body.metadata.activeSolarFlare;
        if (
          this.settings.autoFlares &&
          body.luminosity > 0.1 &&
          this.time >= (body.metadata.nextFlareTime ?? 0.1)
        ) {
          this.triggerSolarFlare(body.id, { intensity: 0.5 + this.random() });
          body.metadata.nextFlareTime =
            this.time +
            (0.15 + this.random() * 0.4) /
              Math.max(0.1, body.metadata.solarActivity || 1);
        }
      }
      let nearestStar = null,
        nearestDistance = Infinity,
        strongest = null,
        localFactor = 1;
      for (const primary of sources)
        if (primary !== body) {
          const d = body.position.distanceTo(primary.position);
          if (primary.luminosity > 0 && d < nearestDistance) {
            nearestStar = primary;
            nearestDistance = d;
          }
          if (
            primary.mass > body.mass * 10 &&
            body.type !== "wormhole" &&
            body.type !== "dark matter halo"
          ) {
            const tides = this.calculateTidalEffects(body, primary);
            if (!strongest || tides.stressRatio > strongest.stressRatio)
              strongest = tides;
          }
          if (primary.type === "black hole")
            localFactor = Math.min(
              localFactor,
              this.calculateRelativity(body, primary)
                .combinedApproximateTimeFactor,
            );
          if (
            this.settings.magnetism &&
            primary.type === "magnetar" &&
            d < 0.03 &&
            (body.charge ||
              body.composition.some((c) => /iron|nickel/i.test(c)))
          ) {
            // Toy magnetic acceleration falls as r^-3, bounded for numerical stability.
            const strength = Math.min(5, 0.000001 / Math.max(d ** 3, 1e-12));
            body.velocity.addScaledVector(
              body.position.clone().sub(primary.position).normalize(),
              strength * dt,
            );
            if ((body.metadata.lastMagneticEvent || -1) + 0.01 < this.time) {
              this.emit("magnetarDisruption", { body, primary });
              body.metadata.lastMagneticEvent = this.time;
            }
          }
        }
      body.metadata.localTimeFactor = localFactor;
      if (body.type === "comet" && nearestStar) {
        body.metadata.nearestStarId = nearestStar.id;
        body.metadata.nearestStarDistance = nearestDistance;
        body.metadata.cometActivity = clamp(
          nearestStar.luminosity / Math.max(0.01, nearestDistance ** 2),
          0,
          5,
        );
        body.metadata.tailLength = Math.min(
          2,
          body.metadata.cometActivity * 0.4,
        );
      }
      if (strongest && this.settings.tides) {
        body.metadata.tidalStress = strongest.stressRatio;
        body.metadata.tidalStretch =
          1 + clamp(strongest.stressRatio * 0.2, 0, 1.5);
        body.metadata.tidalPrimaryId = strongest.primaryId;
        if (
          strongest.distance < strongest.rocheLimit &&
          !body.metadata.rocheWarned
        ) {
          this.emit("rocheLimitBreach", { body, ...strongest });
          body.metadata.rocheWarned = true;
        }
        if (strongest.stressRatio > 0.1 && !body.metadata.tidalWarned) {
          this.emit("tidalStress", { body, ...strongest });
          body.metadata.tidalWarned = true;
        }
        if (
          strongest.stressRatio > 1.5 &&
          !body.metadata.fragment &&
          (body.metadata.collisionCooldown || 0) < this.time
        )
          this.applyTidalDisruption(body);
      } else {
        body.metadata.tidalStretch = 1;
        body.metadata.tidalStress = 0;
      }
    }
  }
  triggerSolarFlare(id = "Sun", options = {}) {
    const star = this.getBody(id);
    if (!star || !isStar(star)) return null;
    const duration = clamp(finite(options.durationYears, 0.004), 0.00001, 1),
      intensity = clamp(finite(options.intensity, 1), 0.1, 10);
    const flare = {
      id: `flare-${star.id}-${this.time}-${this.random()}`,
      starId: star.id,
      startTime: this.time,
      endTime: this.time + duration,
      duration,
      intensity,
      energy: 1e25 * intensity,
      direction: [
        this.random() - 0.5,
        this.random() - 0.5,
        this.random() - 0.5,
      ],
    };
    Object.assign(star.metadata, {
      activeSolarFlare: flare,
      lastSolarFlare: this.time,
      solarFlareCount: (star.metadata.solarFlareCount || 0) + 1,
      coronalActivity: intensity,
    });
    for (const b of this.bodies)
      if (b !== star)
        b.metadata.solarFlareExposure =
          intensity /
          Math.max(
            star.radius ** 2,
            b.position.distanceToSquared(star.position),
          );
    this.emit("solarFlare", { star, flare, position: star.position.clone() });
    return flare;
  }
  triggerSupernova(id) {
    const star = this.getBody(id);
    if (!star || !isStar(star)) return null;
    if (this.bodies.length + 12 > this.maxBodies)
      throw new Error("Supernova needs room for 12 ejecta bodies.");
    const mass = star.mass,
      retained = mass > 20 ? mass * 0.3 : mass * 0.2,
      type = mass > 20 ? "black hole" : "neutron star";
    this.removeBody(star.id);
    const remnant = this.spawnBody(type, {
      name: `${star.name} remnant`,
      mass: retained,
      position: star.position,
      velocity: star.velocity,
      metadata: { collisionCooldown: this.time + 0.01 },
    });
    remnant.angularVelocity
      .copy(star.angularVelocity)
      .multiplyScalar(
        (star.mass * star.radius ** 2) / (remnant.mass * remnant.radius ** 2),
      );
    const shellSource = star.clone();
    shellSource.radius = Math.max(star.radius, 0.01);
    const ejecta = this.generateDebris(
      shellSource,
      mass - retained,
      msToAUPerYear(1e6),
      12,
      3,
    );
    this.emit("supernova", {
      star,
      remnant,
      ejecta,
      position: star.position.clone(),
    });
    return remnant;
  }
  calculateOrbitalElements(body, primary) {
    if (!body || !primary || body === primary) return null;
    const r = body.position.clone().sub(primary.position),
      v = body.velocity.clone().sub(primary.velocity),
      distance = r.length(),
      mu = G * this.gravityMultiplier * (body.mass + primary.mass);
    if (distance <= 0 || mu <= 0) return null;
    const h = r.clone().cross(v),
      energy = v.lengthSq() / 2 - mu / distance;
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
  getSystemDiagnostics() {
    const bodies = this.bodies.filter((b) => b.active && b.enabled),
      centerOfMass = new Vector3(),
      linearMomentum = new Vector3();
    let totalMass = 0,
      kineticEnergy = 0,
      potentialEnergy = 0;
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      totalMass += b.mass;
      centerOfMass.addScaledVector(b.position, b.mass);
      linearMomentum.addScaledVector(b.velocity, b.mass);
      kineticEnergy += 0.5 * b.mass * b.velocity.lengthSq();
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[j],
          soft = a.metadata.softening || b.metadata.softening || 0;
        potentialEnergy -=
          (G * this.gravityMultiplier * a.mass * b.mass) /
          Math.sqrt(
            a.position.distanceToSquared(b.position) +
              this.softening ** 2 +
              soft ** 2,
          );
      }
    }
    centerOfMass.divideScalar(totalMass);
    return {
      totalMass,
      centerOfMass,
      linearMomentum,
      angularMomentum: this.calculateAngularMomentumBudget(bodies),
      kineticEnergy,
      potentialEnergy,
      totalEnergy: kineticEnergy + potentialEnergy,
      bodyCount: this.bodies.length,
      activeBodyCount: bodies.length,
      time: this.time,
      droppedTime: this.droppedTime,
      substeps: this.lastSubsteps,
    };
  }
  predictTrajectory(data, steps = 96, horizon = 0.3) {
    // Test-particle Verlet in the instantaneous, frozen source field; no live mutation.
    const b =
        data instanceof CelestialBody ? data.clone() : new CelestialBody(data),
      result = [b.position.toArray()];
    const dt = horizon / clamp(steps, 2, 256),
      sources = this.bodies.filter(
        (s) => s.id !== b.id && s.enabled && s.active,
      );
    const acceleration = (position) => {
      const a = new Vector3();
      for (const s of sources) {
        const d = s.position.clone().sub(position),
          r2 =
            d.lengthSq() +
            this.softening ** 2 +
            (s.metadata.softening || 0) ** 2;
        a.addScaledVector(
          d,
          (G * this.gravityMultiplier * s.mass) / (r2 * Math.sqrt(r2)),
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
  saveState() {
    return {
      version: 1,
      time: this.time,
      fixedDt: this.fixedDt,
      gravityMultiplier: this.gravityMultiplier,
      timeScale: this.timeScale,
      paused: this.paused,
      settings: { ...this.settings },
      seed: this.seed,
      droppedTime: this.droppedTime,
      bodies: this.bodies.map((b) => {
        const data = b.serialize();
        delete data._previous;
        return data;
      }),
    };
  }
  restoreState(state, { preservePlayback = false } = {}) {
    if (
      !state ||
      state.version !== 1 ||
      !Array.isArray(state.bodies) ||
      state.bodies.length > this.maxBodies
    )
      throw new Error("Invalid or oversized Event Horizon save.");
    // Validate atomically before replacing the live simulation.
    const ids = new Set();
    for (const b of state.bodies) {
      if (
        !b.id ||
        ids.has(b.id) ||
        !Number.isFinite(b.mass) ||
        b.mass <= 0 ||
        !Number.isFinite(b.radius) ||
        b.radius <= 0 ||
        !["position", "velocity", "angularVelocity"].every(
          (k) =>
            Array.isArray(b[k]) &&
            b[k].length === 3 &&
            b[k].every(Number.isFinite),
        )
      )
        throw new Error(
          "Save contains invalid bodies or duplicate identifiers.",
        );
      ids.add(b.id);
    }
    const bodies = state.bodies.map(CelestialBody.restore);
    this.bodies = bodies;
    this.time = finite(state.time);
    this.gravityMultiplier = clamp(finite(state.gravityMultiplier, 1), 0, 10);
    this.fixedDt = clamp(
      finite(state.fixedDt, 1 / 32768),
      1 / 2097152,
      1 / 32768,
    );
    this.settings = { ...this.settings, ...state.settings };
    this.seed = finite(state.seed, 2026);
    this.droppedTime = finite(state.droppedTime);
    if (!preservePlayback) {
      this.timeScale = clamp(finite(state.timeScale, 0.04), -1, 1);
      this.paused = !!state.paused;
    }
    this.accumulator = 0;
    this.lastHistoryTime = this.time;
    this.emit("simulationReset");
  }
  recordHistory() {
    this.history.splice(this.historyIndex + 1);
    this.history.push(this.saveState());
    if (this.history.length > this.historyLimit) this.history.shift();
    this.historyIndex = this.history.length - 1;
    this.lastHistoryTime = this.time;
    this.emit("historyChanged");
  }
  checkpoint() {
    this.recordHistory();
  }
  seekHistory(index) {
    index = clamp(Math.round(index), 0, this.history.length - 1);
    if (!this.history[index]) return false;
    this.historyIndex = index;
    this.restoreState(this.history[index], { preservePlayback: true });
    this.emit("historyChanged");
    return true;
  }
  undo() {
    return this.historyIndex > 0
      ? this.seekHistory(this.historyIndex - 1)
      : false;
  }
  redo() {
    return this.historyIndex < this.history.length - 1
      ? this.seekHistory(this.historyIndex + 1)
      : false;
  }
  getHistoryInfo() {
    return {
      index: this.historyIndex,
      length: this.history.length,
      start: this.history[0]?.time || 0,
      end: this.history.at(-1)?.time || 0,
    };
  }
  createBranch(name = `Branch ${this.branches.size + 1}`) {
    if (this.branches.size >= 12 && !this.branches.has(name))
      throw new Error("Maximum 12 branches. Delete one to make room.");
    this.branches.set(name, this.saveState());
    return name;
  }
  restoreBranch(name) {
    if (!this.branches.has(name)) return false;
    this.restoreState(this.branches.get(name));
    this.recordHistory();
    this.emit("branchRestored", { name });
    return true;
  }
  createScenario(name = "solar") {
    this.bodies = [];
    this.time = 0;
    this.seed = 2026;
    this.accumulator = 0;
    this.gravityMultiplier = 1;
    this.droppedTime = 0;
    this.timeScale = 0.04;
    this.paused = false;
    this.history = [];
    this.historyIndex = -1;
    if (name === "solar") populateSolarSystem(this);
    this.initialState = this.saveState();
    this.recordHistory();
    this.emit("simulationReset");
  }
  resetScenario() {
    if (this.initialState) {
      this.restoreState(this.initialState);
      this.history = [];
      this.historyIndex = -1;
      this.recordHistory();
    } else this.createScenario();
  }
  spawnBinary(
    center = new Vector3(4, 0, 0),
    separation = 1,
    mass = 1,
    count = 2,
  ) {
    if (this.bodies.length + count > this.maxBodies)
      throw new Error("Not enough room for this star system.");
    const link = `system-${this.random()}`,
      bodies = [];
    // Equilateral 3-body solution is mathematically valid but perturbationally unstable.
    const radius = count === 3 ? separation / Math.sqrt(3) : separation / 2;
    const speed = Math.sqrt(
      count === 3 ? (G * mass) / separation : (G * mass) / (2 * separation),
    );
    for (let i = 0; i < count; i++) {
      const theta = (TAU * i) / count;
      bodies.push(
        this.spawnBody("star", {
          name: `${count === 3 ? "Trinary" : "Binary"} ${i + 1}`,
          mass,
          position: Vector3.from(center).add(
            new Vector3(Math.cos(theta) * radius, 0, Math.sin(theta) * radius),
          ),
          velocity: new Vector3(
            -Math.sin(theta) * speed,
            0,
            Math.cos(theta) * speed,
          ),
          metadata: { linkedSystem: link },
        }),
      );
    }
    return bodies;
  }
  spawnWormholePair(center = new Vector3(3, 0, 0)) {
    if (this.bodies.length + 2 > this.maxBodies)
      throw new Error("A wormhole needs two available body slots.");
    const link = `portal-${this.random()}`;
    return [-1, 1].map((side, i) =>
      this.spawnBody("wormhole", {
        name: `Wormhole ${i ? "β" : "α"}`,
        position: Vector3.from(center).add(new Vector3(side, 0, side)),
        metadata: { wormholeLink: link },
      }),
    );
  }
  spawnBelt({
    count = 24,
    inner = 2.2,
    outer = 3.2,
    primary = this.getBody("Sun"),
    galaxy = false,
  } = {}) {
    if (!primary) throw new Error("A central body is required for a disk.");
    const bodies = [];
    count = Math.min(count, this.maxBodies - this.bodies.length);
    for (let i = 0; i < count; i++) {
      const r = inner + this.random() * (outer - inner),
        angle = TAU * this.random(),
        speed = Math.sqrt((G * this.gravityMultiplier * primary.mass) / r);
      bodies.push(
        this.spawnBody(galaxy ? "star" : "asteroid", {
          name: `${galaxy ? "Cluster star" : "Belt object"} ${i + 1}`,
          mass: galaxy
            ? 0.002 + this.random() * 0.003
            : 2e-14 * (0.5 + this.random()),
          position: primary.position
            .clone()
            .add(
              new Vector3(
                r * Math.cos(angle),
                (this.random() - 0.5) * r * 0.04,
                r * Math.sin(angle),
              ),
            ),
          velocity: primary.velocity
            .clone()
            .add(
              new Vector3(-speed * Math.sin(angle), 0, speed * Math.cos(angle)),
            ),
          metadata: {
            visualSize: galaxy ? 0.055 : 0.015,
            collisionCooldown: this.time + 0.001,
          },
        }),
      );
    }
    return bodies;
  }
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
  const earth = engine.getBody("earth"),
    lunarDistance = 384400000 / AU_M;
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
  for (const b of engine.bodies)
    if (b !== sun) momentum.addScaledVector(b.velocity, b.mass);
  sun.velocity.copy(momentum).divideScalar(-sun.mass);
  return engine;
}
export function createSunEarthTestSystem() {
  const engine = new PhysicsEngine();
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
export default PhysicsEngine;
