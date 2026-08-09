"use strict";
/* ================================================================
   PRO STAMP STUDIO — js/inspector.js
   Right-editor-panel & left-sidebar markup generators (Phase 2).

   • renderRightEditorPanel() builds the consolidated 3-tab
     inspector (Layers / Selection / Stamp Canvas).
   • renderLeftSidebar() returns the static action dock.
   • The per-item property sub-builders (text, shape, image, ring,
     stamp geometry, effects, alignment, swatches) are preserved
     verbatim, so the data-ls / data-rng binding keys the app.js
     controller listens for remain completely intact.

   Active tab comes from cfg.viewState.activeTab; the selected layer
   comes from window.stampApp.selId (exposed by the controller).
   ================================================================ */

import { cfg, SWATCHES, OFFICIAL_PRESETS } from "./state.js";

/* ── Compact stepper utility ──────────────────────────────────────
   High-density number input with +/- buttons — replaces the heavy
   double-width range+number slider rows for a tighter inspector. */
export function createCompactStepper(label, dataKey, currentVal, min, max, step) {
  return `<div class="compact-row">
      <label class="compact-label">${label}</label>
      <div class="compact-input-group">
        <button type="button" class="manual-step-down" data-target="${dataKey}" data-step="-${step}">-</button>
        <input type="number" class="scrubbable-input" data-ls="${dataKey}" value="${currentVal}" min="${min}" max="${max}" step="${step}">
        <button type="button" class="manual-step-up" data-target="${dataKey}" data-step="${step}">+</button>
      </div>
    </div>`;
}

/* ── Fonts (shared with the editor) ────────────────────────────── */
const FONTS = [
  { group: "Universal (all languages)", items: ["Noto Sans", "Noto Serif"] },
  {
    group: "Arabic",
    items: ["Noto Sans Arabic", "Noto Naskh Arabic", "Noto Kufi Arabic"],
  },
  { group: "CJK", items: ["Noto Sans SC", "Noto Sans JP", "Noto Sans KR"] },
  {
    group: "Indic / Other scripts",
    items: ["Noto Sans Devanagari", "Noto Sans Thai", "Noto Sans Hebrew"],
  },
];

const FONT_WEIGHTS = {
  "Noto Sans": [100, 200, 300, 400, 500, 600, 700, 800, 900],
  "Noto Serif": [100, 200, 300, 400, 500, 600, 700, 800, 900],
  "Noto Sans Arabic": [100, 200, 300, 400, 500, 600, 700, 800, 900],
  "Noto Naskh Arabic": [400, 500, 600, 700],
  "Noto Kufi Arabic": [400, 500, 700, 800, 900],
  "Noto Sans SC": [100, 200, 300, 400, 500, 600, 700, 800, 900],
  "Noto Sans JP": [100, 200, 300, 400, 500, 600, 700, 800, 900],
  "Noto Sans KR": [100, 200, 300, 400, 500, 600, 700, 800, 900],
  "Noto Sans Devanagari": [100, 200, 300, 400, 500, 600, 700, 800, 900],
  "Noto Sans Thai": [100, 200, 300, 400, 500, 600, 700, 800, 900],
  "Noto Sans Hebrew": [100, 200, 300, 400, 500, 600, 700, 800, 900],
};

function fontOptHTML(sel) {
  return FONTS.map(
    (g) =>
      `<optgroup label="${g.group}">` +
      g.items
        .map((f) => `<option${f === sel ? " selected" : ""}>${f}</option>`)
        .join("") +
      "</optgroup>",
  ).join("");
}

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

/* ── Editor state (compatibility) ────────────────────────────────
   Retained so the app.js controller's setEditorState() call keeps
   working. Tab + selection now come from cfg.viewState and
   window.stampApp instead of this object. */
let editorState = null;
export function setEditorState(s) {
  editorState = s;
}

