import {
  SOLAR_RADIUS_M,
  AU_M,
  clamp,
  finite,
} from "./constants.js";

/**
 * Piecewise mass-luminosity stellar model, radius, effective temperature and spectral type.
 */
export function stellarModel(mass) {
  const luminosity =
    mass < 0.43
      ? 0.23 * mass ** 2.3
      : mass < 2
        ? mass ** 4
        : 1.5 * mass ** 3.5;
  const radius = (mass ** 0.8 * SOLAR_RADIUS_M) / AU_M;
  const temperature = 5772 * (luminosity / mass ** 1.6) ** 0.25;

  let spectralType = "M";
  if (temperature > 30000) spectralType = "O";
  else if (temperature > 10000) spectralType = "B";
  else if (temperature > 7500) spectralType = "A";
  else if (temperature > 6000) spectralType = "F";
  else if (temperature > 5200) spectralType = "G";
  else if (temperature > 3700) spectralType = "K";

  return {
    luminosity,
    radius,
    temperature,
    spectralType,
  };
}

/**
 * Calculates flare duration, energy, and radiation exposures for surrounding bodies.
 */
export function createFlareData(star, options = {}, time = 0, random = Math.random) {
  const duration = clamp(finite(options.durationYears, 0.004), 0.00001, 1);
  const intensity = clamp(finite(options.intensity, 1), 0.1, 10);
  const flare = {
    id: `flare-${star.id}-${time}-${random()}`,
    starId: star.id,
    startTime: time,
    endTime: time + duration,
    duration,
    intensity,
    energy: 1e25 * intensity,
    direction: [
      random() - 0.5,
      random() - 0.5,
      random() - 0.5,
    ],
  };

  return { flare, duration, intensity };
}

/**
 * Calculates remnant type, retained mass, and ejecta parameters for a supernova.
 */
export function calculateSupernovaParameters(star) {
  const mass = star.mass;
  const retained = mass > 20 ? mass * 0.3 : mass * 0.2;
  const type = mass > 20 ? "black hole" : "neutron star";
  const ejectaMass = mass - retained;

  return {
    retainedMass: retained,
    remnantType: type,
    ejectaMass,
  };
}
