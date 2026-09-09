/** Convert hex color to rgba() string */
export function hexToRgba(hex, alpha = 1) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Returns black or white depending on perceptual brightness of a hex color */
export function labelTextColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.45
    ? 'rgba(0,0,0,0.85)'
    : 'rgba(255,255,255,0.92)';
}

/** Parse hex string to [r, g, b] numbers */
export function hexToRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

/** Convert [r, g, b] numbers to a hex color string */
export function rgbToHex([r, g, b]) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [r, g, b].map(v => clamp(v).toString(16).padStart(2, '0')).join('');
}

/**
 * Blend a hex color toward white to simulate marker opacity.
 * opacity: 0-100, 100 = unchanged (current/original color), 0 = fully lightened (white).
 */
export function applyOpacity(hex, opacity = 100) {
  if (opacity >= 100) return hex;
  const t = Math.max(0, Math.min(100, opacity)) / 100;
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex([r + (255 - r) * (1 - t), g + (255 - g) * (1 - t), b + (255 - b) * (1 - t)]);
}

// ---------------------------------------------------------------------------
// CIEDE2000 color matching — mirrors the Lab conversion + CIEDE2000 distance
// used server-side (main.py) so the frontend can re-match a color against a
// palette locally (e.g. to re-derive nearest swatches as opacity changes,
// without a round-trip to the backend).
// ---------------------------------------------------------------------------

/** Convert [r, g, b] (0-255) to CIE Lab [L, a, b] */
export function rgbToLab([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const linearize = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  r = linearize(r); g = linearize(g); b = linearize(b);
  let X = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
  let Y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
  let Z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041;
  X /= 0.95047; Z /= 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fX = f(X), fY = f(Y), fZ = f(Z);
  return [116 * fY - 16, 500 * (fX - fY), 200 * (fY - fZ)];
}

const _rad = (d) => (d * Math.PI) / 180;
const _deg = (r) => (r * 180) / Math.PI;
const _mod360 = (d) => ((d % 360) + 360) % 360;

/** Perceptual color distance between two Lab colors (CIEDE2000) */
export function ciede2000([L1, a1, b1], [L2, a2, b2]) {
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2);
  const C_avg = (C1 + C2) / 2, C_avg7 = C_avg ** 7;
  const G = 0.5 * (1 - Math.sqrt(C_avg7 / (C_avg7 + 6103515625)));
  const a1p = a1 * (1 + G), a2p = a2 * (1 + G);
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const h1p = _mod360(_deg(Math.atan2(b1, a1p)));
  const h2p = _mod360(_deg(Math.atan2(b2, a2p)));
  const dLp = L2 - L1, dCp = C2p - C1p;
  let dhp;
  if (C1p * C2p === 0) dhp = 0;
  else if (Math.abs(h2p - h1p) <= 180) dhp = h2p - h1p;
  else if (h2p - h1p > 180) dhp = h2p - h1p - 360;
  else dhp = h2p - h1p + 360;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(_rad(dhp / 2));
  const Lp_avg = (L1 + L2) / 2, Cp_avg = (C1p + C2p) / 2;
  let Hp_avg;
  if (C1p * C2p === 0) Hp_avg = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) Hp_avg = (h1p + h2p) / 2;
  else if (h1p + h2p < 360) Hp_avg = (h1p + h2p + 360) / 2;
  else Hp_avg = (h1p + h2p - 360) / 2;
  const T = 1 - 0.17 * Math.cos(_rad(Hp_avg - 30)) + 0.24 * Math.cos(_rad(2 * Hp_avg))
    + 0.32 * Math.cos(_rad(3 * Hp_avg + 6)) - 0.20 * Math.cos(_rad(4 * Hp_avg - 63));
  const SL = 1 + (0.015 * (Lp_avg - 50) ** 2) / Math.sqrt(20 + (Lp_avg - 50) ** 2);
  const SC = 1 + 0.045 * Cp_avg, SH = 1 + 0.015 * Cp_avg * T;
  const Cp_avg7 = Cp_avg ** 7;
  const RC = 2 * Math.sqrt(Cp_avg7 / (Cp_avg7 + 6103515625));
  const d_theta = 30 * Math.exp(-(((Hp_avg - 275) / 25) ** 2));
  const RT = -Math.sin(_rad(2 * d_theta)) * RC;
  return Math.sqrt((dLp / SL) ** 2 + (dCp / SC) ** 2 + (dHp / SH) ** 2 + RT * (dCp / SC) * (dHp / SH));
}