/* ── Effects panel HTML ────────────────────────────────────────── */
export function buildEffectsHTML() {
  return `
    <div class="prop-section">
      <div class="prop-label">Opacity</div>
      <div class="slider-row"><input type="range" min="5" max="100" step="1" data-ls="opacity" value="${cfg.opacity}"><input type="number" min="5" max="100" step="1" data-ls="opacity" value="${cfg.opacity}"></div>
    </div>
    <div class="prop-section">
      <div class="slider-row" style="margin-top:2px"><label class="eff-amount-label">Bleed</label><input type="range" min="0" max="2" step="0.05" data-ls="inkBleedAmount" value="${cfg.inkBleedAmount}"><input type="number" min="0" max="2" step="0.05" data-ls="inkBleedAmount" value="${cfg.inkBleedAmount}"></div>
      <div class="slider-row"><label class="eff-amount-label">Grunge</label><input type="range" min="0" max="1" step="0.01" data-ls="grungeAmount" value="${cfg.grungeAmount}"><input type="number" min="0" max="1" step="0.01" data-ls="grungeAmount" value="${cfg.grungeAmount}"></div>
      <div class="slider-row"><label class="eff-amount-label">Jitter</label><input type="range" min="0" max="1.5" step="0.05" data-ls="jitterDegrees" value="${cfg.jitterDegrees}"><input type="number" min="0" max="1.5" step="0.05" data-ls="jitterDegrees" value="${cfg.jitterDegrees}"></div>
    </div>
  `;
}

/* ── Ring channel adjustments HTML ─────────────────────────────── */
export function buildRingContextHTML() {
  const rv = cfg.ringVisible || {};
  const eye = (ring, visible) =>
    visible
      ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>'
      : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3l18 18M10.6 10.6A3 3 0 0014.8 14.8M9.9 5.2A9.7 9.7 0 0112 5c6 0 10 7 10 7a17 17 0 01-3.2 3.8M6.1 6.2A17 17 0 002 12s4 7 10 7a9.6 9.6 0 003.1-.5"/></svg>';
  return `
    <div class="rp-ring-row" data-rng-row="1">
      <div class="rp-ring-row-head">
        <span class="ring-dot ring-dot-outer"></span>
        <span class="prop-label">1</span>
        <button class="layer-icon-btn" data-rng-vis="outer" title="Show/hide" style="opacity:${(rv.outer ?? 1) ? "1" : "0.4"}">${eye("outer", rv.outer ?? 1)}</button>
        <span class="prop-label rp-ring-val" data-rng-val="1">${cfg.outerRingThickness ?? 1}</span>
      </div>
      ${createCompactStepper("Width", "outerRingThickness", cfg.outerRingThickness ?? 1, 0.1, 5, 0.1)}
    </div>
    ${
      cfg.rings >= 2
        ? `
    <div class="rp-ring-row" data-rng-row="2">
      <div class="rp-ring-row-head">
        <span class="ring-dot ring-dot-inner"></span>
        <span class="prop-label">2</span>
        <button class="layer-icon-btn" data-rng-vis="inner" title="Show/hide" style="opacity:${(rv.inner ?? 1) ? "1" : "0.4"}">${eye("inner", rv.inner ?? 1)}</button>
        <span class="prop-label rp-ring-val" data-rng-val="2">${cfg.innerRingThickness ?? 0.5}</span>
      </div>
      ${createCompactStepper("Width", "innerRingThickness", cfg.innerRingThickness ?? 0.5, 0, 5, 0.1)}
    </div>`
        : ""
    }
    ${
      cfg.rings >= 3
        ? `
    <div class="rp-ring-row" data-rng-row="3">
      <div class="rp-ring-row-head">
        <span class="ring-dot ring-dot-inner2"></span>
        <span class="prop-label">3</span>
        <button class="layer-icon-btn" data-rng-vis="inner2" title="Show/hide" style="opacity:${(rv.inner2 ?? 1) ? "1" : "0.4"}">${eye("inner2", rv.inner2 ?? 1)}</button>
        <span class="prop-label rp-ring-val" data-rng-val="3">${cfg.innerRing2Thickness ?? 0.5}</span>
      </div>
      ${createCompactStepper("Width", "innerRing2Thickness", cfg.innerRing2Thickness ?? 0.5, 0, 5, 0.1)}
    </div>`
        : ""
    }
    ${
      cfg.rings >= 2
        ? `
    <div class="rp-ring-gap">
      ${createCompactStepper("Gap", "ringGap", cfg.ringGap || 0, 0, 10, 0.1)}
    </div>`
        : ""
    }
  `;
}

