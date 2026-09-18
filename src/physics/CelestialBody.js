import { Vector3 } from "./Vector3.js";
import {
  clamp,
  finite,
  jsonClone,
  EARTH_RADIUS_M,
  AU_M,
  G_SI,
  SOLAR_MASS_KG,
  C_M_PER_S,
  solarMassesToKg,
  auToMeters,
  G,
} from "./constants.js";

export { Vector3 };

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
      ["captureRadiusAU", 0, 0, 1e5],
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
  bindingEnergy() {
    // Gravitational binding energy in simulation units: 3 * G * M^2 / (5 * R)
    return (3 * G * this.mass ** 2) / (5 * Math.max(this.radius, 1e-20));
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

export default CelestialBody;
