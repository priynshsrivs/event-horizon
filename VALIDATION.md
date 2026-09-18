# Validation record

## Automated checks

`npm test` runs 58 Node test suites against the renderer-independent physics engine across 5 test files:

### Hardening, Relativity & Edge Cases (`tests/hardening.test.js`)
1. Swept moving black-hole capture conserves mass, momentum, spin and grows horizon.
2. Grazing black-hole trajectory is not captured by mesh size or projectile radius.
3. Sequential captures update horizon and removed holes cannot capture ghosts.
4. Enlarged simulation capture region never reports a physical horizon crossing.
5. Dimensionless impact energy selects merge, partial and catastrophic outcomes.
6. Catastrophic impact conserves total mass, COM and angular momentum with physical debris.
7. Swept bounce reverses a fast projectile and conserves linear/angular momentum.
8. Debris capacity fallback preserves mass at 128 bodies and repeated history restores.
9. Roche density scaling, distant stability and elongated tidal stream conservation.
10. Stellar presets obey thermal luminosity, representative densities and radius units.
11. Radiation and equilibrium temperature scale with luminosity, distance, albedo and emissivity.
12. Planckian RGB is bounded, cool orange and hot blue-white.
13. Bad mass cannot contaminate a healthy neighbor and frame stepping stops on warning.
14. Preferences persist only validated settings and tolerate corrupt or unavailable storage.
15. Constructor resource bounds and malformed null imports are safe.
16. Black hole capture region and physical contact prevent slingshot escapes.
17. Tidal stress ratio is invariant with respect to gravityMultiplier.
18. Multi-body bounce respects collision cooldown and isolates single-step contacts.
19. Black hole merger and supernova collapse compute Kerr spin and bounded rotation.
20. Solar flare direction vector is strictly normalized unit vector.

### Core physics & numerical conservation (`tests/physics.test.js`)
21. Vector algebra, serialization, input defaults and vector restoration.
22. One-year Sun–Earth orbit, approximate 29.8 km/s speed and relative energy error below 10⁻⁸.
23. One-year full Solar System, Earth distance, lunar binding and balanced momentum.
24. Sun-mass response, Jupiter perturbation and safe body removal.
25. Glancing merge mass, linear/angular momentum and off-center spin.
26. 3D bounce separation, linear momentum and friction-induced spin.
27. Partial accretion with physical ejecta and conserved mass/momentum.
28. Tidal fragment mass and center-of-mass velocity.
29. Wormhole speed preservation and cooldown.
30. Event-horizon capture and mass preservation.
31. Manual/automatic flares, exposure and expiration.
32. Supernova remnant, ejecta, mass and momentum.
33. Snapshots, branches, undo/redo, invalid save rejection and non-mutating prediction.
34. Substep/history bounds, duplicate identifiers and pause.
35. Orbital/radiative/Schwarzschild magnitudes and unbound orbits.
36. Keplerian orbital initialization and realistic 3D Solar System generation (`REAL_SOLAR_ELEMENTS`, `keplerianToCartesian`, `populateRealisticSolarSystem`).

### Scenarios & astrophysics (`tests/scenarios.test.js`)
37. All 13 local textures have valid JPEG signatures and nonempty data.
38. All eight story scenes initialize and step with finite state.
39. Controlled Theia collision produces ejecta and spin while conserving mass.
40. Swept collision catches a fast projectile crossing a physical radius between steps.
41. Automatic Roche disruption and magnetar material selectivity.
42. Exotic type presets, plausible asteroid/comet densities and mass-dependent horizons.
43. Binary barycenter, momentum and circular speed.
44. Ten-year Solar System stability: all 10 bodies retained, lunar binding, relative total-energy drift below 10⁻⁵.
45. Reverse playback moves through history instead of integrating backwards.
46. Non-finite integration is contained rather than propagating to the renderer.
47. Malformed imported display metadata is sanitized without discarding valid extension fields.

