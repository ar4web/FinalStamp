"use strict";
/* ================================================================
   PRO STAMP STUDIO — js/state.js
   State model, seeded RNG, localStorage persistence and the
   60-step in-memory Undo/Redo history stack.

   Phase 1 extraction from app.js — behaviour is identical to the
   original single-file code. The module owns every reassignment of
   `cfg` (undo/redo/load), so the exported binding stays in sync.
   ================================================================ */

/* ── Constants ─────────────────────────────────────────────────── */
export const CSS_DPI = 96;
export const CSS_MM = CSS_DPI / 25.4; // CSS px per mm  (screen preview)
export const DEG = Math.PI / 180;

export let DPI_CURRENT = 300;
export const mmPx = (mm) => mm * (DPI_CURRENT / 25.4);
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const uid = () => "L" + Math.random().toString(36).slice(2, 8);

/* ── Undo / Redo history ────────────────────────────────────────── */
export const HIST_MAX = 60;
let histStack = [];
let histIdx = -1;
let histPushing = false;

/* UI round-trip hook: app.js registers a callback here so undo/redo
   can trigger syncAll()/render()/showToast() without importing the
   whole editor back into this module (avoids a circular dependency). */
let stateObserver = null;
export function setStateObserver(fn) {
  stateObserver = fn;
}

function notifyStateChanged(action) {
  if (stateObserver) stateObserver(action);
}

export function pushHistory() {
  histStack = histStack.slice(0, histIdx + 1);
  histStack.push(JSON.stringify(cfg));
  if (histStack.length > HIST_MAX) histStack.shift();
  histIdx = histStack.length - 1;
  histPushing = false;
  saveState();
}

export function undo() {
  if (histIdx <= 0) return;
  histIdx--;
  setConfig(JSON.parse(histStack[histIdx]));
  notifyStateChanged("undo");
}

export function redo() {
  if (histIdx >= histStack.length - 1) return;
  histIdx++;
  setConfig(JSON.parse(histStack[histIdx]));
  notifyStateChanged("redo");
}

export function autoHist() {
  if (!histPushing) {
    histPushing = true;
    pushHistory();
  }
}

/* Replace the whole configuration object (used by undo/redo,
   applyTemplate, reset, loadPreset, importConfig…). Keeps DPI in sync. */
export function setConfig(next) {
  cfg = next;
  DPI_CURRENT = next.dpi || 300;
}

/* ── Seeded RNG (mulberry32) — stable per render, no flicker ──── */
export function mkRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ================================================================
   STATE MODEL
   ================================================================ */
export function autoLayerName(l) {
  if (l.type === "shape")
    return (l.shapeType || "Shape").replace(/^./, (c) => c.toUpperCase());
  if (l.type === "image") return l.imageName || "Image";
  const t = (l.text || "").trim();
  if (t) return t.length > 22 ? t.slice(0, 22) + "…" : t;
  return l.mode === "curved" ? "Curved text" : "Line text";
}

export function makeLayer(o = {}) {
  const base = Object.assign(
    {
      id: uid(),
      name: "",
      text: "Text",
      font: "Arial",
      weight: 800,
      sizeMm: 4,
      letterSpacing: 0,
      wordSpacing: 0,
      scaleX: 1,
      scaleY: 1,
      dir: "auto",
      mode: "curved",
      flip: false,
      radiusMm: 16,
      startAngle: 200,
      endAngle: 340,
      offsetXmm: 0,
      offsetYmm: 0,
      visible: true,
      color: null, // per-layer override; null = inherit cfg.inkColor
      type: "text",
      shapeType: "star",
      shapeSizeMm: 10,
      shapeRotation: 0,
      shapeFill: true,
      shapePoints: 5,
      imageData: null,
      imageWidthMm: 10,
      imageHeightMm: 10,
    },
    o,
  );
  // Treat placeholder names from older code/templates as auto so they get refreshed.
  const placeholder =
    !base.name ||
    base.name === "Text" ||
    base.name === "Shape" ||
    base.name === "Image" ||
    base.name === "Layer";
  if (placeholder) {
    base.name = autoLayerName(base);
    base._autoName = true;
  } else if (base._autoName === undefined) {
    base._autoName = false;
  }
  return base;
}

export function defaultLayers() {
  return [
    makeLayer({
      name: "Shape",
      text: "شركة بصمة الموارد المحدودة",
      font: "Noto Sans Arabic",
      dir: "rtl",
      weight: 800,
      sizeMm: 4.5,
      mode: "curved",
      flip: false,
      radiusMm: 16,
      startAngle: 200,
      endAngle: 340,
    }),
    makeLayer({
      name: "Shape",
      text: "LIMITED RESOURCE STAMP CO.",
      font: "Noto Sans",
      dir: "ltr",
      weight: 700,
      sizeMm: 3.8,
      mode: "curved",
      flip: true,
      radiusMm: 15.8,
      startAngle: 145,
      endAngle: 35,
      letterSpacing: 1.5,
    }),
    makeLayer({
      name: "Shape",
      text: "1234567890",
      font: "Noto Sans",
      weight: 900,
      sizeMm: 3.2,
      mode: "straight",
      offsetYmm: 0,
    }),
  ];
}

