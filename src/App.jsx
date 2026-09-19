import React, { useCallback, useEffect, useRef, useState } from "react";
import PhysicsEngine, {
  AU_M,
  SOLAR_MASS_KG,
  G_SI,
  Vector3,
  auPerYearToMS,
  isStar,
} from "./physics/PhysicsEngine.js";
import { CHAPTERS, initializeChapter } from "./physics/story.js";
import voyagerStory from "./data/stories.json";
import Voyager from "./scene/Voyager.jsx";
import Universe from "./scene/Universe.jsx";
import { mapPosition, visualRadius } from "./scene/coordinates.js";
import Icon from "./ui/Icon.jsx";
import { playTone } from "./ui/audio.js";
import "./scene/Endurance.css";

const DEFAULT_SETTINGS = {
  orbits: true,
  labels: true,
  compressed: true,
  habitable: false,
  lensing: true,
  frameDragging: true,
  darkMatter: true,
  links: true,
  quality: "medium",
  sound: false,
  volume: 0.25,
};
const fmt = (value, digits = 2) =>
  !Number.isFinite(value)
    ? "Unbound"
    : Math.abs(value) >= 1e6 || (Math.abs(value) > 0 && Math.abs(value) < 0.001)
      ? value.toExponential(digits)
      : value.toLocaleString("en-US", { maximumFractionDigits: digits });
const eventLabels = {
  collision: "Impact detected",
  bodyMerged: "Bodies accreted",
  partialAccretion: "Ejecta released",
  tidalDisruption: "Tidal disruption",
  eventHorizonCrossed: "Event horizon crossed",
  solarFlare: "Stellar flare",
  supernova: "Supernova",
  wormholeTransit: "Wormhole transit",
  magnetarDisruption: "Magnetic interaction",
  branchRestored: "Timeline restored",
  planetaryNebula: "Planetary nebula formed",
  deepTime: "Deep-time evolution",
  rocheLimitBreach: "Roche limit breached",
};
const EXOTIC_TYPES = [
  "asteroid",
  "planet",
  "rogue planet",
  "comet",
  "star",
  "red giant",
  "red supergiant",
  "white dwarf",
  "brown dwarf",
  "neutron star",
  "magnetar",
  "black hole",
  "dark matter halo",
];

class RenderBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    return this.state.error ? (
      <div className="render-error">
        <Icon name="info" size={36} />
        <h2>The observatory couldn’t start.</h2>
        <p>{this.state.error.message}</p>
        <p>
          Check that hardware acceleration and WebGL 2 are enabled in your
          browser.
        </p>
        <button onClick={() => location.reload()}>Reload observatory</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
function MagneticTitle({ children }) {
  const titleRef = useRef(null);

  useEffect(() => {
    const title = titleRef.current;
    if (!title) return;

    const letters = [...title.querySelectorAll(".magnetic-letter")];
    let frame = 0;
    let mouseX = -9999;
    let mouseY = -9999;

    const move = (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;

      if (frame) return;

      frame = requestAnimationFrame(() => {
        frame = 0;

        letters.forEach((letter) => {
          const rect = letter.getBoundingClientRect();

          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;

          const dx = mouseX - cx;
          const dy = mouseY - cy;
          const distance = Math.sqrt(dx * dx + dy * dy);

          const radius = 105;

          if (distance < radius) {
            const strength = Math.pow(1 - distance / radius, 2);

            // Subtle, controlled enlargement
            const scale = 1 + strength * 0.16;

            letter.style.transform = `scale(${scale})`;

            letter.style.textShadow =
              `0 0 ${8 + strength * 12}px rgba(255,255,255,${0.25 + strength * 0.35})`;
          } else {
            letter.style.transform = "scale(1)";
            letter.style.textShadow = "none";
          }
        });
      });
    };

    const reset = () => {
      mouseX = -9999;
      mouseY = -9999;

      letters.forEach((letter) => {
        letter.style.transform = "scale(1)";
        letter.style.textShadow = "none";
      });
    };

    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("blur", reset);

    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("blur", reset);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <h1 ref={titleRef} className="splash-title magnetic-title">
      {[...children].map((char, index) =>
        char === " " ? (
          <span key={index} className="magnetic-space">{" "}</span>
        ) : (
          <span key={index} className="magnetic-letter">
            {char}
          </span>
        )
      )}
    </h1>
  );
}

function Metric({ label, value, unit }) {
  const valueRef = useRef(null);
  const didAnimate = useRef(false);

  useEffect(() => {
    const node = valueRef.current;
    if (!node || didAnimate.current) return;
    didAnimate.current = true;

    const raw = String(value).replace(/,/g, "").trim();
    const target = Number(raw);
    if (!Number.isFinite(target)) return;

    const scientific = /[eE]/.test(raw);
    const decimals = scientific
      ? 2
      : Math.max(0, (raw.split(".")[1] || "").length);
    const duration = 440;
    const start = performance.now();

    const format = (number) => {
      if (scientific) return number.toExponential(decimals);
      return number.toLocaleString("en-US", { maximumFractionDigits: decimals });
    };

    node.classList.add("is-counting");
    node.textContent = format(0);

    const animate = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      node.textContent = format(target * eased);
      if (progress < 1) requestAnimationFrame(animate);
      else node.textContent = String(value);
    };

    requestAnimationFrame(animate);
  }, [value]);

  return (
    <div className="metric">
      <dt>{label}</dt>
      <dd>
        <span ref={valueRef} className="metric-value">{value}</span>{" "}
        {unit && <small>{unit}</small>}
      </dd>
    </div>
  );
}
function Toggle({ label, checked, onChange, detail }) {
  return (
    <label className="toggle-row">
      <span>
        {label}
        {detail && <small>{detail}</small>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <i className="switch" />
    </label>
  );
}
function PanelHeading({ eyebrow, title, onClose, icon = "orbit" }) {
  return (
    <div className="panel-heading">
      <div>
        <span className="eyebrow">
          <Icon name={icon} size={13} />
          {eyebrow}
        </span>
        <h2>{title}</h2>
      </div>
      <button
        className="icon-button"
        aria-label="Close panel"
        onClick={onClose}
      >
        <Icon name="close" />
      </button>
    </div>
  );
}

function PlanetInfo({ body, engine, onClose, onEdit }) {
  const primary = engine.getBody(body.metadata.primaryId || "sun"),
    orbit = engine.calculateOrbitalElements(body, primary);
  const radiation = engine.calculateRadiation(body),
    relativity = engine.bodies.find(
      (b) => b.type === "black hole" && b !== body,
    );
  const local = relativity
    ? engine.calculateRelativity(body, relativity)
    : null;
  return (
    <aside className="panel info-panel">
      <PanelHeading
        eyebrow="OBJECT TELEMETRY"
        title={body.name}
        onClose={onClose}
      />
      <div className="object-category">
        <i style={{ background: body.metadata.color || "#94c9ce" }} />
        {body.type === "planet" ? engine.classifyExoplanet(body) : body.type}
        <span>LIVE</span>
      </div>
      <p className="body-description">
        {body.metadata.description ||
          `A ${body.type} in your experiment. Its position and velocity evolve through the N-body simulation.`}
      </p>
      <dl className="metrics-grid">
        <Metric label="MASS" value={fmt(body.mass * SOLAR_MASS_KG)} unit="kg" />
        <Metric
          label="RADIUS"
          value={fmt((body.radius * AU_M) / 1000)}
          unit="km"
        />
        <Metric
          label="DISTANCE TO PRIMARY"
          value={
            primary && primary !== body
              ? fmt(body.position.distanceTo(primary.position), 3)
              : "—"
          }
          unit="AU"
        />
        <Metric
          label="VELOCITY"
          value={fmt(auPerYearToMS(body.velocity.length()) / 1000)}
          unit="km/s"
        />
        <Metric label="TEMPERATURE" value={fmt(body.temperature, 0)} unit="K" />
        <Metric label="DENSITY" value={fmt(body.density, 0)} unit="kg/m³" />
      </dl>
      <section className="panel-section">
        <h3>Orbital mechanics</h3>
        <dl className="data-rows">
          <Metric
            label="Orbital period"
            value={orbit ? fmt(orbit.period, 3) : "—"}
            unit="yr"
          />
          <Metric
            label="Semi-major axis"
            value={orbit ? fmt(orbit.semiMajorAxis, 4) : "—"}
            unit="AU"
          />
          <Metric
            label="Eccentricity"
            value={orbit ? fmt(orbit.eccentricity, 5) : "—"}
          />
          <Metric
            label="Inclination"
            value={orbit ? fmt(orbit.inclination, 2) : "—"}
            unit="°"
          />
          <Metric
            label="Rotation period"
            value={
              body.metadata.rotationDays
                ? fmt(body.metadata.rotationDays, 3)
                : body.angularVelocity.length()
                  ? fmt(
                      ((2 * Math.PI) / body.angularVelocity.length()) * 365.25,
                    )
                  : "—"
            }
            unit="days"
          />
          <Metric label="Axial tilt" value={fmt(body.axialTilt)} unit="°" />
          <Metric
            label="Escape velocity"
            value={fmt(auPerYearToMS(body.escapeVelocity()) / 1000)}
            unit="km/s"
          />
          <Metric
            label="Surface gravity"
            value={fmt(
              (G_SI * body.mass * SOLAR_MASS_KG) / (body.radius * AU_M) ** 2,
            )}
            unit="m/s²"
          />
        </dl>
      </section>
      <section className="panel-section">
        <h3>Composition</h3>
        <div className="chips">
          {body.composition.map((c, i) => (
            <span key={i}>{c}</span>
          ))}
        </div>
      </section>
      {!isStar(body) && body.type !== "black hole" && (
        <section className="panel-section">
          <h3>Environment</h3>
          <dl className="data-rows">
            <Metric
              label="Stellar flux"
              value={fmt(radiation.flux)}
              unit="W/m²"
            />
            <Metric
              label="Equilibrium temperature"
              value={fmt(engine.calculateEquilibriumTemperature(body), 0)}
              unit="K"
            />
            <Metric
              label="Tidal stress / self-gravity"
              value={fmt(body.metadata.tidalStress || 0, 5)}
            />
            <Metric
              label="N₂ retention estimate"
              value={
                engine.atmosphericRetention(body).likelyRetained
                  ? "Likely retained"
                  : "Likely escape"
              }
            />
          </dl>
          <p className="fine-print">
            Equilibrium temperature excludes greenhouse warming. Gas retention
            is a thermal-speed estimate.
          </p>
        </section>
      )}
      {(local || body.type === "black hole") && (
        <section className="panel-section">
          <h3>Relativity · approximate</h3>
          <dl className="data-rows">
            <Metric
              label="Horizon radius"
              value={fmt(
                (engine.schwarzschildRadius(
                  body.type === "black hole" ? body.mass : relativity.mass,
                ) *
                  AU_M) /
                  1000,
              )}
              unit="km"
            />
            <Metric
              label="Local time factor"
              value={
                local
                  ? fmt(local.combinedApproximateTimeFactor, 8)
                  : "Not defined at horizon"
              }
            />
            <Metric
              label="Universe time"
              value={fmt(engine.time, 5)}
              unit="yr"
            />
            <Metric
              label="Local elapsed time"
              value={fmt(body.metadata.localTime || 0, 5)}
              unit="yr"
            />
          </dl>
        </section>
      )}
      <button className="button full" onClick={onEdit}>
        <Icon name="settings" />
        Edit in God Mode
        <Icon name="chevron" size={14} />
      </button>
    </aside>
  );
}

function BodyEditor({ body, engine, onChange, notify }) {
  const [values, setValues] = useState({});
  useEffect(() => {
    setValues({
      mass: String(body.mass),
      radius: String((body.radius * AU_M) / 1000),
      density: String(body.density),
      temperature: String(body.temperature),
      luminosity: String(body.luminosity),
      spin: String(body.angularVelocity.y),
      tilt: String(body.axialTilt),
      vx: String(body.velocity.x),
      vy: String(body.velocity.y),
      vz: String(body.velocity.z),
      charge: String(body.charge),
      composition: body.composition.join(", "),
      collisionMode: body.collisionMode,
    });
  }, [body.id]);
  const edit = (key) => (e) =>
    setValues((old) => ({ ...old, [key]: e.target.value }));
  const apply = (e) => {
    e.preventDefault();
    const keys = [
      "mass",
      "radius",
      "density",
      "temperature",
      "luminosity",
      "spin",
      "tilt",
      "vx",
      "vy",
      "vz",
      "charge",
    ];
    if (
      keys.some(
        (k) => values[k] === "" || !Number.isFinite(Number(values[k])),
      ) ||
      Number(values.mass) <= 0 ||
      Number(values.radius) <= 0 ||
      Number(values.density) <= 0 ||
      Number(values.temperature) < 0 ||
      Number(values.luminosity) < 0
    ) {
      notify(
        "Enter finite values; mass, radius and density must be positive.",
        "error",
      );
      return;
    }
    engine.checkpoint();
    engine.updateBody(body.id, {
      mass: +values.mass,
      radius: (+values.radius * 1000) / AU_M,
      temperature: +values.temperature,
      luminosity: +values.luminosity,
      angularVelocity: [
        body.angularVelocity.x,
        +values.spin,
        body.angularVelocity.z,
      ],
      spin: +values.spin,
      axialTilt: +values.tilt,
      velocity: [+values.vx, +values.vy, +values.vz],
      charge: +values.charge,
      composition: values.composition
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      collisionMode: values.collisionMode,
    });
    engine.checkpoint();
    onChange();
    notify(`${body.name} updated`);
  };
  return (
    <form onSubmit={apply} className="body-editor">
      <h3>Edit {body.name}</h3>
      <div className="form-grid">
        {[
          ["mass", "Mass · M☉"],
          ["radius", "Radius · km"],
          ["temperature", "Temperature · K"],
          ["luminosity", "Luminosity · L☉"],
          ["spin", "Spin · rad/yr"],
          ["tilt", "Axial tilt · °"],
          ["vx", "Velocity X · AU/yr"],
          ["vy", "Velocity Y · AU/yr"],
          ["vz", "Velocity Z · AU/yr"],
          ["charge", "Charge · relative"],
        ].map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              aria-label={label}
              value={values[key] ?? ""}
              onChange={edit(key)}
              type="number"
              step="any"
            />
          </label>
        ))}
      </div>
      <label>
        Density · kg/m³
        <div className="input-action">
          <input
            type="number"
            aria-label="Density"
            step="any"
            value={values.density ?? ""}
            onChange={edit("density")}
          />
          <button
            type="button"
            onClick={() => {
              if (+values.density > 0 && +values.mass > 0)
                setValues((v) => ({
                  ...v,
                  radius: String(
                    Math.cbrt(
                      (3 * +v.mass * SOLAR_MASS_KG) /
                        (4 * Math.PI * +v.density),
                    ) / 1000,
                  ),
                }));
            }}
          >
            Derive radius
          </button>
        </div>
      </label>
      <label>
        Composition
        <input
          value={values.composition ?? ""}
          onChange={edit("composition")}
        />
      </label>
      <label>
        Collision response
        <select
          value={values.collisionMode || "auto"}
          onChange={edit("collisionMode")}
        >
          {["auto", "merge", "bounce", "destroy", "ignore"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </label>
      <button className="button primary full" type="submit">
        Apply properties
      </button>
    </form>
  );
}

function voyagerWaypointIndex(waypoints, missionYear) {
  if (!waypoints?.length) return 0;
  let index = 0;
  for (let i = 0; i < waypoints.length; i++) {
    if (missionYear >= waypoints[i].year) index = i;
  }
  return index;
}

function VoyagerPanel({ story, engine, progress, setProgress, active, setActive, onSelect, deepTimeTarget, setDeepTimeTarget, act, ensureVoyagerBody }) {
  const missionYear = 1977 + (2012 - 1977) * progress;
  const idx = voyagerWaypointIndex(story.waypoints, missionYear);
  const waypoint = story.waypoints[idx];
  return (
    <aside className="panel voyager-panel">
      <PanelHeading eyebrow="MISSION STORY" title="Voyager's Journey" icon="story" onClose={() => { setActive(false); onSelect(null); }} />
      <p className="panel-intro">{story.description}</p>
      <section className="panel-section">
        <button className="button warm full" onClick={() => {
          if (active) {
            setActive(false);
            onSelect(null);
            return;
          }
          const body = ensureVoyagerBody(progress);
          onSelect(body.id);
          setActive(true);
        }}>{active ? "Pause mission" : "Start mission"}</button>
        <label className="range-label">MISSION YEAR <output>{Math.round(missionYear)}</output>
          <input type="range" min="0" max="1" step="0.001" value={progress} onChange={(e) => {
            const value = +e.target.value;
            setProgress(value);
            ensureVoyagerBody(value);
            onSelect("voyager-1");
          }} />
        </label>
      </section>
      <section className="panel-section">
        <h3>{waypoint.label}</h3>
        <dl className="data-rows">
          <Metric label="Mission elapsed" value={fmt(missionYear - 1977, 1)} unit="yr" />
          <Metric label="Velocity" value="17.0" unit="km/s" />
          <Metric label="Distance from Earth" value={fmt(165 * progress, 1)} unit="AU" />
        </dl>
      </section>
      <section className="panel-section">
        <h3>Deep time · stellar evolution</h3>
        <label className="range-label"><output>{(deepTimeTarget / 1e9).toFixed(2)} Gyr</output>
          <input type="range" min="0" max="5000000000" step="10000000" value={deepTimeTarget}
            onChange={(e) => { const v = +e.target.value; setDeepTimeTarget(v); act(() => engine.applyDeepTime(v)); }} />
        </label>
        <button className="button full" onClick={() => act(() => { engine.fastForwardDeepTime(5e9); setDeepTimeTarget(5e9); })}>
          Fast-forward to +5 Gyr
        </button>
      </section>
    </aside>
  );
}

function GodPanel({
  engine,
  selected,
  onClose,
  onBuild,
  onChange,
  act,
  notify,
  onSelect,
}) {
  return (
    <aside className="panel god-panel">
      <PanelHeading
        eyebrow="ADVANCED SANDBOX"
        title="God Mode"
        icon="god"
        onClose={onClose}
      />
      <p className="panel-intro">
        Rewrite the rules. Create a body, or select one to change its
        properties.
      </p>
      <div className="notice">
        <i />
        Physics pauses when this panel opens. Resume when your experiment is
        ready.
      </div>
      <section className="panel-section">
        <h3>Universal parameters</h3>
        <button className="button full" onClick={() => onSelect(null)}>
          <Icon name="home" />
          Free camera · release target
        </button>
        <label className="range-label">
          Gravity multiplier{" "}
          <output>{fmt(engine.gravityMultiplier, 1)}×</output>
          <input
            aria-label="Gravity multiplier"
            type="range"
            min="0"
            max="5"
            step="0.05"
            value={engine.gravityMultiplier}
            onChange={(e) =>
              act(() => engine.setGravityMultiplier(+e.target.value))
            }
          />
        </label>
        {engine.getBody("sun") && (
          <label className="range-label">
            Sun mass <output>{fmt(engine.getBody("sun").mass, 2)} M☉</output>
            <input
              aria-label="Sun mass"
              type="range"
              min="0.1"
              max="5"
              step="0.05"
              value={engine.getBody("sun").mass}
              onChange={(e) =>
                act(() => {
                  const mass = +e.target.value;
                  engine.updateBody("sun", {
                    mass,
                    luminosity: engine.stellarModel(mass).luminosity,
                  });
                })
              }
            />
          </label>
        )}
      </section>
      <section className="panel-section">
        <h3>
          Create an object <small>CLICK, THEN DRAG IN SPACE</small>
        </h3>
        <div className="spawn-grid">
          {EXOTIC_TYPES.map((type) => (
            <button key={type} onClick={() => onBuild(type)}>
              <i className={`body-dot ${type.replaceAll(" ", "-")}`} />
              {type}
            </button>
          ))}
        </div>
      </section>
      <section className="panel-section">
        <h3>System generators</h3>
        <div className="generator-grid">
          {[
            ["Binary stars", () => engine.spawnBinary()],
            [
              "Trinary stars",
              () => engine.spawnBinary(new Vector3(5, 0, 0), 1, 1, 3),
            ],
            ["Wormhole pair", () => engine.spawnWormholePair()],
            ["Asteroid belt", () => engine.spawnBelt()],
            [
              "Kuiper belt",
              () => engine.spawnBelt({ inner: 35, outer: 45, count: 24 }),
            ],
            [
              "Galaxy disk",
              () =>
                engine.spawnBelt({
                  galaxy: true,
                  count: 40,
                  inner: 2,
                  outer: 10,
                }),
            ],
          ].map(([name, fn]) => (
            <button
              key={name}
              onClick={() =>
                act(() => {
                  fn();
                  notify(`${name} created`);
                })
              }
            >
              {name}
              <Icon name="plus" size={13} />
            </button>
          ))}
        </div>
      </section>
      <section className="panel-section">
        <h3>Stellar events</h3>
        <div className="button-row">
          <button
            className="button warm"
            onClick={() =>
              act(() => {
                const star =
                  selected && isStar(selected)
                    ? selected
                    : engine.bodies.find(isStar);
                if (!star) throw new Error("Create or select a star first.");
                engine.triggerSolarFlare(star.id);
                onSelect(star.id);
              })
            }
          >
            <Icon name="bolt" />
            Solar flare
          </button>
          <button
            className="button danger"
            onClick={() =>
              act(() => {
                const star =
                  selected && isStar(selected)
                    ? selected
                    : engine.bodies.find(isStar);
                if (!star) throw new Error("Create or select a star first.");
                const remnant = engine.triggerSupernova(star.id);
                onSelect(remnant.id);
              })
            }
          >
            <Icon name="star" />
            Supernova
          </button>
        </div>
        <p className="fine-print">
          Forced supernovae are sandbox interventions. The Sun cannot naturally
          undergo a core-collapse supernova.
        </p>
      </section>
      {selected && (
        <>
          <BodyEditor
            key={selected.id}
            body={selected}
            engine={engine}
            onChange={onChange}
            notify={notify}
          />
          <div className="button-row">
            <button
              className="button"
              onClick={() =>
                act(() => engine.applyTidalDisruption(selected.id))
              }
            >
              Disrupt body
            </button>
            <button
              className="button danger"
              onClick={() =>
                act(() => {
                  engine.removeBody(selected.id);
                  onSelect(null);
                })
              }
            >
              <Icon name="trash" />
              Delete
            </button>
          </div>
        </>
      )}
      <p className="fine-print">
        Wormholes and magnetic disruption are speculative toy models. Galaxy
        disks use a small number of gravitating particles.
      </p>
    </aside>
  );
}

function EnergyChart({ samples }) {
  const all = samples.flatMap((s) => [
      s.kineticEnergy,
      s.potentialEnergy,
      s.totalEnergy,
    ]),
    min = Math.min(...all, -1e-9),
    max = Math.max(...all, 1e-9),
    span = max - min;
  return (
    <div className="energy-chart">
      <svg
        viewBox="0 0 300 105"
        role="img"
        aria-label="Live kinetic, potential and total energy history"
      >
        <path
          d="M0 25H300M0 53H300M0 80H300"
          stroke="#24313b"
          strokeWidth="0.5"
        />
        {[
          ["kineticEnergy", "#c8b08c"],
          ["potentialEnergy", "#9a8dc0"],
          ["totalEnergy", "#79bbb9"],
        ].map(([key, color]) => (
          <polyline
            key={key}
            fill="none"
            stroke={color}
            strokeWidth="1.5"
            points={samples
              .map(
                (s, i) =>
                  `${(i / Math.max(1, samples.length - 1)) * 300},${95 - ((s[key] - min) / span) * 85}`,
              )
              .join(" ")}
          />
        ))}
      </svg>
      <div className="chart-key">
        <span>Kinetic</span>
        <span>Potential</span>
        <span>Total</span>
      </div>
    </div>
  );
}

function PhysicsPanel({
  engine,
  samples,
  settings,
  setSetting,
  onChange,
  onClose,
}) {
  const d = engine.getSystemDiagnostics();
  return (
    <aside className="panel">
      <PanelHeading
        eyebrow="SIMULATION HEALTH"
        title="Physics laboratory"
        icon="physics"
        onClose={onClose}
      />
      <span className="status-pill">VELOCITY VERLET · FIXED STEP</span>
      <EnergyChart samples={samples} />
      <dl className="data-rows">
        <Metric label="Total energy" value={fmt(d.totalEnergy, 6)} />
        <Metric label="Total mass" value={fmt(d.totalMass, 6)} unit="M☉" />
        <Metric
          label="Linear momentum |p|"
          value={fmt(d.linearMomentum.length(), 5)}
        />
        <Metric
          label="Angular momentum |L|"
          value={fmt(d.angularMomentum.length(), 5)}
        />
        <Metric
          label="Barycenter X / Y / Z"
          value={d.centerOfMass
            .toArray()
            .map((x) => fmt(x, 3))
            .join(" / ")}
        />
        <Metric
          label="Active bodies"
          value={`${d.activeBodyCount} / ${engine.maxBodies}`}
        />
        <Metric
          label="Fixed step"
          value={fmt(engine.fixedDt * 365.25 * 24 * 60)}
          unit="min"
        />
        <Metric
          label="Last frame substeps"
          value={`${d.substeps} / ${engine.maxSubsteps}`}
        />
        <Metric
          label="Capped simulation time"
          value={fmt(d.droppedTime * 365.25, 3)}
          unit="days"
        />
      </dl>
      <p className="fine-print">
        Energy: M☉·AU²/yr². Momentum: M☉·AU/yr. Collisions, mass edits, portals
        and magnetic forces can change system energy. At the substep limit, the
        simulation slows instead of taking unsafe large steps.
      </p>
      <section className="panel-section">
        <h3>Physical models</h3>
        {[
          ["collisions", "Physical collisions"],
          ["tides", "Tidal deformation & disruption"],
          ["autoFlares", "Automatic stellar flares"],
          ["magnetism", "Magnetic interactions"],
          ["relativityEnabled", "Bounded relativistic correction"],
        ].map(([key, label]) => (
          <Toggle
            key={key}
            label={label}
            checked={engine.settings[key]}
            onChange={(value) => {
              engine.settings[key] = value;
              onChange();
            }}
          />
        ))}
      </section>
      <section className="panel-section">
        <h3>Field visualizations</h3>
        {[
          ["habitable", "Habitable zones"],
          ["lensing", "Background lensing"],
          ["frameDragging", "Accretion disk rotation"],
          ["darkMatter", "Dark matter fields"],
          ["links", "Wormhole links"],
        ].map(([key, label]) => (
          <Toggle
            key={key}
            label={label}
            checked={settings[key]}
            onChange={(value) => setSetting(key, value)}
          />
        ))}
      </section>
      <p className="fine-print">
        Newtonian gravity is simulated. Relativity, lensing, stellar evolution
        and tidal fragmentation are reduced approximations, not full GR or fluid
        dynamics.
      </p>
    </aside>
  );
}

function BranchPanel({ engine, onClose, act, notify, onExport, onImport }) {
  const [name, setName] = useState("Branch A");
  return (
    <aside className="panel">
      <PanelHeading
        eyebrow="ALTERNATE TIMELINES"
        title="What if?"
        icon="branch"
        onClose={onClose}
      />
      <p className="panel-intro">
        Save a moment. Change one thing. Discover a different universe.
      </p>
      <label className="field-label">
        TIMELINE NAME
        <input
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <button
        className="button primary full"
        onClick={() =>
          act(() => {
            if (!name.trim()) throw new Error("Give this timeline a name.");
            engine.createBranch(name.trim());
            notify(`Saved ${name.trim()}`);
            setName(`Branch ${String.fromCharCode(65 + engine.branches.size)}`);
          })
        }
      >
        <Icon name="plus" />
        Save current timeline
      </button>
      <div className="branches">
        {[...engine.branches].map(([key, state]) => (
          <div className="branch-card" key={key}>
            <div>
              <Icon name="branch" />
              <strong>{key}</strong>
              <small>
                {fmt(state.time, 3)} years · {state.bodies.length} bodies
              </small>
            </div>
            <button
              title={`Restore ${key}`}
              onClick={() => act(() => engine.restoreBranch(key))}
            >
              <Icon name="undo" size={16} />
            </button>
            <button
              title={`Delete ${key}`}
              onClick={() => act(() => engine.branches.delete(key))}
            >
              <Icon name="trash" size={15} />
            </button>
          </div>
        ))}
        {!engine.branches.size && (
          <div className="empty-state">
            <Icon name="branch" size={30} />
            <p>
              Your first alternate universe
              <br />
              starts with a snapshot.
            </p>
          </div>
        )}
      </div>
      <section className="panel-section">
        <h3>Take your universe with you</h3>
        <div className="button-row">
          <button className="button" onClick={onExport}>
            <Icon name="download" />
            Export JSON
          </button>
          <button className="button" onClick={onImport}>
            <Icon name="upload" />
            Import JSON
          </button>
        </div>
        <p className="fine-print">
          Snapshots include bodies, velocities, temperatures, metadata and
          physics settings. In-memory branches last for this session; export any
          timeline you want to keep.
        </p>
      </section>
    </aside>
  );
}

function Minimap({ engine, selectedId, onSelect }) {
  const points = engine.bodies.filter((b) => b.metadata.texture),
    max = Math.max(
      5,
      ...points.map((b) => 4 * Math.log1p(b.position.length())),
    );
  return (
    <div className="minimap">
      <span className="eyebrow">SYSTEM OVERVIEW</span>
      <svg viewBox="0 0 160 160" role="img" aria-label="Solar system minimap">
        <circle
          cx="80"
          cy="80"
          r="66"
          fill="none"
          stroke="#2b3540"
          strokeWidth="0.5"
        />
        <path d="M10 80h140M80 10v140" stroke="#25313b" strokeWidth="0.5" />
        {points.map((b) => {
          const p = mapPosition(b.position),
            x = 80 + (p[0] / max) * 65,
            y = 80 + (p[2] / max) * 65;
          return (
            <g
              key={b.id}
              onClick={() => onSelect(b.id)}
              role="button"
              tabIndex="0"
              aria-label={`Focus ${b.name}`}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSelect(b.id);
              }}
            >
              <circle cx={x} cy={y} r="6" fill="transparent" />
              <circle
                cx={x}
                cy={y}
                r={selectedId === b.id ? 3 : 1.8}
                fill={b.metadata.color}
              />
              {selectedId === b.id && (
                <circle
                  cx={x}
                  cy={y}
                  r="6"
                  stroke="#91d3d4"
                  fill="none"
                  strokeWidth="0.7"
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}


const SPLASH_STAGE_ONE_IMAGE = "/textures/splash/images-3.jpeg";
const SPLASH_STAGE_TWO_IMAGE = "/textures/splash/images-4.jpeg";
const SPLASH_STAGE_THREE_IMAGE = "/textures/splash/images-2.jpeg";

const CRITICAL_BOOT_ASSETS = [
  { type: "image", url: SPLASH_STAGE_ONE_IMAGE, label: "SPLASH IMAGE 01" },
  { type: "image", url: SPLASH_STAGE_TWO_IMAGE, label: "SPLASH IMAGE 02" },
  { type: "image", url: SPLASH_STAGE_THREE_IMAGE, label: "SPLASH IMAGE 03" },
  { type: "font", url: "/fonts/dm-sans-regular.ttf", label: "DM SANS REGULAR" },
  { type: "font", url: "/fonts/dm-sans-medium.ttf", label: "DM SANS MEDIUM" },
  { type: "font", url: "/fonts/ibm-plex-mono-regular.ttf", label: "IBM PLEX MONO" },
];

async function preloadCriticalAsset(asset) {
  if (asset.type === "font") {
    const response = await fetch(asset.url, { cache: "force-cache" });
    if (!response.ok) throw new Error(`${asset.url} returned HTTP ${response.status}`);
    await response.arrayBuffer();
    await document.fonts.load(
      asset.url.includes("ibm-plex") ? '400 12px "IBM Plex Mono"' :
        asset.url.includes("medium") ? '500 12px "DM Sans"' :
          '400 12px "DM Sans"',
    );
    return;
  }
  await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(`${asset.url} failed to load`));
    image.src = asset.url;
  });
}

function BootScreen({ progress, current, error, onRetry }) {
  return (
    <main className="boot-screen" aria-live="polite" aria-busy={!error}>
      <div className="boot-screen-inner">
        <span className="eyebrow">EVENT HORIZON / LOCAL BOOT</span>
        <h1>INITIALIZING OBSERVATORY</h1>
        <div className="boot-progress">
          <span style={{ transform: `scaleX(${progress / 100})` }} />
        </div>
        <strong>{Math.round(progress)}%</strong>
        <p>{error ? "BOOT HALTED — REQUIRED LOCAL ASSET FAILED" : current || "VERIFYING LOCAL ASSETS…"}</p>
        {error && (
          <>
            <pre className="boot-error">{error}</pre>
            <button className="button" onClick={onRetry}>Retry asset check</button>
          </>
        )}
      </div>
    </main>
  );
}

const SPLASH_FACTS = [
  {
    text: "A black hole is not a cosmic vacuum cleaner.",
    x: "7%",
    y: "22%",
    rotate: "-7deg",
    width: "240px",
    size: "13px",
    delay: "0s",
  },
  {
    text: "If the Sun became a black hole with the same mass, Earth's orbit would barely change.",
    x: "72%",
    y: "12%",
    rotate: "5deg",
    width: "270px",
    size: "12px",
    delay: ".6s",
  },
  {
    text: "Sunlight reaches your face about 8 minutes after leaving the Sun.",
    x: "4%",
    y: "67%",
    rotate: "4deg",
    width: "245px",
    size: "12px",
    delay: "1.1s",
  },
  {
    text: "Those photons may have spent roughly 100,000–170,000 years escaping the solar interior first.",
    x: "69%",
    y: "73%",
    rotate: "-5deg",
    width: "285px",
    size: "11px",
    delay: "1.5s",
  },
  {
    text: "A day on Venus is longer than its year.",
    x: "8%",
    y: "43%",
    rotate: "7deg",
    width: "190px",
    size: "13px",
    delay: ".4s",
  },
  {
    text: "Saturn is less dense than water. Somewhere, a bathtub is missing.",
    x: "73%",
    y: "45%",
    rotate: "-4deg",
    width: "245px",
    size: "12px",
    delay: "1.9s",
  },
  {
    text: "A neutron star packs roughly a star's worth of matter into a city-sized object.",
    x: "18%",
    y: "82%",
    rotate: "-6deg",
    width: "270px",
    size: "11px",
    delay: ".9s",
  },
  {
    text: "You never see distant space in real time. Every photon is ancient history.",
    x: "50%",
    y: "8%",
    rotate: "2deg",
    width: "260px",
    size: "12px",
    delay: "1.3s",
  },
  {
    text: "The Milky Way and Andromeda are on a collision course.",
    x: "47%",
    y: "86%",
    rotate: "5deg",
    width: "235px",
    size: "11px",
    delay: "2.2s",
  },
];


function EHSmokeBackground() {
  const canvasRef = useRef(null);
  const [filterId] = useState(
    () => `eh-liquid-${Math.random().toString(36).slice(2)}`
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", {
      alpha: true,
      desynchronized: true,
    });

    let width = 0;
    let height = 0;
    let raf = 0;
    let running = true;

    const mouse = {
      x: 0.5,
      y: 0.5,
      tx: 0.5,
      ty: 0.5,
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      width = window.innerWidth;
      height = window.innerHeight;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);

      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const onPointerMove = (e) => {
      mouse.tx = e.clientX / Math.max(1, width);
      mouse.ty = e.clientY / Math.max(1, height);
    };

    resize();

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove, {
      passive: true,
    });

    /*
      Large soft liquid bodies.

      These intentionally move VERY slowly.
      The goal is not smoke — it is thick, viscous,
      glass-like fluid.
    */
    const blobs = [
      { x: .12, y: .30, rx: .32, ry: .23, a: 0.0, speed: .18 },
      { x: .30, y: .62, rx: .38, ry: .25, a: 1.7, speed: .14 },
      { x: .50, y: .28, rx: .34, ry: .22, a: 3.2, speed: .12 },
      { x: .69, y: .55, rx: .42, ry: .28, a: 4.6, speed: .16 },
      { x: .88, y: .30, rx: .30, ry: .24, a: 2.4, speed: .11 },
      { x: .80, y: .82, rx: .35, ry: .25, a: 5.5, speed: .13 },
      { x: .25, y: .88, rx: .32, ry: .22, a: 4.1, speed: .10 },
    ];

    const drawBlob = (b, t) => {
      const slow = t * b.speed;

      /*
        Organic orbital movement.
      */
      let x =
        width *
        (
          b.x +
          Math.sin(slow + b.a) * .055 +
          Math.sin(slow * .47 + b.a * 2.1) * .022
        );

      let y =
        height *
        (
          b.y +
          Math.cos(slow * .83 + b.a) * .065 +
          Math.sin(slow * .39 + b.a * 1.7) * .025
        );

      /*
        Mouse gently bends the fluid field.
      */
      x += (mouse.x - .5) * width * .075;
      y += (mouse.y - .5) * height * .055;

      const pulse =
        1 +
        Math.sin(slow * .72 + b.a) * .10 +
        Math.sin(slow * .31 + b.a * 2) * .045;

      const rx =
        Math.min(width, height) * b.rx * pulse;

      const ry =
        Math.min(width, height) *
        b.ry *
        (
          1 +
          Math.cos(slow * .61 + b.a) * .12
        );

      /*
        Main liquid-glass body.
      */
      const g = ctx.createRadialGradient(
        x - rx * .20,
        y - ry * .18,
        0,
        x,
        y,
        Math.max(rx, ry) * 1.18
      );

      g.addColorStop(0, "rgba(82, 67, 119, .105)");
      g.addColorStop(.18, "rgba(61, 49, 96, .13)");
      g.addColorStop(.42, "rgba(43, 36, 72, .12)");
      g.addColorStop(.70, "rgba(25, 23, 48, .10)");
      g.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.fillStyle = g;

      ctx.beginPath();

      /*
        Slightly irregular ellipse instead of a perfect circle.
        This is what makes it feel like viscous liquid.
      */
      const points = 80;

      for (let i = 0; i <= points; i++) {
        const a = (i / points) * Math.PI * 2;

        const wobble =
          1 +
          Math.sin(a * 3 + slow * .8 + b.a) * .055 +
          Math.sin(a * 5 - slow * .52) * .035;

        const px = x + Math.cos(a) * rx * wobble;
        const py = y + Math.sin(a) * ry * wobble;

        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }

      ctx.closePath();
      ctx.fill();

      /*
        Bright liquid-glass highlight.
      */
      const highlight = ctx.createRadialGradient(
        x - rx * .30,
        y - ry * .34,
        0,
        x - rx * .20,
        y - ry * .20,
        rx * .72
      );

      highlight.addColorStop(0, "rgba(155, 145, 190, .055)");
      highlight.addColorStop(.18, "rgba(105, 91, 145, .045)");
      highlight.addColorStop(1, "rgba(255,255,255,0)");

      ctx.fillStyle = highlight;

      ctx.beginPath();
      ctx.ellipse(
        x - rx * .16,
        y - ry * .20,
        rx * .48,
        ry * .28,
        -.35 + Math.sin(slow * .3) * .08,
        0,
        Math.PI * 2
      );
      ctx.fill();
    };

    const draw = (time) => {
      if (!running) return;

      const t = time * 0.001;

      mouse.x += (mouse.tx - mouse.x) * .025;
      mouse.y += (mouse.ty - mouse.y) * .025;

      ctx.clearRect(0, 0, width, height);

      /*
        Deep glassy space background.
      */
      const base = ctx.createRadialGradient(
        width * (.50 + (mouse.x - .5) * .05),
        height * (.48 + (mouse.y - .5) * .04),
        0,
        width * .5,
        height * .5,
        Math.max(width, height) * .82
      );

      base.addColorStop(0, "rgba(11, 9, 22, .99)");
      base.addColorStop(.38, "rgba(7, 7, 16, .995)");
      base.addColorStop(.72, "rgba(3, 5, 12, 1)");
      base.addColorStop(1, "rgba(1, 3, 8, 1)");

      ctx.fillStyle = base;
      ctx.fillRect(0, 0, width, height);

      /*
        Liquid layer.
      */
      ctx.save();

      ctx.globalCompositeOperation = "screen";
      ctx.filter = `blur(${Math.max(18, width * .018)}px)`;

      for (const blob of blobs) {
        drawBlob(blob, t);
      }

      ctx.restore();

      /*
        Secondary sharper liquid highlights.
        This gives the blobs a glass surface instead
        of looking like fog.
      */
      ctx.save();

      ctx.globalCompositeOperation = "screen";
      ctx.filter = `blur(${Math.max(3, width * .004)}px)`;
      ctx.globalAlpha = .48;

      for (let i = 0; i < blobs.length; i++) {
        const b = blobs[i];

        const phase = t * b.speed + b.a;

        const x =
          width *
          (
            b.x +
            Math.sin(phase) * .055 +
            Math.sin(phase * .47 + b.a * 2.1) * .022
          ) +
          (mouse.x - .5) * width * .075;

        const y =
          height *
          (
            b.y +
            Math.cos(phase * .83) * .065 +
            Math.sin(phase * .39 + b.a * 1.7) * .025
          ) +
          (mouse.y - .5) * height * .055;

        const rx = Math.min(width, height) * b.rx;

        const sheen = ctx.createLinearGradient(
          x - rx,
          y - rx,
          x + rx,
          y + rx
        );

        sheen.addColorStop(0, "rgba(255,255,255,0)");
        sheen.addColorStop(.45, "rgba(91, 78, 125, .045)");
        sheen.addColorStop(.52, "rgba(145, 135, 175, .065)");
        sheen.addColorStop(.60, "rgba(80, 68, 112, .035)");
        sheen.addColorStop(1, "rgba(255,255,255,0)");

        ctx.fillStyle = sheen;

        ctx.beginPath();
        ctx.ellipse(
          x - rx * .12,
          y - rx * .18,
          rx * .70,
          rx * .18,
          -.45 + Math.sin(phase * .22) * .1,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }

      ctx.restore();

      /*
        Very subtle film grain.
      */
      ctx.save();
      ctx.globalAlpha = .035;

      const step = Math.max(
        4,
        Math.floor(Math.min(width, height) / 250)
      );

      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          const n =
            Math.sin(
              x * 12.9898 +
              y * 78.233 +
              t * 12.17
            ) * 43758.5453;

          const v = n - Math.floor(n);

          if (v > .76) {
            ctx.fillStyle =
              v > .9
                ? "rgba(255,255,255,.8)"
                : "rgba(105, 97, 130, .32)";

            ctx.fillRect(x, y, 1, 1);
          }
        }
      }

      ctx.restore();

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(raf);

      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="EH-SMOKE-BACKGROUND"
        aria-hidden="true"
      />

      <svg
        className="EH-LIQUID-FILTER"
        width="0"
        height="0"
        aria-hidden="true"
      >
        <defs>
          <filter
            id={filterId}
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency=".008 .014"
              numOctaves="3"
              seed="17"
              result="noise"
            />

            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="17"
              xChannelSelector="R"
              yChannelSelector="B"
            />
          </filter>
        </defs>
      </svg>
    </>
  );
}


function EHNASA3DVideo() {
  return (
    <video
      className="EH-NASA-3D-VIDEO"
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden="true"
      src="/textures/nasa-blackhole-360.webm"
    />
  );
}

function SplashScreen({ onEnter }) {
  const [stage, setStage] = useState(1);
  const [pointer, setPointer] = useState({ x: 50, y: 50, active: false });
  const [idle, setIdle] = useState(false);
  const idleTimer = useRef(null);

  useEffect(() => {
    const resetIdle = () => {
      setIdle(false);
      window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(() => setIdle(true), 4200);
    };

    resetIdle();
    window.addEventListener("pointermove", resetIdle, { passive: true });

    return () => {
      window.clearTimeout(idleTimer.current);
      window.removeEventListener("pointermove", resetIdle);
    };
  }, []);

  useEffect(() => {
    if (stage !== 3) return undefined;

    const timer = window.setTimeout(() => onEnter(), 1400);
    return () => window.clearTimeout(timer);
  }, [stage, onEnter]);

  const move = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();

    setPointer({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
      active: true,
    });
  }, []);

  const advance = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (stage === 1) {
        setStage(2);
        return;
      }

      if (stage === 2) {
        setStage(3);
      }
    },
    [stage],
  );

  const keyboardAdvance = useCallback(
    (e) => {
      if (e.key === "Enter" || e.key === " ") advance(e);
    },
    [advance],
  );

  return (
    <div
      className={`splash-screen stage-${stage}`}
      style={{
        "--pointer-x": `${pointer.x}%`,
        "--pointer-y": `${pointer.y}%`,
        "--splash-title-reveal": pointer.active ? 0.92 : 0.07,
        "--splash-stage-one-image": `url(${SPLASH_STAGE_ONE_IMAGE})`,
        "--splash-stage-two-image": `url(${SPLASH_STAGE_TWO_IMAGE})`,
        "--splash-stage-three-image": `url(${SPLASH_STAGE_THREE_IMAGE})`,
      }}
      onPointerMove={move}
      onPointerLeave={() =>
        setPointer((p) => ({
          ...p,
          active: false,
        }))
      }
      onPointerDown={advance}
      onKeyDown={keyboardAdvance}
      role="button"
      tabIndex={0}
      aria-label={
        stage === 1
          ? "Reveal Event Horizon"
          : stage === 2
            ? "Enter Event Horizon simulation"
            : "Starting Event Horizon simulation"
      }
    >
      {/* EH-SMOKE-BACKGROUND-MOUNT */}
      <EHSmokeBackground />
      <EHNASA3DVideo />
      <div className="EH-NASA-CREDIT" aria-hidden="true">
        NASA / GSFC — Jeremy Schnittman
      </div>


      <div className="splash-blackout" />
      <div className="splash-stars" aria-hidden="true" />

      <div className="splash-nasa" aria-hidden="true" />

      <div className="splash-noise" aria-hidden="true" />
      <div className="splash-glow" aria-hidden="true" />
      <div className="splash-cursor-ring" aria-hidden="true" />

      {stage === 1 && (
        <>
          <div className="splash-blackhole-wrap" aria-hidden="true">
            <img
              className="splash-blackhole-image"
              src="/textures/blackhole.jpeg"
              alt=""
              draggable="false"
            />
            <div className="splash-blackhole-label">
              <span>BLACK HOLE</span>
              <small>EXTREME GRAVITY / SPACETIME</small>
            </div>
          </div>

          <div className="splash-trivia-layer">
            {SPLASH_FACTS.map((fact, index) => (
              <div
                key={`${fact.text}-${index}`}
                className={`splash-trivia splash-trivia-${index + 1}`}
                style={{
                  "--fact-x": fact.x,
                  "--fact-y": fact.y,
                  "--fact-rotate": fact.rotate,
                  "--fact-width": fact.width,
                  "--fact-size": fact.size,
                  "--fact-delay": fact.delay,
                }}
              >
                <span className="splash-trivia-mark">+</span>
                <span>{fact.text}</span>
              </div>
            ))}
          </div>

          <div className="splash-stage-one-label">
            <span>GRAVITY</span>
            <span>LIGHT</span>
            <span>TIME</span>
            <span>01 / EVENT HORIZON</span>
          </div>
        </>
      )}

      <div className="splash-inner">
        <div className="splash-center">
          {stage === 1 ? (
            <>
              <div className="splash-title-wrap">
                <MagneticTitle>EVENT HORIZON</MagneticTitle>
              </div>
              <div className="splash-stage-one-subtitle">
                NOTHING ESCAPES. EVERYTHING LEAVES A TRACE.
              </div>
            </>
          ) : stage === 2 ? (
            <div className="splash-title-wrap">
              <MagneticTitle>EVENT HORIZON</MagneticTitle>
            </div>
          ) : (
            <>
              <div className="splash-title-wrap">
                <MagneticTitle>EVENT HORIZON</MagneticTitle>
              </div>
              <div className="splash-handoff-title">
                ENTERING THE OBSERVATORY...
              </div>
            </>
          )}
        </div>
      </div>

      {stage === 3 && (
        <>
          <div className="splash-stage-three-overlay">
            <span>LOCAL COMPUTE</span>
            <span>N-BODY SIMULATION</span>
            <span>CELESTIAL SANDBOX</span>
          </div>

          <div className="splash-enter-flash" aria-hidden="true" />

          <div className="splash-loading" role="status">
            <span className="splash-loading-dot" />
            BOOTING SIMULATION CORE
          </div>
        </>
      )}
    </div>
  );
}