/* ── Stamp geometry HTML ───────────────────────────────────────── */
export function buildStampContextHTML() {
  // Fix: cfg.shape uses 'circle','oval','rectangle' values; use template name too.
  const isCircle = cfg.shape === "circle";
  const isRect = cfg.shape === "rectangle";
  const isOval = cfg.shape === "oval";
  const sizeLabel = isCircle ? "Diameter" : "Width";
  const sizeVal = isCircle ? cfg.outerDiameter || cfg.width : cfg.width;
  const sizeMax = 120;
  const thickAvg =
    ((cfg.outerRingThickness || 0) +
      (cfg.innerRingThickness || 0) +
      (cfg.innerRing2Thickness || 0)) /
    (cfg.rings >= 3 ? 3 : cfg.rings >= 2 ? 2 : 1);

  const rc = cfg.ringColors || {};
  const swatch = (key, label) => `
    <div class="ls-ring-color">
      <label class="ls-row-label">${label}</label>
      <input type="color" class="ls-color-input" data-ls-ring="${key}" value="${rc[key] || cfg.inkColor}">
      <button class="ls-clear-color" data-ls-ring-clear="${key}" title="Use ink color">×</button>
    </div>`;

  return `
    <div class="ls-sub-title">Stamp</div>
    ${createCompactStepper(sizeLabel, "size", sizeVal, 10, sizeMax, 0.5)}
    ${
      !isCircle
        ? createCompactStepper("Height", "height", cfg.height, 10, 90, 0.5)
        : ""
    }
    ${createCompactStepper("Thickness", "thickness", Math.round(thickAvg * 10) / 10, 0, 8, 0.1)}
    ${createCompactStepper("Center", "centerAreaDiameter", cfg.centerAreaDiameter, 0, 45, 0.5)}
    ${
      isRect
        ? createCompactStepper("Corner", "cornerRadius", cfg.cornerRadius, 0, 20, 0.5)
        : ""
    }
    <div class="ls-row-inline"><label class="ls-row-label">Offset</label>
      <div class="ls-offset-pair">
        <input type="number" min="-30" max="30" step="0.5" data-ls="offsetX" value="${cfg.shapeOffsetXmm || 0}" placeholder="X">
        <input type="number" min="-30" max="30" step="0.5" data-ls="offsetY" value="${cfg.shapeOffsetYmm || 0}" placeholder="Y">
      </div>
    </div>

    <div class="ls-sub-title">Ring colors</div>
    ${swatch("outer", "Outer")}
    ${cfg.rings >= 2 ? swatch("inner", "Middle") : ""}
    ${cfg.rings >= 3 ? swatch("inner2", "Inner") : ""}
    ${cfg.centerAreaDiameter > 0 ? swatch("center", "Center") : ""}
  `;
}

