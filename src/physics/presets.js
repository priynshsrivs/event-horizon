import {
  AU_M,
  SOLAR_MASS_KG,
  SOLAR_RADIUS_M,
  EARTH_RADIUS_M,
  C_M_PER_S,
  G_SI,
  kelvinToRGB,
} from "./constants.js";

export { kelvinToRGB };

export const BODY_PRESETS = {
  asteroid: {
    mass: 2e-14,
    radius: 1e-7,
    temperature: 190,
    metadata: { color: "#938e85", visualSize: 0.035 },
    composition: ["Silicate", "Iron", "Nickel"],
  },
  planet: {
    mass: 3.003e-6,
    radius: EARTH_RADIUS_M / AU_M,
    temperature: 288,
    metadata: { color: "#70b3c7", visualSize: 0.085 },
  },
  "rogue planet": {
    mass: 9.54e-4,
    radius: 0.00047,
    temperature: 70,
    metadata: { color: "#6d87bb", visualSize: 0.14 },
  },
  comet: {
    mass: 3e-17,
    radius: 2e-8,
    temperature: 80,
    composition: ["Water ice", "Silicate", "Carbon dioxide"],
    metadata: { color: "#b2ebef", visualSize: 0.035 },
  },
  star: {
    mass: 1,
    radius: SOLAR_RADIUS_M / AU_M,
    luminosity: 1,
    temperature: 5772,
    composition: ["Hydrogen", "Helium"],
    metadata: { color: "#ffc77a", visualSize: 0.2, solarActivity: 1, texture: "sun" },
  },
  "red giant": {
    mass: 2,
    radius: 0.2,
    luminosity: 150,
    temperature: 3500,
    composition: ["Hydrogen", "Helium"],
    metadata: { color: "#ff6a3d", visualSize: 0.45, texture: "sun" },
  },
  "red supergiant": {
    mass: 15,
    radius: 3,
    luminosity: 60000,
    temperature: 3600,
    composition: ["Hydrogen", "Helium"],
    metadata: { color: "#fa462a", visualSize: 3.1, texture: "sun" },
  },
  supergiant: {
    mass: 15,
    radius: 3,
    luminosity: 60000,
    temperature: 3600,
    composition: ["Hydrogen", "Helium"],
    metadata: { color: "#fa462a", visualSize: 3.1, texture: "sun" },
  },
  "white dwarf": {
    mass: 0.6,
    radius: 0.00005,
    luminosity: 0.01,
    temperature: 17000,
    composition: ["Carbon", "Oxygen"],
    metadata: { color: "#d9edff", visualSize: 0.07, texture: "sun" },
  },
  "brown dwarf": {
    mass: 0.04,
    radius: 0.00047,
    luminosity: 0.0001,
    temperature: 1400,
    composition: ["Hydrogen", "Helium"],
    metadata: { color: "#a36043", visualSize: 0.12, texture: "sun" },
  },
  "neutron star": {
    mass: 1.4,
    radius: 12000 / AU_M,
    luminosity: 0.001,
    temperature: 600000,
    composition: ["Neutron-rich matter"],
    metadata: { color: "#abe6ff", visualSize: 0.065 },
  },
  magnetar: {
    mass: 1.7,
    radius: 12000 / AU_M,
    luminosity: 0.01,
    temperature: 1e6,
    composition: ["Neutron-rich matter"],
    metadata: {
      color: "#c6b0ff",
      visualSize: 0.07,
      magneticFieldStrength: 1e10,
    },
  },
  "black hole": {
    mass: 5,
    radius: (2 * G_SI * 5 * SOLAR_MASS_KG) / C_M_PER_S ** 2 / AU_M,
    temperature: 0,
    composition: ["Compact gravitational source"],
    metadata: { color: "#e8a874", visualSize: 0.17, kerrSpin: 0.6 },
  },
  wormhole: {
    mass: 1e-15,
    radius: 0.15,
    collisionMode: "ignore",
    metadata: { color: "#ad9fff", visualSize: 0.17 },
  },
  "dark matter halo": {
    mass: 3,
    radius: 5,
    collisionMode: "ignore",
    temperature: 0,
    composition: ["Hypothetical dark matter"],
    metadata: { color: "#8a7fcc", visualSize: 3, softening: 3 },
  },
};

export const STARS = new Set([
  "star",
  "red giant",
  "red supergiant",
  "supergiant",
  "white dwarf",
  "brown dwarf",
  "neutron star",
  "magnetar",
]);

export const isStar = (body) => (body && body.type ? STARS.has(body.type) : false);
