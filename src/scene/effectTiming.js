export const FLARE_DURATION_MS = 5000;
export const FLARE_COOLDOWN_MS = 6500;

export function flareEnvelope(ageMs) {
  if (ageMs <= 0 || ageMs >= FLARE_DURATION_MS) return 0;
  const attack = Math.min(1, ageMs / 600);
  const release = 1 - ageMs / FLARE_DURATION_MS;
  return attack * attack * (3 - 2 * attack) * release * release;
}

// Simulation years may advance in milliseconds. Keep presentation effects on
// wall-clock time so flares cannot continually replace visible ones.
export function appendVisualEffect(effects, effect) {
  if (effect.type === 'solarFlare') {
    const previous = effects.findLast(
      (item) => item.type === 'solarFlare' && item.bodyId === effect.bodyId,
    );
    if (previous && effect.at - previous.at < FLARE_COOLDOWN_MS) return effects;
  }
  return [...effects.slice(-15), effect];
}