/* ── Text parameter HTML (curved / straight) ───────────────────── */
export function buildTextContextHTML(l) {
  const fontOpts = fontOptHTML(l.font);
  const weightOpts = (FONT_WEIGHTS[l.font] || [400, 700, 900])
    .map((w) => {
      const names = {
        100: "Thin",
        200: "XLight",
        300: "Light",
        400: "Regular",
        500: "Medium",
        600: "SBold",
        700: "Bold",
        800: "XBold",
        900: "Black",
      };
      return `<option value="${w}"${l.weight == w ? " selected" : ""}>${names[w] || w}</option>`;
    })
    .join("");

  return `
    <div class="ls-sub-title">${escapeHtml(l.name) || "Text"}</div>
    <div class="ls-row"><label class="ls-row-label">Text</label></div>
    <textarea class="ls-textarea" data-ls="text" dir="auto">${escapeHtml(l.text) || ""}</textarea>
    <div class="ls-row"><label class="ls-row-label">Font</label>
      <select class="ls-select" data-ls="font">${fontOpts}</select>
    </div>
    <div class="ls-row-inline">
      <select class="ls-select" data-ls="weight" style="flex:1">${weightOpts}</select>
      <select class="ls-select" data-ls="mode" style="flex:1">
        <option value="curved"${l.mode === "curved" ? " selected" : ""}>Curved</option>
        <option value="straight"${l.mode === "straight" ? " selected" : ""}>Straight</option>
      </select>
    </div>
    ${
      l.mode === "straight"
        ? `<div class="ls-row-inline">
      <select class="ls-select" data-ls="dir" style="flex:1">
        <option value="auto"${l.dir === "auto" ? " selected" : ""}>Auto</option>
        <option value="ltr"${l.dir === "ltr" ? " selected" : ""}>LTR</option>
        <option value="rtl"${l.dir === "rtl" ? " selected" : ""}>RTL</option>
      </select>
    </div>`
        : ""
    }
    ${createCompactStepper("Size", "sizeMm", l.sizeMm, 1, 18, 0.1)}
    ${createCompactStepper("Spacing", "letterSpacing", l.letterSpacing, -4, 20, 0.5)}
    ${createCompactStepper("Word sp", "wordSpacing", l.wordSpacing, -4, 30, 0.5)}
    ${createCompactStepper("Width", "scaleX", l.scaleX, 0.3, 3, 0.05)}
    ${createCompactStepper("Height", "scaleY", l.scaleY, 0.3, 3, 0.05)}
    ${
      l.mode === "curved"
        ? `
    <div class="ls-row">
      <label class="ls-row-label">Snap to ring</label>
      <div class="ls-snap-row">
        <button class="ls-mini-btn" data-snap="outer">Outer channel</button>
        ${cfg.rings >= 3 ? `<button class="ls-mini-btn" data-snap="inner">Inner channel</button>` : ""}
        <button class="ls-mini-btn" data-snap="center">Near center</button>
      </div>
    </div>
    ${createCompactStepper("Radius", "radiusMm", l.radiusMm, 3, 42, 0.1)}
    ${createCompactStepper("Start", "startAngle", l.startAngle, 0, 360, 1)}
    ${createCompactStepper("End", "endAngle", l.endAngle, 0, 360, 1)}
    <label class="ls-toggle"><input type="checkbox" data-ls="flip"${l.flip ? " checked" : ""}><span>Flip</span></label>
    `
        : `
    <div class="ls-row-inline"><label class="ls-row-label">Offset</label>
      <div class="ls-offset-pair">
        <input type="number" min="-50" max="50" step="0.1" data-ls="offsetXmm" value="${l.offsetXmm || 0}" placeholder="X">
        <input type="number" min="-50" max="50" step="0.1" data-ls="offsetYmm" value="${l.offsetYmm || 0}" placeholder="Y">
      </div>
    </div>
    `
    }
    <div class="ls-sub-title">Color</div>
    <div class="ls-color-row">
      <input type="color" class="ls-color-input" data-ls-color value="${l.color || cfg.inkColor}">
      <button class="ls-clear-color" data-ls-color-clear title="Use stamp ink color">Use ink</button>
    </div>
  `;
}

