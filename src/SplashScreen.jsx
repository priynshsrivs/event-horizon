import React, { useEffect, useRef, useState, useCallback } from "react";
import { playTone } from "./ui/audio.js";
import "./SplashScreen.css";

const TRIVIA_FACTS = [
  {
    id: 1,
    mark: "01",
    text: "Event Horizon: The point of no return where gravitational escape velocity equals the speed of light.",
    x: "8vw",
    y: "16vh",
    width: "280px",
    rotate: "-1.5deg",
    size: "12px",
    delay: "0.1s",
  },
  {
    id: 2,
    mark: "02",
    text: "Gravitational Time Dilation: Clocks in intense gravitational fields tick markedly slower relative to distant observers.",
    x: "6vw",
    y: "62vh",
    width: "290px",
    rotate: "1.2deg",
    size: "12px",
    delay: "0.3s",
  },
  {
    id: 3,
    mark: "03",
    text: "Frame Dragging: Rotating Kerr black holes physically drag the spacetime fabric itself in the ergosphere.",
    x: "42vw",
    y: "10vh",
    width: "270px",
    rotate: "-0.8deg",
    size: "12px",
    delay: "0.2s",
  },
  {
    id: 4,
    mark: "04",
    text: "Photon Sphere: At 1.5 Schwarzschild radii, photons are forced into unstable circular orbits around the core.",
    x: "72vw",
    y: "14vh",
    width: "260px",
    rotate: "1.8deg",
    size: "11px",
    delay: "0.45s",
  },
  {
    id: 5,
    mark: "05",
    text: "Tidal Disruption: Infalling bodies reaching the Roche limit are stretched into stellar filaments via differential gravity.",
    x: "36vw",
    y: "80vh",
    width: "280px",
    rotate: "-1deg",
    size: "12px",
    delay: "0.35s",
  },
  {
    id: 6,
    mark: "06",
    text: "Relativistic Beaming: Doppler boosting concentrates the luminosity of accretion matter orbiting toward the observer.",
    x: "68vw",
    y: "76vh",
    width: "270px",
    rotate: "1.5deg",
    size: "11px",
    delay: "0.5s",
  },
  {
    id: 7,
    mark: "07",
    text: "Hawking Radiation: Quantum vacuum fluctuations near the horizon cause black holes to radiate energy and evaporate.",
    x: "18vw",
    y: "82vh",
    width: "260px",
    rotate: "0.5deg",
    size: "11px",
    delay: "0.4s",
  },
  {
    id: 8,
    mark: "08",
    text: "Innermost Stable Circular Orbit: The final threshold where stable circular orbital motion remains mathematically possible.",
    x: "12vw",
    y: "38vh",
    width: "250px",
    rotate: "-2deg",
    size: "11px",
    delay: "0.25s",
  },
];

