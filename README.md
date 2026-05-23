# Generalized Tonnetz

Interactive Tonnetz lattice visualizer for arbitrary EDOs with configurable directional axes, fixed up/down chord overlays, and high‑resolution export.

## Features

- JI lattice mode with exact fraction axes, monzo labels, and fraction or octave-normalized cent label views
- Any EDO (Equal Divisions of the Octave), default 12
- Directional lattice axes →, ↗, and ↘ auto-tune from a 5-limit major/minor preset when EDO changes, with manual editing still supported
- Crisp lattice rendering with labels and optional highlight for note 0
- Fixed chord overlays
  - Up overlay: `[0, ↗, →]` in red
  - Down overlay: `[0, ↘, →]` in blue
  - Click to add/remove anchors on matching triangle orientations
- Smart click hit‑testing so neighbors don’t accidentally toggle the same triangle
- Overlay steps are computed from the current directional axes whenever EDO or axes change
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

## Testing

- Run the current unit/regression suite with `npm test` or `node tests/run_tests.js`.
- The main test command includes a dependency-free headless browser smoke pass for responsive panel interactions and backdrop behavior when a local Edge, Chrome, or Chromium executable is available.
- If no supported local browser executable is found, the browser smoke pass reports a skip and the rest of the suite still runs.

## Repository structure

- `index.html` – Page layout and control panel
- `styles.css` – Layout and visual styling
- `helpers.js` – Small utilities (color helpers, parsing, etc.)
- `geometry.js` – Lattice math: coordinate transforms, hit‑testing, period vectors
- `drawing.js` – Rendering the grid and overlay geometry
- `overlays.js` – Fixed Up/Down overlay state and panel UI
- `app-rendering.js` – Canvas sizing, drawing, and click-to-anchor rendering behavior
- `app-persistence.js` – State restore/save and export actions
- `app-navigation.js` – Adaptive navigation and mobile sheet behavior
- `app.js` – Bootstrap and event wiring across the controllers

## Controls overview

Navigation:
- Wide view uses a left rail; narrow view uses a bottom tab bar.
- Settings, Chords, Scale, and More each open a dedicated panel.

Settings panel:
- Mode switches between EDO step labels and JI exact-ratio labels
- JI Labels chooses monzo, fraction, or octave-normalized cents when JI mode is active
- EDO – integer divisions of the octave; changing it auto-sets axes from 5-limit approximations
- Directional axes → / ↗ / ↘ – steps along the three lattice directions; → approximates `3/2`, ↗ approximates `5/4`, and ↘ derives from those by default
- Canvas size and orientation (A4/A3/Letter/Legal/Custom)
- Triangle size
- Colors: axis strokes, background, labels, highlight for note 0

More panel:
- Copy Link, Save PNG, Save PDF, Reset
Copy Link uses the browser clipboard API when available and falls back to a manual copy prompt otherwise.

Chord overlays panel:
- Up row – fixed red overlay for up-facing triangles
- Down row – fixed blue overlay for down-facing triangles
- Anchors – number of placed anchors; Clear removes all anchors for that row

## Click behavior

- Clicking an up-facing triangle toggles the Up overlay anchor; clicking a down-facing triangle toggles the Down overlay anchor.
- Clicks are only accepted when they land inside the corresponding overlay triangle.

## Fixed Overlays

- Up uses `[0, ↗, →]` and Down uses `[0, ↘, →]`.
- Overlay steps update from the current axes; only Up/Down anchor positions are saved.

## Export

- Save PNG – exports the rendered canvas at the current size
- Save PDF – uses jsPDF (CDN) to write a PDF sized to the canvas

## Tips

- If the canvas size is large, a preview scale is used internally for responsiveness while maintaining crisp output.
- Increase Triangle Size for presentations or high‑DPI export.
- Use the fixed Up/Down overlays to layer major/minor triangle analyses.

## Development notes

- The lattice math is axial‑like on a triangular grid. Key utilities:
  - `qrToPixel` / `pixelToQR`
  - `solveStepToUV` – express a musical step as lattice offsets
  - `findPeriodVectors` – fundamental translations for repeating patterns
- Strict triangle hit‑testing is barycentric; no nearest‑vertex fallbacks for overlays that draw triangles.

## License

This project is released under a Non‑Commercial license. You are free to use, copy, modify, and distribute this software for personal, educational, or academic research purposes. Commercial use of any kind requires prior written permission from the copyright holder.

See `LICENSE.md` for full terms.