/* ── Shape configuration HTML ──────────────────────────────────── */
export function buildShapeLayerContextHTML(l) {
  const shapeOpts = [
    "star",
    "pentagon",
    "hexagon",
    "diamond",
    "cross",
    "circle",
  ]
    .map(
      (s) =>
        `<option value="${s}"${l.shapeType === s ? " selected" : ""}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`,
    )
    .join("");
  return `
    <div class="ls-sub-title">${escapeHtml(l.name) || "Shape"}</div>
     <div class="ls-row"><label class="ls-row-label">Shape</label>
      <select class="ls-select" data-ls="shapeType">${shapeOpts}</select>
    </div>
    ${createCompactStepper("Size", "shapeSizeMm", l.shapeSizeMm || 10, 1, 20, 0.5)}
    ${createCompactStepper("Rotation", "shapeRotation", l.shapeRotation || 0, 0, 360, 1)}
    <div class="ls-row-inline"><label class="ls-row-label">Offset</label>
      <div class="ls-offset-pair">
        <input type="number" min="-30" max="30" step="0.1" data-ls="offsetXmm" value="${l.offsetXmm || 0}" placeholder="X">
        <input type="number" min="-30" max="30" step="0.1" data-ls="offsetYmm" value="${l.offsetYmm || 0}" placeholder="Y">
      </div>
    </div>
    <label class="ls-toggle"><input type="checkbox" data-ls="shapeFill"${l.shapeFill ? " checked" : ""}><span>Filled</span></label>
    <div class="ls-sub-title">Color</div>
    <div class="ls-color-row">
      <input type="color" class="ls-color-input" data-ls-color value="${l.color || cfg.inkColor}">
      <button class="ls-clear-color" data-ls-color-clear title="Use stamp ink color">Use ink</button>
    </div>
  `;
}

/* ── Image settings HTML ───────────────────────────────────────── */
export function buildImageContextHTML(l) {
  return `
    <div class="ls-sub-title">${escapeHtml(l.name) || "Image"}</div>
    <div class="ls-row"><label class="ls-row-label">Width</label>
      <div class="slider-row"><input type="range" min="1" max="30" step="0.5" data-ls="imageWidthMm" value="${l.imageWidthMm || 10}"><input type="number" min="1" max="30" step="0.5" data-ls="imageWidthMm" value="${l.imageWidthMm || 10}"></div>
    </div>
    <div class="ls-row"><label class="ls-row-label">Height</label>
      <div class="slider-row"><input type="range" min="1" max="30" step="0.5" data-ls="imageHeightMm" value="${l.imageHeightMm || 10}"><input type="number" min="1" max="30" step="0.5" data-ls="imageHeightMm" value="${l.imageHeightMm || 10}"></div>
    </div>
    <div class="ls-row-inline"><label class="ls-row-label">Offset</label>
      <div class="ls-offset-pair">
        <input type="number" min="-30" max="30" step="0.1" data-ls="offsetXmm" value="${l.offsetXmm || 0}" placeholder="X">
        <input type="number" min="-30" max="30" step="0.1" data-ls="offsetYmm" value="${l.offsetYmm || 0}" placeholder="Y">
      </div>
    </div>
  `;
}