function SimulationApp() {
  const [engine] = useState(() => {
    const e = new PhysicsEngine();
    e.createScenario();
    return e;
  });
  const [selectedId, setSelectedId] = useState(null),
    [panel, setPanel] = useState(null),
    [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [homeToken, setHomeToken] = useState(0),
    [sceneRevision, setSceneRevision] = useState(0),
    [, refresh] = useState(0);
  const [buildTool, setBuildTool] = useState(null),
    [buildOpen, setBuildOpen] = useState(false),
    [readout, setReadout] = useState({ speed: 0, position: [0, 0, 0] });
  const [log, setLog] = useState([]),
    [toasts, setToasts] = useState([]),
    [effects, setEffects] = useState([]),
    [samples, setSamples] = useState([]),
    [fps, setFps] = useState(0);
  const isGodModeActive = panel === "god";
  const panelRef = useRef(panel);
  panelRef.current = panel;
  const [showSettings, setShowSettings] = useState(false),
    [showObjects, setShowObjects] = useState(true),
    [hint, setHint] = useState(() => {
      try {
        return !localStorage.getItem("eh-onboarded");
      } catch {
        return true;
      }
    });
  const [chapter, setChapter] = useState(0),
    [storyProgress, setStoryProgress] = useState(0),
    [voyagerMode, setVoyagerMode] = useState(false),
    [voyagerProgress, setVoyagerProgress] = useState(0),
    [enduranceVisible, setEnduranceVisible] = useState(true),
    [enduranceFocused, setEnduranceFocused] = useState(false),
    [deepTimeTarget, setDeepTimeTarget] = useState(0),
    [seeking, setSeeking] = useState(false),
    [showShortcuts, setShowShortcuts] = useState(false);
  const storySaved = useRef(null),
    storyRef = useRef({ active: false, chapter: 0, progress: 0 }),
    importRef = useRef(),
    settingsRef = useRef(settings),
    nextId = useRef(0),
    storySeekId = useRef(0),
    storySeekRestore = useRef(null);
  settingsRef.current = settings;
  const selected = engine.getBody(selectedId),
    history = engine.getHistoryInfo();
  const onChange = useCallback(() => {
    if (panelRef.current === "god") setEnduranceVisible(false);
    setSceneRevision((v) => v + 1);
    refresh((v) => v + 1);
  }, []);
  const notify = useCallback((message, kind = "info") => {
    setToasts((old) => [
      ...old.slice(-2),
      { id: ++nextId.current, message, kind, at: Date.now() },
    ]);
  }, []);
  const setSetting = (key, value) =>
    setSettings((old) => ({ ...old, [key]: value }));
  const select = useCallback((id) => {
    setSelectedId(id);
    if (settingsRef.current.sound)
      playTone("selection", settingsRef.current.volume);
  }, []);
  const home = () => {
    setSelectedId(null);
    setEnduranceFocused(false);
    setHomeToken((v) => v + 1);
  };
  const voyagerPoints = [
    [0, 0, 0],
    [5.2, 0, 0.15],
    [9.55, 0, -0.18],
    [165, 0, -1.2],
  ];
  const interpolateVoyager = useCallback((progress) => {
    const clamped = Math.max(0, Math.min(1, progress));
    const scaled = clamped * (voyagerPoints.length - 1);
    const index = Math.min(voyagerPoints.length - 2, Math.floor(scaled));
    const t = scaled - index;
    return voyagerPoints[index].map((v, i) => v + (voyagerPoints[index + 1][i] - v) * t);
  }, []);
  const ensureVoyagerBody = useCallback((progressValue) => {
    let voyager = engine.getBody("voyager-1");
    if (!voyager) {
      voyager = engine.spawnBody("asteroid", {
        id: "voyager-1",
        name: "Voyager 1",
        mass: 1e-10,
        radius: 1e-9,
        collisionMode: "ignore",
        position: interpolateVoyager(progressValue),
        velocity: [0, 0, 0],
        metadata: { visualSize: 0.2, color: "#b8d9d6", voyagerMission: true }
      });
    } else {
      engine.updateBody("voyager-1", { position: interpolateVoyager(progressValue) });
    }
    return voyager;
  }, [engine, interpolateVoyager]);
  const act = useCallback(
    (fn) => {
      try {
        engine.checkpoint();
        const checkpoint = engine.history.at(-1);
        fn();
        // Operations such as branch restoration already record their own result.
        if (engine.history.at(-1) === checkpoint) engine.checkpoint();
        onChange();
        if (settingsRef.current.sound)
          playTone("click", settingsRef.current.volume);
      } catch (error) {
        notify(error.message, "error");
      }
    },
    [engine, notify, onChange],
  );
  const closeStory = useCallback(
    (restore = true) => {
      storySeekId.current++;
      storyRef.current.active = false;
      if (restore && storySaved.current) {
        engine.restoreState(storySaved.current.state);
        engine.history = storySaved.current.history;
        engine.historyIndex = storySaved.current.historyIndex;
        engine.initialState = storySaved.current.initialState;
        engine.emit("historyChanged");
      } else engine.fixedDt = 1 / 32768;
      storySaved.current = null;
      setSeeking(false);
      setSelectedId(null);
      setHomeToken((v) => v + 1);
      onChange();
    },
    [engine, onChange],
  );
  const startChapter = useCallback(
    (index) => {
      storySeekId.current++;
      setSeeking(false);
      index = Math.max(0, Math.min(7, index));
      setChapter(index);
      setStoryProgress(0);
      storyRef.current = { active: true, chapter: index, progress: 0 };
      select(initializeChapter(engine, index));
      setHomeToken((v) => v + 1);
      onChange();
    },
    [engine, select, onChange],
  );
  const openPanel = useCallback(
    (name) => {
      setShowSettings(false);
      setBuildTool(null);
      setBuildOpen(false);
      if (name !== "story" && storyRef.current.active) closeStory();
      setPanel(name);
      if (name === "god") engine.pause();
      if (name === "story" && !storyRef.current.active) {
        storySaved.current = {
          state: engine.saveState(),
          history: engine.history.slice(),
          historyIndex: engine.historyIndex,
          initialState: engine.initialState,
        };
        startChapter(0);
      }
      onChange();
    },
    [engine, closeStory, startChapter, onChange],
  );
  const beginBuild = (type) => {
    if (storyRef.current.active) closeStory();
    engine.pause();
    setBuildTool(type);
    setBuildOpen(true);
    setPanel(null);
    setSelectedId(null);
    setHomeToken((v) => v + 1);
    notify(`Drag in space to launch a ${type}. Escape cancels.`);
  };
  const place = useCallback(
    (type, position, velocity) => {
      act(() => {
        const body = engine.spawnBody(type, { position, velocity });
        setSelectedId(body.id);
        notify(`${body.name} created · resume to launch`);
      });
      setBuildTool(null);
      setBuildOpen(false);
    },
    [act, engine, notify],
  );

  useEffect(() => {
    const root = document.querySelector(".app");
    if (!root) return;

    let frame = 0;
    const reset = () => {
      root.style.setProperty("--parallax-x", "0px");
      root.style.setProperty("--parallax-y", "0px");
    };
    const move = (event) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const nx = event.clientX / Math.max(window.innerWidth, 1) - 0.5;
        const ny = event.clientY / Math.max(window.innerHeight, 1) - 0.5;
        root.style.setProperty("--parallax-x", `${(-nx * 3.5).toFixed(2)}px`);
        root.style.setProperty("--parallax-y", `${(-ny * 2.5).toFixed(2)}px`);
      });
    };

    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("blur", reset);
    window.addEventListener("pointerleave", reset, { passive: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("blur", reset);
      window.removeEventListener("pointerleave", reset);
      if (frame) cancelAnimationFrame(frame);
      reset();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = engine.on("*", (event) => {
      if (event.type === "numericalWarning")
        notify(`${event.body.name}: ${event.message}`, "error");
      if (
        ["bodyAdded", "bodyRemoved", "simulationReset", "bodyUpdated"].includes(
          event.type,
        )
      )
        setSceneRevision((v) => v + 1);
      if (event.type === "simulationReset") {
        setEffects([]);
        setEnduranceVisible(true);
        setEnduranceFocused(false);
      }
      if (isGodModeActive && ["bodyUpdated","bodyAdded","bodyRemoved","bodyMerged","supernova","planetaryNebula","deepTime"].includes(event.type))
        setEnduranceVisible(false);
      const label = eventLabels[event.type];
      if (label) {
        const message = `${label}${event.star?.name || event.body?.name || event.name ? ` · ${event.star?.name || event.body?.name || event.name}` : ""}`;
        setLog((old) =>
          [
            {
              id: ++nextId.current,
              message,
              time: event.time,
              type: event.type,
            },
            ...old,
          ].slice(0, 50),
        );
        if (
          [
            "solarFlare",
            "supernova",
            "tidalDisruption",
            "wormholeTransit",
            "eventHorizonCrossed",
            "branchRestored",
          ].includes(event.type)
        )
          notify(message);
        if (
          settingsRef.current.sound &&
          ["collision", "solarFlare", "supernova"].includes(event.type)
        )
          playTone(event.type, settingsRef.current.volume);
      }
      if (
        ["solarFlare", "supernova", "impactWave", "tidalDisruption"].includes(
          event.type,
        )
      )
        setEffects((old) => [
          ...old.slice(-15),
          {
            id: ++nextId.current,
            type: event.type,
            bodyId: event.star?.id,
            position: event.position?.clone() || new Vector3(),
            radius: event.star ? visualRadius(event.star) : 0.15,
            rotation: event.flare?.direction?.map((n) => n * Math.PI * 2),
            at: Date.now(),
          },
        ]);
    });
    const timer = setInterval(() => {
      refresh((v) => v + 1);
      setEffects((old) =>
        old.some((e) => Date.now() - e.at > 7500)
          ? old.filter((e) => Date.now() - e.at < 7500)
          : old,
      );
      setToasts((old) =>
        old.some((t) => Date.now() - t.at > 5000)
          ? old.filter((t) => Date.now() - t.at < 5000)
          : old,
      );
      if (!engine.paused)
        setSamples((old) => [
          ...old.slice(-119),
          engine.getSystemDiagnostics(),
        ]);
    }, 250);
    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, [engine, notify]);
  useEffect(() => {
    if (selectedId && !engine.getBody(selectedId)) {
      setSelectedId(null);
      setHomeToken((v) => v + 1);
    }
  }, [sceneRevision, selectedId, engine]);
  useEffect(() => {
    const timer = setInterval(() => {
      const story = storyRef.current;
      if (!story.active || engine.paused || seeking) return;
      story.progress += 0.1 / CHAPTERS[story.chapter].duration;
      setStoryProgress(Math.min(1, story.progress));
      if (story.progress >= 1) {
        if (story.chapter < 7) startChapter(story.chapter + 1);
        else engine.pause();
      }
    }, 100);
    return () => clearInterval(timer);
  }, [engine, seeking, startChapter]);
  const exportState = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(engine.saveState(), null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `event-horizon-${engine.time.toFixed(3)}yr.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("Universe exported");
  };
  const importState = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 5e6) throw new Error("Choose a save smaller than 5 MB.");
      const data = JSON.parse(await file.text());
      engine.restoreState(data);
      engine.checkpoint();
      home();
      onChange();
      notify("Universe restored");
    } catch (error) {
      notify(error.message, "error");
    }
    e.target.value = "";
  };
  const cancelStorySeek = useCallback(() => {
    if (!seeking) return;
    storySeekId.current++;
    const restore = storySeekRestore.current;
    storySeekRestore.current = null;
    if (restore) {
      try {
        engine.restoreState(restore.state, { preservePlayback: false });
        storyRef.current.progress = restore.progress;
        setStoryProgress(restore.progress);
      } catch (error) {
        notify(`Could not cancel timeline reconstruction: ${error.message}`, "error");
      }
    }
    setSeeking(false);
    onChange();
  }, [engine, notify, onChange, seeking]);

  const seekHistoryBy = useCallback((delta) => {
    if (seeking) return;
    engine.pause();
    engine.seekHistory(engine.historyIndex + delta);
    onChange();
  }, [engine, onChange, seeking]);

  const seekStory = async (value) => {
    const token = ++storySeekId.current,
      index = chapter,
      wasPaused = engine.paused;
    storySeekRestore.current = {
      state: engine.saveState(),
      progress: storyRef.current.progress,
    };
    setStoryProgress(value);
    setSeeking(true);
    engine.pause();
    select(initializeChapter(engine, index));
    engine.pause();
    onChange();
    const duration =
        value * CHAPTERS[index].duration * Math.abs(engine.timeScale),
      steps = Math.round(duration / engine.fixedDt);
    for (let n = 0; n < steps; n += 250) {
      if (storySeekId.current !== token || !storyRef.current.active) return;
      for (let j = n; j < Math.min(n + 250, steps); j++)
        engine.step(undefined, { record: false });
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    if (storySeekId.current !== token) return;
    storySeekRestore.current = null;
    storyRef.current.progress = value;
    setStoryProgress(value);
    setSeeking(false);
    engine.recordHistory();
    if (!wasPaused) engine.resume();
    onChange();
  };

  useEffect(() => {
    const key = (e) => {
      if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        setShowShortcuts((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        if (seeking) {
          cancelStorySeek();
          return;
        }
        setBuildTool(null);
        setBuildOpen(false);
        setShowSettings(false);
        setShowShortcuts(false);
        return;
      }
      if (seeking) return;
      if (e.code === "Space") {
        e.preventDefault();
        engine.paused ? engine.resume() : engine.pause();
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (storyRef.current.active) seekStory(Math.max(0, storyRef.current.progress - 0.02));
        else seekHistoryBy(-1);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (storyRef.current.active) seekStory(Math.min(1, storyRef.current.progress + 0.02));
        else seekHistoryBy(1);
      }
      if (e.key.toLowerCase() === "h") {
        setSelectedId(null);
        setHomeToken((v) => v + 1);
      }
      onChange();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [cancelStorySeek, engine, onChange, seeking, seekHistoryBy]);

  const deepTimeProgress = Math.max(0, Math.min(1, deepTimeTarget / 5e9));
  const activeEffect = effects.at(-1);
  const speedBand =
    engine.timeScale < 0
      ? "rewind"
      : engine.timeScale >= 4000
        ? "ultra"
        : engine.timeScale >= 40
          ? "high"
          : engine.timeScale >= 4
            ? "fast"
            : "normal";
  const accent = selected?.metadata?.color || "#9acbc9";

  return (
    <main
      className={`app ${panel || selected ? "has-panel" : ""} ${selected ? "selected-focus" : ""} ${panel === "story" ? "story-mode" : ""} ${buildOpen ? "building" : ""}`}
      data-effect={activeEffect?.type || "none"}
      data-effect-id={activeEffect?.id || "none"}
      data-speed-band={speedBand}
      data-quality={settings.quality}
      data-body-type={selected?.type || "none"}
      style={{ "--accent": accent }}
    >
      {activeEffect && (
        <div
          className={`cinematic-vfx cinematic-${activeEffect.type}`}
          key={activeEffect.id}
          aria-hidden="true"
        >
          <span className="cinematic-shockwave" />
          <span className="cinematic-chromatic cinematic-chromatic-a" />
          <span className="cinematic-chromatic cinematic-chromatic-b" />
        </div>
      )}
      {speedBand !== "normal" && speedBand !== "rewind" && (
        <div className="speed-lines" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      )}
      <RenderBoundary>
        <Universe
          engine={engine}
          selectedId={selectedId}
          onSelect={select}
          settings={settings}
          homeToken={homeToken}
          buildTool={buildTool}
          onPlace={place}
          onReadout={setReadout}
          sceneRevision={sceneRevision}
          effects={effects}
          onFrame={setFps}
          panelOpen={
            !!(
              (panel && panel !== "story") ||
              (selected && panel !== "story" && !buildOpen)
            )
          }
          storyMode={panel === "story"}
          enduranceVisible={enduranceVisible}
          enduranceFocused={enduranceFocused}
          onEnduranceFocus={() => setEnduranceFocused(true)}
          voyagerActive={voyagerMode}
          voyagerProgress={voyagerProgress}
        />
      </RenderBoundary>
      <div className="vignette" />
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            home();
          }}
        >
          <span className="brand-symbol">
            <Icon name="orbit" size={32} />
          </span>
          <span>
            EVENT HORIZON<small>UNIVERSE LABORATORY</small>
          </span>
        </a>
        <div className="top-status">
          <i className={engine.paused ? "paused" : ""} />
          <span>{engine.paused ? "SIMULATION PAUSED" : "SYSTEM ONLINE"}</span>
          <b>LOCAL SESSION</b>
        </div>
        <div className="top-actions">
          <span className="fps">
            {fps || "—"} <small>FPS</small>
          </span>
          <button
            className={`icon-button ${settings.sound ? "active" : ""}`}
            title={settings.sound ? "Mute sound" : "Enable sound"}
            aria-label={settings.sound ? "Mute sound" : "Enable sound"}
            onClick={() => {
              setSetting("sound", !settings.sound);
              if (!settings.sound) playTone("click", settings.volume);
            }}
          >
            <Icon name={settings.sound ? "sound" : "mute"} />
          </button>
          <button
            className={`icon-button ${showSettings ? "active" : ""}`}
            title="View settings"
            aria-label="View settings"
            onClick={() => setShowSettings((v) => !v)}
          >
            <Icon name="settings" />
          </button>
        </div>
      </header>
      {!selected && !storyRef.current.active && !voyagerMode && (
        <div
          className="solar-system-reference"
          aria-hidden="true"
          style={{
            backgroundImage: "url(/textures/solarsystem.avif)",
          }}
        />
      )}
      {enduranceFocused && enduranceVisible && (
        <aside className="endurance-card">
          <button className="icon-button endurance-close" aria-label="Close Endurance card" onClick={() => setEnduranceFocused(false)}>×</button>
          <div className="eyebrow">INTERSTELLAR EASTER EGG</div>
          <h3>ENDURANCE</h3>
          <p>Deep-space rotating habitat concept from <em>Interstellar</em>, presented here as a lightweight sandbox easter egg.</p>
          <div className="tars-preview" aria-label="Animated TARS preview">
            <div className="tars-css">
              <i></i><b></b><span></span>
            </div>
          </div>
          <p className="fine-print">TARS preview · CSS animation · low overhead</p>
        </aside>
      )}
      {voyagerMode && <div className="voyager-hud">
        <div className="eyebrow">VOYAGER 1 · MISSION HUD</div>
        <div className="mission-title">{voyagerStory["voyager-1-journey"].waypoints[voyagerWaypointIndex(voyagerStory["voyager-1-journey"].waypoints, 1977 + (2012 - 1977) * voyagerProgress)].label}</div>
        <div className="hud-grid">
          <div><strong>{(1977 + (2012 - 1977) * voyagerProgress).toFixed(0)}</strong><span>MISSION YEAR</span></div>
          <div><strong>17.0</strong><span>KM/S</span></div>
          <div><strong>{(165 * voyagerProgress).toFixed(1)}</strong><span>AU FROM EARTH</span></div>
        </div>
      </div>}
      {deepTimeTarget > 0 && <div className="voyager-hud" style={{left:24,bottom:190}}>
        <div className="eyebrow">DEEP TIME</div>
        <div className="mission-title">{(deepTimeTarget / 1e9).toFixed(2)} BILLION YEARS</div>
        <div className="hud-grid"><div><strong>{deepTimeProgress >= 0.76 ? "RGB" : "MAIN"}</strong><span>STELLAR PHASE</span></div><div><strong>200</strong><span>R☉ MAX</span></div><div><strong>3000</strong><span>K TARGET</span></div></div>
      </div>}
            <div className="observation">
        <span className="eyebrow">
          OBSERVATORY / {storyRef.current.active ? "ORIGINS" : "SOL SYSTEM"}
        </span>
        <h1>
          {storyRef.current.active
            ? "A cosmic story."
            : selected
              ? selected.name
              : "Our solar system."}
        </h1>
        <p>
          {storyRef.current.active
            ? "From the first light to your next experiment."
            : selected
              ? "A closer look at our celestial neighborhood."
              : "One star. Eight planets. Infinite possibilities."}
        </p>
      </div>
      <nav className="object-browser" aria-label="Celestial bodies">
        <button
          className="browser-heading"
          onClick={() => setShowObjects((v) => !v)}
        >
          <span>EXPLORER</span>
          <span>
            {engine.bodies.length.toString().padStart(2, "0")}{" "}
            <Icon name={showObjects ? "back" : "chevron"} size={12} />
          </span>
        </button>
        {showObjects && (
          <div className="object-list">
            {engine.bodies
              .filter((b) => b.type !== "debris")
              .slice(0, 50)
              .map((b) => (
                <button
                  className={selectedId === b.id ? "active" : ""}
                  key={b.id}
                  onClick={() => select(b.id)}
                >
                  <i
                    style={{
                      "--planet-color": b.metadata.color || "#97b5c1",
                      backgroundImage: b.metadata.texture
                        ? `url(/textures/${b.metadata.texture}.jpg)`
                        : undefined,
                    }}
                  />
                  <span>{b.name}</span>
                  {selectedId === b.id ? (
                    <Icon name="chevron" size={11} />
                  ) : (
                    <small>
                      {b.type === "star"
                        ? "STAR"
                        : b.type === "moon"
                          ? "MOON"
                          : ""}
                    </small>
                  )}
                </button>
              ))}
          </div>
        )}
      </nav>
      <div className="view-tools">
        <button className="button" onClick={home}>
          <Icon name="home" size={15} />
          System view <kbd>H</kbd>
        </button>
        <button
          className={`button ${settings.orbits ? "active" : ""}`}
          onClick={() => setSetting("orbits", !settings.orbits)}
        >
          <Icon name="orbit" size={15} />
          Orbits
        </button>
        <button
          className={`button ${buildOpen ? "active" : ""}`}
          onClick={() => {
            if (storyRef.current.active) closeStory();
            setBuildOpen((v) => !v);
            setBuildTool(null);
            engine.pause();
            setPanel(null);
          }}
        >
          <Icon name="plus" size={15} />
          Build
        </button>
      </div>
      <nav className="command-rail" aria-label="Advanced commands">
        {[
          ["god", "god", "God Mode"],
          ["story", "story", "Story"],
          ["whatif", "branch", "What if"],
          ["physics", "physics", "Physics"],
          ["voyager", "story", "Voyager"],
        ].map(([key, icon, label]) => (
          <button
            className={panel === key ? "active" : ""}
            key={key}
            onClick={() => {
              if (panel === key) {
                if (key === "story") closeStory();
                setPanel(null);
              } else openPanel(key);
            }}
            title={label}
          >
            <Icon name={icon} size={19} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="panel-slot">
        {panel === "god" && (
          <GodPanel
            engine={engine}
            selected={selected}
            onClose={() => setPanel(null)}
            onBuild={beginBuild}
            onChange={onChange}
            act={act}
            notify={notify}
            onSelect={select}
          />
        )}
        {panel === "voyager" && (
          <VoyagerPanel
            story={voyagerStory["voyager-1-journey"]}
            engine={engine}
            progress={voyagerProgress}
            setProgress={setVoyagerProgress}
            active={voyagerMode}
            setActive={setVoyagerMode}
            onSelect={select}
            deepTimeTarget={deepTimeTarget}
            setDeepTimeTarget={setDeepTimeTarget}
            act={act}
            ensureVoyagerBody={ensureVoyagerBody}
          />
        )}
                {panel === "physics" && (
          <PhysicsPanel
            engine={engine}
            samples={samples}
            settings={settings}
            setSetting={setSetting}
            onChange={onChange}
            onClose={() => setPanel(null)}
          />
        )}
        {panel === "whatif" && (
          <BranchPanel
            engine={engine}
            onClose={() => setPanel(null)}
            act={act}
            notify={notify}
            onExport={exportState}
            onImport={() => importRef.current?.click()}
          />
        )}
        {!panel && selected && !buildOpen && (
          <PlanetInfo
            body={selected}
            engine={engine}
            onClose={() => select(null)}
            onEdit={() => openPanel("god")}
          />
        )}
      </div>
      {showSettings && (
        <aside className="panel settings-panel">
          <PanelHeading
            eyebrow="OBSERVATORY PREFERENCES"
            title="View settings"
            icon="settings"
            onClose={() => setShowSettings(false)}
          />
          {[
            [
              "compressed",
              "Atlas distance scale",
              "Logarithmic distances · Moon separation enlarged",
            ],
            ["orbits", "Orbital guides"],
            ["labels", "Object labels"],
            ["habitable", "Habitable zones"],
            ["sound", "Sound effects"],
          ].map(([key, label, detail]) => (
            <Toggle
              key={key}
              label={label}
              detail={detail}
              checked={settings[key]}
              onChange={(value) => setSetting(key, value)}
            />
          ))}
          <label className="range-label">
            Volume<output>{Math.round(settings.volume * 100)}%</output>
            <input
              aria-label="Volume"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.volume}
              onChange={(e) => setSetting("volume", +e.target.value)}
            />
          </label>
          <label className="field-label">
            RENDER QUALITY
            <select
              value={settings.quality}
              onChange={(e) => setSetting("quality", e.target.value)}
            >
              <option value="low">Low · efficient</option>
              <option value="medium">Medium · balanced</option>
              <option value="high">High · detailed</option>
            </select>
          </label>
          <div className="panel-section">
            <h3>Reading this universe</h3>
            <p className="fine-print">
              Body sizes are exaggerated in every view. Atlas mode also
              compresses interplanetary distances and enlarges Moon separation.
              Disable it for linear AU positions. Rotation is visually
              accelerated. Orbit guides are instantaneous Kepler estimates.
            </p>
            <p className="fine-print">
              Textures:{" "}
              <a
                href="https://www.solarsystemscope.com/textures/"
                target="_blank"
                rel="noreferrer"
              >
                Solar System Scope
              </a>{" "}
              · CC BY 4.0. All assets load locally.
            </p>
          </div>
        </aside>
      )}
      {buildOpen && (
        <section className="build-toolbar">
          <span className="eyebrow">CREATE & LAUNCH</span>
          <div>
            {["asteroid", "planet", "star", "black hole"].map((type) => (
              <button
                key={type}
                className={buildTool === type ? "active" : ""}
                onClick={() => beginBuild(type)}
              >
                <i className={`body-dot ${type.replaceAll(" ", "-")}`} />
                {type}
              </button>
            ))}
            <button
              className="icon-button"
              aria-label="Cancel build"
              onClick={() => {
                setBuildTool(null);
                setBuildOpen(false);
              }}
            >
              <Icon name="close" />
            </button>
          </div>
          {buildTool ? (
            <p>
              Drag on the orbital plane to set velocity{" "}
              <strong>
                {fmt(auPerYearToMS(readout.speed) / 1000, 1)} km/s
              </strong>
              <small>
                Frozen-field preview · release to place · Esc to cancel
              </small>
            </p>
          ) : (
            <p>Choose a body to begin your experiment.</p>
          )}
        </section>
      )}
      <div className="bottom-left">
        {selected && !panel && (
          <Minimap engine={engine} selectedId={selectedId} onSelect={select} />
        )}
        {hint && !panel && !selected && (
          <div className="onboarding">
            <button
              title="Dismiss hints"
              aria-label="Dismiss hints"
              onClick={() => {
                setHint(false);
                try {
                  localStorage.setItem("eh-onboarded", "1");
                } catch {}
              }}
            >
              <Icon name="close" size={12} />
            </button>
            <span className="eyebrow">A UNIVERSE TO EXPLORE</span>
            <p>Click a planet to get closer.</p>
            <small>Drag to orbit · Scroll to zoom · Right-drag to pan</small>
          </div>
        )}
        <div className="event-log">
          <div className="eyebrow">
            <i />
            EVENT FEED <span>{log.length.toString().padStart(2, "0")}</span>
          </div>
          {log.length ? (
            log.slice(0, 5).map((item) => (
              <div className="log-item" key={item.id}>
                <time>+{(item.time * 365.25).toFixed(1)}d</time>
                <span>{item.message}</span>
              </div>
            ))
          ) : (
            <p>
              All systems nominal.
              <br />
              <span>Listening for changes in the universe.</span>
            </p>
          )}
        </div>
      </div>
      {showShortcuts && (
        <aside className="shortcuts-overlay" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
          <div className="panel shortcuts-panel">
            <PanelHeading eyebrow="CONTROL SCHEMA" title="Keyboard shortcuts" icon="info" onClose={() => setShowShortcuts(false)} />
            <dl className="data-rows">
              <Metric label="SPACE" value="Play / pause simulation" />
              <Metric label="ARROW LEFT" value="Previous history snapshot / story seek" />
              <Metric label="ARROW RIGHT" value="Next history snapshot / story seek" />
              <Metric label="H" value="Return to system view" />
              <Metric label="ESC" value="Close panel / cancel reconstruction" />
              <Metric label="?" value="Toggle this help" />
            </dl>
          </div>
        </aside>
      )}
      <div className="toasts" aria-live="polite">
        {toasts.map((toast) => (
          <div className={`toast ${toast.kind}`} key={toast.id}>
            <Icon name={toast.kind === "error" ? "info" : "orbit"} size={16} />
            {toast.message}
          </div>
        ))}
      </div>
      {panel === "story" && storyRef.current.active ? (
        <section className="story-overlay" aria-busy={seeking}>
          <div className="story-caption">
            <span className="eyebrow">{CHAPTERS[chapter].era}</span>
            <h2>{CHAPTERS[chapter].title}</h2>
            <p>{CHAPTERS[chapter].caption}</p>
          </div>
          <div className="chapter-timeline">
            {CHAPTERS.map((c, i) => (
              <button
                key={c.era}
                className={
                  chapter === i ? "active" : chapter > i ? "complete" : ""
                }
                title={c.title}
                disabled={seeking}
                onClick={() => startChapter(i)}
              >
                <span>{String(i + 1).padStart(2, "0")}</span>
                <i />
              </button>
            ))}
          </div>
          <input
            aria-label="Story progress"
            type="range"
            min="0"
            max="1"
            step="0.02"
            disabled={seeking}
            value={storyProgress}
            onChange={(e) => seekStory(+e.target.value)}
          />
          <div className="story-actions">
            <button
              className="button"
              disabled={chapter === 0 || seeking}
              onClick={() => startChapter(chapter - 1)}
            >
              <Icon name="back" />
              Previous
            </button>
            <button
              className="button primary"
              disabled={seeking}
              onClick={() => {
                engine.paused ? engine.resume() : engine.pause();
                onChange();
              }}
            >
              <Icon name={engine.paused ? "play" : "pause"} />
              {seeking
                ? "Reconstructing…"
                : engine.paused
                  ? "Play story"
                  : "Pause story"}
            </button>
            <button
              className="button"
              disabled={seeking}
              onClick={() => {
                if (chapter === 7) {
                  closeStory(false);
                  openPanel("god");
                } else startChapter(chapter + 1);
              }}
            >
              {chapter === 7 ? "Enter sandbox" : "Next chapter"}
              <Icon name="chevron" />
            </button>
            <button
              className="text-button"
              disabled={seeking}
              onClick={() => {
                closeStory();
                setPanel(null);
              }}
            >
              Exit story
            </button>
          </div>
        </section>
      ) : (
        <section className="time-console">
          <div className="time-top">
            <span className="eyebrow">SIMULATION TIME</span>
            <strong>
              +{fmt(engine.time * 365.25, 2)} <small>EARTH DAYS</small>
            </strong>
            <span className="integrator">
              <i />
              N-BODY
            </span>
          </div>
          <div className="time-controls">
            <button
              className="icon-button"
              title="Rewind one snapshot"
              aria-label="Rewind one snapshot"
              disabled={history.index <= 0}
              onClick={() => {
                engine.pause();
                engine.undo();
                onChange();
              }}
            >
              <Icon name="back" />
            </button>
            <button
              className="play-button"
              title="Play or pause (Space)"
              aria-label={
                engine.paused ? "Resume simulation" : "Pause simulation"
              }
              onClick={() => {
                engine.paused ? engine.resume() : engine.pause();
                onChange();
              }}
            >
              <Icon name={engine.paused ? "play" : "pause"} size={19} />
            </button>
            <button
              className="icon-button"
              title="Forward one snapshot"
              aria-label="Forward one snapshot"
              disabled={history.index >= history.length - 1}
              onClick={() => {
                engine.pause();
                engine.redo();
                onChange();
              }}
            >
              <Icon name="chevron" />
            </button>
            <span className="control-divider" />
            {[
              [0.004, "0.1×"],
              [0.04, "1×"],
              [0.1, "2.5×"],
              [0.25, "6.25×"],
            ].map(([value, label]) => (
              <button
                className={`speed-button ${engine.timeScale === value ? "active" : ""}`}
                key={value}
                onClick={() => {
                  engine.setTimeScale(value);
                  onChange();
                }}
              >
                {label}
              </button>
            ))}
            <select
              className="speed-select"
              aria-label="Additional time speeds"
              value={
                [0.004, 0.04, 0.1, 0.25].includes(engine.timeScale)
                  ? "more"
                  : String(engine.timeScale)
              }
              onChange={(e) => {
                if (e.target.value !== "more")
                  engine.setTimeScale(+e.target.value);
                onChange();
              }}
            >
              <option value="more">More</option>
              <option value="0.00000003168808781402895">Real time</option>
              <option value="0.4">10×</option>
              <option value="4">100×</option>
              <option value="40">1,000×</option>
              <option value="4000">100,000× · budgeted</option>
              <option value="-0.04">Rewind history</option>
            </select>
            <button
              className="icon-button reset"
              title="Reset Solar System"
              aria-label="Reset Solar System"
              onClick={() => {
                engine.createScenario();
                engine.fixedDt = 1 / 32768;
                home();
                setEffects([]);
                setSamples([]);
                setLog([]);
                onChange();
                notify("Solar System restored");
              }}
            >
              <Icon name="undo" size={16} />
            </button>
          </div>
          <div className="history-track">
            <input
              aria-label="Simulation history"
              type="range"
              min="0"
              max={Math.max(1, history.length - 1)}
              value={Math.max(0, history.index)}
              disabled={history.length < 2}
              onChange={(e) => {
                engine.pause();
                engine.seekHistory(+e.target.value);
                onChange();
              }}
            />
            <span>
              {engine.timeScale < 0
                ? "SNAPSHOT REPLAY"
                : `${fmt(engine.timeScale * 365.25, 2)} DAYS / SECOND`}
            </span>
          </div>
        </section>
      )}
      <footer className="footer">
        <span>
          <i />
          {engine.bodies.length} BODIES TRACKED
        </span>
        <span>
          {settings.compressed ? "ATLAS DISTANCES" : "LINEAR AU DISTANCES"}{" "}
          <b>·</b> BODY SIZES EXAGGERATED
        </span>
        <span>
          LOCAL COMPUTE <b>·</b> v1.0
        </span>
      </footer>
      <input
        className="hidden"
        type="file"
        accept=".json,application/json"
        ref={importRef}
        onChange={importState}
      />
    </main>
  );
}


export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [boot, setBoot] = useState({ status: "loading", progress: 0, current: "VERIFYING LOCAL ASSETS…", error: null });
  const [bootAttempt, setBootAttempt] = useState(0);
  const finishSplash = useCallback(() => setShowSplash(false), []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setBoot({ status: "loading", progress: 0, current: "VERIFYING LOCAL ASSETS…", error: null });
      for (let i = 0; i < CRITICAL_BOOT_ASSETS.length; i++) {
        const asset = CRITICAL_BOOT_ASSETS[i];
        if (cancelled) return;
        setBoot((old) => ({
          ...old,
          current: `${asset.label} · ${asset.url}`,
        }));
        try {
          await preloadCriticalAsset(asset);
        } catch (error) {
          if (!cancelled)
            setBoot({
              status: "error",
              progress: (i / CRITICAL_BOOT_ASSETS.length) * 100,
              current: asset.label,
              error: error.message,
            });
          return;
        }
        if (!cancelled)
          setBoot((old) => ({
            ...old,
            progress: ((i + 1) / CRITICAL_BOOT_ASSETS.length) * 100,
          }));
      }
      if (!cancelled)
        setBoot({ status: "ready", progress: 100, current: "ALL CRITICAL ASSETS VERIFIED", error: null });
    };
    run();
    return () => { cancelled = true; };
  }, [bootAttempt]);

  if (boot.status !== "ready")
    return (
      <BootScreen
        progress={boot.progress}
        current={boot.current}
        error={boot.error}
        onRetry={() => setBootAttempt((v) => v + 1)}
      />
    );
  return showSplash ? <SplashScreen onEnter={finishSplash} /> : <SimulationApp />;
}
