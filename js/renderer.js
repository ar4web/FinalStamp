"use strict";
/* ================================================================
   PRO STAMP STUDIO — js/renderer.js
   Standalone Canvas 2D render engine.

   Phase 1 extraction from app.js — behaviour is identical to the
   original single-file code. Contains every drawing pass:
     • primary render() / debounced renderD()
     • curve/arc/radius math (textEllipseMm, tangent framing, …)
     • alignment guides / selection overlays (drawEditorOverlays)
     • layer loops (curved & straight text, shapes, images, rings)
     • aesthetic filters (ink bleed, grunge, rotation jitter)

   It imports only pure state/utilities from ./state.js and never
   touches UI sync routines. Ephemeral editor-selection state is
   injected by the core app through setEditorContext() so the module
   stays free of circular dependencies with the interface code.
   ================================================================ */

import {
  cfg,
  DPI_CURRENT,
  DEG,
  clamp,
  mmPx,
  mkRng,
  stampSize,
} from "./state.js";

/* ── Canvas elements ───────────────────────────────────────────── */
export const canvas = document.getElementById("stampCanvas");
export const ctx = canvas.getContext("2d", {
  alpha: true,
  willReadFrequently: true,
});

/* ── Editor context (selection / guides / export flag) ───────────
   Injected by app.js via setEditorContext(). Defaults describe a
   fresh document with no selection so the module is safe standalone. */
let editor = {
  exporting: false,
  guideLines: [],
  selShape: false,
  selRing: null,
  selId: null,
  selectedIds: new Set(),
};
export function setEditorContext(ctx) {
  editor = ctx;
}

const selLayer = () => cfg.layers.find((l) => l.id === editor.selId) || null;

/* ── Debounce ──────────────────────────────────────────────────── */
function debounce(fn, ms = 40) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

/* ── RTL detection (shared with the editor/export code) ────────── */
const RTL_RE = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
const isRTL = (t) => RTL_RE.test(t || "");
export const layerDir = (l) =>
  l.dir === "auto" ? (isRTL(l.text) ? "rtl" : "ltr") : l.dir;

