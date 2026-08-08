"use strict";
/* ================================================================
   PRO STAMP STUDIO — js/app.js
   Central controller: wires the extracted engine modules
   (state / renderer / inspector / export) to the DOM.

     • state.js      — cfg model, seeded RNG, history, persistence
     • renderer.js   — canvas drawing (render / renderD)
     • inspector.js  — context-sensitive panel markup builders
     • export.js     — PNG / SVG export + download

   All event bindings live here as delegated listeners on
   `document`, so per-element wiring is never scattered across the
   engine modules.
   ================================================================ */

import * as S from "./state.js";
import * as R from "./renderer.js";
import * as I from "./inspector.js";
import * as E from "./export.js";

/* ── DOM helpers ───────────────────────────────────────────────── */
const $ = (sel) => document.querySelector(sel);
const esc = (s) =>
  String(s == null ? "" : s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

let toastTimer = null;
function showToast(msg) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
}

/* ── Ephemeral editor state (not persisted) ────────────────────── */
let showEffects = false; // FX sub-view in the editor panel
let selShape = false; // stamp shape / ring selection (canvas clicks)
let selRing = null; // "outer" | "inner" | "inner2"
let guideLines = []; // ephemeral alignment guides

/* ── Runtime lifecycle wiring ──────────────────────────────────── */
S.setStateObserver(syncUI);
E.setExportRuntime({ render: () => R.render(), showToast });

R.setEditorContext({
  get exporting() {
    return E.exporting;
  },
  get guideLines() {
    return guideLines;
  },
  get selShape() {
    return selShape;
  },
  get selRing() {
    return selRing;
  },
  get selId() {
    return S.selId;
  },
  get selectedIds() {
    return S.selectedIds;
  },
});

I.setEditorState({
  get selLayer() {
    return selLayer();
  },
  get showEffects() {
    return showEffects;
  },
  get selShape() {
    return selShape;
  },
  get selRing() {
    return selRing;
  },
});

/* ── Global controller surface for the inspector module ──────────
   renderRightEditorPanel() reads window.stampApp.selId to resolve the
   selected layer, and the layer manager uses the same handle. */
window.stampApp = {
  get selId() {
    return S.selId;
  },
  get selectedIds() {
    return S.selectedIds;
  },
  get cfg() {
    return S.cfg;
  },
  makeLayer: S.makeLayer,
  setSelection: S.setSelection,
  pushHistory: S.pushHistory,
  undo: S.undo,
  redo: S.redo,
  syncUI: syncUI,
  render: typeof R.renderD !== "undefined" ? R.renderD : () => {},
};

/* ── syncUI ────────────────────────────────────────────────────── */
function syncUI() {
  const leftHTML = I.renderLeftSidebar();
  I.renderRightEditorPanel(leftHTML);
  R.renderD();
}

/* ── Layer helpers ─────────────────────────────────────────────── */
const selLayer = () =>
  S.cfg.layers.find((l) => l.id === S.selId) || null;

function addLayer(o) {
  const l = S.makeLayer(o);
  S.cfg.layers.push(l);
  S.setSelection(l.id);
  selShape = false;
  selRing = null;
  showEffects = false;
  S.pushHistory();
  syncUI();
}

function applyTemplate(name) {
  if (!S.TEMPLATES[name]) return;
  const next = S.buildConfig(name);
  next.inkColor = S.cfg.inkColor;
  S.setConfig(next);
  S.setSelection(next.layers[0].id);
  selShape = false;
  selRing = null;
  showEffects = false;
  S.pushHistory();
  syncUI();
  showToast("Template: " + name);
}

function resetDocument() {
  applyTemplate(S.cfg.template || "oval");
  showToast("Stamp reset");
}

function selectRelative(delta) {
  const ls = S.cfg.layers;
  if (!ls.length) return;
  let idx = ls.findIndex((l) => l.id === S.selId);
  if (idx < 0) idx = 0;
  idx = (idx + delta + ls.length) % ls.length;
  S.setSelection(ls[idx].id);
  selShape = false;
  selRing = null;
  showEffects = false;
  syncUI();
}

/* ── Property updates (unified data-attribute pipeline) ────────── */
const LAYER_KEYS = new Set([
  "text", "name", "font", "weight", "mode", "dir", "flip",
  "sizeMm", "letterSpacing", "wordSpacing", "scaleX", "scaleY",
  "radiusMm", "startAngle", "endAngle", "offsetXmm", "offsetYmm",
  "shapeType", "shapeSizeMm", "shapeRotation", "shapeFill",
  "imageWidthMm", "imageHeightMm",
]);