/* ── Alignment buttons HTML ────────────────────────────────────── */
export function buildAlignRowHTML() {
  return `<div class="ls-align-row">
    <button class="ls-align-btn" data-align="left" title="Align left"><svg viewBox="0 0 18 18" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><line x1="3" y1="4" x2="15" y2="4"/><line x1="3" y1="9" x2="11" y2="9"/><line x1="3" y1="14" x2="13" y2="14"/></svg></button>
    <button class="ls-align-btn" data-align="centerH" title="Center H"><svg viewBox="0 0 18 18" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><line x1="9" y1="2" x2="9" y2="16"/><line x1="5" y1="7" x2="13" y2="7"/><line x1="6" y1="11" x2="12" y2="11"/></svg></button>
    <button class="ls-align-btn" data-align="right" title="Align right"><svg viewBox="0 0 18 18" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><line x1="3" y1="4" x2="15" y2="4"/><line x1="7" y1="9" x2="15" y2="9"/><line x1="5" y1="14" x2="15" y2="14"/></svg></button>
    <button class="ls-align-btn" data-align="top" title="Align top"><svg viewBox="0 0 18 18" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><line x1="4" y1="3" x2="14" y2="3"/><line x1="9" y1="3" x2="9" y2="11"/><line x1="6" y1="13" x2="12" y2="13"/></svg></button>
    <button class="ls-align-btn" data-align="centerV" title="Center V"><svg viewBox="0 0 18 18" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><line x1="2" y1="9" x2="16" y2="9"/><line x1="7" y1="5" x2="7" y2="13"/><line x1="11" y1="6" x2="11" y2="12"/></svg></button>
    <button class="ls-align-btn" data-align="bottom" title="Align bottom"><svg viewBox="0 0 18 18" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><line x1="4" y1="15" x2="14" y2="15"/><line x1="9" y1="7" x2="9" y2="15"/><line x1="6" y1="5" x2="12" y2="5"/></svg></button>
  </div>`;
}

/* ── Topbar color swatches HTML ────────────────────────────────── */
export function buildSwatchesHTML() {
  return SWATCHES.map(
    (c) =>
      `<div class="color-swatch" data-color="${c}" style="background:${c}" title="${c}"></div>`,
  ).join("");
}

/* ── Layers list manager (Layers tab) ──────────────────────────── */
export function buildLayerProps() {
  const activeLayerId = window.stampApp ? window.stampApp.selId : null;
  const layers = cfg.layers || [];
  if (!layers.length)
    return `<div class="layer-props-empty">No layers yet — add one from the sidebar.</div>`;

  const badge = (l) =>
    l.type === "image"
      ? "IMG"
      : l.type === "shape"
        ? "SHAPE"
        : l.mode === "curved"
          ? "ARC"
          : "LINE";

  const label = (l) =>
    l.name ||
    (l.text ? l.text.slice(0, 16) : l.type.charAt(0).toUpperCase() + l.type.slice(1));

  return `
    <div class="layer-props-list">
      ${layers
        .map((l) => {
          const active = l.id === activeLayerId ? " active" : "";
          return `
      <div class="layer-props-item${active}" data-layer-id="${l.id}">
        <span class="layer-props-badge">${badge(l)}</span>
        <span class="layer-props-name" title="${escapeHtml(l.text || l.name || "")}">${escapeHtml(label(l))}</span>
         <button class="layer-vis-btn${l.visible ? " on" : ""}" data-layer-vis="${l.id}" title="Toggle visibility">${l.visible ? "◉" : "○"}</button>
      </div>`;
        })
        .join("")}
    </div>
  `;
}

/* ================================================================
   TOOL RAIL — dynamic layer list + effects sync
   ================================================================ */
export function buildLayerListHTML() {
  const activeLayerId = window.stampApp ? window.stampApp.selId : null;
  const layers = cfg.layers || [];

  if (!layers.length) {
    return `<div class="layer-list-empty">No layers yet</div>`;
  }

  const badge = (l) =>
    l.type === "image"
      ? "IMG"
      : l.type === "shape"
        ? "SHAPE"
        : l.mode === "curved"
          ? "ARC"
          : "LINE";

  const label = (l) =>
    l.name ||
    (l.text ? l.text.slice(0, 16) : l.type.charAt(0).toUpperCase() + l.type.slice(1));

  return `
    <div class="layer-list-compact">
      ${layers
        .map((l) => {
          const active = l.id === activeLayerId ? " active" : "";
          const visOn = l.visible !== false;
          return `
        <div class="layer-item${active}" data-layer-id="${l.id}">
          <span class="layer-badge">${badge(l)}</span>
          <span class="layer-name" title="${escapeHtml(l.text || l.name || "")}">${escapeHtml(label(l))}</span>
          <button class="layer-vis-btn${visOn ? " on" : ""}" data-layer-vis="${l.id}" title="Toggle visibility">${visOn ? "◉" : "○"}</button>
          <button class="layer-del-btn" data-layer-del="${l.id}" title="Delete layer">×</button>
        </div>`;
        })
        .join("")}
    </div>
  `;
}

