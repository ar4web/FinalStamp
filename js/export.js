"use strict";
/* ================================================================
   PRO STAMP STUDIO — js/export.js
   PNG export + download and the Canvas-to-SVG string compiler.

   Phase 1 extraction from app.js — behaviour is identical to the
   original single-file code. Pure SVG building reads `cfg` directly
   (no canvas render). PNG export reuses the editor canvas, so it
   needs the render/showToast runtime, supplied by app.js via
   setExportRuntime() to avoid a circular dependency.
   ================================================================ */

import {
  cfg,
  DEG,
  clamp,
  mmPx,
  stampSize,
} from "./state.js";

/* ── Canvas elements ───────────────────────────────────────────── */
export const canvas = document.getElementById("stampCanvas");

/* True while an export render is active — drawEditorOverlays checks
   this to suppress editor overlays in the exported image. */
export let exporting = false;

/* UI round-trip hook: app.js registers { render, showToast } here. */
let runtime = null;
export function setExportRuntime(r) {
  runtime = r;
}

export function download(url, filename, revoke) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (revoke) setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportPNG(whiteBg = false) {
  exporting = true;
  runtime.render();
  let src = canvas;
  if (whiteBg) {
    const o = document.createElement("canvas");
    o.width = canvas.width;
    o.height = canvas.height;
    const oc = o.getContext("2d");
    oc.fillStyle = "#fff";
    oc.fillRect(0, 0, o.width, o.height);
    oc.drawImage(canvas, 0, 0);
    src = o;
  }
  download(
    src.toDataURL("image/png"),
    whiteBg ? "stamp-white-300dpi.png" : "stamp-transparent-300dpi.png",
  );
  runtime.showToast(
    whiteBg ? "PNG (white bg) exported" : "PNG (transparent) exported",
  );
  exporting = false;
  runtime.render();
}

/* ── RTL detection (shared with the editor renderer) ───────────── */
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

/* SVG arc path helper */
export function arcPathSVG(cx, cy, rx, ry, startDeg, endDeg, flip) {
  let sDeg = startDeg;
  let eDeg = endDeg;
  let sweep = 1;
  if (flip) {
    sDeg = endDeg;
    eDeg = startDeg;
    sweep = 0;
  }
  // Ensure the arc has a meaningful span — clamp to avoid degenerate arcs
  const span = (eDeg - sDeg + 360) % 360 || 360;
  const s = sDeg * DEG,
    e = (sDeg + span) * DEG;
  const x1 = cx + Math.cos(s) * rx,
    y1 = cy + Math.sin(s) * ry;
  const x2 = cx + Math.cos(e) * rx,
    y2 = cy + Math.sin(e) * ry;
  const large = span > 180 ? 1 : 0;
  return `M${x1.toFixed(2)},${y1.toFixed(2)} A${rx.toFixed(2)},${ry.toFixed(2)},0,${large},${sweep},${x2.toFixed(2)},${y2.toFixed(2)}`;
}

export function escXml(s) {
  return String(s).replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&#60;",
        ">": "&#62;",
        "&": "&#38;",
        '"': "&#34;",
        "'": "&#39;",
      })[c],
  );
}

