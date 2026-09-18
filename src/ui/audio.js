let context;
export function playTone(kind = "click", volume = 0.25) {
  try {
    context ||= new (window.AudioContext || window.webkitAudioContext)();
    if (context.state === "suspended") context.resume();
    const oscillator = context.createOscillator(),
      gain = context.createGain();
    const frequencies = {
      click: 620,
      selection: 440,
      collision: 90,
      solarFlare: 210,
      supernova: 45,
    };
    const duration = kind === "supernova" ? 1.3 : kind === "click" ? 0.07 : 0.4;
    oscillator.type =
      kind === "collision" || kind === "supernova" ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(
      frequencies[kind] || 500,
      context.currentTime,
    );
    oscillator.frequency.exponentialRampToValueAtTime(
      (frequencies[kind] || 500) * 0.5,
      context.currentTime + duration,
    );
    gain.gain.setValueAtTime(
      Math.max(0.0001, volume * 0.1),
      context.currentTime,
    );
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      context.currentTime + duration,
    );
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  } catch {
    /* Audio is optional; simulation must remain usable without a device. */
  }
}