/** Precompute Lab values for a [{ label, hex }] palette list */
export function buildPaletteLabCache(paletteColors) {
  return paletteColors.map((c) => ({ ...c, lab: rgbToLab(hexToRgb(c.hex)) }));
}

/** Find the closest palette entry to a hex color using CIEDE2000 */
export function nearestPaletteEntry(hex, labCache) {
  if (!labCache || labCache.length === 0) return null;
  const lab = rgbToLab(hexToRgb(hex));
  let best = null, bestDist = Infinity;
  for (const entry of labCache) {
    const d = ciede2000(lab, entry.lab);
    if (d < bestDist) { bestDist = d; best = entry; }
  }
  return best;
}

// The /palette endpoint returns groups of { label: hex } maps
// (e.g. { group_1: { B3: "#A2E4B8" } }). Flatten to a [{ label, hex, group }] list.
export function flattenPalette(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  const out = [];
  for (const [group, entries] of Object.entries(data)) {
    if (!entries || typeof entries !== 'object') continue;
    for (const [label, hex] of Object.entries(entries)) {
      out.push({ label, hex: String(hex), group });
    }
  }
  return out;
}

/** Build an ImageData-compatible canvas from a loaded HTMLImageElement,
 *  applying crop, flip, and rotation transforms */
export function getTransformedCanvas(image, { cropSelection, flipX, flipY, rotation }) {
  const iw = image.naturalWidth;
  const ih = image.naturalHeight;

  let sx = 0, sy = 0, sw = iw, sh = ih;
  if (cropSelection) {
    sx = Math.round(cropSelection.x * iw);
    sy = Math.round(cropSelection.y * ih);
    sw = Math.round(cropSelection.w * iw);
    sh = Math.round(cropSelection.h * ih);
  }

  // Step 1: crop
  const base = document.createElement('canvas');
  base.width = sw; base.height = sh;
  base.getContext('2d').drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);

  // Step 2: flip
  let cur = base;
  if (flipX || flipY) {
    const fc = document.createElement('canvas');
    fc.width = sw; fc.height = sh;
    const ctx = fc.getContext('2d');
    ctx.save();
    ctx.translate(flipX ? sw : 0, flipY ? sh : 0);
    ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
    ctx.drawImage(cur, 0, 0);
    ctx.restore();
    cur = fc;
  }

  // Step 3: rotate
  if (rotation !== 0) {
    const swap = rotation === 90 || rotation === 270;
    const rc = document.createElement('canvas');
    rc.width  = swap ? sh : sw;
    rc.height = swap ? sw : sh;
    const ctx = rc.getContext('2d');
    ctx.translate(rc.width / 2, rc.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(cur, -sw / 2, -sh / 2);
    cur = rc;
  }

  return cur;
}

/** Compute grid dimensions that mirror the backend logic */
export function computeGridDims(image, { cropSelection, rotation, beadSize, forceCols, forceRows }) {
  if (!image) return null;
  let iw = image.naturalWidth;
  let ih = image.naturalHeight;
  if (cropSelection) {
    iw = Math.round(iw * cropSelection.w);
    ih = Math.round(ih * cropSelection.h);
  }
  if (rotation === 90 || rotation === 270) { const t = iw; iw = ih; ih = t; }

  const bs = Math.max(1, beadSize || 20);
  if (forceCols > 0 && forceRows > 0) return { cols: forceCols, rows: forceRows };
  if (forceCols > 0) return { cols: forceCols, rows: Math.max(1, Math.round(ih * forceCols / iw)) };
  if (forceRows > 0) return { rows: forceRows, cols: Math.max(1, Math.round(iw * forceRows / ih)) };
  return { cols: Math.max(1, Math.floor(iw / bs)), rows: Math.max(1, Math.floor(ih / bs)) };
}