const STRING_KEYS = new Set([
  "text", "name", "font", "mode", "dir", "shapeType",
]);

function coerce(key, raw, input) {
  if (input.type === "checkbox") return input.checked;
  if (STRING_KEYS.has(key)) return raw;
  const n = parseFloat(raw);
  return Number.isNaN(n) ? raw : n;
}

function applyStampKey(key, val) {
  switch (key) {
    case "size":
      if (S.cfg.shape === "circle") S.cfg.outerDiameter = val;
      else S.cfg.width = val;
      break;
    case "height":
      S.cfg.height = val;
      break;
    case "thickness": {
      S.cfg.outerRingThickness = val;
      if (S.cfg.rings >= 2) S.cfg.innerRingThickness = val;
      if (S.cfg.rings >= 3) S.cfg.innerRing2Thickness = val;
      break;
    }
    case "offsetX":
      S.cfg.shapeOffsetXmm = val;
      break;
    case "offsetY":
      S.cfg.shapeOffsetYmm = val;
      break;
    case "outerRingThickness":
    case "innerRingThickness":
    case "innerRing2Thickness": {
      S.cfg[key] = val;
      const rIdx = key === "outerRingThickness" ? "1" : key === "innerRingThickness" ? "2" : "3";
      const el = document.querySelector(`[data-rng-val="${rIdx}"]`);
      if (el) el.textContent = String(Math.round(val * 10) / 10);
      break;
    }
    default:
      S.cfg[key] = val;
  }
}

function applyValue(t) {
  const key = t.dataset.ls;
  const val = coerce(key, t.value, t);
  const l = selLayer();
  if (
    l &&
    LAYER_KEYS.has(key) &&
    key !== "offsetX" &&
    key !== "offsetY"
  ) {
    l[key] = val;
  } else {
    applyStampKey(key, val);
  }
}

const RING_IDX = { outer: "1", inner: "2", inner2: "3" };
function setRingWidth(key, val) {
  if (key === "outer") S.cfg.outerRingThickness = val;
  else if (key === "inner") S.cfg.innerRingThickness = val;
  else if (key === "inner2") S.cfg.innerRing2Thickness = val;
  const el = document.querySelector(`[data-rng-val="${RING_IDX[key]}"]`);
  if (el) el.textContent = String(Math.round(val * 10) / 10);
}

function syncPair(t) {
  const row = t.closest(".slider-row");
  if (!row) return;
  row.querySelectorAll("input").forEach((el) => {
    if (el !== t && (el.type === "range" || el.type === "number"))
      el.value = t.value;
  });
}

function syncInkUI() {
  const hex = $("#inkColorHex");
  const picker = $("#inkColorPicker");
  if (hex) hex.textContent = S.cfg.inkColor;
  if (picker) picker.value = S.cfg.inkColor;
}

function applyBind(t, bind) {
  if (bind === "inkColor") {
    S.cfg.inkColor = t.value;
    syncInkUI();
  } else if (bind === "dpi") {
    S.cfg.dpi = parseInt(t.value, 10) || 300;
    S.setConfig(S.cfg); // keeps DPI_CURRENT in sync
  }
}

/* History: range drags are debounced so a single drag doesn't flood
   the 60-slot stack; every other input commits immediately. */
let histTimer = null;
function scheduleHist() {
  clearTimeout(histTimer);
  histTimer = setTimeout(() => S.pushHistory(), 400);
}

/* ── Delegated input listener ──────────────────────────────────── */
document.addEventListener("input", (e) => {
  const t = e.target;
  if (!t || t.nodeType !== 1) return;
  const tag = t.tagName;
  if (tag !== "INPUT" && tag !== "SELECT" && tag !== "TEXTAREA") return;

  const ds = t.dataset;
  if (ds.ls) {
    applyValue(t);
    syncPair(t);
  } else if (ds.lsColor !== undefined) {
    const l = selLayer();
    if (l) l.color = t.value;
  } else if (ds.lsRing) {
    S.cfg.ringColors[ds.lsRing] = t.value;
  } else if (ds.rngWidth) {
    setRingWidth(ds.rngWidth, parseFloat(t.value));
    syncPair(t);
  } else if (ds.rngGap !== undefined) {
    S.cfg.ringGap = parseFloat(t.value);
    syncPair(t);
  } else if (ds.bind) {
    applyBind(t, ds.bind);
  } else if (ds.eff) {
    S.cfg[ds.eff] = t.checked;
  } else {
    return;
  }

  if (t.type === "range") scheduleHist();
  else S.pushHistory();
  R.renderD();
});

