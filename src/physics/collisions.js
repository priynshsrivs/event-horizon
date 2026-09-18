import { Vector3 } from "./Vector3.js";
import {
  G,
  clamp,
} from "./constants.js";

/**
 * Calculates closest approach distance using swept relative line segments to
 * prevent small/fast projectiles from tunneling between discrete simulation steps.
 */
export function closestApproach(a, b) {
  const ap = a._previous || a.position;
  const bp = b._previous || b.position;
  const x = bp.x - ap.x;
  const y = bp.y - ap.y;
  const z = bp.z - ap.z;
  const dx = b.position.x - a.position.x - x;
  const dy = b.position.y - a.position.y - y;
  const dz = b.position.z - a.position.z - z;
  const length2 = dx * dx + dy * dy + dz * dz;
  const t = length2 ? clamp(-(x * dx + y * dy + z * dz) / length2, 0, 1) : 1;
  return Math.hypot(x + dx * t, y + dy * t, z + dz * t);
}

/**
 * Calculates 3D contact impulse, restitution and surface friction for bouncing bodies.
 */
export function bounceBodies(
  a,
  b,
  restitution = 0.55,
  friction = 0.2,
  time = 0,
  fixedDt = 1 / 32768,
) {
  const originalL = calculateAngularMomentumBudget([a, b]);
  // Resolve swept contacts at first touch rather than using a separating end normal.
  if (a._previous && b._previous) {
    const start = b._previous.clone().sub(a._previous);
    const delta = b.position.clone().sub(a.position).sub(start);
    const A = delta.lengthSq(), B = 2 * start.dot(delta);
    const C = start.lengthSq() - (a.radius + b.radius) ** 2;
    const discriminant = B * B - 4 * A * C;
    if (A > 0 && C > 0 && discriminant >= 0) {
      const t = (-B - Math.sqrt(discriminant)) / (2 * A);
      if (t >= 0 && t <= 1) {
        a.position.copy(a._previous.clone().lerp(a.position, t));
        b.position.copy(b._previous.clone().lerp(b.position, t));
      }
    }
  }
  const n = b.position.clone().sub(a.position).normalize();
  if (!n.lengthSq()) n.set(1, 0, 0);
  const ra = n.clone().multiplyScalar(a.radius);
  const rb = n.clone().multiplyScalar(-b.radius);
  const va = a.velocity.clone().add(a.angularVelocity.clone().cross(ra));
  const vb = b.velocity.clone().add(b.angularVelocity.clone().cross(rb));
  const relative = vb.sub(va);
  const normalSpeed = relative.dot(n);
  const inverseMass = 1 / a.mass + 1 / b.mass;
  const inertiaA = 0.4 * a.mass * a.radius ** 2;
  const inertiaB = 0.4 * b.mass * b.radius ** 2;

  if (normalSpeed < 0) {
    const j = (-(1 + restitution) * normalSpeed) / inverseMass;
    const impulse = n.clone().multiplyScalar(j);
    const tangent = relative.clone().addScaledVector(n, -normalSpeed);
    const tangentSpeed = tangent.length();
    if (tangentSpeed > 0) {
      tangent.divideScalar(tangentSpeed);
      const jt = Math.min(
        friction * j,
        tangentSpeed /
          (inverseMass + a.radius ** 2 / inertiaA + b.radius ** 2 / inertiaB),
      );
      impulse.addScaledVector(tangent, -jt);
    }
    a.velocity.addScaledVector(impulse, -1 / a.mass);
    b.velocity.addScaledVector(impulse, 1 / b.mass);
    a.angularVelocity.addScaledVector(
      ra.clone().cross(impulse),
      -1 / inertiaA,
    );
    b.angularVelocity.addScaledVector(
      rb.clone().cross(impulse),
      1 / inertiaB,
    );
  }

  const overlap =
    Math.max(0, a.radius + b.radius - a.position.distanceTo(b.position)) +
    1e-10;
  a.position.addScaledVector(n, (-overlap * b.mass) / (a.mass + b.mass));
  b.position.addScaledVector(n, (overlap * a.mass) / (a.mass + b.mass));
  // Positional separation can change orbital L for overlapping initial states.
  const correction = originalL.sub(calculateAngularMomentumBudget([a, b])).divideScalar(inertiaA + inertiaB);
  a.angularVelocity.add(correction);
  b.angularVelocity.add(correction);
  a.metadata.collisionCooldown = b.metadata.collisionCooldown =
    time + fixedDt * 2;
}

