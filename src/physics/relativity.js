import {
  metersToAU,
  G_SI,
  solarMassesToKg,
  C_M_PER_S,
  auPerYearToMS,
  auToMeters,
  JULIAN_YEAR_SECONDS,
  clamp,
} from "./constants.js";

/**
 * Calculates Schwarzschild radius rs = 2GM/c² in astronomical units (AU).
 */
export function schwarzschildRadius(mass) {
  return metersToAU((2 * G_SI * solarMassesToKg(mass)) / C_M_PER_S ** 2);
}

/**
 * Calculates gravitational and kinematic time dilation, photon sphere, and ISCO.
 */
export function calculateRelativity(body, primary) {
  const r = Math.max(body.position.distanceTo(primary.position), 1e-20);
  const rs = schwarzschildRadius(primary.mass);
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

/**
 * Estimates gravitational lensing deflection angle for background ray distortion.
 */
export function calculateGravitationalLensing(body, impactParameter) {
  return clamp(
    (2 * schwarzschildRadius(body.mass)) /
      Math.max(impactParameter, 1e-20),
    0,
    2,
  );
}

/**
 * Kerr-inspired weak-field frame dragging rate in rad/yr, using dimensionless spin parameter χ.
 */
export function calculateFrameDragging(body, distance) {
  const m = solarMassesToKg(body.mass);
  const r = auToMeters(Math.max(distance, schwarzschildRadius(body.mass)));
  const J =
    (clamp(body.metadata.kerrSpin || 0, -0.998, 0.998) * G_SI * m * m) /
    C_M_PER_S;
  return ((2 * G_SI * J) / (C_M_PER_S ** 2 * r ** 3)) * JULIAN_YEAR_SECONDS;
}