export default function SplashScreen({ onDismiss }) {
  const [stage, setStage] = useState(1);
  const containerRef = useRef(null);

  const triggerEnter = useCallback(() => {
    if (stage > 1) return;
    playTone("click", 0.4);
    setStage(2);

    const timer1 = setTimeout(() => {
      setStage(3);
      playTone("selection", 0.3);
      const timer2 = setTimeout(() => {
        onDismiss?.();
      }, 850);
      return () => clearTimeout(timer2);
    }, 650);

    return () => clearTimeout(timer1);
  }, [stage, onDismiss]);

  const handlePointerMove = useCallback((e) => {
    const el = containerRef.current;
    if (!el) return;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    el.style.setProperty("--pointer-x", `${x}px`);
    el.style.setProperty("--pointer-y", `${y}px`);
  }, []);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        triggerEnter();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onDismiss?.();
      }
    },
    [triggerEnter, onDismiss]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      el.focus();
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      el.style.setProperty("--pointer-x", `${cx}px`);
      el.style.setProperty("--pointer-y", `${cy}px`);
    }

    const keyListener = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        triggerEnter();
      } else if (e.key === "Escape") {
        onDismiss?.();
      }
    };
    window.addEventListener("keydown", keyListener);
    return () => window.removeEventListener("keydown", keyListener);
  }, [triggerEnter, onDismiss]);

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Event Horizon Landing"
      tabIndex={0}
      className={`splash-screen stage-${stage}`}
      onMouseMove={handlePointerMove}
      onTouchMove={handlePointerMove}
      onKeyDown={handleKeyDown}
    >
      <div className="splash-blackout" />
      <div className="splash-stars" />
      <div className="splash-nasa" />
      <div className="splash-noise" />
      <div className="splash-glow" />
      <div className="splash-cursor-ring" aria-hidden="true" />

      {/* Skip / Close button */}
      <button
        type="button"
        className="splash-close-btn"
        title="Skip landing and enter simulation (Esc)"
        aria-label="Skip landing and enter simulation"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss?.();
        }}
      >
        <span aria-hidden="true">✕</span>
        <span>SKIP</span>
      </button>

      {/* Kerr Black Hole Centerpiece */}
      <div className="splash-blackhole-wrap" aria-hidden="true">
        <div className="splash-blackhole-halo" />
        <div className="splash-blackhole-core" />
        <div className="splash-blackhole-photon-ring" />
        <div className="splash-blackhole-disk splash-blackhole-disk-a" />
        <div className="splash-blackhole-disk splash-blackhole-disk-b" />
        <div className="splash-blackhole-label">
          <span>SAGITTARIUS A*</span>
          <small>MASS 4.154 × 10⁶ M☉ // KERR SPIN a* = 0.90</small>
        </div>
      </div>

      {/* Astrophysics Trivia Layer */}
      <div className="splash-trivia-layer">
        {TRIVIA_FACTS.map((fact) => (
          <div
            key={fact.id}
            className={`splash-trivia splash-trivia-${fact.id}`}
            style={{
              "--fact-x": fact.x,
              "--fact-y": fact.y,
              "--fact-width": fact.width,
              "--fact-rotate": fact.rotate,
              "--fact-size": fact.size,
              "--fact-delay": fact.delay,
            }}
          >
            <span className="splash-trivia-mark">[{fact.mark}]</span>
            <span>{fact.text}</span>
          </div>
        ))}
      </div>

      {/* Main Center Content */}
      <div className="splash-inner">
        <div className="splash-center">
          <div className="splash-kicker">RELATIVISTIC ASTRODYNAMICS OBSERVATORY</div>
          <div className="splash-title-wrap">
            <h1 className="splash-title">EVENT HORIZON</h1>
          </div>
          <div className="splash-stage-one-subtitle">
            ORBITAL MECHANICS & GENERAL RELATIVITY SIMULATOR
          </div>
          <div className="splash-tagline">
            N-BODY GRAVITATION <b>·</b> KERR LENSING <b>·</b> RELATIVISTIC JETS
          </div>
          <div className="splash-terminal">
            <div>&gt; KERR_METRIC: BOYER-LINDQUIST ONLINE</div>
            <div>&gt; ACCRETION_DISKS: MAGNETOROTATIONAL MODEL</div>
            <div>&gt; TIME_DILATION: ACTIVE LORENTZ FRAMES</div>
            <div>&gt; STATUS: ALL SIMULATION SENSORS NOMINAL</div>
          </div>
          <button
            type="button"
            className="splash-cta"
            onClick={(e) => {
              e.stopPropagation();
              triggerEnter();
            }}
          >
            <span className="splash-cta-label">ENTER OBSERVATORY</span>
            <span className="splash-cta-chevron" aria-hidden="true">→</span>
          </button>
          <div className="splash-hint">PRESS ENTER OR SPACE TO COMMENCE</div>
        </div>
      </div>

      {/* HUD Telemetry and Overlays */}
      <div className="splash-stage-one-label">
        <span>SYSTEM BOOT // v1.0</span>
        <span>ASTRODYNAMICS CORE: ACTIVE</span>
      </div>
      <div className="splash-stage-one-note">
        <span>GPU ACCELERATED</span>
        <span>LOCAL COMPUTE</span>
      </div>
      <div className="splash-nasa-credit">
        <span>DEEP SPACE TELEMETRY</span>
      </div>

      {/* Warp / Stage 3 Enter Flash & Loading */}
      <div className="splash-enter-flash" />
      {stage === 3 && (
        <div className="splash-loading">
          <span className="splash-loading-dot" />
          <span>INITIALIZING OBSERVATORY SYSTEMS...</span>
        </div>
      )}
    </div>
  );
}