/* ── Align & snap ──────────────────────────────────────────────── */
function alignSelection(which) {
  const l = selLayer();
  if (!l) return;
  switch (which) {
    case "centerH":
    case "left":
    case "right":
      l.offsetXmm = 0;
      break;
    case "centerV":
    case "top":
    case "bottom":
      l.offsetYmm = 0;
      break;
  }
}

function snapToRing(channel) {
  const l = selLayer();
  if (!l || l.mode !== "curved") return;
  const sz = S.stampSize();
  const c = S.cfg;
  const sRx = sz.w / 2;
  if (channel === "outer") {
    l.radiusMm = Math.max(2, sRx - (c.outerRingThickness || 0) / 2);
  } else if (channel === "inner") {
    l.radiusMm = Math.max(
      2,
      (c.centerAreaDiameter || 0) / 2 +
        ((c.innerRing2Thickness || c.innerRingThickness || 0) / 2),
    );
  } else {
    l.radiusMm = Math.max(2, (c.centerAreaDiameter || 0) / 2);
  }
}

/* ── Zoom / view ───────────────────────────────────────────────── */
function applyZoom() {
  const stage = $("#stage");
  if (!stage) return;
  const z = S.cfg.editorZoom;
  const px = S.cfg.editorPanX || 0;
  const py = S.cfg.editorPanY || 0;
  stage.style.transform = `translate(${px}px, ${py}px) scale(${z})`;
  const read = $("#zoomRead");
  if (read) read.textContent = Math.round(z * 100) + "%";
}

function zoomBy(f) {
  S.cfg.editorZoom = S.clamp(S.cfg.editorZoom * f, 0.1, 8);
  applyZoom();
}

function zoomReset() {
  S.cfg.editorZoom = 1;
  S.cfg.editorPanX = 0;
  S.cfg.editorPanY = 0;
  applyZoom();
}

function fitView() {
  const vp = $("#viewport");
  if (!vp) return;
  const sz = S.stampSize();
  const w = sz.w * S.CSS_MM;
  const h = sz.h * S.CSS_MM;
  S.cfg.editorZoom = S.clamp(
    Math.min(vp.clientWidth / w, vp.clientHeight / h) * 0.92,
    0.05,
    4,
  );
  S.cfg.editorPanX = 0;
  S.cfg.editorPanY = 0;
  applyZoom();
}

/* ── Panels & overlay toggles ──────────────────────────────────── */
function rightPanelVisible() {
  const p = $("#rightEditorPanel");
  return p ? p.style.display !== "none" : false;
}

function setRightPanel(on) {
  const p = $("#rightEditorPanel");
  if (p) p.style.display = on ? "" : "none";
  const tg = $("#rightPanelToggle");
  if (tg) tg.setAttribute("aria-pressed", String(on));
}

function toggleSidebar() {
  const wa = document.querySelector(".work-area");
  if (wa) wa.classList.toggle("sidebar-collapsed");
}

function toggleShortcuts() {
  const ov = $("#shortcutsOverlay");
  if (!ov) return;
  ov.style.display = ov.style.display === "flex" ? "none" : "flex";
}

/* ── Presets & config import/export ────────────────────────────── */
const PRESETS_KEY = "prostampstudio_presets";
const loadPresets = () => {
  try {
    return JSON.parse(localStorage.getItem(PRESETS_KEY)) || [];
  } catch {
    return [];
  }
};
const savePresets = (list) => {
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(list));
  } catch {
    /* storage full — ignore */
  }
};

function rebuildPresetsList() {
  const el = $("#presetsList");
  if (!el) return;
  const list = loadPresets();
  el.innerHTML = list.length
    ? list
        .map(
          (p, i) =>
            `<div class="tb-preset-item" data-preset="${i}">${esc(p.name)}</div>`,
        )
        .join("")
    : `<div class="tb-preset-item" style="opacity:.5">No presets yet</div>`;
}

function applyPreset(i) {
  const p = loadPresets()[i];
  if (!p) return;
  try {
    const data = JSON.parse(p.json);
    const next = S.buildConfig(data.template || "oval");
    Object.assign(next, data);
    next.layers = (data.layers || []).map((l) => S.makeLayer(l));
    S.setConfig(next);
    S.setSelection(next.layers[0].id);
    S.pushHistory();
    syncUI();
    toggleExportMenu(false);
    showToast("Preset loaded");
  } catch {
    showToast("Invalid preset");
  }
}