/* ================================================================
   LEFT SIDEBAR — static action dock
   ================================================================ */
const PRESET_CHIP_LABELS = {
  circle40: "Circle 40mm",
  saudiCorp: "Saudi Oval",
  returnAddress: "Return Rect",
  pocketSize: "Pocket Stamp",
};

export function renderLeftSidebar() {
  const presetChips = Object.entries(OFFICIAL_PRESETS)
    .map(
      ([key, spec]) =>
        `<button class="preset-chip-btn btn-secondary" data-preset="${key}" title="${spec.name}">${PRESET_CHIP_LABELS[key] || spec.name}</button>`,
    )
    .join("");

  return `
        <div class="sidebar-rail-dock">
            <h3>Stamp Blueprint Templates</h3>
            <div id="templates-grid-target"></div>
            <div class="preset-chips-row" style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; margin-bottom: 12px;">
                ${presetChips}
            </div>
            <hr class="panel-divider">
            <h3>Add Composition Channels</h3>
            <div class="action-buttons-stack">
                <button id="add-text-straight-btn" class="btn-primary">Add Straight Text</button>
                <button id="add-text-curved-btn" class="btn-primary">Add Curved Text</button>
                <button id="add-shape-btn" class="btn-primary">Add Shape Layer</button>
                <button id="add-image-btn" class="btn-primary">Add Logo/Image</button>
            </div>
        </div>
    `;
}

/* ================================================================
   RIGHT EDITOR PANEL — consolidated 3-tab inspector
   ================================================================ */
export function renderRightEditorPanel() {
  const activeTab = (cfg.viewState && cfg.viewState.activeTab) || "layers";
  const activeLayerId = window.stampApp ? window.stampApp.selId : null;
  const layers = cfg.layers || [];
  const currentLayer = layers.find((l) => l.id === activeLayerId);

  const tabTitles = {
    layers: "LAYERS",
    selection: "PROPERTIES",
    stamp: "STAMP SETTINGS",
  };

  // Build Tab Navigation Header
  let html = `
        <div class="inspector-tabs-header">
            <button class="tab-toggle-btn ${activeTab === "layers" ? "active" : ""}" data-tab-target="layers">Layers</button>
            <button class="tab-toggle-btn ${activeTab === "selection" ? "active" : ""}" data-tab-target="selection" ${!currentLayer ? "disabled" : ""}>Selection</button>
            <button class="tab-toggle-btn ${activeTab === "stamp" ? "active" : ""}" data-tab-target="stamp">Stamp Canvas</button>
        </div>
        <div class="inspector-tab-content-body">
    `;

  // Inject matching sub-builder layout strings into the active tab slot
  if (activeTab === "layers") {
    html += buildLayerProps();
  } else if (activeTab === "selection" && currentLayer) {
    if (currentLayer.type === "text") html += buildTextContextHTML(currentLayer);
    else if (currentLayer.type === "shape") html += buildShapeLayerContextHTML(currentLayer);
    else if (currentLayer.type === "image") html += buildImageContextHTML(currentLayer);
  } else if (activeTab === "stamp") {
    html += buildStampContextHTML();
    html += buildRingContextHTML();
    html += buildEffectsHTML();
  }

  html += `</div>`;

  const rep = document.getElementById("repBody");
  if (rep) rep.innerHTML = html;

  const title = document.querySelector("#rightEditorPanel .rep-title");
  if (title) title.textContent = tabTitles[activeTab] || "EDITOR";
}
