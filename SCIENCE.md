# Model notes

## Units and initial conditions

The kernel uses AU, solar masses and Julian years with `G = 4π²`. SI constants and conversions are exported explicitly. Temperature is kelvin; density is kg/m³; luminosity is relative to the Sun; angular velocity is radians per Julian year. Display radii are stored independently in metadata and never determine a collision.

The default system uses approximate measured masses, radii, orbital distances, rotations, axial tilts, temperatures, albedos and compositions. Starting orbital phases are chosen for readability; these are **not** planetary positions on a particular date. Initial orbits are nearly circular and coplanar, so Mercury's real eccentricity and planetary inclinations are not reproduced. The Moon receives Earth's velocity plus its geocentric orbital velocity. The Sun's velocity balances total initial system momentum. In the scene's XZ convention, increasing orbital phase has angular momentum along −Y; inclination is measured against that reference normal.

## Integration and time

Velocity Verlet evaluates pairwise accelerations before and after each drift, with half velocity kicks. Default step: 1/32768 year (about 16 minutes). The controlled Theia scene uses 1/2097152 year. The fixed timestep is included in snapshots.

Rendering delta feeds an accumulator, never a single arbitrarily large physical step. A frame processes at most 128 steps. Excess requested simulation time is discarded and exposed in diagnostics; displayed simulated time remains the actual integrated time. Pausing clears the accumulator. Negative playback uses stored snapshots, because collisions, destruction, radiation metadata and portal transit are not physically reversible.

Softening is `10⁻⁸ AU`; the force and reported potential use the same Plummer form. Dark halos add their own extended softening scale. This is an O(N²) point-mass solver, not an adaptive regularized close-encounter solver. High-speed impacts use relative swept-segment intersection to reduce tunneling, but the step can still undersample tight gravitational encounters.

## Collisions and tides

- Contact uses physical radii. Visual spheres can overlap while physical bodies remain far apart.
- Bounce uses a 3D contact impulse, restitution and bounded tangential friction. Both linear velocities and solid-sphere angular velocities change.
- Merge uses the mass-weighted center and velocity. Orbital angular momentum relative to the pair's center and both spin budgets become remnant spin, using `I = 2MR²/5`.
- Automatic outcomes compare impact speed with mutual escape speed. High-speed impacts eject a bounded fraction, up to 45%, in opposing radial pairs. The reduced model conserves mass and center-of-mass momentum; retained spin carries the pre-impact angular-momentum budget. It does not solve fragment hydrodynamics, elasticity, chemical mixing or nuclear reactions.
- A fraction of relative kinetic energy is stored as impact heat, with bounded temperature rise. Diagnostic kinetic energy concerns translational motion; it excludes the thermal reservoir and rotational kinetic energy.
- The destroy mode deliberately removes mass. It is a sandbox operation, not conservation-preserving physics.
- Tidal acceleration is `2GMR/r³`. Rigid/fluid Roche estimates use density ratios. Deformation changes render scale only. Disruption above the configured stress threshold generates fragments that participate in ordinary gravity. Fragmentation is not a fluid/smoothed-particle calculation. A fragment flag prevents infinite automatic fragmentation cascades.

## Radiation and stellar models

Flux sums luminous sources as `L / (4πr²)` in SI. Equilibrium temperature uses Bond albedo and emissivity, assuming a uniformly reradiating sphere. A planet's displayed measured temperature is distinct from its estimated equilibrium temperature. Greenhouse effects are not solved.

Habitable zones use luminosity-scaled boundaries `sqrt(L/1.1)` and `sqrt(L/0.53)` AU. They do not assert actual habitability. Gas retention compares molecular thermal speed with escape speed; a ratio above six is a rough retention heuristic.

Main-sequence property helpers use piecewise mass–luminosity relations. Exotic stellar types use representative presets. A supernova is a **forced event** that replaces the source with a remnant and opposite ejecta pairs; it is not a stellar-evolution prediction. The engine rejects core-collapse for initial masses below 8 solar masses, including the Sun, without changing bodies or emitting events. White dwarfs, brown dwarfs, neutron stars and magnetars are also excluded.

Automatic flare timing is a seeded activity model at accelerated visualization timescales, not a solar-weather forecast. Exposure falls with distance squared. Coronal arcs, particles, pulses and temporary lighting follow events on a bounded wall-clock visual lifetime so a flare remains visible even while paused or at high time scale.

## Relativity and speculative features

Black-hole horizons use `2GM/c²` with SI conversions; helpers also return a non-spinning photon sphere and ISCO. Capture occurs when a body's center or swept trajectory crosses the horizon. Newtonian forces remain the base dynamics.

Gravitational and velocity time factors are separate approximate diagnostics. The optional radial post-Newtonian-inspired force correction is capped at 10%; it is not a complete 1PN integrator. Kerr-inspired weak-field frame-dragging rates are compressed into a readable disk-rotation speed. The lensing visual samples the local Milky Way texture with a radial, screen-aligned deflection: it distorts the background map, not arbitrary foreground meshes, and is not GR ray tracing.

