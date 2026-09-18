# Model notes

## Architecture and domain modularity

The physics subsystem is modularized into focused, domain-specific modules while maintaining 100% backward-compatible public exports from `PhysicsEngine.js`:

- `constants.js`: Canonical astronomical and SI physical constants (`G`, `AU_M`, `SOLAR_MASS_KG`, `C_M_PER_S`), unit conversion utilities, and numerical clamping helpers.
- `Vector3.js`: Pure mathematical 3D vector arithmetic engine (Euler vectors, dot, cross, distance, normalization, scaling, interpolation) with zero external dependencies.
- `CelestialBody.js`: Entity data model, physical state serialization, density recalculation, and cloning.
- `presets.js`: Archetype catalog (`BODY_PRESETS`) covering rocky worlds, gas giants, main-sequence stars, neutron stars, white dwarfs, magnetars, and black holes.
- `collisions.js`: Relative swept-segment closest-approach detection, 3D restitution/friction bouncing, momentum-conserving inelastic merges, and mass-conserving debris generation.
- `tides.js`: Rigid and fluid Roche limit calculation, differential tidal acceleration, and disruption spin distribution.
- `relativity.js`: Schwarzschild radii, non-spinning photon spheres, innermost stable circular orbits (ISCO), post-Newtonian radial force corrections, and Kerr frame-dragging heuristics.
- `radiation.js`: Inverse-square flux integration, equilibrium blackbody surface temperatures, luminosity-scaled habitable zones, and atmospheric escape velocity heuristics.
- `stellar.js`: Piecewise mass-luminosity relations, coronal mass ejection flare models, and core-collapse supernova ejecta calculations.
- `orbits.js`: Keplerian orbital element recovery, frozen-field trajectory prediction, circular coplanar system generation, and full 3D Keplerian orbital initializers (`populateRealisticSolarSystem`).
- `worker/`: Off-thread Web Worker integration (`physicsWorker.js`) and asynchronous message client (`PhysicsWorkerClient.js`).

## Units and initial conditions

The kernel uses AU, solar masses and Julian years with `G = 4π²`. SI constants and conversions are exported explicitly. Temperature is kelvin; density is kg/m³; luminosity is relative to the Sun; angular velocity is radians per Julian year. Display radii are stored independently in metadata and never determine a collision.

The default system uses approximate measured masses, radii, orbital distances, rotations, axial tilts, temperatures, albedos and compositions. Starting orbital phases are chosen for readability; these are **not** planetary positions on a particular date. Initial orbits are nearly circular and coplanar.

An optional realistic Keplerian generator (`populateRealisticSolarSystem`) is available using real J2000 orbital elements (semi-major axis $a$, eccentricity $e$, inclination $i$, longitude of ascending node $\Omega$, argument of periapsis $\omega$, true anomaly $\nu$). It maps orbital plane (perifocal) coordinates into the 3D X-Z reference plane, preserving true orbital inclinations and eccentricities. In both modes, the Moon receives Earth's velocity plus its geocentric orbital velocity, and the Sun's velocity is balanced to ensure zero net barycentric momentum. In the scene's XZ convention, increasing orbital phase has angular momentum along −Y; inclination is measured against that reference normal.

## Integration, numerical robustness and time

Velocity Verlet evaluates pairwise accelerations before and after each drift, with half velocity kicks. Default step: 1/32768 year (about 16 minutes). The controlled Theia scene uses 1/2097152 year. The fixed timestep is included in snapshots.

Rendering delta feeds an accumulator, never a single arbitrarily large physical step. A frame processes at most 128 steps. Excess requested simulation time is discarded and exposed in diagnostics; displayed simulated time remains the actual integrated time. Pausing clears the accumulator. Negative playback uses stored snapshots, because collisions, destruction, radiation metadata and portal transit are not physically reversible.

### Numerical safeguards and containment

