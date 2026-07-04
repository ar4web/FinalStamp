# FinalStamp — Agent Guide

Vanilla JS stamp designer. No build step, no dependencies.

## Quick start

```sh
python -m http.server 8083  # from project root
```
Open http://localhost:8083. No npm/bundler needed.

## Architecture

```
index.html       — app shell, tool rail, viewport, panels
style.css        — dark Figma-inspired theme
app.js           — all logic (~3750 lines, single file)
logo.svg         — app icon
```

- **State**: global `cfg` object (plain JS). Saved to `localStorage` key `prostampstudio_config`.
- **Render**: `render()` draws stamp + layers to `<canvas id="stampCanvas">`. Uses seeded RNG (`cfg.seed`) so grunge/jitter is stable across frames.
- **Editor UI**: `renderLeftSidebar()` builds context-sensitive props into `#lsContext` (left sidebar) and `#repBody` (right floating panel).
- **Undo**: 60-step history via `JSON.stringify(cfg)` in memory.

## Coordinate system

| Context | Formula | Used for |
|---------|---------|---------|
| Canvas/export pixels | `mmPx(mm) = mm * (DPI_CURRENT / 25.4)` | All drawing, export |
| Screen CSS pixels | `mm * (96 / 25.4)` | `fitView()`, viewport sizing |

Default DPI is 300. Change via the DPI select (data-bind `dpi`).

## Key globals

- `cfg` — entire app state (template, layers, rings, colors, effects, zoom)
- `DPI_CURRENT` — current DPI (default 300, synced from `cfg.dpi`)
- `selId` / `selectedIds` — primary + multi-selected layer IDs
- `selShape` / `selRing` — stamp shape/ring selection state

## Layer types (`cfg.layers[]`)

Each layer has `type`: `'text'` (default), `'shape'`, or `'image'`.

- **Text**: `mode` = `'curved'` (along ellipse arc) or `'straight'` (flat). Supports RTL via `dir` field.
- **Shape**: `shapeType` = `star|pentagon|hexagon|diamond|cross|circle`.
- **Image**: Base64 `imageData` from imported files.

## Templates

8 built-in templates in `TEMPLATES` object: `standardCircle`, `doubleRing`, `tripleRing`, `oval`, `rectangle`, `square`, `minimalCircle`, `saudiCorporate`.

`applyTemplate(name)` swaps geometry + layers; `applyShapeKeepLayers(name)` swaps geometry only.

## Editor panels

- **Left sidebar** (`[` key): tool rail with accordion sections (stamp shape, add layer, layers, rings, stamp, style, export, guides).
- **Right floating panel** (`]` key): context-sensitive editor for selected layer (text/shape/image/stamp props). Mirrors the Properties section content.
- **Toggle**: sidebar `[`, right panel `]`. States persist in localStorage.

## Patterns & quirks

- `stampSize()` returns `{w, h}` in mm — for circles reads `cfg.outerDiameter`, for oval/rect reads `cfg.width`/`cfg.height`.
- `textEllipseMm(layer)` computes the ellipse radius for curved text — respects oval aspect ratio.
- `ringChannelRadiusMm(channel)` snaps curved text radius to ring channels.
- No separate text props panel on right side — all layer editing goes through the left sidebar Properties section and the floating right panel.
- Default zoom is 75% (not 100%).
- SVG export runs independently (no `render()` call — reads `cfg` directly).
- PNG export sets `exporting = true` to suppress editor overlays, calls `render()`, then restores.
- Image loading is async — renders without image first, then re-renders when loaded (via `imageCache`).

## Commands

| Action | Shortcut |
|--------|----------|
| Undo/Redo | Ctrl+Z / Ctrl+Y |
| Zoom + / - | +/- |
| Zoom 100% | 0 |
| Fit | F |
| Guides toggle | G |
| Toggle left sidebar | [ |
| Toggle right panel | ] |
| Select all layers | Ctrl+A |
| Delete layer | Delete/Backspace |
| Save state | Ctrl+S |
| Shortcuts help | ? |

## Testing

No test suite. Manual visual verification — open in browser, inspect canvas output, check SVG/PNG export, verify undo/redo, test localStorage persistence.