### Stress & edge conditions (`tests/stress.test.js`)
48. Simulation near 128-body capacity steps stably and rejects overflows beyond limit.
49. High-frequency debris creation cannot exceed maximum body cap and conserves total mass.
50. Extreme time scales, zero/negative dt, infinite dt, and time scale clamping.
51. Repeated high-energy collisions maintain finite state and momentum conservation.
52. Repeated history snapshot buffer wraparound and arbitrary seek index clamping.
53. Long-running simulation (1000 steps) maintains energy drift below 10⁻⁵.
54. Non-finite state containment isolates corrupted coordinates, pauses simulation, and preserves healthy neighbors.

### Web Worker architecture (`tests/worker.test.js`)
55. `PhysicsWorkerClient` lifecycle: initialization, body spawning, integration stepping, pause/resume, and state caching.
56. `PhysicsWorkerClient` error propagation and graceful rejection of invalid actions.
57. Worker failure rejects pending requests instead of leaving callers hanging.
58. Production worker entry bundles its physics dependencies.

---

## Physics performance benchmarking

The project includes a standalone performance benchmark script:

```bash
npm run benchmark
```

Executed across 1,000 Velocity Verlet integration steps per test run (with a 50-step warm-up) across varying body counts:

| Bodies ($N$) | Steps | Total Time (ms) | Avg Step Time (ms) | Steps / sec |
|:------------:|:-----:|:---------------:|:------------------:|:-----------:|
| **10**       | 1,000 | ~9.0 ms         | 0.0090 ms          | ~110,000    |
| **25**       | 1,000 | ~20.5 ms        | 0.0206 ms          | ~48,600     |
| **50**       | 1,000 | ~57.6 ms        | 0.0576 ms          | ~17,300     |
| **100**      | 1,000 | ~226.7 ms       | 0.2267 ms          | ~4,400      |
| **128**      | 1,000 | ~373.5 ms       | 0.3735 ms          | ~2,680      |

Hot-path optimizations (scalar finite checks eliminating array/closure allocations, hoised body coordinates, single square-root reuse for relativistic corrections, and precomputed mass scalings) reduced 128-body 1,000-step time from 459 ms to 373 ms (~19% throughput improvement).

---

## Web Worker evaluation

An isolated Web Worker physics kernel is implemented in `src/physics/worker/physicsWorker.js` paired with `src/physics/worker/PhysicsWorkerClient.js`. 

- **Benchmark & Overhead Analysis**: At $N = 128$, stepping on the main thread takes $\approx 0.37\text{ ms}$ for 1,000 steps ($< 0.005\text{ ms}$ per 60 FPS frame). The structured clone serialization cost across thread boundaries via `postMessage` is typically $0.5\text{ to }1.0\text{ ms}$ per message.
- **Architectural Decision**: Physics runs by default on the main thread for zero-latency, zero-copy direct access by Three.js rendering loops, while `PhysicsWorkerClient` is available for off-thread batch precomputation or background simulation without frame drops.

---

## Browser checks & manual acceptance

The app is exercised through its actual browser UI:
1. Start with `npm run dev`; inspect browser console and Network for errors.
2. Inspect Earth, Saturn and Sun; drag to orbit each. Return with System View.
3. Pause, change speed, resume, then scrub history backward and forward.
4. Build an asteroid by dragging in empty space. Check the velocity readout and dotted prediction, release, and resume.
5. Open God Mode. Adjust gravity/Sun mass, edit/delete a selected body, create binary/trinary stars, portals, a magnetar, comet and black hole. Use branches or Reset to isolate experiments.
6. Trigger a flare and supernova. Verify the event feed, visible effect, physical ejecta and compact remnant. Resume to evolve ejecta.
7. Toggle habitable zones, lensing, halo visibility and model switches in Physics. Watch all three energy traces advance.
8. Save Branch A, change the system, save Branch B and restore each. Export a JSON save, reset, and import it.
9. Enter Story; select each chapter, pause, seek, advance, exit and switch directly to God/What if/Physics. The story overlay must disappear and the pre-story universe return. Chapter eight can instead hand the final system to the sandbox.
10. Check a tablet and phone viewport. Verify drawers scroll, controls remain accessible and a focused body remains visible. Confirm sound starts only after opt-in and adjust volume.
