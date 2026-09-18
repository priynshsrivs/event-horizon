const KEY = "event-horizon.preferences.v1";

export function readPreferences(defaults, storage) {
  try {
    storage ??= globalThis.localStorage;
    const saved = JSON.parse(storage.getItem(KEY));
    const result = { ...defaults };
    if (!saved || saved.version !== 1) return result;
    for (const [key, fallback] of Object.entries(defaults)) {
      const value = saved.settings?.[key];
      if (typeof fallback === "boolean" && typeof value === "boolean") result[key] = value;
      if (key === "quality" && ["low", "medium", "high"].includes(value)) result[key] = value;
      if (key === "volume" && Number.isFinite(value)) result[key] = Math.max(0, Math.min(1, value));
    }
    return result;
  } catch { return { ...defaults }; }
}

export function writePreferences(settings, storage) {
  try {
    storage ??= globalThis.localStorage;
    storage.setItem(KEY, JSON.stringify({ version: 1, settings }));
    return true;
  } catch { return false; }
}
