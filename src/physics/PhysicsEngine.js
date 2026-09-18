/**
 * Event Horizon simulation kernel. No renderer, DOM, React or Three.js dependencies.
 * Positions/radii: AU. Mass: M☉. Time: Julian years. Temperature: kelvin.
 * Velocity: AU/yr, angular velocity: rad/yr. SI is used only at named boundaries.
 * Newtonian point-mass dynamics are integrated with velocity Verlet. Collisions,
 * tides, stellar evolution and magnetic effects are intentionally reduced models.
 */
import {
  AU_M,
  SOLAR_MASS_KG,
  SOLAR_RADIUS_M,
  EARTH_MASS_KG,
  EARTH_RADIUS_M,
  JULIAN_YEAR_SECONDS,
  DAY_SECONDS,
  C_M_PER_S,
  G_SI,
  SOLAR_LUMINOSITY_W,
  G,
  TAU,
  auToMeters,
  metersToAU,
  solarMassesToKg,
  kgToSolarMasses,
  auPerYearToMS,
  msToAUPerYear,
  yearsToSeconds,
  secondsToYears,
  clamp,
  finite,
  jsonClone,
  STARS,
  isStar,
} from "./constants.js";

export {
  AU_M,
  SOLAR_MASS_KG,
  SOLAR_RADIUS_M,
  EARTH_MASS_KG,
  EARTH_RADIUS_M,
  JULIAN_YEAR_SECONDS,
  DAY_SECONDS,
  C_M_PER_S,
  G_SI,
  SOLAR_LUMINOSITY_W,
  G,
  TAU,
  auToMeters,
  metersToAU,
  solarMassesToKg,
  kgToSolarMasses,
  auPerYearToMS,
  msToAUPerYear,
  yearsToSeconds,
  secondsToYears,
  clamp,
  finite,
  jsonClone,
  STARS,
  isStar,
};
import { Vector3 } from "./Vector3.js";

export { Vector3 };

import { CelestialBody } from "./CelestialBody.js";
export { CelestialBody };

import { BODY_PRESETS } from "./presets.js";
export { BODY_PRESETS };

import {
  closestApproach,
  bounceBodies,
  calculateAngularMomentumBudget,
  calculateCollisionOutcome,
  createDebrisPayloads,
} from "./collisions.js";

export {
  closestApproach,
  bounceBodies,
  calculateAngularMomentumBudget,
  calculateCollisionOutcome,
  createDebrisPayloads,
};

import {
  calculateRocheLimit,
  calculateTidalEffects,
  distributeDisruptionSpin,
} from "./tides.js";

export {
  calculateRocheLimit,
  calculateTidalEffects,
  distributeDisruptionSpin,
};

import {
  schwarzschildRadius,
  calculateRelativity,
  calculateGravitationalLensing,
  calculateFrameDragging,
} from "./relativity.js";

export {
  schwarzschildRadius,
  calculateRelativity,
  calculateGravitationalLensing,
  calculateFrameDragging,
};

import {
  calculateRadiation,
  calculateEquilibriumTemperature,
  calculateHabitableZone,
  atmosphericRetention,
  classifyExoplanet,
} from "./radiation.js";

export {
  calculateRadiation,
  calculateEquilibriumTemperature,
  calculateHabitableZone,
  atmosphericRetention,
  classifyExoplanet,
};

import {
  stellarModel,
  createFlareData,
  calculateSupernovaParameters,
} from "./stellar.js";

export {
  stellarModel,
  createFlareData,
  calculateSupernovaParameters,
};

import {
  calculateOrbitalElements,
  predictTrajectory,
  SOLAR_DATA,
  populateSolarSystem,
  createSunEarthTestSystem as createSunEarthTestSystemHelper,
} from "./orbits.js";

export {
  calculateOrbitalElements,
  predictTrajectory,
  SOLAR_DATA,
  populateSolarSystem,
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
    return closestApproach(a, b);
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
        const outcome = calculateCollisionOutcome(a, b, this.gravityMultiplier);
        this.mergeBodies(outcome.survivor, outcome.victim, outcome.fraction);
        consumed.add(outcome.victim.id);
        // Each body resolves at most one impact per step to avoid stale-pair cascades.
        consumed.add(outcome.survivor.id);
        break;
      }
    }
  }
  bounceBodies(a, b, restitution = 0.55, friction = 0.2) {
    bounceBodies(a, b, restitution, friction, this.time, this.fixedDt);
    this.emit("impactWave", { position: a.position.clone(), intensity: 0.5 });
  }
  calculateAngularMomentumBudget(
    bodies = this.bodies,
    origin = new Vector3(),
    velocity = new Vector3(),
  ) {
    return calculateAngularMomentumBudget(bodies, origin, velocity);
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
    const payloads = createDebrisPayloads({
      source,
      mass,
      speed,
      requestedCount,
      spread,
      maxAvailable: this.maxBodies - this.bodies.length,
      time: this.time,
      fixedDt: this.fixedDt,
      random: () => this.random(),
    });
    const fragments = payloads.map((p) => this.addBody(p));
    if (fragments.length) this.emit("debrisGenerated", { fragments });
    return fragments;
  }
  calculateRocheLimit(primary, satellite, fluid = true) {
    return calculateRocheLimit(primary, satellite, fluid);
  }
  calculateTidalEffects(body, primary) {
    return calculateTidalEffects(body, primary, this.gravityMultiplier);
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
    distributeDisruptionSpin(body, fragments);
    this.emit("tidalDisruption", {
      body,
      fragments,
      position: body.position.clone(),
    });
    return fragments;
  }
  schwarzschildRadius(mass) {
    return schwarzschildRadius(mass);
  }
  calculateRelativity(body, primary) {
    return calculateRelativity(body, primary);
  }
  calculateGravitationalLensing(body, impactParameter) {
    return calculateGravitationalLensing(body, impactParameter);
  }
  calculateFrameDragging(body, distance) {
    return calculateFrameDragging(body, distance);
  }
  calculateRadiation(body) {
    return calculateRadiation(body, this.bodies);
  }
  calculateEquilibriumTemperature(body) {
    return calculateEquilibriumTemperature(body, this.bodies);
  }
  calculateHabitableZone(star) {
    return calculateHabitableZone(star);
  }
  atmosphericRetention(body, molecularMassAMU = 28) {
    return atmosphericRetention(body, molecularMassAMU);
  }
  classifyExoplanet(body) {
    return classifyExoplanet(body);
  }
  stellarModel(mass) {
    return stellarModel(mass);
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
    const { flare, intensity } = createFlareData(
      star,
      options,
      this.time,
      () => this.random(),
    );
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
    const { retainedMass, remnantType, ejectaMass } =
      calculateSupernovaParameters(star);
    this.removeBody(star.id);
    const remnant = this.spawnBody(remnantType, {
      name: `${star.name} remnant`,
      mass: retainedMass,
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
      ejectaMass,
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
    return calculateOrbitalElements(body, primary, this.gravityMultiplier);
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
    return predictTrajectory(
      data,
      this.bodies,
      steps,
      horizon,
      this.softening,
      this.gravityMultiplier,
    );
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

export function createSunEarthTestSystem() {
  return createSunEarthTestSystemHelper(PhysicsEngine);
}
export default PhysicsEngine;