function savePreset() {
  const name = prompt("Preset name:", S.cfg.template);
  if (!name) return;
  const list = loadPresets();
  list.push({ name, json: JSON.stringify(S.cfg) });
  savePresets(list);
  rebuildPresetsList();
  showToast("Preset saved");
}

function managePresets() {
  const list = loadPresets();
  if (!list.length) {
    showToast("No presets saved yet");
    return;
  }
  const pick = prompt(
    "Remove a preset by typing its name (Cancel to keep all):\n" +
      list.map((p) => "- " + p.name).join("\n"),
  );
  if (!pick) return;
  savePresets(list.filter((p) => p.name !== pick));
  rebuildPresetsList();
  showToast("Preset removed");
}

function exportConfig() {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(S.cfg, null, 2)], {
      type: "application/json",
    }),
  );
  E.download(url, "stamp-config.json", true);
  showToast("Config exported");
}

function importConfigFile(file) {
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const data = JSON.parse(fr.result);
      const next = S.buildConfig(data.template || "oval");
      Object.assign(next, data);
      if (!Array.isArray(next.layers) || !next.layers.length)
        next.layers = S.defaultLayers();
      next.layers = next.layers.map((l) => S.makeLayer(l));
      S.setConfig(next);
      S.setSelection(next.layers[0].id);
      S.pushHistory();
      syncUI();
      showToast("Config imported");
    } catch {
      showToast("Invalid config file");
    }
  };
  fr.readAsText(file);
}

/* ── Export dropdown ───────────────────────────────────────────── */
function toggleExportMenu(force) {
  const m = $("#exportMenu");
  if (!m) return;
  const open = force !== undefined ? force : m.style.display !== "block";
  m.style.display = open ? "block" : "none";
}

const ACTIONS = {
  saveProject: () => {
    S.saveState();
    showToast("Project saved");
  },
  save: savePreset,
  exportConfig,
  importConfig: () => {
    const f = $("#importConfigFile");
    if (f) f.click();
  },
  manage: managePresets,
  pngTransparent: () => E.exportPNG(false),
  pngWhite: () => E.exportPNG(true),
  svgExport: () => E.exportSVG(),
};

document.addEventListener("click", (e) => {
  if (e.target.closest("#exportDropdown")) {
    e.stopPropagation();
    toggleExportMenu();
    return;
  }
  if (e.target.closest("#tbExport")) {
    const item = e.target.closest("[data-action]");
    if (item) {
      const fn = ACTIONS[item.dataset.action];
      if (fn) fn();
      toggleExportMenu(false);
    }
    return;
  }
  toggleExportMenu(false);
});

/* ── Delegated click listeners ─────────────────────────────────── */
document.addEventListener("click", (e) => {
  const t = e.target;
  if (!t || t.nodeType !== 1) return;

  const stepBtn = e.target.closest(".manual-step-down, .manual-step-up");
  if (stepBtn) {
    const stepDelta = parseFloat(stepBtn.dataset.step);
    const row = stepBtn.closest(".compact-row");
    const input = row ? row.querySelector(".scrubbable-input") : null;
    if (input) {
      let n = Math.round(((parseFloat(input.value) || 0) + stepDelta) * 100) / 100;
      const min = parseFloat(input.min), max = parseFloat(input.max);
      if (!isNaN(min) && n < min) n = min;
      if (!isNaN(max) && n > max) n = max;
      input.value = n;
      applyValue(input);
      S.pushHistory();
      syncUI();
    }
    return;
  }

  const act = t.closest("[data-act]");
  if (act) return; // reserved for layer-list controls

  const vis = t.closest("[data-rng-vis]");
  if (vis) {
    const key = vis.dataset.rngVis;
    S.cfg.ringVisible[key] = !(S.cfg.ringVisible[key] ?? true);
    S.pushHistory();
    syncUI();
    return;
  }

  const clr = t.closest("[data-ls-ring-clear],[data-ls-color-clear]");
  if (clr) {
    if (clr.dataset.lsRingClear !== undefined)
      S.cfg.ringColors[clr.dataset.lsRingClear] = null;
    else {
      const l = selLayer();
      if (l) l.color = null;
    }
    S.pushHistory();
    syncUI();
    return;
  }

  const al = t.closest("[data-align]");
  if (al) {
    alignSelection(al.dataset.align);
    S.pushHistory();
    syncUI();
    return;
  }

  const snap = t.closest("[data-snap]");
  if (snap) {
    snapToRing(snap.dataset.snap);
    S.pushHistory();
    syncUI();
    return;
  }

  const sw = t.closest("[data-color]");
  if (sw) {
    S.cfg.inkColor = sw.dataset.color;
    syncInkUI();
    S.pushHistory();
    R.renderD();
    return;
  }

  const tpl = t.closest("[data-template]");
  if (tpl) {
    applyTemplate(tpl.dataset.template);
    return;
  }

  const shape = t.closest("[data-add-shape]");
  if (shape) {
    addLayer({ type: "shape", name: "NEW SHAPE", shapeType: shape.dataset.addShape });
    return;
  }

  const preset = t.closest("[data-preset]");
  if (preset) {
    applyPreset(parseInt(preset.dataset.preset, 10));
    return;
  }

  const head = t.closest(".ts-head");
  if (head) {
    head.closest(".ts-section")?.classList.toggle("ts-collapsed");
    return;
  }
});

