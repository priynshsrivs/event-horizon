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
export const finite = (x, fallback = 0) =>
  Number.isFinite(Number(x)) ? Number(x) : fallback;
export const jsonClone = (x) => JSON.parse(JSON.stringify(x));

export const STARS = new Set([
  "star",
  "red giant",
  "red supergiant",
  "white dwarf",
  "brown dwarf",
  "neutron star",
  "magnetar",
]);
export const isStar = (body) => STARS.has(body?.type);