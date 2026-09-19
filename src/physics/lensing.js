// Weak-field point-mass deflection in radians; invalid/zero impact is excluded.
export function lightDeflection(massSolar, impactMeters) {
  if (!Number.isFinite(massSolar) || !Number.isFinite(impactMeters) || massSolar <= 0 || impactMeters <= 0) return 0;
  return 4 * 6.6743e-11 * 1.98847e30 * massSolar / (impactMeters * 299792458 ** 2);
}
// Deliberate visual scaling in the compressed scene. UV Einstein radius squared.
export function visualEinsteinRadius(massSolar, distance) {
  if (!(massSolar > 0 && distance > 0) || !Number.isFinite(massSolar + distance)) return 0;
  return Math.min(0.22, 0.065 * Math.sqrt(Math.log1p(massSolar) / Math.log(11)) * Math.sqrt(15 / distance));
}