/* Topbar chips + panel buttons */
document.addEventListener("click", (e) => {
  const t = e.target;
  if (!t || t.nodeType !== 1) return;

  const id = t.closest("button, .tb-preset-item")?.id;
  const idBtn = t.closest("[id]");

  const uid = idBtn ? idBtn.id : id;
  if (!uid) return;

  switch (uid) {
    case "undoBtn":
    case "repUndoBtn":
      S.undo();
      break;
    case "redoBtn":
    case "repRedoBtn":
      S.redo();
      break;
    case "resetBtn":
      resetDocument();
      break;
    case "helpBtn":
      toggleShortcuts();
      break;
    case "saveBtn":
      S.saveState();
      showToast("Project saved");
      break;
    case "presetsDropdown":
      toggleExportMenu();
      break;
    case "addCurved":
      addLayer({ name: "NEW TEXT", text: "NEW TEXT", mode: "curved" });
      break;
    case "addLine":
      addLayer({ name: "NEW LINE", text: "NEW LINE", mode: "straight", offsetYmm: 6 });
      break;
    case "addShape":
      addLayer({ type: "shape", name: "NEW SHAPE", shapeType: "star" });
      break;
    case "importLogo":
      showToast("Import image: select a PNG/JPG file");
      break;
    case "repPrevLayer":
      selectRelative(-1);
      break;
    case "repNextLayer":
      selectRelative(1);
      break;
    case "rightPanelClose":
      setRightPanel(false);
      break;
    case "rightPanelToggle":
      setRightPanel(!rightPanelVisible());
      break;
    case "sidebarToggle":
      toggleSidebar();
      break;
    case "effectsBackBtn":
      showEffects = false;
      syncUI();
      break;
    case "zoomOut":
      zoomBy(1 / 1.15);
      break;
    case "zoomIn":
      zoomBy(1.15);
      break;
    case "zoomFit":
      fitView();
      break;
    case "zoom100":
      zoomReset();
      break;
    case "zoomReset":
      zoomReset();
      break;
    case "zoomHalf":
      S.cfg.editorZoom = 0.5;
      applyZoom();
      break;
    case "shortcutsClose":
      toggleShortcuts();
      break;
  }
});

