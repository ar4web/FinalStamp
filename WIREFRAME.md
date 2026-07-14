# FinalStamp UI Redesign — Wireframe Specification

## Overview

The redesign restructures the stamp designer into a clean 3-column layout:
- **Left**: Sidebar with stamp templates and add-more tools
- **Center**: Canvas viewport with zoom controls
- **Right**: Three floating context panels (Stamp Settings, Position, Layers)

---

## 1. TOP BAR (Header)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ [Logo] │ [Colors] [Bleed] [Grunge] [Jitter] │ [★] [✚] [◆] [⬠] [⬡] │ [Export] [≡] │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Layout (Left to Right):
1. **Left section**: Logo button (sidebar toggle) — square icon with app logo
2. **Separator**: Vertical line
3. **Center section** (grouped together):
   - Color swatches (blue, green, red, rainbow/gradient)
   - Hex color value display (#112233)
   - Effect toggles: `Bleed` | `Grunge` | `Jitter` (pill-shaped toggles)
   - Separator
   - Shape icons (draggable to canvas): Star ★, Cross ✚, Diamond ◆, Pentagon ⬠, Hexagon ⬡
4. **Right section**:
   - Export button (with dropdown arrow)
   - Right panel toggle button (sidebar-like icon `≡`)

### Style Notes:
- Dark background with glassmorphism (blur + gradient)
- All buttons are compact (32px height)
- Shape icons have subtle background on hover
- Effect toggles are pill-shaped with checkbox behavior

---

## 2. LEFT SIDEBAR

```
┌───────────────────────────────┐
│ ⚙ STAMP TEMPLATES         ▼ │
├───────────────────────────────┤
│  ┌─────┐ ┌─────┐ ┌─────┐   │
│  │  ○  │ │ ◎◎ │ │  ⊙  │   │
│  │     │ │     │ │     │   │
│  └─────┘ └─────┘ └─────┘   │
│  ┌─────┐ ┌─────┐ ┌─────┐   │
│  │  □  │ │  ▭  │ │  ○  │   │
│  │     │ │     │ │     │   │
│  └─────┘ └─────┘ └─────┘   │
├───────────────────────────────┤
│ ➕ ADD MORE                ▼ │
├───────────────────────────────┤
│  ⟲ Curved Text               │
│  ↔ Straight Text             │
│  ☆ Shape                     │
│  🖼 Logo / Image             │
└───────────────────────────────┘
```

### Section 1: STAMP TEMPLATES
- **Header**: Uppercase "STAMP TEMPLATES" with collapse chevron
- **Grid**: 3 columns × 2 rows of template thumbnails
- **Templates** (in order):
  1. **Circle** — Single ring (standardCircle)
  2. **Double Ring** — Two concentric rings (doubleRing)
  3. **Oval** — Horizontal ellipse (oval)
  4. **Rectangle** — Rounded rectangle (rectangle)
  5. **Square** — Rounded square (square)
  6. **Minimal Circle** — Thin single ring (minimalCircle)

### Section 2: ADD MORE
- **Header**: Uppercase "ADD MORE" with collapse chevron
- **List**: Vertical list of add-layer buttons
- **Buttons** (in order):
  1. **Curved Text** — Arc icon, adds text along ellipse path
  2. **Straight Text** — Line icon, adds flat horizontal text
  3. **Shape** — Star icon, opens shape picker
  4. **Logo / Image** — Image icon, imports image file

### Style Notes:
- Each template thumbnail is ~40×40px with SVG preview
- Active template has accent border/highlight
- Buttons have icon + label, hover highlights
- Sections collapse independently

---

## 3. CENTER CANVAS AREA

```
┌─────────────────────────────────────┐
│                                     │
│                                     │
│            ┌───────────┐           │
│            │           │           │
│            │  Canvas   │           │
│            │  (stamp)  │           │
│            │           │           │
│            └───────────┘           │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ [-] 100% [+] │ Fit │ 1:1 │ 🔍│   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### Elements:
- **Viewport**: Dark background with subtle dot grid
- **Stage**: Centered container holding the stamp canvas
- **Canvas**: White background, renders stamp at current DPI
- **Zoom bar** (floating, bottom center):
  - Zoom out (-) button
  - Zoom percentage display
  - Zoom in (+) button
  - Separator
  - Fit button (fits stamp to viewport)
  - 1:1 button (100% zoom)
  - Reset view button
  - Guides toggle

---

## 4. RIGHT FLOATING PANELS

The right side shows **three separate floating panels** that appear contextually. They are shown below the main layout as exploded detail views.

### Panel A: STAMP SETTINGS

```
┌─────────────────────────────────────┐
│ ↩ ↪ │        ▲ ▼        │    ✕    │
├─────────────────────────────────────┤
│ [STAMP]  Stamp settings             │
├─────────────────────────────────────┤
│ STAMP                               │
│ Width      ════════●═══  62  ↕     │
│ Height     ═══════●════  36  ↕     │
│ Thickness  ════●════════  16  ↕     │
│ Center     ●════════════   0  ↕     │
│ Offset     [ 0 ] [ 0 ]    ↕        │
├─────────────────────────────────────┤
│ RING COLORS                         │
│ Outer  [■] ×                         │
│ Middle [■] ×                         │
└─────────────────────────────────────┘
```

**Header**:
- Left: Undo (↩) and Redo (↪) buttons
- Center: Previous layer (▲) and Next layer (▼) navigation
- Right: Close (✕) button

**Content**:
- Tab bar: `STAMP` (active, highlighted) | `Stamp settings`
- **STAMP section**:
  - Width: Slider + numeric value (62) + increment/decrement arrows
  - Height: Slider + numeric value (36) + increment/decrement arrows
  - Thickness: Slider + numeric value (16) + increment/decrement arrows
  - Center: Slider + numeric value (0) + increment/decrement arrows
  - Offset: Two inputs (X: 0, Y: 0) + increment/decrement arrows
- **RING COLORS section**:
  - Outer: Color swatch + reset (×) button
  - Middle: Color swatch + reset (×) button

---

### Panel B: POSITION

```
┌─────────────────────────────────────┐
│ Position                         ✕  │
├─────────────────────────────────────┤
│  Arrange        Layers              │
│  ─────────────                      │
├─────────────────────────────────────┤
│ Arrange                             │
│ [↑ Forward]  [↓ Backward]          │
│ [⬆ To front] [⬇ To back]          │
├─────────────────────────────────────┤
│ Align to page                       │
│ [⬆ Top]    [◀ Left]                │
│ [◆ Middle] [▶ Center]              │
│ [⬇ Bottom] [▶ Right]               │
├─────────────────────────────────────┤
│ Advanced                            │
│ Width: 38.9 px  Height: 415.4 px   │
│ Ratio: 🔒                           │
│ X: 687 px      Y: 875.1 px         │
│ Rotate: 90°                         │
└─────────────────────────────────────┘
```

**Header**:
- Title: "Position"
- Close (✕) button

**Tabs**:
- `Arrange` (active, with underline)
- `Layers`

**Arrange section** (grid 2×2):
- Forward (↑ arrow icon)
- Backward (↓ arrow icon)
- To front (⬆ arrow icon)
- To back (⬇ arrow icon)

**Align to page section** (grid 2×3):
- Top (⬆ icon)
- Left (◀ icon)
- Middle (◆ icon)
- Center (▶ icon)
- Bottom (⬇ icon)
- Right (▶ icon)

**Advanced section**:
- Width: `38.9 px`
- Height: `415.4 px`
- Ratio: Lock icon (aspect ratio lock)
- X: `687 px`
- Y: `875.1 px`
- Rotate: `90°`

---

### Panel C: LAYERS

```
┌─────────────────────────────────────┐
│ ◇ LAYERS                        ▼  │
├─────────────────────────────────────┤
│ 👁 Stamp outline (oval)    [SHAPE] │
│ 👁 Ring 1 · outer     [RING] [1.8] │
│ 👁 Ring 2 · middle    [RING] [0.8] │
│ 👁 الموارد المـ...        [ARC]    │
│ 👁 LIMITED RE...         [ARC]     │
│ 👁 1234567890            [LINE]    │
└─────────────────────────────────────┘
```

**Header**:
- Layers icon (◇)
- Title: "LAYERS" (uppercase)
- Collapse chevron (▼)

**Layer list** (vertical):
Each row has:
- **Visibility toggle** (eye icon 👁)
- **Layer name** (truncated with ellipsis if too long)
- **Badge** (type indicator):
  - `SHAPE` — for shape layers
  - `RING` — for ring/channel layers (with numeric value like 1.8, 0.8)
  - `ARC` — for curved text layers
  - `LINE` — for straight text layers

**Example layers**:
1. Stamp outline (oval) — SHAPE badge
2. Ring 1 · outer — RING badge, value 1.8
3. Ring 2 · middle — RING badge, value 0.8
4. الموارد المـ... (Arabic text) — ARC badge
5. LIMITED RE... — ARC badge
6. 1234567890 — LINE badge

---

## 5. ORANGE ANNOTATION LINES

The wireframe includes orange annotation lines/arrows that show:
1. **From Export button → to right panels**: Indicates the floating panels appear when clicking the right panel toggle
2. **From panels → to sidebar sections**: Shows how panel content relates to sidebar tools

---

## 6. COLOR SCHEME

- **Background**: Deep midnight blue (#08081a)
- **Panels**: Dark with glassmorphism (blur + gradient)
- **Borders**: Subtle luminous seams (rgba(140, 140, 200, 0.1))
- **Accent**: Electric indigo (#4f46e5)
- **Text**: Light (#eef0ff) with dim variants
- **Badges**: Color-coded by type (SHAPE=purple, RING=blue, ARC=teal, LINE=green)

---

## 7. KEY INTERACTIONS

1. **Logo button** (topbar left): Toggles sidebar visibility
2. **Right panel toggle** (topbar right): Shows/hides the floating editor panel
3. **Template click**: Applies stamp template (changes geometry + layers)
4. **Add More buttons**: Adds new layer of selected type
5. **Layer click**: Selects layer for editing (shows in right panel)
6. **Panel tabs**: Switches between Stamp Settings / Position / Layers views
7. **Drag shapes**: Dragging shape icons from topbar to canvas adds shape layer

---

## 8. RESPONSIVE BEHAVIOR

- **≥1200px**: Full layout, sidebar 240px
- **900-1200px**: Sidebar 220px, shape icons hidden
- **720-900px**: Sidebar 200px, center controls hidden
- **≤720px**: Sidebar collapses, right panel goes full-width
- **≤520px**: Topbar wraps to 2 rows, export text hidden
