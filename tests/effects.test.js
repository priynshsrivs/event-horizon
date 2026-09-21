import test from 'node:test';
import assert from 'node:assert/strict';
import { appendVisualEffect, flareEnvelope, FLARE_DURATION_MS, FLARE_COOLDOWN_MS } from '../src/scene/effectTiming.js';

test('accelerated flare bursts cannot replace or stack a star’s visible flare', () => {
  const initial = [{ id: 1, type: 'solarFlare', bodyId: 'sun', at: 1000 }];
  let effects = initial;
  for (let age = 1; age < FLARE_COOLDOWN_MS; age += 16) {
    effects = appendVisualEffect(effects, { id: age + 1, type: 'solarFlare', bodyId: 'sun', at: 1000 + age });
    assert.equal(effects, initial);
  }
  assert.equal(appendVisualEffect(effects, { type: 'solarFlare', bodyId: 'sun', at: 1000 + FLARE_COOLDOWN_MS }).length, 2);
  assert.equal(appendVisualEffect(effects, { type: 'solarFlare', bodyId: 'other-star', at: 1001 }).length, 2);
  assert.equal(appendVisualEffect(effects, { type: 'supernova', bodyId: 'sun', at: 1001 }).length, 2);
});

test('flare brightness starts at zero and fades to zero before removal', () => {
  assert.equal(flareEnvelope(-1), 0);
  assert.equal(flareEnvelope(0), 0);
  assert.ok(flareEnvelope(1) < 0.00001);
  assert.ok(flareEnvelope(600) > 0.5);
  let previous = flareEnvelope(600);
  for (let age = 601; age <= FLARE_DURATION_MS; age++) {
    const brightness = flareEnvelope(age);
    assert.ok(brightness >= 0 && brightness <= previous);
    previous = brightness;
  }
  assert.equal(flareEnvelope(FLARE_DURATION_MS + 1000), 0);
});
