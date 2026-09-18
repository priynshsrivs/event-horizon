import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("splash screen files and landing page assets are present", () => {
  const jsxPath = path.resolve("src/SplashScreen.jsx");
  const cssPath = path.resolve("src/SplashScreen.css");
  assert.ok(fs.existsSync(jsxPath), "SplashScreen.jsx should exist");
  assert.ok(fs.existsSync(cssPath), "SplashScreen.css should exist");

  const jsx = fs.readFileSync(jsxPath, "utf-8");
  assert.ok(jsx.includes("SAGITTARIUS A*"), "Should include Kerr black hole centerpiece");
  assert.ok(jsx.includes("TRIVIA_FACTS"), "Should include astrophysics trivia");
  assert.ok(jsx.includes("ENTER OBSERVATORY"), "Should include Enter Observatory CTA");
  assert.ok(jsx.includes("splash-stage-one-subtitle"), "Should include interactive subtitle");

  const css = fs.readFileSync(cssPath, "utf-8");
  assert.ok(css.includes(".splash-screen"), "Should define .splash-screen");
  assert.ok(css.includes(".splash-blackhole-wrap"), "Should define black hole styling");
  assert.ok(css.includes(".splash-trivia"), "Should define trivia styles");
  assert.ok(css.includes(".splash-enter-flash"), "Should define enter flash");

  // Ensure SplashScreen.css does NOT alter .time-console
  assert.equal(css.includes("time-console"), false, "SplashScreen.css must not contaminate time-console");
});

test("time-console adjusting bar remains anchored at bottom of screen in App.css", () => {
  const appCssPath = path.resolve("src/App.css");
  const appCss = fs.readFileSync(appCssPath, "utf-8");

  // Check default position of time-console
  const match = appCss.match(/\.time-console\s*\{([^}]+)\}/);
  assert.ok(match, ".time-console rule must exist in App.css");
  const body = match[1];
  assert.ok(body.includes("position: absolute;"), "time-console must be positioned absolute");
  assert.ok(body.includes("bottom: 66px;"), "time-console must be at bottom: 66px");
  assert.ok(!body.includes("top:"), "time-console must not be anchored to top");
});

test("splash textures exist and are non-empty", () => {
  const img2 = path.resolve("public/textures/splash/images-2.jpeg");
  const img4 = path.resolve("public/textures/splash/images-4.jpeg");
  assert.ok(fs.existsSync(img2), "images-2.jpeg should exist");
  assert.ok(fs.existsSync(img4), "images-4.jpeg should exist");
  assert.ok(fs.statSync(img2).size > 1000, "images-2.jpeg should be valid image");
  assert.ok(fs.statSync(img4).size > 1000, "images-4.jpeg should be valid image");
});
