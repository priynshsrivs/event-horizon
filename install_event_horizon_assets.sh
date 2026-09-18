#!/usr/bin/env bash
set -euo pipefail

# Event Horizon asset installer
# Installs the exact filenames expected by the current App.jsx/App.css/Universe.jsx.
# Fonts: Google Fonts repositories / SIL Open Font License.
# Planet maps: Solar System Scope, CC BY 4.0.
#
# Run from the Event Horizon project root:
#   bash install_event_horizon_assets.sh

if ! command -v curl >/dev/null 2>&1; then
  echo "ERROR: curl is required."
  exit 1
fi

mkdir -p public/fonts public/textures/splash public/textures

fetch() {
  local url="$1"
  local out="$2"
  echo "Downloading $(basename "$out")"
  curl -fL --retry 3 --retry-delay 1 --connect-timeout 15 --max-time 120 "$url" -o "$out"
  test -s "$out"
}

# ---------- Fonts ----------
fetch "https://raw.githubusercontent.com/googlefonts/dm-fonts/main/Sans/Exports/DMSans-Regular.ttf" \
      "public/fonts/dm-sans-regular.ttf"
fetch "https://raw.githubusercontent.com/googlefonts/dm-fonts/main/Sans/Exports/DMSans-Medium.ttf" \
      "public/fonts/dm-sans-medium.ttf"
fetch "https://raw.githubusercontent.com/IBM/plex/master/packages/plex-mono/fonts/complete/ttf/IBMPlexMono-Regular.ttf" \
      "public/fonts/ibm-plex-mono-regular.ttf"

# ---------- Solar System Scope 2K maps ----------
BASE="https://www.solarsystemscope.com/textures/download"

fetch "$BASE/2k_sun.jpg" \
      "public/textures/sun.jpg"
fetch "$BASE/2k_mercury.jpg" \
      "public/textures/mercury.jpg"
fetch "$BASE/2k_venus_surface.jpg" \
      "public/textures/venus.jpg"
fetch "$BASE/2k_earth_daymap.jpg" \
      "public/textures/earth.jpg"
fetch "$BASE/2k_earth_nightmap.jpg" \
      "public/textures/earth_night.jpg"
fetch "$BASE/2k_earth_clouds.jpg" \
      "public/textures/earth_clouds.jpg"
fetch "$BASE/2k_moon.jpg" \
      "public/textures/moon.jpg"
fetch "$BASE/2k_mars.jpg" \
      "public/textures/mars.jpg"
fetch "$BASE/2k_jupiter.jpg" \
      "public/textures/jupiter.jpg"
fetch "$BASE/2k_saturn.jpg" \
      "public/textures/saturn.jpg"
fetch "$BASE/2k_uranus.jpg" \
      "public/textures/uranus.jpg"
fetch "$BASE/2k_neptune.jpg" \
      "public/textures/neptune.jpg"
fetch "$BASE/2k_saturn_ring_alpha.png" \
      "public/textures/saturn_ring.png"
fetch "$BASE/2k_stars_milky_way.jpg" \
      "public/textures/galaxy.jpg"

# ---------- Verification ----------
required=(
  "public/fonts/dm-sans-regular.ttf"
  "public/fonts/dm-sans-medium.ttf"
  "public/fonts/ibm-plex-mono-regular.ttf"
  "public/textures/sun.jpg"
  "public/textures/mercury.jpg"
  "public/textures/venus.jpg"
  "public/textures/earth.jpg"
  "public/textures/earth_night.jpg"
  "public/textures/earth_clouds.jpg"
  "public/textures/moon.jpg"
  "public/textures/mars.jpg"
  "public/textures/jupiter.jpg"
  "public/textures/saturn.jpg"
  "public/textures/saturn_ring.png"
  "public/textures/uranus.jpg"
  "public/textures/neptune.jpg"
  "public/textures/galaxy.jpg"
  "public/textures/splash/images-2.jpeg"
  "public/textures/splash/images-3.jpeg"
  "public/textures/splash/images-4.jpeg"
)

for f in "${required[@]}"; do
  if [[ ! -s "$f" ]]; then
    echo "ERROR: missing or empty asset: $f"
    exit 1
  fi
done

echo
echo "Asset installation complete."
echo
echo "Required asset payload:"
du -ch "${required[@]}" 2>/dev/null | tail -n 1
echo
echo "Files verified: ${#required[@]}"
