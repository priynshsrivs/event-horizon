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

/**
 * Planckian blackbody color mapping (Tanner Helland algorithm).
 * Converts temperature in Kelvin to a 6-digit hex color (#rrggbb).
 */
export function kelvinToRGB(kelvin) {
  const temp = clamp(kelvin, 1000, 40000) / 100;
  let red, green, blue;

  // Red
  if (temp <= 66) {
    red = 255;
  } else {
    red = temp - 60;
    red = 329.698727446 * Math.pow(red, -0.1332047592);
    red = clamp(red, 0, 255);
  }

  // Green
  if (temp <= 66) {
    green = temp;
    green = 99.4708025861 * Math.log(green) - 161.1195681661;
    green = clamp(green, 0, 255);
  } else {
    green = temp - 60;
    green = 288.1221695283 * Math.pow(green, -0.0755148492);
    green = clamp(green, 0, 255);
  }

  // Blue
  if (temp >= 66) {
    blue = 255;
  } else if (temp <= 19) {
    blue = 0;
  } else {
    blue = temp - 10;
    blue = 138.5177312231 * Math.log(blue) - 305.0447927307;
    blue = clamp(blue, 0, 255);
  }

  const toHex = (n) => Math.round(n).toString(16).padStart(2, "0");
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}
