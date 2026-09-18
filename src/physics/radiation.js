import {
  SOLAR_LUMINOSITY_W,
  EARTH_MASS_KG,
  solarMassesToKg,
  auToMeters,
  auPerYearToMS,
} from "./constants.js";

/**
 * Calculates incident radiative flux on a body from all active luminous bodies.
 */
export function calculateRadiation(body, bodies = []) {
  let flux = 0;
  for (const star of bodies) {
    if (star !== body && star.enabled && star.active && star.luminosity > 0) {
      flux +=
        (star.luminosity * SOLAR_LUMINOSITY_W) /
        (4 *
          Math.PI *
          auToMeters(
            Math.max(star.radius, star.position.distanceTo(body.position)),
          ) **
            2);
    }
  }
  return { flux, earthRelative: flux / 1361 };
}

/**
 * Calculates radiative equilibrium temperature assuming uniform thermal reradiation.
 */
export function calculateEquilibriumTemperature(body, bodies = []) {
  const { flux } = calculateRadiation(body, bodies);
  const emissivity = Math.max(0.0001, body.emissivity || 1);
  return Math.pow(
    Math.max(0, (flux * (1 - body.albedo)) /
      (4 * 5.670374419e-8 * emissivity)),
    0.25,
  );
}

/**
 * Calculates inner and outer boundaries (in AU) of the classical habitable zone for a star.
 */
export function calculateHabitableZone(star) {
  return {
    inner: Math.sqrt(star.luminosity / 1.1),
    outer: Math.sqrt(star.luminosity / 0.53),
  };
}

/**
 * Atmospheric retention heuristic: compares molecular thermal speed with escape speed.
 */
export function atmosphericRetention(body, molecularMassAMU = 28) {
  const thermalSpeed = Math.sqrt(
    (3 * 1.380649e-23 * body.temperature) /
      (molecularMassAMU * 1.6605390666e-27),
  );
  const ratio =
    auPerYearToMS(body.escapeVelocity()) / Math.max(thermalSpeed, 1);
  return { thermalSpeed, escapeRatio: ratio, likelyRetained: ratio > 6 };
}

/**
 * Classifies an exoplanet based on its mass in Earth masses.
 */
export function classifyExoplanet(body) {
  const m = solarMassesToKg(body.mass) / EARTH_MASS_KG;
  return m > 50
    ? "Gas giant"
    : m > 10
      ? "Ice giant / mini-Neptune"
      : m > 2
        ? "Super-Earth"
        : "Terrestrial / rocky";
}