/* ── Inspector tab toggles + sidebar add-layer actions ─────────── */
document.addEventListener("click", (e) => {
  // Handle official sizing preset chips (instant canvas boundary scale).
  const presetBtn = e.target.closest("[data-preset]");
  if (presetBtn) {
    const spec = S.OFFICIAL_PRESETS[presetBtn.dataset.preset];
    if (spec) {
      const c = S.cfg;
      if (spec.type === "circle") {
        c.shape = "circle";
        c.outerDiameter = spec.widthMm;
      } else {
        c.shape = spec.type; // "oval" | "rectangle"
        c.width = spec.widthMm;
        c.height = spec.heightMm;
      }
      selShape = false;
      selRing = null;
      S.pushHistory();
      syncUI();
      showToast("Preset: " + spec.name);
    }
    return;
  }

  // Handle tab toggles (Layers / Selection / Stamp Canvas).
  const tabBtn = e.target.closest("[data-tab-target]");
  if (tabBtn) {
    if (!S.cfg.viewState) S.cfg.viewState = {};
    S.cfg.viewState.activeTab = tabBtn.dataset.tabTarget;

    // Re-render only the inspector layout block.
    I.renderRightEditorPanel();
    return;
  }

  // Handle the sidebar "Add Composition Channels" stack.
  const addBtn = e.target.closest(
    "#add-text-straight-btn, #add-text-curved-btn, #add-shape-btn, #add-image-btn",
  );
  if (addBtn) {
    let newLayerType = "text";
    let subMode = "straight";

    if (addBtn.id === "add-text-curved-btn") subMode = "curved";
    if (addBtn.id === "add-shape-btn") newLayerType = "shape";
    if (addBtn.id === "add-image-btn") newLayerType = "image";

    // Switch view cleanly to selection adjustments instantly.
    if (!S.cfg.viewState) S.cfg.viewState = {};
    S.cfg.viewState.activeTab = "selection";

    if (newLayerType === "shape") {
      addLayer({ type: "shape", name: "NEW SHAPE", shapeType: "star" });
    } else if (newLayerType === "image") {
      addLayer({ type: "image", name: "NEW IMAGE" });
    } else {
      addLayer({
        name: subMode === "curved" ? "NEW TEXT" : "NEW LINE",
        text: subMode === "curved" ? "NEW TEXT" : "NEW LINE",
        mode: subMode,
        offsetYmm: subMode === "straight" ? 6 : 0,
      });
    }
  }
});

/* ── Keyboard shortcuts ────────────────────────────────────────── */
document.addEventListener("keydown", (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && (e.key === "z" || e.key === "Z")) {
    e.preventDefault();
    if (e.shiftKey) S.redo();
    else S.undo();
    return;
  }
  if (mod && (e.key === "y" || e.key === "Y")) {
    e.preventDefault();
    S.redo();
    return;
  }
  if (mod && (e.key === "s" || e.key === "S")) {
    e.preventDefault();
    S.saveState();
    showToast("Project saved");
    return;
  }
  const tag = (e.target && e.target.tagName) || "";
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  switch (e.key) {
    case "+":
    case "=":
      zoomBy(1.1);
      break;
    case "-":
    case "_":
      zoomBy(1 / 1.1);
      break;
    case "0":
      zoomReset();
      break;
    case "f":
    case "F":
      fitView();
      break;
    case "g":
    case "G": {
      const g = $("#showGuides");
      if (g) g.checked = !g.checked;
      R.renderD();
      break;
    }
    case "[":
      toggleSidebar();
      break;
    case "]":
      setRightPanel(!rightPanelVisible());
      break;
    case "?":
      toggleShortcuts();
      break;
  }
});

/* ── Canvas interaction: click-to-select & drag-to-move ──────────
   Isolated handler set, written from scratch. Layers in this codebase
   have no x/y/width/height — they are positioned by offsetXmm/offsetYmm
   around the stamp centre and sized in mm, so bounds are derived from
   the same mm→px math renderer.js uses (mmPx). Selection uses a
   point-in-bounding-box test (top-most layer first). */
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let initialOffsetXmm = 0;
let initialOffsetYmm = 0;
let isScaling = false;
let activeScaleHandle = null;
let scaleStart = null;

const canvasEl = $("#stampCanvas");

function layerCenterPx(layer) {
  const w = canvasEl.width;
  const h = canvasEl.height;
  const cx = w / 2 + S.mmPx(S.cfg.shapeOffsetXmm || 0);
  const cy = h / 2 + S.mmPx(S.cfg.shapeOffsetYmm || 0);
  return {
    x: cx + S.mmPx(layer.offsetXmm || 0),
    y: cy + S.mmPx(layer.offsetYmm || 0),
  };
}

