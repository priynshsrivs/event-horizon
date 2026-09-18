import { mkdirSync, writeFileSync } from "node:fs";
import PhysicsEngine, { G } from "../src/physics/PhysicsEngine.js";

mkdirSync("artifacts", { recursive: true });
function save(name, setup) {
  const engine = new PhysicsEngine();
  engine.settings.autoFlares = engine.settings.magnetism = false;
  engine.settings.tides = false;
  setup(engine);
  engine.pause();
  writeFileSync(`artifacts/${name}.json`, JSON.stringify(engine.saveState(), null, 2));
}
save("capture", e => {
  e.gravityMultiplier = 0;
  e.spawnBody("black hole", { id: "hole", name: "Capture target", mass: 5 });
  e.spawnBody("planet", { name: "Incoming body", mass: 0.1, position: [-0.5, 0, 0], velocity: [5, 0, 0] });
});
save("catastrophic", e => {
  e.gravityMultiplier = 1; e.timeScale = 0.005;
  for (const sign of [-1, 1]) e.spawnBody("asteroid", { name: `Impactor ${sign}`, mass: 1e-6, radius: 0.001,
    position: [sign * 0.02, 0, 0], velocity: [-sign * 0.5, 0, 0], metadata: { displayScale: 20, visualSize: 0.08 } });
});
save("tidal", e => {
  e.settings.tides = true; e.timeScale = 0.000003; e.fixedDt = 1 / 2097152;
  e.spawnBody("white dwarf", { name: "Tidal primary" });
  e.spawnBody("planet", { name: "Tidal secondary", position: [0.001, 0, 0], velocity: [0, 0, Math.sqrt(G * 0.6 / 0.001)], metadata: { displayScale: 3000 } });
});
save("stellar", e => {
  e.gravityMultiplier = 0;
  for (const [type, x, z] of [["red giant", -4, 0], ["white dwarf", 4, 0], ["neutron star", 0, 4], ["red supergiant", 18, 0]])
    e.spawnBody(type, { position: [x, 0, z] });
});
writeFileSync("artifacts/invalid.json", '{"version":1,"bodies":[null]}');
console.log("Acceptance fixtures written to artifacts/ (gitignored).");