export function baseStyle() {
  return {
    inkColor: "#1e3a8a",
    opacity: 100,
    ringColors: { outer: null, inner: null, inner2: null, center: null }, // null = inherit inkColor
    ringVisible: { outer: true, inner: true, inner2: true, center: true },
    inkBleed: true,
    inkBleedAmount: 0.5,
    grungeTexture: true,
    grungeAmount: 0.3,
    rotationJitter: true,
    jitterDegrees: 0.9,
    paddingMm: 5,
    seed: 73219,
    dpi: 300,
  };
}

/* ── Template definitions ──────────────────────────────────────── */
export const TEMPLATES = {
  standardCircle: {
    label: "Circle",
    shape: "circle",
    outerDiameter: 42,
    width: 42,
    height: 42,
    outerRingThickness: 1.6,
    innerRingThickness: 0.7,
    ringGap: 2.2,
    centerAreaDiameter: 14,
    cornerRadius: 3,
    rings: 2,
  },
  doubleRing: {
    label: "Double Ring",
    shape: "circle",
    outerDiameter: 46,
    width: 46,
    height: 46,
    outerRingThickness: 2.0,
    innerRingThickness: 1.1,
    ringGap: 1.6,
    centerAreaDiameter: 20,
    cornerRadius: 4,
    rings: 2,
  },
  tripleRing: {
    label: "Triple Ring",
    shape: "circle",
    outerDiameter: 50,
    width: 50,
    height: 50,
    outerRingThickness: 2.2,
    innerRingThickness: 0.9,
    innerRing2Thickness: 0.6,
    ringGap: 1.3,
    centerAreaDiameter: 18,
    cornerRadius: 4,
    rings: 3,
  },
  oval: {
    label: "Oval",
    shape: "oval",
    outerDiameter: 46,
    width: 62,
    height: 36,
    outerRingThickness: 1.8,
    innerRingThickness: 0.8,
    ringGap: 2.0,
    centerAreaDiameter: 0,
    cornerRadius: 4,
    rings: 2,
  },
  rectangle: {
    label: "Rectangle",
    shape: "rectangle",
    outerDiameter: 50,
    width: 72,
    height: 34,
    outerRingThickness: 1.4,
    innerRingThickness: 0.6,
    ringGap: 2.0,
    centerAreaDiameter: 0,
    cornerRadius: 4,
    rings: 2,
  },
  square: {
    label: "Square",
    shape: "rectangle",
    outerDiameter: 44,
    width: 44,
    height: 44,
    outerRingThickness: 1.6,
    innerRingThickness: 0,
    ringGap: 0,
    centerAreaDiameter: 0,
    cornerRadius: 8,
    rings: 1,
  },
  minimalCircle: {
    label: "Minimal",
    shape: "circle",
    outerDiameter: 38,
    width: 38,
    height: 38,
    outerRingThickness: 1.1,
    innerRingThickness: 0,
    ringGap: 0,
    centerAreaDiameter: 0,
    cornerRadius: 3,
    rings: 1,
  },
  saudiCorporate: {
    label: "Saudi CO.",
    shape: "oval",
    outerDiameter: 46,
    width: 62,
    height: 38,
    outerRingThickness: 1.6,
    innerRingThickness: 0.8,
    innerRing2Thickness: 0.5,
    ringGap: 2.0,
    centerAreaDiameter: 0,
    cornerRadius: 4,
    rings: 3,
  },
};

