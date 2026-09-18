import { Vector3 } from "../physics/PhysicsEngine.js";

const finiteNumber = (value, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;

function safeVectorComponents(position) {
  return [
    finiteNumber(position?.x),
    finiteNumber(position?.y),
    finiteNumber(position?.z),
  ];
}

export function mapPosition(position, compressed = true) {
  const [x, y, z] = safeVectorComponents(position);
  const r = Math.hypot(x, y, z);

  if (!compressed || r === 0) return [x, y, z];

  const factor = (4 * Math.log1p(r)) / r;
  return [x * factor, y * factor, z * factor];
}

export function unmapPosition(position, compressed = true) {
  const [x, y, z] = safeVectorComponents(position);
  const r = Math.hypot(x, y, z);

  if (!compressed || r === 0) return new Vector3(x, y, z);

  // Inverse of mapPosition:
  // visualRadius = 4 * log1p(physicalRadius)
  // physicalRadius = expm1(visualRadius / 4)
  const factor = Math.expm1(r / 4) / r;

  return new Vector3(x * factor, y * factor, z * factor);
}

export function bodyPosition(body, engine, compressed = true) {
  if (!body) return [0, 0, 0];

  const displayScale = Number.isFinite(Number(body.metadata?.displayScale))
    ? Number(body.metadata.displayScale)
    : 1;

  const sourcePosition =
    displayScale !== 1
      ? body.position.clone().multiplyScalar(displayScale)
      : body.position;

  const result = mapPosition(sourcePosition, compressed);

  // Moons are visually separated from their parent so their motion remains
  // readable in the compressed Solar System view. The physics state itself is
  // never modified by this presentation-only transform.
  if (body.type === "moon" && compressed) {
    const primary = engine?.getBody(body.metadata?.primaryId);

    if (primary) {
      const center = mapPosition(primary.position, compressed);
      const relative = body.position
        .clone()
        .sub(primary.position)
        .multiplyScalar(160);

      return [
        center[0] + finiteNumber(relative.x),
        center[1] + finiteNumber(relative.y),
        center[2] + finiteNumber(relative.z),
      ];
    }
  }

  return result;
}

export const visualRadius = (body) => {
  const rawSize = Number(body?.metadata?.visualSize);
  const size = Number.isFinite(rawSize) ? rawSize : 0.06;

  return Math.min(5, Math.max(0.012, size * 1.65));
};
