# Event Horizon — Cinematic FX Integration Pack

This pack is deliberately additive. It does not replace the physics engine,
Universe, or App.

## 1. Install the post-processing dependency

From the Event Horizon project root:

```bash
npm install @react-three/postprocessing@3.1.1
```

The project already uses Three.js + React Three Fiber, so no second renderer is
needed.

## 2. Copy this directory

Copy:

```text
src/cinematic/
```

into:

```text
src/cinematic/
```

in Event Horizon.

## 3. Add post-processing inside the existing Canvas

In `Universe.jsx`, inside the existing `<Canvas>` scene, mount:

```jsx
<CinematicPostFX
  quality={settings.quality}
  intensity={cinematicIntensity}
  reducedMotion={reducedMotion}
/>
```

Import:

```jsx
import CinematicPostFX from "../cinematic/components/CinematicPostFX.jsx";
```

Do NOT create another Canvas.

## 4. Add GPU ambient particles

Inside the existing Canvas scene:

```jsx
<CinematicParticles
  quality={settings.quality}
  reducedMotion={reducedMotion}
/>
```

Import:

```jsx
import CinematicParticles from "../cinematic/components/CinematicParticles.jsx";
```

## 5. Event effects

When the existing physics event system emits:

- collision
- tidalDisruption
- solarFlare
- supernova
- wormholeTransit

feed the event into the existing `effects` state rather than inventing a
second event system.

For collision/supernova:

```jsx
<CinematicShockwave
  position={eventPosition}
  color="#b9efff"
  intensity={eventIntensity}
/>
```

For wormholes:

```jsx
<CinematicWormhole
  radius={visualRadius}
  color="#9b7cff"
  intensity={1}
/>
```

## 6. Atmosphere

For Earth/planet bodies:

```jsx
<CinematicAtmosphere
  radius={radius}
  color="#8ddff2"
  intensity={0.8}
/>
```

Keep the existing Earth day/night/cloud layers.

This is an additional atmospheric rim layer.

## 7. IMPORTANT

Do not mount multiple EffectComposer instances.

The application should have ONE primary post-processing pipeline.

Do not put post-processing inside individual planet components.

## 8. Performance

LOW:
- 900 particles
- no DOF
- low-resolution postprocessing

MEDIUM:
- 2200 particles
- bloom
- noise
- vignette
- subtle chromatic aberration

HIGH:
- 4200 particles
- full bloom
- DOF during cinematic events
- stronger chromatic aberration

Never increase particle counts indefinitely.

## 9. Reduced motion

When `prefers-reduced-motion` is enabled:

- stop particle rotation
- disable chromatic aberration
- disable DOF
- keep bloom/vignette restrained
- preserve functionality
