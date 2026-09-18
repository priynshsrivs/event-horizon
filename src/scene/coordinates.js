import { Vector3 } from "../physics/PhysicsEngine.js";

export function mapPosition(position, compressed = true) {
  const r = Math.hypot(position.x, position.y, position.z);
  const factor = compressed && r > 0 ? (4 * Math.log1p(r)) / r : 1;
  return [position.x * factor, position.y * factor, position.z * factor];
}
export function unmapPosition(position, compressed = true) {
  const r = Math.hypot(position.x, position.y, position.z);
  const factor = compressed && r > 0 ? Math.expm1(r / 4) / r : 1;
  return new Vector3(
    position.x * factor,
    position.y * factor,
    position.z * factor,
  );
}
export function bodyPosition(body, engine, compressed = true) {
  const result = mapPosition(
    body.metadata.displayScale
      ? body.position.clone().multiplyScalar(body.metadata.displayScale)
      : body.position,
    compressed,
  );
  if (body.type === "moon" && compressed) {
    const primary = engine.getBody(body.metadata.primaryId);
    if (primary) {
      const center = mapPosition(primary.position, compressed),
        relative = body.position
          .clone()
          .sub(primary.position)
          .multiplyScalar(160);
      return [
        center[0] + relative.x,
        center[1] + relative.y,
        center[2] + relative.z,
      ];
    }
  }
  return result;
}
export const visualRadius = (body) =>
  Math.min(
    5,
    Math.max(
      0.012,
      (Number.isFinite(Number(body.metadata.visualSize))
        ? Number(body.metadata.visualSize)
        : 0.06) * 1.65,
    ),
  );
