import { labelTextColor } from '../utils.js';

export function drawBoard(canvas, {
  project,
  doneSet,
  beadMap,
  cellPx,
  gapPx,
  roundBeads,
  showAllMode,
  selectedLabel,
  hiddenLabels,
  markedRows,
  markedCols,
  guideN,
  guideOriginCol,
  guideOriginRow,
  guideVisible,
  guideColor,
  showRulers,
  rulerRowOffset,
  rulerColOffset,
  highlightBlink,
}) {
  if (!project) return;
  const ctx = canvas.getContext('2d');
  const { width: cols, height: rows, beads } = project;
  const step   = cellPx + gapPx;
  const totalW = cols * step - gapPx;
  const totalH = rows * step - gapPx;

  if (canvas.width !== totalW || canvas.height !== totalH) {
    canvas.width  = totalW;
    canvas.height = totalH;
  }

  ctx.fillStyle = 'var(--board-bg, #07070e)';
  ctx.fillRect(0, 0, totalW, totalH);

  const hasFocus    = !!selectedLabel;
  const showLabels  = cellPx >= 14;
  const fontSize    = Math.max(5, Math.round(cellPx * 0.38));
  ctx.font        = `700 ${fontSize}px 'JetBrains Mono', monospace`;
  ctx.textAlign   = 'center';
  ctx.textBaseline = 'middle';

  for (const bead of beads) {
    if (bead.transparent) continue;
    const x   = bead.col * step;
    const y   = bead.row * step;
    const key = `${bead.row}:${bead.col}`;

    const isDone     = doneSet.has(key);
    const isHidden   = hiddenLabels.has(bead.label);
    const isSelected = bead.label === selectedLabel;
    const isDimmed   = isHidden || (hasFocus && !isSelected);

    // Alpha: hidden → very dim; unfocused → slightly dim; normal → opaque
    let alpha;
    if (isHidden)            alpha = 0.13;
    else if (isDimmed)       alpha = 0.28;
    else if (isDone && !showAllMode) alpha = 0.12;
    else                     alpha = 0.88;

    ctx.globalAlpha = alpha;
    ctx.fillStyle   = bead.color;

    if (roundBeads) {
      const r = cellPx / 2 - 0.5;
      ctx.beginPath();
      ctx.arc(x + cellPx / 2, y + cellPx / 2, Math.max(1, r), 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(x, y, cellPx, cellPx);
    }
    ctx.globalAlpha = 1;

    // Label — always show when cell is large enough and bead is not done.
    // Hidden beads get a muted lavender label (always readable on the dark board).
    // Dimmed (unfocused) beads get the normal contrasting color at half opacity.
    if (showLabels && !isDone) {
      if (isHidden) {
        ctx.globalAlpha = 0.65;
        ctx.fillStyle   = 'rgba(190, 175, 235, 1)';
      } else if (isDimmed) {
        ctx.globalAlpha = 0.4;
        ctx.fillStyle   = labelTextColor(bead.color);
      } else {
        ctx.fillStyle = labelTextColor(bead.color);
      }
      ctx.fillText(bead.label, x + cellPx / 2, y + cellPx / 2);
      ctx.globalAlpha = 1;
    }

    // Selection highlight (pulsing border on focused label)
    if (isSelected && !isDone) {
      ctx.strokeStyle = highlightBlink
        ? 'rgba(91, 164, 245, 0.95)'
        : 'rgba(91, 164, 245, 0.2)';
      ctx.lineWidth = Math.max(1.5, cellPx * 0.12);
      if (roundBeads) {
        ctx.beginPath();
        ctx.arc(x + cellPx / 2, y + cellPx / 2, Math.max(1, cellPx / 2 - 1), 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.strokeRect(x + 1, y + 1, cellPx - 2, cellPx - 2);
      }
    }
  }

  // Guide grid
  if (guideVisible && guideN > 0) {
    const oCol = guideOriginCol ?? 0;
    const oRow = guideOriginRow ?? 0;
    ctx.strokeStyle = guideColor;
    ctx.lineWidth   = 1.5;
    ctx.globalAlpha = 0.7;

    for (let c = oCol % guideN; c <= cols; c += guideN) {
      ctx.beginPath();
      ctx.moveTo(c * step - 0.5, 0);
      ctx.lineTo(c * step - 0.5, totalH);
      ctx.stroke();
    }
    for (let r = oRow % guideN; r <= rows; r += guideN) {
      ctx.beginPath();
      ctx.moveTo(0, r * step - 0.5);
      ctx.lineTo(totalW, r * step - 0.5);
      ctx.stroke();
    }
    // Origin crosshair
    const cx = oCol * step, cy = oRow * step;
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 10, cy); ctx.lineTo(cx + 10, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy + 10); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Row/col mark lines
  if (markedRows.size || markedCols.size) {
    ctx.strokeStyle = 'rgba(255, 60, 90, 0.85)';
    ctx.lineWidth   = 2;
    for (const r of markedRows) {
      const y = r * step - 1;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(totalW, y); ctx.stroke();
    }
    for (const c of markedCols) {
      const x = c * step - 1;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, totalH); ctx.stroke();
    }
  }

  // Rulers
  if (showRulers && cellPx >= 6) {
    ctx.font          = `600 9px 'JetBrains Mono', monospace`;
    ctx.fillStyle     = 'rgba(107, 125, 179, 0.75)';
    ctx.textAlign     = 'left';
    ctx.textBaseline  = 'middle';
    const rowInterval = rows <= 20 ? 1 : rows <= 50 ? 5 : 10;
    for (let r = 0; r < rows; r += rowInterval) {
      ctx.fillText(r + rulerRowOffset, 2, r * step + cellPx / 2);
    }
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    const colInterval = cols <= 20 ? 1 : cols <= 50 ? 5 : 10;
    for (let c = 0; c < cols; c += colInterval) {
      ctx.fillText(c + rulerColOffset, c * step + cellPx / 2, 2);
    }
  }
}

export function drawSelectionRect(canvas, { x, y, w, h }) {
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = 'rgba(157, 127, 248, 0.9)';
  ctx.fillStyle   = 'rgba(157, 127, 248, 0.08)';
  ctx.lineWidth   = 2;
  ctx.setLineDash([5, 3]);
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
}
