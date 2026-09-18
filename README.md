# Event Horizon

An interactive 3D universe laboratory built with React, Three.js and an independent JavaScript N-body engine. Everything runs in the browser; no accounts, backend, runtime CDN requests or API keys are required.

## Run

Requires Node.js **22.12+** (developed with Node 24.18.0).

```sh
npm install
npm run dev
```

Open the localhost address printed by Vite. To produce and serve the production build:

```sh
npm run build
npm run preview
```

Run the numerical and scenario checks with:

```sh
npm test
npm run lint
npm run benchmark
```

The checked-in lockfile fixes compatible versions: React/React DOM 19.2.8, Three.js 0.186.0, Fiber 9.7.0, Drei 10.7.8 and Vite 8.3.0. Fiber's React peer range excludes React 19.3, so do not upgrade React alone.

## Explore

- Click a planet or an Explorer entry to focus it. Drag to orbit, scroll/pinch to zoom, and right-drag to pan. **H** returns to System View.
- **Space** pauses/resumes. The default `1×` visualization speed is **14.61 simulated days per real second**. Choose **Real time** from More for wall-clock time.
- **Build** pauses physics. Choose a body, then drag on the orbital plane to set its initial position and velocity. The arrow and dotted prediction update while dragging. Release to create it, then resume to launch. **Esc** cancels placement.
- **God Mode** pauses on entry. Create exotic bodies and complete systems, edit selected-body properties, alter gravity or Sun mass, delete bodies, trigger flares/supernovae, or release the camera target. You can explicitly resume while the panel remains open.
- **What if** stores up to 12 independent snapshots. Restore a branch to experiment from that point. Export/import JSON for persistence across sessions; in-memory branches are not an autosave.
- **Physics** displays live energy history and system diagnostics, physical-model switches and field visualizations.
- **Story** has eight reproducible scenes, narration, chapter selection, pause, progress seeking and sandbox handoff. Leaving Story normally restores the pre-story universe. The final **Enter sandbox** keeps the story's final universe.
- Sound is opt-in. View, graphics quality, audio preference and volume persist in localStorage. View settings → Reset saved preferences restores defaults. Storage failures leave the app usable. Simulations and branches are never silently restored or overwritten; use JSON export/import to retain experiments.

### Reading the scene

The physical simulation always uses AU, solar masses and Julian years. Display sizes are exaggerated so that planets remain visible. **Atlas mode** additionally maps radial distances with `4 ln(1 + r)` and enlarges Earth–Moon separation 160×. Disable Atlas in View Settings to use linear AU positions (body sizes are still exaggerated). The Theia story uses a separately labeled 1500× spatial magnification.

Planet translation always comes from the engine. Rotation is visually accelerated and is not a literal clock. Orbital guides are instantaneous two-body osculating estimates; they change when the system changes. The placement predictor uses frozen source positions and is a short-term guide, not an exact future N-body solution.

## Implemented systems

| Area                   | Implementation                                                                                                                                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dynamics               | Pairwise gravity, Plummer softening, gravity multiplier, velocity Verlet, fixed-step accumulator, bounded substeps                                                                                          |
| Solar System           | Sun, eight planets, Moon, approximate measured bulk data, phase-separated circular states, balanced total linear momentum                                                                                   |
| Collisions             | Physical radii, swept detection, ignore/bounce/merge/destroy/auto modes, friction/spin impulses, mass and momentum conserving mergers/ejecta, impact heating                                                |
| Tides                  | Differential acceleration, rigid/fluid Roche limits, visual deformation, automatic disruption, gravitating fragments                                                                                        |
| Stars                  | Stellar-property helper, multiple stellar presets, binary/trinary initial states, automatic/manual flares, supernova remnant and ejecta                                                                     |
| Compact/exotic objects | Black-hole capture, Schwarzschild helpers, local time factors, background lensing, disk rotation, pulsar beams, selective magnetic perturbation, paired portals and cooldowns, softened dark-matter gravity |
| Environment            | Stellar flux, equilibrium temperature, luminosity-based habitable zones, approximate gas retention and exoplanet classification, distance-dependent comet tails                                             |
| Experiment management  | Bounded snapshots, undo/redo, scrubbing, reverse snapshot playback, named branches, versioned JSON import/export                                                                                            |
| Interface              | Smooth focus, pan/orbit/zoom, selection rings, local textures, Saturn ring bands, inspector/editor, minimap, event log/toasts, audio, reduced-motion support and responsive panels                          |

See [SCIENCE.md](./SCIENCE.md) for model boundaries and conservation conventions, and [VALIDATION.md](./VALIDATION.md) for verification details.

## Architecture

```text
src/
  main.jsx                    React entry point
  App.jsx                     UI, events, story playback and experiment controls
  App.css                     Responsive HUD and panels
  physics/
    PhysicsEngine.js          Stateful integration, events, capture and history
    constants.js / Vector3.js / CelestialBody.js  Units, math and entities
    presets.js / stellar.js   Representative properties and display-color helper
    collisions.js / tides.js  Impact budgets, physical debris and Roche estimates
    radiation.js / relativity.js / orbits.js  Pure scientific helpers
    worker/                   Optional batch worker and request client
    story.js                  Deterministic chapter initial conditions
  scene/
    Universe.jsx              R3F bodies, effects, camera and placement
    coordinates.js            Explicit physics-to-display mapping
  ui/
    Icon.jsx                  Local SVG icon set
    audio.js                  Opt-in Web Audio synthesis
public/
  textures/                   13 locally bundled maps and attribution
  fonts/                      Local fonts and OFL licenses
tests/
  physics.test.js              Unit, orbital and conservation checks
  scenarios.test.js            Long-run, exotic, story and asset checks
```

Physics mutates its own state. Rendering reads it each frame; React UI telemetry refreshes four times per second. Orbital guides refresh less frequently. Direct N-body gravity is appropriate for the hard limit of 128 bodies. Presets usually create 24–56 bodies, and automatic debris respects the limit. History is limited to 160 snapshots, branches to 12, event records to 50, active visual effects to 16, and energy samples to 120. Temporary effects unmount after at most 7.5 seconds, allowing R3F to dispose their geometry/materials. A small, shared texture cache is intentional.

At extreme time settings the engine drops excess requested simulated time rather than enlarging the integration timestep; the Physics panel reports that amount. Dense close encounters can still be inaccurate with this reduced fixed-step model. Reduce speed and use smaller systems for detailed inspection. This is an educational sandbox, not an ephemeris, collision-hydrodynamics or mission-planning package.

## Assets and attribution

Planet/Sun/Moon/Milky Way maps: [Solar System Scope / INOVE](https://www.solarsystemscope.com/textures/), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). See [texture attribution](./public/textures/ATTRIBUTION.md). Saturn rings are procedural geometry. Image loading failures fall back to colored materials.

DM Sans and IBM Plex Mono are distributed under the SIL Open Font License; copies are included in `public/fonts`. No third-party analytics or tracking is included.

## Quality and acceptance

CI uses Node 24 and runs npm ci, tests, production build and ESLint. ESLint 9 is pinned for the React plugin peer range. Generate repeatable local browser fixtures with `node scripts/create-acceptance-fixtures.js`, then import files from the gitignored `artifacts/` directory. Physics stays on the main thread; live worker synchronization is deferred. See VALIDATION.md for measured benchmark scope and browser results.
