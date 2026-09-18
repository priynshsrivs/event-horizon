import React, { useEffect, useRef, useState, useCallback } from "react";
import "./SplashScreen.css";

const TRIVIA_FACTS = [
  {
    id: 1,
    mark: "01",
    text: "Event Horizon: The point of no return where gravitational escape velocity equals the speed of light.",
    x: "11vw",
    y: "18vh",
    width: "285px",
    rotate: "-1.5deg",
    size: "13px",
    delay: "0.15s",
  },
  {
    id: 2,
    mark: "02",
    text: "Gravitational Time Dilation: Clocks in intense gravitational fields tick markedly slower relative to distant observers.",
    x: "7vw",
    y: "64vh",
    width: "295px",
    rotate: "1.2deg",
    size: "12px",
    delay: "0.35s",
  },
  {
    id: 3,
    mark: "03",
    text: "Frame Dragging: Rotating Kerr black holes physically drag the spacetime fabric itself in the ergosphere.",
    x: "47vw",
    y: "11vh",
    width: "275px",
    rotate: "-0.8deg",
    size: "12px",
    delay: "0.25s",
  },
  {
    id: 4,
    mark: "04",
    text: "Photon Sphere: At 1.5 Schwarzschild radii, photons are forced into unstable circular orbits around the core.",
    x: "73vw",
    y: "16vh",
    width: "265px",
    rotate: "1.8deg",
    size: "11px",
    delay: "0.5s",
  },
  {
    id: 5,
    mark: "05",
    text: "Tidal Disruption: Infalling bodies reaching the Roche limit are stretched into stellar filaments via differential gravity.",
    x: "38vw",
    y: "79vh",
    width: "285px",
    rotate: "-1deg",
    size: "12px",
    delay: "0.4s",
  },
  {
    id: 6,
    mark: "06",
    text: "Relativistic Beaming: Doppler boosting concentrates the luminosity of accretion matter orbiting toward the observer.",
    x: "67vw",
    y: "75vh",
    width: "275px",
    rotate: "1.5deg",
    size: "11px",
    delay: "0.6s",
  },
  {
    id: 7,
    mark: "07",
    text: "Hawking Radiation: Quantum vacuum fluctuations near the horizon cause black holes to radiate energy and evaporate.",
    x: "21vw",
    y: "83vh",
    width: "265px",
    rotate: "0.5deg",
    size: "11px",
    delay: "0.45s",
  },
  {
    id: 8,
    mark: "08",
    text: "Innermost Stable Circular Orbit: The final threshold where stable circular orbital motion remains mathematically possible.",
    x: "15vw",
    y: "40vh",
    width: "255px",
    rotate: "-2deg",
    size: "11px",
    delay: "0.3s",
  },
];

export default function SplashScreen({ onDismiss }) {
  const [stage, setStage] = useState(1);
  const [entering, setEntering] = useState(false);
  const containerRef = useRef(null);

  const triggerEnter = useCallback(() => {
    if (stage > 1) return;
    setEntering(true);
    setStage(2);

    const timer1 = setTimeout(() => {
      setStage(3);
      const timer2 = setTimeout(() => {
        onDismiss?.();
      }, 950);
      return () => clearTimeout(timer2);
    }, 750);

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

    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const dist = Math.hypot(x - cx, y - cy);
    const maxDist = Math.hypot(cx, cy) || 1;
    const proximity = Math.max(0.12, 1 - (dist / maxDist) * 0.88);
    el.style.setProperty("--splash-title-reveal", proximity.toFixed(2));
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
      el.style.setProperty("--splash-title-reveal", "0.65");
      el.style.setProperty("--nasa-image", "url('/textures/galaxy.jpg')");
      el.style.setProperty("--splash-stage-two-image", "url('/textures/galaxy.jpg')");
      el.style.setProperty("--splash-stage-three-image", "url('/textures/galaxy.jpg')");
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
      className={`splash-screen stage-${stage} ${entering ? "entering" : ""}`}
      onMouseMove={handlePointerMove}
      onTouchMove={handlePointerMove}
      onClick={triggerEnter}
      onKeyDown={handleKeyDown}
    >
      <div className="splash-blackout" />
      <div className="splash-stars" />
      <div className="splash-nasa" />
      <div className="splash-noise" />
      <div className="splash-glow" />
      <div className="splash-cursor-ring" aria-hidden="true" />

      {/* Interactive Kerr Black Hole */}
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

      {/* Floating Astrophysics Trivia Layer */}
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
            CLICK ANYWHERE OR PRESS SPACE TO ENTER OBSERVATORY
          </div>
          <div className="splash-tagline">
            N-BODY GRAVITATION <b>·</b> KERR METRIC LENSING <b>·</b> RELATIVISTIC JETS
          </div>
          <div className="splash-terminal">
            <div>&gt; KERR_METRIC: SOLVED (BOYER-LINDQUIST)</div>
            <div>&gt; ACCRETION_DISKS: MAGNETOROTATIONAL DYNAMICS</div>
            <div>&gt; SCHWARZSCHILD_RADIUS: 2GM/c² ONLINE</div>
            <div>&gt; STATUS: ALL SENSORS NOMINAL</div>
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
          <div className="splash-hint">CLICK ANYWHERE // PRESS ENTER OR SPACE</div>
        </div>
      </div>

      {/* HUD Telemetry and Overlays */}
      <div className="splash-stage-one-label">
        <span>SYSTEM BOOT // v1.0</span>
        <span>SIMULATION ENGINE: ACTIVE</span>
        <span>ASTRODYNAMICS CORE: VERIFIED</span>
      </div>
      <div className="splash-stage-one-note">
        <span>LOCAL COMPUTE READY</span>
        <span>GPU ACCELERATED</span>
      </div>
      <div className="splash-nasa-credit">
        <span>DEEP SPACE OBSERVATORY TELEMETRY</span>
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
