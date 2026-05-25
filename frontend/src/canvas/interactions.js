/** Pure canvas hit-test and coordinate utilities */

/** Get bead row/col from a mouse event on the canvas */
export function getBeadCoords(canvas, e, cellPx, gapPx) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top)  * scaleY;
  const step = cellPx + gapPx;
  return {
    col: Math.floor(x / step),
    row: Math.floor(y / step),
    pixelX: x,
    pixelY: y,
  };
}

/** Convert pixel coordinates to bead row/col */
export function pixelToCell(x, y, step) {
  return { col: Math.floor(x / step), row: Math.floor(y / step) };
}

/** Convert bead row/col to top-left pixel position */
export function cellToPixel(row, col, step) {
  return { x: col * step, y: row * step };
}

/** Clamp a value between min and max */
export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