/* ── Font weights (shared with the editor font pickers) ────────── */
export const FONT_WEIGHTS = {
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

export function safeWeight(font, weight) {
  const list = FONT_WEIGHTS[font];
  if (!list) return weight;
  if (list.includes(weight)) return weight;
  let best = list[0];
  for (const w of list) {
    if (Math.abs(w - weight) < Math.abs(best - weight)) best = w;
  }
  return best;
}

/* ── hex → rgba ────────────────────────────────────────────────── */
function hexRgba(hex, opacity) {
  let c = (hex || "#000000").replace("#", "").trim();
  if (c.length === 3)
    c = c
      .split("")
      .map((x) => x + x)
      .join("");
  if (!/^[0-9a-fA-F]{6}$/.test(c)) c = "000000";
  const n = parseInt(c, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${clamp(opacity / 100, 0, 1)})`;
}

/* ================================================================
   DRAWING — GEOMETRY
   ================================================================ */
function ellipseStroke(cx, cy, rx, ry, thickMm, color) {
  if (thickMm <= 0 || rx <= 0 || ry <= 0) return;
  const lw = mmPx(thickMm);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.ellipse(
    cx,
    cy,
    Math.max(0.5, rx - lw / 2),
    Math.max(0.5, ry - lw / 2),
    0,
    0,
    Math.PI * 2,
  );
  ctx.stroke();
  ctx.restore();
}

function roundRectPath(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function rectStroke(cx, cy, wPx, hPx, insetMm, thickMm, color) {
  if (thickMm <= 0) return;
  const inset = mmPx(insetMm);
  const lw = mmPx(thickMm);
  const x = cx - wPx / 2 + inset + lw / 2;
  const y = cy - hPx / 2 + inset + lw / 2;
  const rw = wPx - inset * 2 - lw;
  const rh = hPx - inset * 2 - lw;
  if (rw <= 0 || rh <= 0) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  roundRectPath(x, y, rw, rh, mmPx(cfg.cornerRadius));
  ctx.stroke();
  ctx.restore();
}

function drawGeometry(cx, cy, wPx, hPx, color) {
  const rx = wPx / 2,
    ry = hPx / 2;
  const insetPx = mmPx(cfg.outerRingThickness + cfg.ringGap);
  const rc = cfg.ringColors || {};
  const rv = cfg.ringVisible || {};
  const op = cfg.opacity;
  const cOuter = rc.outer ? hexRgba(rc.outer, op) : color;
  const cInner = rc.inner ? hexRgba(rc.inner, op) : color;
  const cInner2 = rc.inner2 ? hexRgba(rc.inner2, op) : color;
  const cCenter = rc.center ? hexRgba(rc.center, op) : color;

  if (cfg.shape === "rectangle") {
    if (rv.outer !== false)
      rectStroke(cx, cy, wPx, hPx, 0, cfg.outerRingThickness, cOuter);
    if (cfg.rings >= 2 && cfg.innerRingThickness > 0 && rv.inner !== false) {
      rectStroke(
        cx,
        cy,
        wPx,
        hPx,
        cfg.outerRingThickness + cfg.ringGap,
        cfg.innerRingThickness,
        cInner,
      );
    }
    if (cfg.rings >= 3 && cfg.innerRing2Thickness > 0 && rv.inner2 !== false) {
      const inset2 =
        cfg.outerRingThickness +
        cfg.ringGap +
        cfg.innerRingThickness +
        cfg.ringGap;
      rectStroke(cx, cy, wPx, hPx, inset2, cfg.innerRing2Thickness, cInner2);
    }
    return;
  }

  // Ellipse / oval / circle
  if (rv.outer !== false)
    ellipseStroke(cx, cy, rx, ry, cfg.outerRingThickness, cOuter);

  if (cfg.rings >= 2 && cfg.innerRingThickness > 0 && rv.inner !== false) {
    ellipseStroke(
      cx,
      cy,
      rx - insetPx,
      ry - insetPx,
      cfg.innerRingThickness,
      cInner,
    );
  }
  if (cfg.rings >= 3 && cfg.innerRing2Thickness > 0 && rv.inner2 !== false) {
    const inset2 =
      mmPx(cfg.outerRingThickness + cfg.ringGap) +
      mmPx(cfg.innerRingThickness + cfg.ringGap);
    ellipseStroke(
      cx,
      cy,
      rx - inset2,
      ry - inset2,
      cfg.innerRing2Thickness,
      cInner2,
    );
  }
  if (cfg.centerAreaDiameter > 0 && rv.center !== false) {
    const cr = mmPx(cfg.centerAreaDiameter / 2);
    const sy = cfg.shape === "oval" ? clamp(ry / rx, 0.1, 1) : 1;
    ellipseStroke(
      cx,
      cy,
      cr,
      cr * sy,
      Math.max(0.4, cfg.innerRingThickness ?? 0.8),
      cCenter,
    );
  }
}

/* ================================================================
   DRAWING — TEXT
   ================================================================ */

/*
  textEllipseMm:
  Single source of truth for the ellipse a curved layer rides on.
  Returns { rx, ry } in MM. For circles rx === ry === radiusMm.
  For ovals we preserve the ring's eccentricity by scaling ry with
  the stamp's aspect ratio, so the text traces the same curve as
  the ring instead of drifting onto an unrelated ellipse.
*/
export function textEllipseMm(layer) {
  const sz = stampSize(); // {w, h} in mm
  const sRx = sz.w / 2;
  const sRy = sz.h / 2;
  const r = layer.radiusMm;
  if (cfg.shape === "oval" && sRx > 0) {
    return { rx: r, ry: Math.max(0.5, r * (sRy / sRx)) };
  }
  return { rx: r, ry: r };
}

export const getShapeAspect = () => {
  if (cfg.shape === "circle") return 1;
  const sz = stampSize();
  return sz.w > 0 ? sz.h / sz.w : 1;
};

/*
  buildTextStrip:
  Renders the text to an offscreen canvas strip ONCE.
  This preserves connected-script ligatures (Arabic, etc.)
  for both curved and straight text, and fixes the blurry
  rendering bug that came from re-rendering per-column.
*/
function buildTextStrip(layer, color) {
  const fontPx = mmPx(layer.sizeMm);
  const fontStr = `${safeWeight(layer.font, layer.weight)} ${fontPx}px "${layer.font}"`;
  const dir = layerDir(layer);
  const sx = layer.scaleX || 1;
  const sy = layer.scaleY || 1;

  const m = document.createElement("canvas").getContext("2d");
  m.font = fontStr;
  if ("letterSpacing" in m) m.letterSpacing = `${layer.letterSpacing}px`;
  if ("wordSpacing" in m) m.wordSpacing = `${layer.wordSpacing}px`;
  const measured = m.measureText(layer.text);

  const textW = Math.max(2, Math.ceil(measured.width * sx));
  const pad = fontPx * 0.3;
  const sw = textW + pad * 2;
  const sh = Math.max(2, Math.ceil(fontPx * 2.2 * sy));

  const strip = document.createElement("canvas");
  strip.width = sw;
  strip.height = sh;
  const sc = strip.getContext("2d");
  sc.font = fontStr;
  if ("letterSpacing" in sc) sc.letterSpacing = `${layer.letterSpacing}px`;
  if ("wordSpacing" in sc) sc.wordSpacing = `${layer.wordSpacing}px`;
  sc.fillStyle = color;
  sc.textAlign = "center";
  sc.textBaseline = "middle";
  sc.direction = dir;
  sc.translate(sw / 2, sh / 2);
  sc.scale(sx, sy);
  sc.fillText(layer.text, 0, 0);
  return { canvas: strip, textWidth: textW, pad };
}

/* Ink-bleed wrapper — renders soft bleed passes then sharp pass */
function bleedWrap(drawFn, rng) {
  if (!cfg.inkBleed || cfg.inkBleedAmount <= 0) {
    drawFn();
    return;
  }
  const blurPx = mmPx(cfg.inkBleedAmount) * 0.2;
  ctx.save();
  ctx.globalAlpha *= 0.16;
  ctx.filter = `blur(${blurPx}px)`;
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.translate((rng() - 0.5) * mmPx(0.09), (rng() - 0.5) * mmPx(0.09));
    drawFn();
    ctx.restore();
  }
  ctx.restore();
  drawFn(); // crisp final pass
}

function drawCurvedLayer(layer, cx, cy, color, rng) {
  if (!layer.text.trim()) return;
  const info = buildTextStrip(layer, color);
  const strip = info.canvas;
  const sw = strip.width,
    sh = strip.height;
  const textW = info.textWidth;
  const padPx = info.pad;
  const slice = Math.max(1, Math.round(sh / 32));

  const sz = stampSize();
  const rx = sz.w / 2;
  const ry = sz.h / 2;

  let textRx, textRy;
  {
    const e = textEllipseMm(layer);
    textRx = mmPx(e.rx);
    textRy = mmPx(e.ry);
  }

  const draw = () => {
    for (let x = 0; x < sw; x += slice) {
      const f = (x + slice / 2 - padPx) / textW;
      if (f < -0.02 || f > 1.02) continue;
      const cf = Math.max(0, Math.min(1, f));
      const ang =
        (layer.startAngle + (layer.endAngle - layer.startAngle) * cf) * DEG;
      const tx = cx + Math.cos(ang) * textRx;
      const ty = cy + Math.sin(ang) * textRy;

      const tangent = Math.atan2(
        textRy * Math.cos(ang),
        -textRx * Math.sin(ang),
      );
      const jit =
        cfg.rotationJitter && cfg.jitterDegrees > 0
          ? (rng() * 2 - 1) * cfg.jitterDegrees * DEG
          : 0;
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(tangent + (layer.flip ? Math.PI : 0) + jit);
      ctx.drawImage(strip, x, 0, slice, sh, -slice / 2, -sh / 2, slice, sh);
      ctx.restore();
    }
  };
  bleedWrap(draw, rng);
}

function drawStraightLayer(layer, cx, cy, color, rng) {
  if (!layer.text.trim()) return;
  const fontPx = mmPx(layer.sizeMm);
  const tx = cx + mmPx(layer.offsetXmm);
  const ty = cy + mmPx(layer.offsetYmm);

  const draw = () => {
    ctx.save();
    ctx.font = `${safeWeight(layer.font, layer.weight)} ${fontPx}px "${layer.font}"`;
    if ("letterSpacing" in ctx) ctx.letterSpacing = `${layer.letterSpacing}px`;
    if ("wordSpacing" in ctx) ctx.wordSpacing = `${layer.wordSpacing}px`;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.direction = layerDir(layer);
    const sx = layer.scaleX || 1;
    const sy = layer.scaleY || 1;
    if (cfg.rotationJitter && cfg.jitterDegrees > 0) {
      ctx.translate(tx, ty);
      ctx.rotate((rng() * 2 - 1) * cfg.jitterDegrees * DEG * 0.5);
      ctx.scale(sx, sy);
      ctx.fillText(layer.text, 0, 0);
    } else {
      ctx.translate(tx, ty);
      ctx.scale(sx, sy);
      ctx.fillText(layer.text, 0, 0);
    }
    ctx.restore();
  };
  bleedWrap(draw, rng);
}

/* ── Draw shape layer (star, pentagon, hexagon, diamond, cross) ── */
function drawShapeLayer(layer, cx, cy, color, rng) {
  const tx = cx + mmPx(layer.offsetXmm);
  const ty = cy + mmPx(layer.offsetYmm);
  const size = mmPx(layer.shapeSizeMm);
  const rot = (layer.shapeRotation || 0) * DEG;
  const fill = layer.shapeFill;
  const pts = layer.shapePoints || 5;

  const draw = () => {
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(rot);
    ctx.beginPath();

    if (layer.shapeType === "star") {
      const inner = size * 0.4;
      for (let i = 0; i < pts * 2; i++) {
        const r = i % 2 === 0 ? size : inner;
        const a = (i * Math.PI) / pts - Math.PI / 2;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
    } else if (
      layer.shapeType === "pentagon" ||
      layer.shapeType === "hexagon"
    ) {
      const n = layer.shapeType === "pentagon" ? 5 : 6;
      for (let i = 0; i < n; i++) {
        const a = (i * 2 * Math.PI) / n - Math.PI / 2;
        if (i === 0) ctx.moveTo(Math.cos(a) * size, Math.sin(a) * size);
        else ctx.lineTo(Math.cos(a) * size, Math.sin(a) * size);
      }
      ctx.closePath();
    } else if (layer.shapeType === "diamond") {
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.6, 0);
      ctx.lineTo(0, size);
      ctx.lineTo(-size * 0.6, 0);
      ctx.closePath();
    } else if (layer.shapeType === "cross") {
      const t = size * 0.3;
      ctx.moveTo(-t, -size);
      ctx.lineTo(t, -size);
      ctx.lineTo(t, -t);
      ctx.lineTo(size, -t);
      ctx.lineTo(size, t);
      ctx.lineTo(t, t);
      ctx.lineTo(t, size);
      ctx.lineTo(-t, size);
      ctx.lineTo(-t, t);
      ctx.lineTo(-size, t);
      ctx.lineTo(-size, -t);
      ctx.lineTo(-t, -t);
      ctx.closePath();
    } else if (layer.shapeType === "circle") {
      ctx.arc(0, 0, size, 0, Math.PI * 2);
    }

    if (fill) {
      ctx.fillStyle = color;
      ctx.fill();
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, mmPx(0.5));
      ctx.stroke();
    }
    ctx.restore();
  };
  bleedWrap(draw, rng);
}

/* ── Draw image layer (imported logo) ─────────────────────────── */
export const imageCache = {};
export function clearImageCache() {
  Object.keys(imageCache).forEach((k) => delete imageCache[k]);
}
function drawImageLayer(layer, cx, cy) {
  if (!layer.imageData) return;
  const tx = cx + mmPx(layer.offsetXmm);
  const ty = cy + mmPx(layer.offsetYmm);
  const w = mmPx(layer.imageWidthMm);
  const h = mmPx(layer.imageHeightMm);

  const drawImg = (img) => {
    ctx.save();
    ctx.globalAlpha = (cfg.opacity || 100) / 100;
    ctx.drawImage(img, tx - w / 2, ty - h / 2, w, h);
    ctx.restore();
  };

  if (imageCache[layer.imageData]) {
    drawImg(imageCache[layer.imageData]);
  } else {
    const img = new Image();
    img.onload = () => {
      imageCache[layer.imageData] = img;
      render();
    };
    img.src = layer.imageData;
  }
}

/* ── Grunge texture ────────────────────────────────────────────── */
function applyGrunge(rng, amount) {
  if (!cfg.grungeTexture || amount <= 0) return;
  const iData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = iData.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 8) continue; // skip transparent pixels — FIX: was skipping too much
    const noise = (rng() - 0.5) * amount * 200;
    d[i + 3] = clamp(d[i + 3] + noise, 0, 255);
  }
  ctx.putImageData(iData, 0, 0);
}

function drawEditorOverlays() {
  if (editor.exporting) return;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const offPxX = mmPx(cfg.shapeOffsetXmm || 0);
  const offPxY = mmPx(cfg.shapeOffsetYmm || 0);
  const scx = cx + offPxX,
    scy = cy + offPxY;
  const aspect = getShapeAspect();
  const sz = stampSize();
  const ppmm = DPI_CURRENT / 25.4;
  const showGuidesEl = document.getElementById("showGuides");
  const showGuidesOn = showGuidesEl ? showGuidesEl.checked : true;

  ctx.save();

  // ── Persistent center & edge guides ──────────────────────────
  if (showGuidesOn) {
    const hw = mmPx(sz.w) / 2,
      hh = mmPx(sz.h) / 2;
    ctx.save();
    ctx.strokeStyle = "rgba(34,211,238,0.35)";
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 6]);
    // Center crosshair
    ctx.beginPath();
    ctx.moveTo(scx, 0);
    ctx.lineTo(scx, canvas.height);
    ctx.moveTo(0, scy);
    ctx.lineTo(canvas.width, scy);
    ctx.stroke();
    // Edge box
    ctx.strokeStyle = "rgba(34,211,238,0.28)";
    ctx.strokeRect(scx - hw, scy - hh, hw * 2, hh * 2);
    ctx.setLineDash([]);
    ctx.restore();
  }

  // ── Alignment guide lines (from alignment tools) ─────────────
  if (editor.guideLines && editor.guideLines.length > 0) {
    editor.guideLines.forEach((g) => {
      ctx.save();
      ctx.strokeStyle = "rgba(34,211,238,0.7)";
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      if (g.type === "v") {
        const x = scx + g.mm * ppmm;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
      } else {
        const y = scy + g.mm * ppmm;
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    });
  }

  // ── Stamp bounding box guide ─────────────────────────────────
  if (editor.selShape || (selLayer() && selLayer().visible)) {
    const hw = mmPx(sz.w) / 2,
      hh = mmPx(sz.h) / 2;
    ctx.strokeStyle = "rgba(37, 99, 235, 0.45)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(cx - hw - 2, cy - hh - 2, hw * 2 + 4, hh * 2 + 4);
    ctx.setLineDash([]);
  }

  // ── Shape selection handles ──────────────────────────────────
  if (editor.selShape) {
    const hw = mmPx(sz.w) / 2,
      hh = mmPx(sz.h) / 2;

    // Determine effective bounds based on selected ring
    let ringInsetPx = 0;
    let ringColor = "#2563eb";
    let ringLabel = "";
    if (editor.selRing === "inner" && cfg.rings >= 2) {
      ringInsetPx = mmPx(cfg.outerRingThickness + cfg.ringGap);
      ringColor = "#d97706";
      ringLabel = "Ring 2";
    } else if (editor.selRing === "inner2" && cfg.rings >= 3) {
      ringInsetPx = mmPx(
        cfg.outerRingThickness +
          cfg.ringGap +
          cfg.innerRingThickness +
          cfg.ringGap,
      );
      ringColor = "#059669";
      ringLabel = "Ring 3";
    } else if (editor.selRing === "outer") {
      ringLabel = "Ring 1";
    }
    const selHw = hw - ringInsetPx,
      selHh = hh - ringInsetPx;

    // Highlight selected ring
    if (editor.selRing) {
      ctx.save();
      ctx.strokeStyle = ringColor;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);

      if (cfg.shape === "circle" || cfg.shape === "oval") {
        ctx.beginPath();
        ctx.ellipse(
          scx,
          scy,
          Math.max(2, selHw),
          Math.max(2, selHh),
          0,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      } else if (cfg.shape === "rectangle") {
        ctx.strokeRect(scx - selHw, scy - selHh, selHw * 2, selHh * 2);
      }

      // Ring label
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.6;
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = ringColor;
      ctx.fillText(ringLabel, scx + selHw + 8, scy - selHh);
      ctx.restore();
    }

    // Corner handles at the selected ring bounds (or outer if no ring selected)
    const corners = [
      { x: scx - selHw, y: scy - selHh, cursor: "nwse-resize" },
      { x: scx + selHw, y: scy - selHh, cursor: "nesw-resize" },
      { x: scx + selHw, y: scy + selHh, cursor: "nwse-resize" },
      { x: scx - selHw, y: scy + selHh, cursor: "nesw-resize" },
    ];
    corners.forEach((p) => {
      ctx.beginPath();
      ctx.rect(p.x - 5, p.y - 5, 10, 10);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    });
    // Dashed selection box at the selected ring bounds
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle =
      ringColor === "#2563eb" ? "rgba(37,99,235,0.75)" : ringColor + "cc";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      scx - selHw - 1,
      scy - selHh - 1,
      selHw * 2 + 2,
      selHh * 2 + 2,
    );
    ctx.setLineDash([]);
    ctx.restore();
    return;
  }

  // ── Multi-select outlines for all selected layers ────────────
  cfg.layers.forEach((ml) => {
    if (!editor.selectedIds.has(ml.id) || !ml.visible) return;
    const isPrimary = ml.id === editor.selId;
    const mRadius = mmPx(ml.radiusMm);

    if (ml.mode === "curved") {
      ctx.save();
      const _e = textEllipseMm(ml);
      const mlRx = _e.rx;
      const mlRy = _e.ry;

      ctx.strokeStyle = isPrimary
        ? "rgba(37,99,235,0.85)"
        : "rgba(37,99,235,0.5)";
      ctx.lineWidth = isPrimary ? 2.5 : 1.5;
      ctx.setLineDash(isPrimary ? [5, 5] : [3, 4]);
      ctx.beginPath();
      ctx.ellipse(
        cx,
        cy,
        mmPx(mlRx),
        mmPx(mlRy),
        0,
        ml.startAngle * DEG,
        ml.endAngle * DEG,
      );
      ctx.stroke();
      ctx.restore();
    } else {
      const tx = cx + mmPx(ml.offsetXmm);
      const ty = cy + mmPx(ml.offsetYmm);
      ctx.save();
      ctx.font = `${safeWeight(ml.font, ml.weight)} ${mmPx(ml.sizeMm)}px "${ml.font}"`;
      const tw = ctx.measureText(ml.text).width;
      const th = mmPx(ml.sizeMm);
      ctx.strokeStyle = isPrimary
        ? "rgba(99,102,241,0.7)"
        : "rgba(99,102,241,0.35)";
      ctx.lineWidth = isPrimary ? 1.8 : 1;
      ctx.setLineDash(isPrimary ? [3, 3] : [2, 3]);
      ctx.beginPath();
      ctx.rect(tx - tw / 2 - 8, ty - th / 2 - 6, tw + 16, th + 12);
      ctx.stroke();
      ctx.restore();
    }
  });

  // ── Primary layer handles ──────────────────────────────────
  const l = selLayer();
  if (!l || !l.visible) {
    ctx.restore();
    return;
  }
  const radius = mmPx(l.radiusMm);

  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(37, 99, 235, 0.85)";

  if (l.mode === "curved") {
    const theta1 = l.startAngle * DEG;
    const theta2 = l.endAngle * DEG;
    const thetaM = (l.startAngle + (l.endAngle - l.startAngle) / 2) * DEG;
    const _le = textEllipseMm(l);
    const lRx = _le.rx;
    const lRy = _le.ry;
    const lRxPx = mmPx(lRx),
      lRyPx = mmPx(lRy);

    const handles = [
      {
        x: cx + Math.cos(theta1) * lRxPx,
        y: cy + Math.sin(theta1) * lRyPx,
        role: "start",
      },
      {
        x: cx + Math.cos(theta2) * lRxPx,
        y: cy + Math.sin(theta2) * lRyPx,
        role: "end",
      },
      {
        x: cx + Math.cos(thetaM) * lRxPx,
        y: cy + Math.sin(thetaM) * lRyPx,
        role: "radius",
      },
    ];

    handles.forEach((h) => {
      ctx.beginPath();
      ctx.arc(h.x, h.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.setLineDash([]);
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 3;
      ctx.stroke();
    });
  } else {
    const tx = cx + mmPx(l.offsetXmm);
    const ty = cy + mmPx(l.offsetYmm);

    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(tx, ty, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  ctx.restore();

  // Size label — below stamp (hidden when ring selected)
  if (!editor.selRing) {
    const hh2 = mmPx(sz.h) / 2;
    ctx.save();
    ctx.font = "bold 10px sans-serif";
    ctx.fillStyle = "rgba(37,99,235,0.9)";
    ctx.textAlign = "center";
    ctx.fillText(
      `${sz.w.toFixed(1)} × ${sz.h.toFixed(1)} mm`,
      scx,
      scy + hh2 + 16,
    );
    ctx.restore();
  }
}

/* ================================================================
   MAIN RENDER
   ================================================================ */
export function render() {
  const sz = stampSize();
  const pad = cfg.paddingMm;
  const wPx = Math.round(mmPx(sz.w + pad * 2));
  const hPx = Math.round(mmPx(sz.h + pad * 2));

  if (canvas.width !== wPx || canvas.height !== hPx) {
    canvas.width = wPx;
    canvas.height = hPx;
  }
  ctx.clearRect(0, 0, wPx, hPx);

  const cx = wPx / 2,
    cy = hPx / 2;
  const offPxX = mmPx(cfg.shapeOffsetXmm || 0);
  const offPxY = mmPx(cfg.shapeOffsetYmm || 0);
  const scx = cx + offPxX,
    scy = cy + offPxY;
  const stampW = mmPx(sz.w),
    stampH = mmPx(sz.h);
  const color = hexRgba(cfg.inkColor, cfg.opacity);

  // New RNG per render — seeded so grunge is stable (no flicker)
  const rng = mkRng(cfg.seed);

  drawGeometry(scx, scy, stampW, stampH, color);

  cfg.layers.forEach((layer) => {
    if (!layer.visible) return;
    const lcolor = layer.color ? hexRgba(layer.color, cfg.opacity) : color;
    if (layer.type === "shape") drawShapeLayer(layer, scx, scy, lcolor, rng);
    else if (layer.type === "image") drawImageLayer(layer, scx, scy);
    else if (layer.mode === "curved")
      drawCurvedLayer(layer, scx, scy, lcolor, rng);
    else drawStraightLayer(layer, scx, scy, lcolor, rng);
  });

  applyGrunge(rng, cfg.grungeAmount);
  drawEditorOverlays();
}

export const renderD = debounce(render, 40);
