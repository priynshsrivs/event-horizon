import React, { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Additive cinematic camera layer.
 *
 * CameraController/OrbitControls still own the simulation camera. This rig
 * only adds short-lived cinematic behavior after the base camera has settled:
 * FOV kicks, banking, impulse shake, and event-specific breathing.
 */
export default function CinematicCameraRig() {
  const { camera } = useThree();
  const state = useRef({
    type: null,
    phase: "idle",
    nonce: 0,
    startedAt: 0,
    baseFov: 43,
  });
  const scratch = useMemo(() => ({
    axis: new THREE.Vector3(0, 0, 1),
    q: new THREE.Quaternion(),
    pos: new THREE.Vector3(),
  }), []);

  useEffect(() => {
    const onTransition = (event) => {
      const detail = event.detail || {};
      if (!detail.type) return;

      if (detail.phase === "out") {
        state.current = {
          type: detail.type,
          phase: "out",
          nonce: detail.nonce ?? 0,
          startedAt: performance.now(),
          baseFov: camera.fov,
        };
      } else if (detail.phase === "in" && state.current.nonce === detail.nonce) {
        state.current.phase = "in";
        state.current.startedAt = performance.now();
      } else if (detail.phase === "idle") {
        state.current.type = null;
        state.current.phase = "idle";
        camera.fov = state.current.baseFov || 43;
        camera.updateProjectionMatrix();
      }
    };

    window.addEventListener("event-horizon:transition", onTransition);
    return () => window.removeEventListener("event-horizon:transition", onTransition);
  }, [camera]);

  useFrame(({ clock }) => {
    const fx = state.current;
    if (!fx.type || fx.phase === "idle") return;

    const elapsed = Math.max(0, performance.now() - fx.startedAt);
    const duration = fx.phase === "out"
      ? fx.type === "black-hole" ? 620 : 460
      : fx.type === "black-hole" ? 700 : 520;

    const p = THREE.MathUtils.clamp(elapsed / duration, 0, 1);
    const envelope = Math.sin(p * Math.PI);
    const inOut = fx.phase === "out"
      ? THREE.MathUtils.smoothstep(p, 0, 1)
      : 1 - THREE.MathUtils.smoothstep(p, 0, 1);

    let roll = 0;
    let fovKick = 0;
    let shake = 0;

    switch (fx.type) {
      case "warp":
        roll = Math.sin(clock.elapsedTime * 7.0) * 0.008 * envelope;
        fovKick = 7.5 * inOut;
        shake = 0.012 * envelope;
        break;
      case "camera-dive":
        roll = Math.sin(clock.elapsedTime * 9.0) * 0.012 * envelope;
        fovKick = 12.0 * inOut;
        shake = 0.018 * envelope;
        break;
      case "starfield":
        roll = Math.sin(clock.elapsedTime * 5.0) * 0.016 * envelope;
        fovKick = 10.0 * inOut;
        shake = 0.01 * envelope;
        break;
      case "orbital":
        roll = Math.sin(clock.elapsedTime * 3.4) * 0.022 * envelope;
        fovKick = 5.5 * inOut;
        shake = 0.006 * envelope;
        break;
      case "black-hole":
        // The black-hole sequence narrows the field as the camera is pulled
        // toward the lens, then releases it slowly on arrival.
        roll = Math.sin(clock.elapsedTime * 2.7) * 0.035 * envelope;
        fovKick = -8.0 * inOut;
        shake = 0.022 * envelope;
        break;
      case "hud":
        fovKick = 2.2 * envelope;
        break;
      default:
        break;
    }

    const targetFov = (fx.baseFov || 43) + fovKick;
    camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 0.22);

    if (Math.abs(roll) > 0.00001) {
      scratch.q.setFromAxisAngle(scratch.axis, roll);
      camera.quaternion.multiply(scratch.q);
    }

    if (shake > 0) {
      const t = clock.elapsedTime;
      scratch.pos.set(
        Math.sin(t * 71.0) * shake,
        Math.cos(t * 83.0) * shake * 0.72,
        Math.sin(t * 97.0) * shake * 0.45,
      );
      camera.position.add(scratch.pos);
    }

    camera.updateProjectionMatrix();

    if (p >= 1 && fx.phase === "in") {
      state.current.type = null;
      state.current.phase = "idle";
      camera.fov = fx.baseFov || 43;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
