import {
  SOLAR_RADIUS_M,
  AU_M,
  clamp,
  finite,
  auToSolarRadii,
} from "./constants.js";

/**
 * Piecewise mass-luminosity stellar model, radius, effective temperature and spectral type.
 */
export function stellarModel(mass) {
  mass = clamp(finite(mass, 1), 0.08, 150);
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

export function stellarLuminosity(radiusAU, temperature) {
  return auToSolarRadii(radiusAU) ** 2 * (temperature / 5772) ** 4;
}

// Compact logarithmic Planckian-locus RGB approximation (sRGB, 1000–40000 K).
// Coefficients: Tanner Helland, 2012, https://tannerhelland.com/2012/09/18/convert-temperature-rgb-algorithm-code.html
// Hotter compact stars use the blue-white endpoint, not an X-ray spectrum.
export function blackbodyColor(temperature) {
  const t = clamp(finite(temperature, 5772), 1000, 40000) / 100;
  const red = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592;
  const green = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661
    : 288.1221695283 * (t - 60) ** -0.0755148492;
  const blue = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return [red, green, blue].map((channel) => clamp(channel / 255, 0, 1));
}

/**
 * Calculates flare duration, energy, and radiation exposures for surrounding bodies.
 */
export function createFlareData(star, options = {}, time = 0, random = Math.random) {
  const duration = clamp(finite(options.durationYears, 0.004), 0.00001, 1);
  const intensity = clamp(finite(options.intensity, 1), 0.1, 10);
  const dx = random() - 0.5,
    dy = random() - 0.5,
    dz = random() - 0.5;
  const dLen = Math.hypot(dx, dy, dz) || 1;
  const flare = {
    id: `flare-${star.id}-${time}-${random()}`,
    starId: star.id,
    startTime: time,
    endTime: time + duration,
    duration,
    intensity,
    energy: 1e25 * intensity,
    direction: [dx / dLen, dy / dLen, dz / dLen],
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