/**
 * Draw a scaled-down thumbnail of a board onto a canvas element.
 * Pass overrideLabel/overrideColor to preview a color swap without mutating
 * the project — used by the palette swap "before/after" preview.
 */
export function drawBoardThumbnail(canvas, project, { boardBg = '#000000', overrideLabel = null, overrideColor = null, maxSize = 160 } = {}) {
  if (!canvas || !project) return;
  const cols = project.width, rows = project.height;
  if (!cols || !rows) return;
  const cell = Math.max(1, Math.min(maxSize / cols, maxSize / rows));
  canvas.width  = Math.max(1, Math.round(cols * cell));
  canvas.height = Math.max(1, Math.round(rows * cell));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = boardBg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const b of project.beads) {
    if (b.transparent) continue;
    ctx.fillStyle = (overrideLabel && b.label === overrideLabel) ? overrideColor : b.color;
    ctx.fillRect(b.col * cell, b.row * cell, cell, cell);
  }
}

/** Simple debounce */
export function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/** Create a pixelated preview of an image based on bead size */
export function createPixelatedPreview(image, { cropSelection, flipX, flipY, rotation, beadSize }) {
  const iw = image.naturalWidth;
  const ih = image.naturalHeight;

  let sx = 0, sy = 0, sw = iw, sh = ih;
  if (cropSelection) {
    sx = Math.round(cropSelection.x * iw);
    sy = Math.round(cropSelection.y * ih);
    sw = Math.round(cropSelection.w * iw);
    sh = Math.round(cropSelection.h * ih);
  }

  // Step 1: crop
  const base = document.createElement('canvas');
  base.width = sw; base.height = sh;
  base.getContext('2d').drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);

  // Step 2: flip
  let cur = base;
  if (flipX || flipY) {
    const fc = document.createElement('canvas');
    fc.width = sw; fc.height = sh;
    const ctx = fc.getContext('2d');
    ctx.save();
    ctx.translate(flipX ? sw : 0, flipY ? sh : 0);
    ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
    ctx.drawImage(cur, 0, 0);
    ctx.restore();
    cur = fc;
  }

  // Step 3: rotate
  if (rotation !== 0) {
    const swap = rotation === 90 || rotation === 270;
    const rc = document.createElement('canvas');
    rc.width  = swap ? sh : sw;
    rc.height = swap ? sw : sh;
    const ctx = rc.getContext('2d');
    ctx.translate(rc.width / 2, rc.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(cur, -sw / 2, -sh / 2);
    cur = rc;
  }

  // Step 4: Apply pixelation based on bead size
  const pixelated = document.createElement('canvas');
  const ctx = pixelated.getContext('2d');

  // Calculate pixelated dimensions
  const pixelSize = Math.max(1, beadSize || 20);
  const pixelatedWidth = Math.ceil(cur.width / pixelSize);
  const pixelatedHeight = Math.ceil(cur.height / pixelSize);

  pixelated.width = pixelatedWidth;
  pixelated.height = pixelatedHeight;

  // Draw pixelated version
  for (let y = 0; y < pixelatedHeight; y++) {
    for (let x = 0; x < pixelatedWidth; x++) {
      const srcX = Math.floor(x * pixelSize);
      const srcY = Math.floor(y * pixelSize);

      // Make sure we don't go out of bounds
      if (srcX < cur.width && srcY < cur.height) {
        const pixel = ctx.getImageData(srcX, srcY, 1, 1).data;
        ctx.fillStyle = `rgba(${pixel[0]}, ${pixel[1]}, ${pixel[2]}, ${pixel[3]})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  return pixelated;
}