/**
 * Calculates angular momentum budget for a set of bodies about an origin and velocity frame.
 */
export function calculateAngularMomentumBudget(
  bodies = [],
  origin = new Vector3(),
  velocity = new Vector3(),
) {
  const L = new Vector3();
  for (const b of bodies) {
    L.add(
      b.position
        .clone()
        .sub(origin)
        .cross(b.velocity.clone().sub(velocity).multiplyScalar(b.mass)),
    );
    L.addScaledVector(b.angularVelocity, 0.4 * b.mass * b.radius ** 2);
  }
  return L;
}

/**
 * Calculates collision speed, mutual escape speed, ejecta fraction, survivor and victim.
 */
export function calculateCollisionOutcome(a, b, gravityMultiplier = 1) {
  const speed = a.velocity.distanceTo(b.velocity);
  const escape = Math.sqrt(
    (2 * G * gravityMultiplier * (a.mass + b.mass)) /
      (a.radius + b.radius),
  );
  const reducedMass = a.mass * b.mass / (a.mass + b.mass);
  const impactEnergy = 0.5 * reducedMass * speed ** 2;
  // Uniform-sphere self-binding plus mutual binding at contact, in M☉ AU²/yr².
  const bindingEnergy = G * gravityMultiplier * (
    0.6 * (a.mass ** 2 / a.radius + b.mass ** 2 / b.radius) +
    a.mass * b.mass / (a.radius + b.radius)
  );
  const ratio = impactEnergy / Math.max(bindingEnergy, 1e-30);
  const catastrophic = ratio >= 2;
  const fraction =
    a.collisionMode === "merge" || b.collisionMode === "merge"
      ? 0
      : catastrophic ? 0.5 + 0.4 * (1 - 2 / ratio)
        : clamp((ratio - 0.05) * 0.3, 0, 0.45);
  const survivor = a.mass >= b.mass ? a : b;
  const victim = survivor === a ? b : a;
  return { speed, escape, reducedMass, impactEnergy, bindingEnergy, ratio,
    fraction, catastrophic: catastrophic && fraction > 0, survivor, victim };
}

/**
 * Generates payloads for mass-conserving physical debris / ejecta pairs.
 */
export function createDebrisPayloads({
  source,
  mass,
  speed,
  requestedCount = 8,
  spread = 2.5,
  maxAvailable = 8,
  time = 0,
  fixedDt = 1 / 32768,
  random = Math.random,
}) {
  let count = Math.min(requestedCount, maxAvailable, Math.floor(mass / 1e-20));
  count -= count % 2;
  if (count < 2) return [];

  const payloads = [];
  const originalMass = source.mass + (source.metadata?.lastEjectMass || 0);
  const radius = source.radius * Math.cbrt(mass / Math.max(originalMass, mass, 1e-30) / count);

  for (let i = 0; i < count / 2; i++) {
    const angle = (Math.PI * i) / (count / 2);
    const y = (random() - 0.5) * 0.7;
    const direction = new Vector3(
      Math.cos(angle),
      y,
      Math.sin(angle),
    ).normalize();

    for (const sign of [-1, 1]) {
      payloads.push({
        name: `${source.name} ejecta`,
        type: "debris",
        mass: mass / count,
        radius,
        position: source.position
          .clone()
          .addScaledVector(direction, sign * source.radius * spread),
        velocity: source.velocity
          .clone()
          .addScaledVector(direction, sign * speed),
        temperature: Math.min(source.temperature, 5000),
        composition: source.composition,
        metadata: {
          visualSize: 0.025,
          color: "#e9aa79",
          collisionCooldown: time + fixedDt * 32,
          fragment: true,
          impactGlowUntil: time + 0.01,
          displayScale: source.metadata.displayScale || 1,
        },
      });
    }
  }

  return payloads;
}
