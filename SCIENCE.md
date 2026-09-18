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

Main-sequence property helpers use piecewise mass–luminosity relations. Exotic stellar types use representative presets. A supernova is a **forced event** that replaces the source with a remnant and opposite ejecta pairs; it is not a stellar-evolution prediction. The Sun cannot naturally produce a core-collapse supernova, even though the sandbox allows the intervention.

Automatic flare timing is a seeded activity model at accelerated visualization timescales, not a solar-weather forecast. Exposure falls with distance squared. Coronal arcs, particles, pulses and temporary lighting follow events on a bounded wall-clock visual lifetime so a flare remains visible even while paused or at high time scale.

## Relativity and speculative features

Black-hole horizons use `2GM/c²` with SI conversions; helpers also return a non-spinning photon sphere and ISCO. Capture occurs when a body's center or swept trajectory crosses the horizon. Newtonian forces remain the base dynamics.

Gravitational and velocity time factors are separate approximate diagnostics. The optional radial post-Newtonian-inspired force correction is capped at 10%; it is not a complete 1PN integrator. Kerr-inspired weak-field frame-dragging rates are compressed into a readable disk-rotation speed. The lensing visual samples the local Milky Way texture with a radial, screen-aligned deflection: it distorts the background map, not arbitrary foreground meshes, and is not GR ray tracing.

Magnetars perturb nearby charged or iron/nickel-bearing objects through a bounded, distance-decaying toy force. It is intentionally not magnetohydrodynamics and can inject momentum/energy. Pulsar beams are purely visual. Comet tail activity depends on nearest stellar distance and luminosity; the rendered tail points away from the star without modeling gas dynamics.

Wormholes are explicitly speculative. Paired portals preserve incoming velocity vectors and use an exit offset and cooldown to prevent reentry loops. They alter orbital potential energy. Dark matter is represented as an extended softened gravity source with collision disabled. Galaxy disks contain a small set of particles and illustrate emergent gravity, not galactic cosmology.

## Story and trajectory limitations

The singularity and inflation scenes are abstract illustrations. Clustering uses Newtonian bodies. Nebula/formation chapters deliberately enlarge collision radii to demonstrate accretion. The Theia chapter uses approximately Earth/Mars masses and radii but cannot predict the Moon's formation. Stabilization deliberately transitions to modern initial conditions rather than claiming that the preceding particles evolved into the real planets.

Placement prediction integrates a test particle in frozen source positions. It cannot predict full N-body feedback, collisions, moving primaries or portal outcomes. Orbit paths are instantaneous Kepler estimates, not stored motion trails. Unbound trajectories are labeled unbound rather than assigned a spurious orbital period.