function layerBoundsPx(layer) {
  const c = layerCenterPx(layer);
  if (layer.type === "image") {
    const hw = S.mmPx(layer.imageWidthMm || 10) / 2;
    const hh = S.mmPx(layer.imageHeightMm || 10) / 2;
    return { x: c.x - hw, y: c.y - hh, w: hw * 2, h: hh * 2 };
  }
  if (layer.type === "shape") {
    const r = (S.mmPx(layer.shapeSizeMm || 10) / 2) * 1.35;
    return { x: c.x - r, y: c.y - r, w: r * 2, h: r * 2 };
  }
  if (layer.mode === "straight") {
    const fs = S.mmPx(layer.sizeMm || 4) * (layer.scaleY || 1);
    const approxW =
      S.mmPx(layer.sizeMm || 4) *
      (layer.scaleX || 1) *
      (layer.text || " ").length *
      0.62;
    const hw = Math.max(fs * 0.6, approxW) / 2;
    const hh = fs * 0.75;
    return { x: c.x - hw, y: c.y - hh, w: hw * 2, h: hh * 2 };
  }
  // Curved text traces an elliptical arc at radiusMm (± half cap height).
  const sz = S.stampSize();
  const sRx = sz.w / 2;
  const sRy = sz.h / 2;
  const r = layer.radiusMm || 16;
  const rx = S.mmPx(r);
  const ry = S.cfg.shape === "oval" && sRx > 0 ? S.mmPx(r * (sRy / sRx)) : rx;
  const cap = S.mmPx((layer.sizeMm || 4) / 2);
  return {
    cx: c.x,
    cy: c.y,
    rx,
    ry,
    cap,
    start: layer.startAngle || 0,
    end: layer.endAngle || 0,
  };
}

function hitTestLayer(layer, px, py) {
  const b = layerBoundsPx(layer);
  if (b.rx !== undefined) {
    // Normalize onto a unit circle so the elliptical arc is hit-tested
    // exactly like the renderer's cos/sin parameterization.
    const dx = (px - b.cx) / b.rx;
    const dy = (py - b.cy) / b.ry;
    const nd = Math.hypot(dx, dy);
    const nInner = Math.max(0, 1 - b.cap / b.rx);
    const nOuter = 1 + b.cap / b.rx;
    if (nd < nInner || nd > nOuter) return false;
    const a = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
    const s = ((b.start % 360) + 360) % 360;
    const e = ((b.end % 360) + 360) % 360;
    const span = (e - s + 360) % 360;
    if (span >= 360) return true;
    return (a - s + 360) % 360 <= span;
  }
  return px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
}

// Match a click against the active layer's corner scale handles.
// Uses the same transform box the renderer draws so the grab region
// lines up exactly with the on-canvas anchor nodes.
const checkScaleHandles = (clickX, clickY, layer) => {
  const box = R.transformBoxPx(layer);
  const padding = 6;
  const lx = box.x - padding;
  const ly = box.y - padding;
  const lw = box.w + padding * 2;
  const lh = box.h + padding * 2;

  // Match if click is near the bottom-right corner node ('se')
  if (Math.abs(clickX - (lx + lw)) < 12 && Math.abs(clickY - (ly + lh)) < 12) {
    return "se";
  }
  return null;
};

