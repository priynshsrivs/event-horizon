import React from 'react';
import { missionYearAt, estimateVoyagerDistance, safeMissionProgress } from '../physics/voyager.js';

export default function VoyagerMissionPanel({ story, progress, setProgress, active, setActive, playing, setPlaying, onExit, onSelect, ensureVoyagerBody }) {
  progress = safeMissionProgress(progress);
  const missionYear = missionYearAt(progress, story.waypoints);
  const idx = Math.min(story.waypoints.length - 1, Math.floor(progress * (story.waypoints.length - 1) + 1e-8));
  const waypoint = story.waypoints[idx];
  const distance = estimateVoyagerDistance(story.display);
  const seek = value => { setPlaying(false); setActive(true); setProgress(value); ensureVoyagerBody(value); onSelect('voyager-1'); };
  return <aside className="panel voyager-panel">
    <div className="panel-heading"><h2>Voyager's Journey</h2><button className="button" onClick={onExit}>Exit story</button></div>
    <p className="panel-intro">{story.description}</p>
    <section className="panel-section">
      <button className="button warm full" onClick={() => { ensureVoyagerBody(progress); onSelect('voyager-1'); setActive(true); if (progress >= 1) setProgress(0); setPlaying(!playing); }}>{active && playing ? 'Pause mission' : 'Play mission'}</button>
      <label className="range-label">MISSION YEAR <output>{missionYear.toFixed(1)}</output><input aria-label="Voyager mission progress" type="range" min="0" max="1" step="0.001" value={progress} onChange={e => seek(+e.target.value)} /></label>
      <div className="future-inputs">
        <button className="button" disabled={idx === 0} onClick={() => seek((idx-1)/(story.waypoints.length-1))}>Previous milestone</button>
        <button className="button" disabled={idx === story.waypoints.length-1} onClick={() => seek((idx+1)/(story.waypoints.length-1))}>Next milestone</button>
        <button className="button" onClick={() => { ensureVoyagerBody(progress); setActive(true); onSelect('voyager-1'); }}>Focus Voyager 1</button>
      </div>
    </section>
    <section className="panel-section"><h3>{waypoint.label}</h3><p>{waypoint.highlight || 'Launched September 5, 1977, toward Jupiter and Saturn.'}</p><p>{waypoint.date}</p></section>
    <section className="panel-section"><h3>Present distance from Earth</h3>
      <dl className="data-rows"><div><dt>Estimated distance</dt><dd>{distance.au.toFixed(1)} AU</dd></div><div><dt>Kilometres</dt><dd>{Math.round(distance.km).toLocaleString('en-US')} km</dd></div><div><dt>One-way light time</dt><dd>{distance.lightHours.toFixed(2)} hours</dd></div><div><dt>Assumed outbound speed</dt><dd>{story.display.outboundVelocityKMS} km/s</dd></div></dl>
      <p className="fine-print">Estimated as of {distance.asOf}. Baseline: {story.display.baselineDistanceAU} AU from Earth, {story.display.epoch.slice(0,10)}. <a href={story.display.sourceURL} target="_blank" rel="noreferrer">NASA source</a>. No live feed. {story.display.uncertainty}</p>
      <p className="fine-print">The journey is visually compressed and milestone timing is rescaled. Voyager is far beyond the planets; the camera path is illustrative.</p>
    </section>
  </aside>;
}
