import React, { useEffect, useState } from "react";
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
  const [transitionFx, setTransitionFx] = useState({ type: null, phase: "idle" });

  useEffect(() => {
    const onTransition = (event) => {
      const detail = event.detail || {};
      setTransitionFx({
        type: detail.type || null,
        phase: detail.phase || "idle",
      });
    };
    window.addEventListener("event-horizon:transition", onTransition);
    return () => window.removeEventListener("event-horizon:transition", onTransition);
  }, []);
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
  const transitionActive = !reducedMotion && transitionFx.phase !== "idle";
  const transitionBoost = transitionActive
    ? transitionFx.type === "black-hole"
      ? 0.95
      : transitionFx.type === "camera-dive"
        ? 0.78
        : transitionFx.type === "starfield"
          ? 0.72
          : transitionFx.type === "orbital"
            ? 0.46
            : 0.32
    : 0;
  const cinematicIntensity = Math.max(event, transitionBoost);

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
        intensity={0.35 + cinematicIntensity * 0.72}
        luminanceThreshold={0.92}
        luminanceSmoothing={0.25}
      />

      {!reducedMotion && cinematicIntensity > 0.05 && (
        <ChromaticAberration
          enabled={enabled}
          offset={[0.00012 + cinematicIntensity * 0.0009, 0.00006 + cinematicIntensity * 0.00046]}
          radialModulation
          modulationOffset={0.28}
          blendFunction={BlendFunction.NORMAL}
        />
      )}

      <EffectGroup enabled={enabled && !reducedMotion}>
        {cinematicIntensity > 0.1 && (
          <Noise premultiply opacity={(high ? 0.018 : 0.012) * cinematicIntensity} />
        )}
        <Vignette offset={0.24} darkness={0.58 + cinematicIntensity * 0.15} eskil={false} />
      </EffectGroup>

      <SMAA />

    </EffectComposer>
  );
}