export function templateLayers(name) {
  if (name === "rectangle") {
    return [
      makeLayer({
        name: "Shape",
        text: "COMPANY NAME",
        font: "Noto Sans",
        weight: 900,
        sizeMm: 4,
        letterSpacing: 1.5,
        mode: "straight",
        offsetYmm: -7,
      }),
      makeLayer({
        name: "Shape",
        text: "City · Country",
        font: "Noto Sans",
        sizeMm: 3,
        mode: "straight",
        offsetYmm: 0,
      }),
      makeLayer({
        name: "Shape",
        text: "info@company.com",
        font: "Noto Sans",
        sizeMm: 2.8,
        mode: "straight",
        offsetYmm: 7,
      }),
    ];
  }
  if (name === "square") {
    return [
      makeLayer({
        name: "Shape",
        text: "APPROVED",
        font: "Noto Sans",
        weight: 900,
        sizeMm: 4.5,
        letterSpacing: 1,
        mode: "straight",
        offsetYmm: -3,
      }),
      makeLayer({
        name: "Shape",
        text: "موافق عليه",
        font: "Noto Sans Arabic",
        dir: "rtl",
        sizeMm: 3.5,
        mode: "straight",
        offsetYmm: 5,
      }),
    ];
  }
  if (name === "minimalCircle") {
    return [
      makeLayer({
        name: "Shape",
        text: "COMPANY NAME",
        font: "Noto Sans",
        weight: 800,
        sizeMm: 3.2,
        letterSpacing: 2,
        mode: "curved",
        flip: false,
        radiusMm: 14,
        startAngle: 210,
        endAngle: 330,
      }),
      makeLayer({
        name: "Shape",
        text: "CN",
        font: "Playfair Display",
        weight: 800,
        sizeMm: 7,
        mode: "straight",
      }),
    ];
  }
  const ls = defaultLayers();
  if (name === "oval") {
    ls[0].radiusMm = 28.0;
    ls[1].radiusMm = 27.5;
    ls[0].startAngle = 195;
    ls[0].endAngle = 345;
    ls[1].startAngle = 150;
    ls[1].endAngle = 30;
  }
  if (name === "tripleRing") {
    ls[0].radiusMm = 19.5;
    ls[1].radiusMm = 19;
  }
  if (name === "standardCircle") {
    ls[0].radiusMm = 15;
    ls[1].radiusMm = 14.8;
  }
  if (name === "saudiCorporate") {
    return [
      makeLayer({
        name: "Shape",
        text: "بصمة التاسعة المحدودة",
        font: "Noto Sans Arabic",
        weight: 800,
        dir: "rtl",
        sizeMm: 4.5,
        letterSpacing: 0.8,
        mode: "curved",
        flip: false,
        radiusMm: 27,
        startAngle: 200,
        endAngle: 340,
      }),
      makeLayer({
        name: "Shape",
        text: "ب.ت. ٩٠٥٢٣٣٠٧٧",
        font: "Noto Sans Arabic",
        weight: 800,
        dir: "rtl",
        sizeMm: 3.8,
        letterSpacing: 0.5,
        mode: "curved",
        flip: true,
        radiusMm: 26.5,
        startAngle: 200,
        endAngle: 340,
      }),
      makeLayer({
        name: "Shape",
        text: "★",
        font: "Noto Sans",
        weight: 700,
        sizeMm: 3.5,
        mode: "straight",
        offsetXmm: -17,
        offsetYmm: 0,
      }),
      makeLayer({
        name: "Shape",
        text: "★",
        font: "Noto Sans",
        weight: 700,
        sizeMm: 3.5,
        mode: "straight",
        offsetXmm: 17,
        offsetYmm: 0,
      }),
      makeLayer({
        name: "Shape",
        text: "✪",
        font: "Noto Sans",
        weight: 900,
        sizeMm: 10,
        mode: "straight",
        offsetXmm: 0,
        offsetYmm: 0,
      }),
    ];
  }
  return ls;
}

export function buildConfig(name) {
  const t = TEMPLATES[name] || TEMPLATES.doubleRing;
  return Object.assign({}, baseStyle(), {
    template: name,
    shape: t.shape,
    outerDiameter: t.outerDiameter,
    width: t.width,
    height: t.height,
    outerRingThickness: t.outerRingThickness,
    innerRingThickness: t.innerRingThickness,
    innerRing2Thickness: t.innerRing2Thickness || t.innerRingThickness * 0.8,
    ringGap: t.ringGap,
    centerAreaDiameter: t.centerAreaDiameter,
    cornerRadius: t.cornerRadius,
    rings: t.rings,
    shapeOffsetXmm: 0,
    shapeOffsetYmm: 0,
    layers: templateLayers(name),
    editorZoom: 0.75,
    editorPanX: 0,
    editorPanY: 0,
  });
}

/* Current stamp dimensions in mm. Circles read `outerDiameter`;
   oval/rectangle read `width`/`height`. */
export const stampSize = () =>
  cfg.shape === "circle"
    ? { w: cfg.outerDiameter, h: cfg.outerDiameter }
    : { w: cfg.width, h: cfg.height };

/* ── Color swatches ────────────────────────────────────────────── */
export const SWATCHES = ["#1e3a8a", "#c0182a", "#15171c", "#1f7a45"];

/* ================================================================
   LIVE STATE
   ================================================================ */
export let cfg = buildConfig("oval");
export let selId = cfg.layers[0].id;
export let selectedIds = new Set([selId]);

/* Selection is an ephemeral editor concern. ES module live bindings are
   read-only to importers, so the core app must go through this setter. */
export function setSelection(id, ids) {
  selId = id;
  selectedIds = ids || new Set(id != null ? [id] : []);
}

/* ── localStorage persistence ──────────────────────────────────── */
export const STORAGE_KEY = "prostampstudio_config";

export function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch (_) {
    /* quota exceeded, ignore */
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return false;
    cfg = buildConfig(data.template || "oval");
    Object.assign(cfg, data);
    if (!Array.isArray(cfg.layers) || cfg.layers.length === 0)
      cfg.layers = defaultLayers();
    cfg.layers = cfg.layers.map((l) => makeLayer(l));
    DPI_CURRENT = cfg.dpi || 300;
    selId = cfg.layers[0].id;
    selectedIds = new Set([selId]);
    return true;
  } catch {
    return false;
  }
}
