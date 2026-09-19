export const TIME_UNITS = Object.freeze({ days: 1 / 365.25, years: 1, thousand: 1e3, million: 1e6, billion: 1e9 });
export const MAX_FUTURE_YEARS = 1e11;
export function toYears(value, unit = 'years') {
  const years = Number(value) * TIME_UNITS[unit];
  if (!Number.isFinite(years) || years < 0 || years > MAX_FUTURE_YEARS) throw new RangeError('Choose a time between 0 and 100 billion years.');
  return years;
}
export function formatYears(years) {
  const [scale, label] = years >= 1e9 ? [1e9, 'billion years'] : years >= 1e6 ? [1e6, 'million years'] : years >= 1e3 ? [1e3, 'thousand years'] : years > 0 && years < 1 ? [1 / 365.25, 'days'] : [1, 'years'];
  return `${Number((years / scale).toPrecision(5)).toLocaleString('en-US')} ${label}`;
}

// Frozen two-body ellipse, solved in bounded work; no long-term N-body prediction.
export function advanceEllipse(position, velocity, mu, years) {
  const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
  const r = Math.hypot(...position), v2 = dot(velocity, velocity);
  if (!(r > 0 && mu > 0)) return null;
  const a = 1 / (2 / r - v2 / mu);
  const rv = dot(position, velocity);
  const ev = position.map((x, i) => ((v2 - mu / r) * x - rv * velocity[i]) / mu);
  const e = Math.hypot(...ev);
  if (!(a > 0 && e < 0.999)) return null;
  const h = [position[1]*velocity[2]-position[2]*velocity[1], position[2]*velocity[0]-position[0]*velocity[2], position[0]*velocity[1]-position[1]*velocity[0]];
  const hn = Math.hypot(...h);
  if (hn < 1e-15) return null;
  const p = e > 1e-8 ? ev.map(x => x / e) : position.map(x => x / r);
  const n = h.map(x => x / hn);
  const q = [n[1]*p[2]-n[2]*p[1], n[2]*p[0]-n[0]*p[2], n[0]*p[1]-n[1]*p[0]];
  const root = Math.sqrt(1 - e*e);
  const E0 = Math.atan2(dot(position, q) / (a * root), dot(position, p) / a + e);
  const rate = Math.sqrt(mu / a**3), period = 2 * Math.PI / rate;
  const M = (E0 - e*Math.sin(E0) + rate*(years % period)) % (2*Math.PI);
  let E = M;
  for (let i = 0; i < 24; i++) E -= (E-e*Math.sin(E)-M)/(1-e*Math.cos(E));
  const c = Math.cos(E), s = Math.sin(E), speed = rate*a/(1-e*c);
  return { position: p.map((x,i) => a*((c-e)*x+root*s*q[i])), velocity: p.map((x,i) => speed*(-s*x+root*c*q[i])) };
}