Magnetars perturb nearby charged or iron/nickel-bearing objects through a bounded, distance-decaying toy force. It is intentionally not magnetohydrodynamics and can inject momentum/energy. Pulsar beams are purely visual. Comet tail activity depends on nearest stellar distance and luminosity; the rendered tail points away from the star without modeling gas dynamics.

Wormholes are explicitly speculative. Paired portals preserve incoming velocity vectors and use an exit offset and cooldown to prevent reentry loops. They alter orbital potential energy. Dark matter is represented as an extended softened gravity source with collision disabled. Galaxy disks contain a small set of particles and illustrate emergent gravity, not galactic cosmology.

## Story and trajectory limitations

The singularity and inflation scenes are abstract illustrations. Clustering uses Newtonian bodies. Nebula/formation chapters deliberately enlarge collision radii to demonstrate accretion. The Theia chapter uses approximately Earth/Mars masses and radii but cannot predict the Moon's formation. Stabilization deliberately transitions to modern initial conditions rather than claiming that the preceding particles evolved into the real planets.

Placement prediction integrates a test particle in frozen source positions. It cannot predict full N-body feedback, collisions, moving primaries or portal outcomes. Orbit paths are instantaneous Kepler estimates, not stored motion trails. Unbound trajectories are labeled unbound rather than assigned a spurious orbital period.


## Future timeline and stellar endpoints

The timeline shows actual kernel time relative to an illustrative present-year origin; initial planetary phases are not a dated ephemeris. Days use 365.25 days/year. Advances are limited to 100 billion years. Up to 512 fixed steps use normal Newtonian integration. Larger jumps solve frozen two-body ellipses about the dominant mass with 24 bounded Kepler iterations and phase reduction modulo the orbital period. Positions and velocities both change. Unbound/degenerate orbits are held and marked `futurePositionUnresolved`. This is an educational approximation: it omits long-term encounters, perturbations, tides, and galactic motion, and cannot forecast real planets over billions of years. Reset restores the saved pre-jump state.

The inherited illustrative solar giant schedule begins at +3.8 billion years and reaches about 200 solar radii at +5 billion years. At +7 billion years it sheds outer layers and leaves a white dwarf. These dates are teaching milestones, not calibrated stellar tracks. Other stars use an approximate 10 billion / initialMass^2.5 year lifetime. Giant engulfment is processed before outer-layer loss even when a jump skips intermediate phases. Low-mass dwarf lifetimes exceed the supported timeline.

Core-collapse requires an initial mass >=8 solar masses; initial mass is recorded when a star enters the engine and retained across mass loss and property edits. The simplified remnant rule is neutron star for initial masses 8–20 and black hole above 20. Retained mass is approximately 14% (bounded by available mass) or 30%, respectively; the remainder becomes ejecta. Metallicity, binary evolution, electron-capture boundaries, direct collapse and pair-instability are omitted. Type Ia explosions are not modeled. Sources: [NASA supernova overview](https://imagine.gsfc.nasa.gov/science/objects/supernovae1.html), [NASA Sun-like stellar lifecycle](https://science.nasa.gov/resource/the-life-cycle-of-a-sun-like-star-annotated/).

## Voyager distance and storyline

[Official NASA Voyager 1 page](https://science.nasa.gov/mission/voyager/voyager-1/) reports 164.7 AU **from Earth** on 2024-08-21 and an outbound velocity of about 17 km/s relative to the Sun. These values, epoch, reference and URL are stored in `src/data/stories.json`. The present estimate adds elapsed seconds times 17 km/s to that distance; 1 AU = 149,597,870.7 km and light time uses 299,792.458 km/s. The Earth-distance estimate neglects seasonal Earth motion (up to about 2 AU change relative to the epoch) and changes in spacecraft speed. It is not a NASA live feed or navigation ephemeris. The UI updates the as-of date, current milestone and future milestone from the clock. Historical encounters, the 1990 Pale Blue Dot, 2012 heliopause crossing, present and future are shown in order. Milestone timing and the displayed path are rescaled for readability; the camera path is illustrative, not a measured 3D position.

## Background gravitational lensing

The postprocessing shader applies the thin point-mass lens equation beta = theta - theta_E^2 / theta to the rendered background. Its inverse-impact behavior corresponds to weak-field alpha = 4GM/(b c^2). The pure SI deflection helper reproduces about 1.75 arcseconds at the solar limb. Near alignment, one source stretches into arcs or an Einstein-ring-like image; closer impact parameters bend more strongly. Depth masking preserves foreground geometry and the opaque core; HTML controls are outside the WebGL pass and remain sharp. Existing NASA disk imagery and the core remain separate from remapped background light.

For observability in the compressed scene, the Einstein UV radius is 0.065 * sqrt(log(1+mass)/log(11)) * sqrt(15/displayDistance), capped at 0.22; this is deliberate visual scaling, not physical angular size. It follows camera projection and the nearest visible black hole. High quality uses three background samples; medium uses one; low disables lensing. Only one dominant visible lens is modeled. Strong-field photon orbits, Kerr spacetime, multiple lenses and full GR ray tracing are not solved. The central exclusion and outer taper are visual stabilizers, not GR predictions.
