import React, { useState, useRef } from 'react';
import { TIME_UNITS, toYears, formatYears } from '../physics/timeline.js';

export default function FutureTimeline({ engine, onChange, act }) {
  const [amount, setAmount] = useState('250');
  const [unit, setUnit] = useState('years');
  const start = useRef(null);
  const epoch = useRef(new Date().getUTCFullYear());
  return <details className="future-timeline">
    <summary>Future timeline · elapsed {formatYears(engine.time)} · year {Number((epoch.current + engine.time).toFixed(2)).toLocaleString('en-US')}</summary>
    <div className="future-inputs">
      <label>Advance by <input aria-label="Future amount" type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} /></label>
      <select aria-label="Future time unit" value={unit} onChange={e => setUnit(e.target.value)}>{Object.keys(TIME_UNITS).map(u => <option key={u} value={u}>{u === 'days' || u === 'years' ? u : `${u} years`}</option>)}</select>
      <button className="button" onClick={() => act(() => { const years = toYears(amount, unit); start.current ??= engine.saveState(); engine.pause(); engine.advanceFuture(years); })}>Advance</button>
      <button className="button" onClick={() => { if (start.current) { engine.restoreState(start.current); start.current = null; } else engine.resetScenario(); engine.pause(); onChange(); }}>Reset to start</button>
    </div>
    <p className="fine-print">Play/pause and speed controls above run Newtonian physics. Large jumps use fixed two-body ellipses and educational stellar evolution; unbound paths are held and marked unresolved. Sizes are visually exaggerated.</p>
  </details>;
}
