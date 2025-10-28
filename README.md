# Generalized Tonnetz

Interactive Tonnetz lattice visualizer for arbitrary EDOs with configurable axis intervals, overlays for chords/shapes, and high‑resolution export.

## Features

- Any EDO (Equal Divisions of the Octave), default 12
- Configurable lattice axes X and Z (Y is implied by geometry)
- Crisp lattice rendering with labels and optional highlight for note 0
- Chord overlays
  - Steps editor (first three steps form a triangle when applicable)
  - Color and opacity controls
  - Up/Down mapping: assign which overlay activates when clicking up vs. down triangles
  - Repeat toggle: tile each placed overlay anchor periodically across the lattice
  - Click to add/remove anchors
- Smart click hit‑testing so neighbors don’t accidentally toggle the same triangle
- Default overlays auto‑sync to X/Z (Down: `[0, Z, X]`, Up: `[0, X−Z, X]`)
  - Their Steps inputs update automatically when X/Z/EDO change
  - Manual edits disable auto‑sync for that overlay
- Export to PNG and PDF
- Controls panel starts collapsed by default

## Getting started

- Quick start: open `index.html` in your browser.
- For a local server (optional, recommended for consistent caching and PDF export):

```powershell
# From the repository folder
python -m http.server 8000
# Then open http://localhost:8000/
```

> Any static server works; the app is a single‑page site with no backend.

## Repository structure

- `index.html` – Page layout and control panel
- `styles.css` – Layout and visual styling
- `helpers.js` – Small utilities (color helpers, parsing, etc.)
- `geometry.js` – Lattice math: coordinate transforms, hit‑testing, period vectors
- `drawing.js` – Rendering the grid and overlay geometry
- `overlays.js` – Overlay state, panel UI, up/down mapping, repeat flag
- `app.js` – Wiring controls, click behavior, export, and draw orchestration
- `data/presets.json` – Placeholder for preset configurations (optional)

## Controls overview

Header (always visible):
- EDO – integer divisions of the octave
- Interval X / Interval Z – steps along the two displayed axes
- Draw Tonnetz, Save PNG, Save PDF

Controls panel (toggle +):
- Canvas size and orientation (A4/A3/Letter/Legal/Custom)
- Triangle size
- Colors: axis strokes, background, labels, highlight for note 0

Overlay sidebar:
- Add Overlay
- For each overlay:
  - Visible – toggle drawing
  - Active – which overlay responds to clicks (used as fallback)
  - ↑ / ↓ – map this overlay to up/down triangle clicks
  - Repeat – periodically tile placed anchors over the lattice
  - Steps – comma‑separated integers (e.g., `0,4,7`)
  - Color – overlay stroke color
  - Opacity – overlay opacity (0–1)
  - Anchors – number of placed anchors; Clear Anchors, Delete

## Click behavior

- Clicking a triangle chooses the overlay via the up/down mapping; if none is set, the active overlay is used.
- If the overlay’s first 3 steps form a triangle, clicks are only accepted when you actually click within that triangle’s area.
- Toggling anchors:
  - Without Repeat: click toggles the single anchor at that triangle apex.
  - With Repeat: anchors are periodically tiled via the lattice’s two period vectors; clicking any tile toggles the entire equivalence class (all repeated copies) on/off.

## Default overlays and auto‑sync

- On first load, two overlays are created:
  - Down overlay: `[0, Z, X]`
  - Up overlay: `[0, X−Z, X]`
- They auto‑update with X/Z/EDO changes and the Steps inputs refresh automatically.
- If you edit an overlay’s Steps, its auto‑sync is disabled so your edits persist.

## Export

- Save PNG – exports the rendered canvas at the current size
- Save PDF – uses jsPDF (CDN) to write a PDF sized to the canvas

## Tips

- If the canvas size is large, a preview scale is used internally for responsiveness while maintaining crisp output.
- Increase Triangle Size for presentations or high‑DPI export.
- Use different overlay colors and opacities to layer analyses.

## Development notes

- The lattice math is axial‑like on a triangular grid. Key utilities:
  - `qrToPixel` / `pixelToQR`
  - `solveStepToUV` – express a musical step as lattice offsets
  - `findPeriodVectors` – fundamental translations for repeating patterns
- Strict triangle hit‑testing is barycentric; no nearest‑vertex fallbacks for overlays that draw triangles.

## License

This project is released under a Non‑Commercial license. You are free to use, copy, modify, and distribute this software for personal, educational, or academic research purposes. Commercial use of any kind requires prior written permission from the copyright holder.

See `LICENSE.md` for full terms.
