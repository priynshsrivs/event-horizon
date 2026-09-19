let context = null;
let master = null;
let music = null;
let volume = 1;
let muted = true;
try { muted = globalThis.localStorage?.getItem("eh-muted") !== "false"; } catch {}
const listeners = new Set();
export const getMuted = () => muted;
export function subscribeAudio(listener) { listeners.add(listener); return () => listeners.delete(listener); }
export function setMuted(value) {
  muted = !!value;
  try { globalThis.localStorage?.setItem("eh-muted", String(muted)); } catch {}
  if (master) master.gain.value = muted ? 0 : 1;
  if (music) { music.muted = muted; if (muted) music.pause(); }
  if (!muted) unlockAudio();
  for (const listener of listeners) listener(muted);
}
export function setAudioVolume(value) {
  volume = clampVolume(value);
  if (music) music.volume = Math.min(1, volume * 1.5);
}
export function unlockAudio() {
  if (muted || typeof window === "undefined") return;
  try {
    if (!music) { music = new Audio("/audio/interstellar.mp3"); music.loop = true; music.preload = "none"; }
    music.muted = muted;
    music.volume = Math.min(1, volume * 1.5);
    if (music.paused) music.play()?.catch(() => {});
    if (context?.state === "suspended") context.resume()?.catch(() => {});
  } catch {}
}
export function mountAudio() {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("pointerdown", unlockAudio);
  window.addEventListener("keydown", unlockAudio);
  return () => {
    window.removeEventListener("pointerdown", unlockAudio);
    window.removeEventListener("keydown", unlockAudio);
    disposeAudio();
  };
}

const SOUND_DEFINITIONS = Object.freeze({
  click: {
    frequency: 620,
    endMultiplier: 0.5,
    duration: 0.07,
    type: "sine",
    level: 0.1,
  },
  selection: {
    frequency: 440,
    endMultiplier: 0.72,
    duration: 0.16,
    type: "sine",
    level: 0.08,
  },
  collision: {
    frequency: 90,
    endMultiplier: 0.5,
    duration: 0.4,
    type: "triangle",
    level: 0.12,
  },
  solarFlare: {
    frequency: 210,
    endMultiplier: 0.55,
    duration: 0.4,
    type: "sine",
    level: 0.08,
  },
  supernova: {
    frequency: 45,
    endMultiplier: 0.5,
    duration: 1.3,
    type: "triangle",
    level: 0.14,
  },
  panelOpen: {
    frequency: 360,
    endMultiplier: 1.35,
    duration: 0.12,
    type: "sine",
    level: 0.055,
  },
  panelClose: {
    frequency: 300,
    endMultiplier: 0.72,
    duration: 0.1,
    type: "sine",
    level: 0.045,
  },
  toast: {
    frequency: 520,
    endMultiplier: 1.18,
    duration: 0.18,
    type: "sine",
    level: 0.065,
  },
  warp: {
    frequency: 180,
    endMultiplier: 2.2,
    duration: 0.32,
    type: "sine",
    level: 0.07,
  },
});

function clampVolume(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(1, numeric)) : 0;
}

function getAudioContext() {
  if (typeof window === "undefined") return null;
  if (!window.AudioContext && !window.webkitAudioContext) return null;

  try {
    context ||= new (window.AudioContext || window.webkitAudioContext)();
    return context;
  } catch {
    return null;
  }
}

export function playTone(kind = "click", volume = 0.25) {
  const definition = SOUND_DEFINITIONS[kind] || SOUND_DEFINITIONS.click;
  const safeVolume = clampVolume(volume);

  if (muted || safeVolume <= 0) return false;

  const audio = getAudioContext();
  if (!audio) return false;

  const now = audio.currentTime;
  const duration = definition.duration;

  try {
    if (audio.state === "suspended") {
      const resumeResult = audio.resume();
      if (resumeResult && typeof resumeResult.catch === "function") {
        resumeResult.catch(() => {});
      }
    }

    const oscillator = audio.createOscillator();
    const gain = audio.createGain();

    oscillator.type = definition.type;
    oscillator.frequency.setValueAtTime(definition.frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(1, definition.frequency * definition.endMultiplier),
      now + duration,
    );

    const peak = Math.max(0.0001, Math.min(0.9, safeVolume * definition.level * 5));

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(
      peak,
      now + Math.min(0.012, duration * 0.2),
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(gain);
    if (!master) { master = audio.createGain(); master.gain.value = muted ? 0 : 1; master.connect(audio.destination); }
    gain.connect(master);

    oscillator.addEventListener(
      "ended",
      () => {
        try {
          oscillator.disconnect();
          gain.disconnect();
        } catch {
          // Audio cleanup is best-effort.
        }
      },
      { once: true },
    );

    oscillator.start(now);
    oscillator.stop(now + duration);

    return true;
  } catch {
    return false;
  }
}

export function disposeAudio() {
  if (music) { music.pause(); music.removeAttribute("src"); music.load(); music = null; }
  master = null;
  const audio = context;
  context = null;

  if (!audio) return;

  try {
    const result = audio.close();
    if (result && typeof result.catch === "function") {
      result.catch(() => {});
    }
  } catch {
    // Audio is optional.
  }
}