- **Plummer softening lower bound**: Softening is `10⁻⁸ AU`; pairwise denominator $r^2$ is explicitly bounded below by `10⁻¹⁸ AU²` (`Math.max(r2, 1e-18)`), preventing floating-point underflow or singular infinite forces in extreme close encounters.
- **Multi-phase non-finite containment**: Pre-step scans detect any corrupted coordinates (`NaN`, `Infinity`) before pairwise interaction loops execute. Bodies with non-finite coordinates are ignored during acceleration summation, preventing non-finite contamination from poisoning healthy neighbor bodies. Corrupted bodies are reverted to their previous valid state, disabled, and the simulation is safely paused with a `numericalWarning` event.
- **Scalar loop optimization**: Coordinate finite checks avoid per-step array and closure allocations, maintaining maximum integration throughput across large body counts.

## Collisions and tides

- Contact uses physical radii. Visual spheres can overlap while physical bodies remain far apart.
- Bounce uses a 3D contact impulse, restitution and bounded tangential friction. Both linear velocities and solid-sphere angular velocities change.
- Merge uses the mass-weighted center and velocity. Orbital angular momentum relative to the pair's center and both spin budgets become remnant spin, using `I = 2MR²/5`.
- Automatic outcomes compare center-of-mass impact energy E = μv²/2 with uniform-sphere self-binding plus mutual binding at contact: B = G[0.6(m₁²/R₁ + m₂²/R₂) + m₁m₂/(R₁+R₂)]. Both use simulation units and the gravity multiplier. E/B ≤ 0.05 merges; larger ratios eject a fraction min(0.45, 0.3(E/B − 0.05)). E/B ≥ 2 is labeled catastrophic and ejects 50–90%, retaining a smaller remnant. These thresholds are an educational energy-budget approximation, not a calibrated impact law. Explicit bounce and merge modes override automatic outcomes. Ejecta uses symmetric radial pairs with radii derived from the remnant density. The reduced model conserves mass and center-of-mass momentum; retained spin carries the pre-impact angular-momentum budget. It does not solve fragment hydrodynamics, elasticity, chemical mixing or nuclear reactions. Spin is a conserved bookkeeping budget and can exceed realistic breakup limits. Debris is permanent gravitating mass; it has no arbitrary expiry. Pair count reduces near capacity, and a full system falls back to conservative accretion. Cooldowns and the 128-body cap bound repeated impacts.
- A fraction of relative kinetic energy is stored as impact heat, with bounded temperature rise. Diagnostic kinetic energy concerns translational motion; it excludes the thermal reservoir and rotational kinetic energy.
- The destroy mode deliberately removes mass. It is a sandbox operation, not conservation-preserving physics.
- Tidal acceleration is `2GMR/r³`. Rigid/fluid Roche estimates use density ratios. Deformation changes render scale only. Automatic disruption requires a primary more than ten times the secondary mass and tidal/self-gravity stress above 1.5. Symmetric fragments form an initial radial stream along the primary-secondary direction, preserving mass, COM velocity and the original spin budget. Subsequent orbital evolution bends the stream. Manual Disrupt body is a forced sandbox intervention. Fragments participate in ordinary gravity. Fragmentation is not a fluid/smoothed-particle calculation. A fragment flag prevents infinite automatic fragmentation cascades.

## Radiation and stellar models

Flux sums luminous sources as `L / (4πr²)` in SI. Equilibrium temperature uses Bond albedo and emissivity, assuming a uniformly reradiating sphere. A planet's displayed measured temperature is distinct from its estimated equilibrium temperature. Greenhouse effects are not solved.

Habitable zones use luminosity-scaled boundaries `sqrt(L/1.1)` and `sqrt(L/0.53)` AU. They do not assert actual habitability. Gas retention compares molecular thermal speed with escape speed; a ratio above six is a rough retention heuristic.