export function exportSVG() {
  const sz = stampSize();
  const pad = cfg.paddingMm;
  const vwMm = sz.w + pad * 2;
  const vhMm = sz.h + pad * 2;
  const wPx = Math.round(mmPx(vwMm));
  const hPx = Math.round(mmPx(vhMm));
  const stampW = mmPx(sz.w),
    stampH = mmPx(sz.h);
  const cx = wPx / 2,
    cy = hPx / 2;
  const offSvgX = mmPx(cfg.shapeOffsetXmm || 0);
  const offSvgY = mmPx(cfg.shapeOffsetYmm || 0);
  const scx = cx + offSvgX,
    scy = cy + offSvgY;
  const rx = stampW / 2,
    ry = stampH / 2;
  const color = cfg.inkColor;
  const op = clamp(cfg.opacity / 100, 0, 1).toFixed(3);
  const insetPx = mmPx(cfg.outerRingThickness + cfg.ringGap);
  const cr = mmPx(cfg.cornerRadius).toFixed(2);
  const rv = cfg.ringVisible || {};
  const rc = cfg.ringColors || {};
  const cOuterSvg = rc.outer || color;
  const cInnerSvg = rc.inner || color;
  const cInner2Svg = rc.inner2 || color;
  const cCenterSvg = rc.center || color;

  let shapes = "",
    defs = "",
    texts = "";

  // ── Geometry SVG ──────────────────────────────────────────────
  if (cfg.shape === "rectangle") {
    const o = mmPx(cfg.outerRingThickness);
    shapes += `<rect x="${(scx - rx + o / 2).toFixed(2)}" y="${(scy - ry + o / 2).toFixed(2)}" width="${(stampW - o).toFixed(2)}" height="${(stampH - o).toFixed(2)}" rx="${cr}" fill="none" stroke="${cOuterSvg}" stroke-width="${o.toFixed(2)}" opacity="${op}"/>`;
    if (cfg.rings >= 2 && cfg.innerRingThickness > 0 && rv.inner !== false) {
      const inset = mmPx(cfg.outerRingThickness + cfg.ringGap);
      const il = mmPx(cfg.innerRingThickness);
      const iw = stampW - inset * 2 - il,
        ih = stampH - inset * 2 - il;
      if (iw > 0 && ih > 0) {
        shapes += `<rect x="${(scx - rx + inset + il / 2).toFixed(2)}" y="${(scy - ry + inset + il / 2).toFixed(2)}" width="${iw.toFixed(2)}" height="${ih.toFixed(2)}" rx="${cr}" fill="none" stroke="${cInnerSvg}" stroke-width="${il.toFixed(2)}" opacity="${op}"/>`;
      }
    }
  } else {
    const o = mmPx(cfg.outerRingThickness);
    shapes += `<ellipse cx="${scx}" cy="${scy}" rx="${(rx - o / 2).toFixed(2)}" ry="${(ry - o / 2).toFixed(2)}" fill="none" stroke="${cOuterSvg}" stroke-width="${o.toFixed(2)}" opacity="${op}"/>`;
    if (cfg.rings >= 2 && cfg.innerRingThickness > 0 && rv.inner !== false) {
      const il = mmPx(cfg.innerRingThickness);
      shapes += `<ellipse cx="${scx}" cy="${scy}" rx="${(rx - insetPx - il / 2).toFixed(2)}" ry="${(ry - insetPx - il / 2).toFixed(2)}" fill="none" stroke="${cInnerSvg}" stroke-width="${il.toFixed(2)}" opacity="${op}"/>`;
    }
    if (cfg.rings >= 3 && cfg.innerRing2Thickness > 0 && rv.inner2 !== false) {
      const inset2 = mmPx(
        cfg.outerRingThickness +
          cfg.ringGap +
          cfg.innerRingThickness +
          cfg.ringGap,
      );
      const il2 = mmPx(cfg.innerRing2Thickness);
      shapes += `<ellipse cx="${scx}" cy="${scy}" rx="${(rx - inset2).toFixed(2)}" ry="${(ry - inset2).toFixed(2)}" fill="none" stroke="${cInner2Svg}" stroke-width="${il2.toFixed(2)}" opacity="${op}"/>`;
    }
    if (cfg.centerAreaDiameter > 0) {
      const crd = mmPx(cfg.centerAreaDiameter / 2);
      const ilc = Math.max(mmPx(0.4), mmPx(cfg.innerRingThickness || 0.8));
      shapes += `<circle cx="${scx}" cy="${scy}" r="${crd.toFixed(2)}" fill="none" stroke="${cCenterSvg}" stroke-width="${ilc.toFixed(2)}" opacity="${op}"/>`;
    }
  }

  // ── Text layers SVG ───────────────────────────────────────────
  cfg.layers.forEach((l, i) => {
    if (!l.visible || !l.text.trim()) return;
    const fs = mmPx(l.sizeMm).toFixed(2);
    const dir = layerDir(l);
    // FIX: correct bidi attribute value for SVG
    const bidi = dir === "rtl" ? ' unicode-bidi="bidi-override"' : "";
    const ws = l.wordSpacing ? ` word-spacing="${l.wordSpacing}"` : "";
    const scl =
      l.scaleX !== 1 || l.scaleY !== 1
        ? ` transform="scale(${l.scaleX || 1},${l.scaleY || 1})"`
        : "";
    const lColor = l.color || color;
    const common = `font-family="${escXml(l.font)}" font-size="${fs}" font-weight="${safeWeight(l.font, l.weight)}" fill="${lColor}" opacity="${op}" letter-spacing="${l.letterSpacing}"${ws} direction="${dir}"${bidi}${scl}`;

    if (l.mode === "curved") {
      const pid = "tp" + i;
      let svgRx = mmPx(l.radiusMm),
        svgRy;
      if (cfg.shape === "oval") {
        const svgSz = stampSize();
        const aspect = svgSz.h / svgSz.w;
        svgRy = mmPx(Math.max(2, l.radiusMm * aspect));
      } else {
        svgRy = svgRx;
      }
      defs += `<path id="${pid}" d="${arcPathSVG(scx, scy, svgRx, svgRy, l.startAngle, l.endAngle, l.flip)}" fill="none"/>`;
      texts += `<text ${common}><textPath href="#${pid}" startOffset="50%" text-anchor="middle">${escXml(l.text)}</textPath></text>`;
    } else {
      const tx = (scx + mmPx(l.offsetXmm)).toFixed(2);
      const ty = (scy + mmPx(l.offsetYmm)).toFixed(2);
      texts += `<text x="${tx}" y="${ty}" text-anchor="middle" dominant-baseline="middle" ${common}>${escXml(l.text)}</text>`;
    }
  });

  const svgStr = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${vwMm.toFixed(2)}mm" height="${vhMm.toFixed(2)}mm" viewBox="0 0 ${wPx} ${hPx}">
<defs>${defs}</defs>
${shapes}
${texts}
</svg>`;

  download(
    URL.createObjectURL(new Blob([svgStr], { type: "image/svg+xml" })),
    "stamp-vector.svg",
    true,
  );
  runtime.showToast("SVG exported");
}
