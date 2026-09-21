import React from "react";
import GravitationalLensing from "../../scene/GravitationalLensing.jsx";
import {
  EffectComposer,
  Bloom,
  ChromaticAberration,
  Noise,
  Vignette,
  EffectGroup,
  SMAA,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";

/**
 * Drop this inside the existing <Canvas>.
 * It does not own the scene or camera and is safe to mount conditionally.
 *
 * quality: "low" | "medium" | "high"
 * intensity: 0..1, useful for event-driven cinematic moments.
 * reducedMotion: disable expensive motion-dependent effects.
 */
export default function CinematicPostFX({
  quality = "medium",
  intensity = 0,
  reducedMotion = false,
  enabled = true,
  engine,
  settings,
}) {
  // An inactive composer still changes renderer clearing/tone mapping when
  // mounted. Let Fiber own the renderer completely when effects are off.
  if (!enabled) return null;

  if (quality === "low") {
    return (
      <EffectComposer multisampling={0} resolutionScale={0.7} enabled={enabled}>
        <EffectGroup enabled={enabled && !reducedMotion}>
          <Vignette offset={0.22} darkness={0.72} eskil={false} />
        </EffectGroup>
      </EffectComposer>
    );
  }

  const high = quality === "high";
  const event = Math.max(0, Math.min(1, intensity));

  return (
    <EffectComposer
      // Multisampled post-processing targets intermittently lose scene color
      // with the depth-aware lensing pass. Use a single-sample target and SMAA.
      multisampling={0}
      resolutionScale={1}
      mergeMode="auto"
      enabled={enabled}
    >
      {engine && settings && <GravitationalLensing engine={engine} settings={settings} />}
      <Bloom
        enabled={enabled}
        mipmapBlur
        intensity={0.35 + event * 0.5}
        luminanceThreshold={0.92}
        luminanceSmoothing={0.25}
      />

      {!reducedMotion && event > 0.05 && (
        <ChromaticAberration
          enabled={enabled}
          offset={[0.00012 + event * 0.00075, 0.00006 + event * 0.00038]}
          radialModulation
          modulationOffset={0.28}
          blendFunction={BlendFunction.NORMAL}
        />
      )}

      <EffectGroup enabled={enabled && !reducedMotion}>
        {event > 0.1 && (
          <Noise premultiply opacity={(high ? 0.018 : 0.012) * event} />
        )}
        <Vignette offset={0.24} darkness={0.58 + event * 0.08} eskil={false} />
      </EffectGroup>

      <SMAA />

    </EffectComposer>
  );
}