if (canvasEl) {
  canvasEl.addEventListener("mousedown", (e) => {
    const rect = canvasEl.getBoundingClientRect();
    // Convert click coordinates to canvas matrix coordinates.
    const clickX = (e.clientX - rect.left) * (canvasEl.width / rect.width);
    const clickY = (e.clientY - rect.top) * (canvasEl.height / rect.height);

    isScaling = false;
    activeScaleHandle = null;
    scaleStart = null;

    // Scale-handle grab takes priority over translation: only the
    // currently selected layer's corner anchors are actionable.
    const currentSel =
      S.cfg.layers.find((l) => l.id === S.selId) || null;
    const grabHandle = currentSel
      ? checkScaleHandles(clickX, clickY, currentSel)
      : null;
    if (grabHandle) {
      S.setSelection(currentSel.id);
      selShape = false;
      selRing = null;
      isScaling = true;
      activeScaleHandle = grabHandle;
      dragStartX = clickX;
      dragStartY = clickY;
      const sb = R.transformBoxPx(currentSel);
      scaleStart = {
        wPx: sb.w,
        hPx: sb.h,
        imageWidthMm: currentSel.imageWidthMm || 10,
        imageHeightMm: currentSel.imageHeightMm || 10,
        shapeSizeMm: currentSel.shapeSizeMm || 10,
        sizeMm: currentSel.sizeMm || 4,
      };
      syncUI();
      return;
    }

    // Loop through layers backward (top-most layer first).
    const layers = S.cfg.layers || [];
    let foundId = null;
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i];
      if (!layer.visible) continue;
      if (hitTestLayer(layer, clickX, clickY)) {
        foundId = layer.id;
        break;
      }
    }
    if (foundId === null) return;

    S.setSelection(foundId);
    selShape = false;
    selRing = null;
    const active = layers.find((l) => l.id === foundId);
    if (!active) return;

    isDragging = true;
    dragStartX = clickX;
    dragStartY = clickY;
    initialOffsetXmm = active.offsetXmm || 0;
    initialOffsetYmm = active.offsetYmm || 0;
    syncUI();
  });

  canvasEl.addEventListener("mousemove", (e) => {
    if (!isDragging && !isScaling) return;
    const rect = canvasEl.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) * (canvasEl.width / rect.width);
    const clickY = (e.clientY - rect.top) * (canvasEl.height / rect.height);

    const mmPerPx = 25.4 / S.DPI_CURRENT;

    // Scale path: convert px → mm and adjust the per-type dimension.
    if (isScaling) {
      const active = S.cfg.layers.find((l) => l.id === S.selId);
      if (!active || !scaleStart) {
        isScaling = false;
        activeScaleHandle = null;
        return;
      }
      const newWpx = Math.max(8, scaleStart.wPx + (clickX - dragStartX));
      const factor = scaleStart.wPx > 0 ? newWpx / scaleStart.wPx : 1;
      if (active.type === "image") {
        active.imageWidthMm = Math.max(1, scaleStart.imageWidthMm * factor);
        active.imageHeightMm = Math.max(1, scaleStart.imageHeightMm * factor);
      } else if (active.type === "shape") {
        active.shapeSizeMm = Math.max(1, scaleStart.shapeSizeMm * factor);
      } else {
        active.sizeMm = Math.max(0.5, scaleStart.sizeMm * factor);
      }
      R.renderD(); // rapid canvas updates during scale dragging
      return;
    }

    const dxPx = clickX - dragStartX;
    const dyPx = clickY - dragStartY;
    const active = S.cfg.layers.find((l) => l.id === S.selId);
    if (!active) return;

    // px → mm so the stored position matches the render model.
    active.offsetXmm = +(initialOffsetXmm + dxPx * mmPerPx).toFixed(3);
    active.offsetYmm = +(initialOffsetYmm + dyPx * mmPerPx).toFixed(3);
    R.renderD(); // rapid canvas updates during translation dragging
  });

  window.addEventListener("mouseup", () => {
    if (isScaling) {
      isScaling = false;
      activeScaleHandle = null;
      scaleStart = null;
      S.pushHistory(); // capture a stable history snapshot on mouse release
      syncUI();
      return;
    }
    if (isDragging) {
      isDragging = false;
      S.pushHistory(); // capture a stable history snapshot on mouse release
      syncUI();
    }
  });
}

/* ── Init ──────────────────────────────────────────────────────── */
function verifyState() {
  if (!S.cfg || !Array.isArray(S.cfg.layers) || !S.cfg.layers.length) {
    S.setConfig(S.buildConfig("oval"));
  }
  if (!S.cfg.template || !S.TEMPLATES[S.cfg.template]) {
    S.setConfig(S.buildConfig("oval"));
  }
  const r = S.cfg.rings;
  if (typeof r !== "number" || r < 1 || r > 3) S.cfg.rings = 2;
}

function init() {
  verifyState();

  // Sync editor + topbar with the loaded config.
  S.setSelection(S.selId || S.cfg.layers[0].id);
  const dp = $("#dpiSelect");
  if (dp) dp.value = String(S.cfg.dpi || 300);
  document.querySelectorAll("[data-eff]").forEach((el) => {
    el.checked = !!S.cfg[el.dataset.eff];
  });
  syncInkUI();
  applyZoom();

  // Populate the topbar swatches from the shared palette.
  const sw = $("#swatchRow");
  if (sw) sw.innerHTML = I.buildSwatchesHTML();

  // Presets list in the export menu.
  rebuildPresetsList();

  // Dead WIREFRAME panels were never wired — keep them out of the layout.
  const dead = ["stampSettingsPanel", "positionPanel"];
  dead.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  // Import config file picker.
  const file = $("#importConfigFile");
  if (file)
    file.addEventListener("change", () => {
      if (file.files && file.files[0]) importConfigFile(file.files[0]);
      file.value = "";
    });

  syncUI();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

// Direct safety pass execution — guarantee the canvas viewport layout
// initializes and any queued state sync is flushed even if an earlier
// listener was skipped by the host page.
if (canvasEl && S.cfg) {
  const w = S.cfg.outerDiameter || S.cfg.width || 50;
  const h = S.cfg.height || 50;
  canvasEl.width = Math.round(S.mmPx(w));
  canvasEl.height = Math.round(S.mmPx(h));
}
setTimeout(() => { syncUI(); if (typeof R.renderD === "function") R.renderD(); }, 30);
