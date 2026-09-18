import { G } from "./constants.js";

/**
 * Calculates fluid or rigid Roche limit for a primary-satellite pair based on density ratio.
 */
export function calculateRocheLimit(primary, satellite, fluid = true) {
  return (
    (fluid ? 2.44 : 1.26) *
    primary.radius *
    Math.cbrt(primary.density / Math.max(satellite.density, 1e-20))
  );
}

/**
 * Calculates differential tidal acceleration, Roche limits, and stress ratio.
 */
export function calculateTidalEffects(body, primary, gravityMultiplier = 1) {
  const distance = Math.max(
    body.position.distanceTo(primary.position),
    primary.radius,
  );
  const tidalAcceleration =
    (2 * G * gravityMultiplier * primary.mass * body.radius) /
    distance ** 3;
  const selfGravity = (G * body.mass) / body.radius ** 2;

  return {
    distance,
    tidalAcceleration,
    rocheLimit: calculateRocheLimit(primary, body, true),
    rigidRocheLimit: calculateRocheLimit(primary, body, false),
    stressRatio: tidalAcceleration / Math.max(selfGravity, 1e-30),
    primaryId: primary.id,
  };
}

/**
 * Distributes original body's spin budget into tidal disruption fragments.
 */
export function distributeDisruptionSpin(body, fragments) {
  const totalI = fragments.reduce(
    (sum, f) => sum + 0.4 * f.mass * f.radius ** 2,
    0,
  );
  const L = body.angularVelocity
    .clone()
    .multiplyScalar(0.4 * body.mass * body.radius ** 2);
  if (totalI) {
    for (const f of fragments) {
      f.angularVelocity.copy(L).divideScalar(totalI);
    }
  }
}
