# Validation record

## Automated checks

`npm test` runs 26 Node tests against the actual renderer-independent engine:

1. Vector algebra, input defaults and vector restoration.
2. One-year Sun–Earth orbit, approximate 29.8 km/s speed and relative energy error below 10⁻⁸.
3. One-year full Solar System, Earth distance, lunar binding and balanced momentum.
4. Sun-mass response, Jupiter perturbation and safe body removal.
5. Merge mass, linear/angular momentum and off-center spin.
6. 3D bounce separation, linear momentum and friction-induced spin.
7. Partial accretion with physical ejecta and conserved mass/momentum.
8. Tidal fragment mass and center-of-mass velocity.
9. Wormhole speed preservation and cooldown.
10. Event-horizon capture and mass preservation.
11. Manual/automatic flares, exposure and expiration.
12. Supernova remnant, ejecta, mass and momentum.
13. Snapshots, branches, undo/redo, invalid save rejection and non-mutating prediction.
14. Substep/history bounds, duplicate identifiers and pause.
15. Orbital/radiative/Schwarzschild magnitudes and unbound orbits.
16. All 13 local textures have valid JPEG signatures and nonempty data.
17. All eight story scenes initialize and step with finite state.
18. The controlled Theia collision produces ejecta and spin while conserving mass.
19. Swept collision catches a fast projectile between steps.
20. Automatic Roche disruption and magnetar material selectivity.
21. Exotic type presets, plausible asteroid/comet densities and mass-dependent horizons.
22. Binary barycenter, momentum and circular speed.
23. Ten-year Solar System stability: all 10 bodies retained, lunar binding, relative total-energy drift below 10⁻⁵.
24. Reverse playback moves through history instead of integrating backwards.
25. Non-finite motion is contained, disables the affected body and pauses the simulation.
26. Malformed imported display metadata is sanitized without discarding valid extension fields.

Additional build check: `node --check src/physics/PhysicsEngine.js` and `npm run build`.

## Browser checks

The app is exercised through its actual browser UI, not by substituting a mock scene. Checks include texture appearance, Earth/Saturn/Sun focus, ring visibility, inspector data, pause/resume, body placement with drag velocity, God Mode, gravity/Sun mass controls, binary and wormhole creation, branches, story transitions, and manual flare/supernova effects. Runtime error logs are inspected after these flows.

The in-app FPS counter measures rendered frames. It is a local observation, not a cross-device performance guarantee. Body/effect/history limits bound resource growth, but long-duration heap profiling across browsers has not been performed. The build may report a large Three.js-containing bundle; this is a size advisory, not a compilation failure. The development console can show Fiber's upstream `THREE.Clock` deprecation notice with Three.js 0.186; it is not an application runtime exception.

## Repeatable manual acceptance route

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
