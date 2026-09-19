const AU_KM = 149597870.7;
export function estimateVoyagerDistance(baseline, date = new Date()) {
  const now = new Date(date), seconds = (now.getTime() - Date.parse(baseline.epoch)) / 1000;
  if (!Number.isFinite(seconds) || !Number.isFinite(baseline.baselineDistanceAU) || !Number.isFinite(baseline.outboundVelocityKMS)) throw new RangeError('Invalid Voyager epoch or baseline');
  const km = baseline.baselineDistanceAU * AU_KM + seconds * baseline.outboundVelocityKMS;
  if (km < 0) throw new RangeError('Date precedes this distance model');
  return { au: km / AU_KM, km, lightHours: km / 299792.458 / 3600, asOf: now.toISOString().slice(0,10) };
}
export function presentMission(story, date = new Date()) {
  const copy = structuredClone(story);
  const now = new Date(date);
  const year = now.getUTCFullYear() + (now - Date.UTC(now.getUTCFullYear(),0,1)) / (365.25*86400000);
  for (const waypoint of copy.waypoints) {
    if (waypoint.phase === 'present') { waypoint.year = year; waypoint.date = now.toISOString().slice(0,10); }
    if (waypoint.phase === 'future') { waypoint.year = year + 20; waypoint.date = String(Math.floor(year + 20)); }
  }
  return copy;
}
export function missionYearAt(progress, waypoints) {
  const scaled = safeMissionProgress(progress) * (waypoints.length-1);
  const index = Math.min(waypoints.length-2, Math.floor(scaled));
  return waypoints[index].year + (waypoints[index+1].year-waypoints[index].year)*(scaled-index);
}
export const safeMissionProgress = value => Number.isFinite(value) ? Math.max(0, Math.min(1,value)) : 0;
export function missionPlaybackProgress(start, elapsedMs, durationMs) {
  return safeMissionProgress(safeMissionProgress(start) + Math.max(0, elapsedMs) / Math.max(1,durationMs));
}
export function missionCameraOffset(progress) {
  const p = safeMissionProgress(progress);
  return [2.4 + p*2, 1.2 + p, 4.5 + p*3];
}