Main-sequence property helpers use piecewise mass–luminosity relations. Exotic stellar types use representative presets with luminosity in L☉ derived from physical radius and effective temperature using L/L☉ = (R/R☉)²(T/5772 K)⁴. See the [Stefan–Boltzmann relation](https://astro.unl.edu/naap/hr/hr_background2.html). These are examples, not class-wide constants; compact-object emission excludes nonthermal radiation and magnetic heating. Solar-radius/AU conversions are explicit. Main-sequence mass helpers clamp to 0.08–150 M☉. Story and galaxy tracer properties remain illustrative rather than stellar populations. A supernova is a **forced event** that replaces the source with a remnant and opposite ejecta pairs; it is not a stellar-evolution prediction. The Sun cannot naturally produce a core-collapse supernova, even though the sandbox allows the intervention.

Automatic flare timing is a seeded activity model at accelerated visualization timescales, not a solar-weather forecast. Exposure falls with distance squared. Coronal arcs, particles, pulses and temporary lighting follow events on a bounded wall-clock visual lifetime so a flare remains visible even while paused or at high time scale.

## Relativity and speculative features

Black-hole horizons use `2GM/c²` with SI conversions; helpers also return a non-spinning photon sphere and ISCO. Capture uses the center of a body and a continuous relative swept segment. The optional metadata.captureRadiusAU is a separate simulation capture threshold (AU), defaulting to the true horizon and never shrinking below it. God Mode exposes this threshold and telemetry labels both radii separately. Enlarged-region captures do not emit an event-horizon-crossing event. Softening, mesh size and projectile radius never enlarge the true horizon. Captures conserve mass, COM momentum and the engine spin budget, recalculate the horizon, and remove stale body references; repeated captures use the updated mass. The linear sweep approximates motion within each fixed step; it does not resolve relativistic trajectories or curved substep paths. Newtonian forces remain the base dynamics.

Gravitational and velocity time factors are separate approximate diagnostics. The optional radial post-Newtonian-inspired force correction is capped at 10%; it is not a complete 1PN integrator. Kerr-inspired weak-field frame-dragging rates are compressed into a readable disk-rotation speed. The lensing visual samples the local Milky Way texture with a radial, screen-aligned deflection: it distorts the background map, not arbitrary foreground meshes, and is not GR ray tracing.

Magnetars perturb nearby charged or iron/nickel-bearing objects through a bounded, distance-decaying toy force. It is intentionally not magnetohydrodynamics and can inject momentum/energy. Pulsar beams are purely visual. Comet tail activity depends on nearest stellar distance and luminosity; the rendered tail points away from the star without modeling gas dynamics.

Wormholes are explicitly speculative. Paired portals preserve incoming velocity vectors and use an exit offset and cooldown to prevent reentry loops. They alter orbital potential energy. Dark matter is represented as an extended softened gravity source with collision disabled. Galaxy disks contain a small set of particles and illustrate emergent gravity, not galactic cosmology.

## Stellar display and worker trade-offs

Stellar colors use [Tanner Helland’s temperature-to-RGB approximation](https://tannerhelland.com/2012/09/18/convert-temperature-rgb-algorithm-code.html), clamped to 1000–40000 K. This is a qualitative display approximation, not a spectral renderer. Hot neutron stars share the blue-white endpoint. Luminosity controls bounded light and glow, while changes to physical radius modulate a separately exaggerated, capped display radius. Giants remain extended and compact remnants small. Black-hole mesh size is likewise independent of the horizon and capture threshold.

The existing optional worker/client remains available for batch integration; the app continues using the main-thread engine. At 128 bodies the measured integration cost is approximately 0.36 ms **per step**, or about 46 ms for the maximum 128-step frame burst, excluding rendering. The earlier claim of 0.37 ms per 1000 steps was incorrect. A worker could help these bursts, but moving the live app requires asynchronous event, history, editor and renderer synchronization. That migration is deferred; no unmeasured structured-clone overhead is claimed. The worker client now rejects pending requests on error/termination, preserves numeric trajectory arrays, and uses a bundler-recognized worker entry.

## Story and trajectory limitations

The singularity and inflation scenes are abstract illustrations. Clustering uses Newtonian bodies. Nebula/formation chapters deliberately enlarge collision radii to demonstrate accretion. The Theia chapter uses approximately Earth/Mars masses and radii but cannot predict the Moon's formation. Stabilization deliberately transitions to modern initial conditions rather than claiming that the preceding particles evolved into the real planets.

Placement prediction integrates a test particle in frozen source positions. It cannot predict full N-body feedback, collisions, moving primaries or portal outcomes. Orbit paths are instantaneous Kepler estimates, not stored motion trails. Unbound trajectories are labeled unbound rather than assigned a spurious orbital period.
