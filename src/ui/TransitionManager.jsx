import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const TransitionContext = createContext(null);

const TRANSITION_CONFIG = {
  warp: { duration: 560, className: "eh-transition-warp" },
  "camera-dive": { duration: 820, className: "eh-transition-dive" },
  "black-hole": { duration: 1120, className: "eh-transition-black-hole" },
  starfield: { duration: 720, className: "eh-transition-starfield" },
  hud: { duration: 580, className: "eh-transition-hud" },
  orbital: { duration: 760, className: "eh-transition-orbital" },
};

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

export function TransitionManager({ children }) {
  const [state, setState] = useState({ active: false, type: null, phase: "idle", nonce: 0 });
  const running = useRef(false);
  const token = useRef(0);
  const reducedRef = useRef(false);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!media) return undefined;
    const sync = () => { reducedRef.current = media.matches; };
    sync();
    media.addEventListener?.("change", sync);
    media.addListener?.(sync);
    return () => {
      media.removeEventListener?.("change", sync);
      media.removeListener?.(sync);
    };
  }, []);

  const transition = useCallback(async (type = "warp", options = {}) => {
    const config = TRANSITION_CONFIG[type] || TRANSITION_CONFIG.warp;
    const nextToken = ++token.current;
    if (running.current) {
      running.current = false;
    }
    running.current = true;

    const duration = reducedRef.current ? Math.min(220, config.duration) : config.duration;
    const coverAt = reducedRef.current ? 90 : Math.round(duration * (type === "black-hole" ? 0.56 : 0.46));

    setState({ active: true, type, phase: "out", nonce: nextToken });
    options.onStart?.(type);

    await wait(coverAt);
    if (token.current !== nextToken) return false;

    setState((old) => ({ ...old, phase: "in" }));
    options.onSwap?.(type);

    await wait(Math.max(90, duration - coverAt));
    if (token.current !== nextToken) return false;

    running.current = false;
    setState({ active: false, type: null, phase: "idle", nonce: nextToken });
    options.onComplete?.(type);
    return true;
  }, []);

  const cancel = useCallback(() => {
    token.current += 1;
    running.current = false;
    setState({ active: false, type: null, phase: "idle", nonce: token.current });
  }, []);

  const value = useMemo(() => ({ transition, cancel, isTransitioning: state.active }), [transition, cancel, state.active]);

  return (
    <TransitionContext.Provider value={value}>
      {children}
      <TransitionOverlay state={state} />
    </TransitionContext.Provider>
  );
}

function TransitionOverlay({ state }) {
  if (!state.active) return null;

  return (
    <div
      className={`eh-transition-layer ${state.className || ""} eh-transition-${state.type} eh-transition-${state.phase}`}
      data-transition={state.type}
      aria-hidden="true"
    >
      <div className="eh-transition-grid" />
      <div className="eh-transition-stars">
        <i /><i /><i /><i /><i /><i /><i /><i />
      </div>
      <div className="eh-transition-core" />
      <div className="eh-transition-hud-fragments">
        <span>COORD 07·31·54</span>
        <span>GRAVITY FIELD / 01</span>
        <span>EVENT HORIZON</span>
      </div>
    </div>
  );
}

export function useTransition() {
  const context = useContext(TransitionContext);
  if (!context) throw new Error("useTransition must be used inside TransitionManager");
  return context;
}

export function transitionTypeForPanel(nextPanel) {
  if (nextPanel === "god" || nextPanel === "physics") return "camera-dive";
  if (nextPanel === "nebula") return "starfield";
  if (nextPanel === "voyager") return "orbital";
  if (nextPanel === "story" || nextPanel === "whatif") return "hud";
  return "warp";
}

export function transitionTypeForObject(body) {
  if (body?.type === "black hole") return "black-hole";
  if (body?.type === "planet" || body?.type === "moon") return "orbital";
  return "warp";
}
