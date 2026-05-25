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

/** Simple debounce */
export function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
