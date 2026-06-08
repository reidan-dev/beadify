import { useRef, useEffect, useCallback, useState } from 'react';
import { useStore } from '../store.js';
import { drawBoard } from '../canvas/renderer.js';
import { getBeadCoords, clamp } from '../canvas/interactions.js';

export function useCanvasBoard() {
  const canvasRef  = useRef(null);
  const blinkTimer = useRef(null);
  const [blinkOn, setBlinkOn]     = useState(true);
  const [tipPos,  setTipPos]      = useState(null);    // {x, y, text} | null
  const selectStart = useRef(null);
  const isDragging  = useRef(false);
  const suppressClick = useRef(false);
  const [panning, setPanning] = useState(false);

  const {
    project, doneSet, beadMap, cellPx, gapPx, roundBeads, showAllMode,
    selectedLabel, hiddenLabels, markedRows, markedCols,
    guideN, guideOriginCol, guideOriginRow, guideVisible, guideColor, guideLocked,
    showRulers, rulerRowOffset, rulerColOffset, viewRotation,
    activeTool,
    toggleBead, floodFill, markSelection,
    toggleMarkedRow, toggleMarkedCol,
    setGuideOrigin,
  } = useStore();

  // ─── Blink animation for selected-color highlight ───────────────────────────
  useEffect(() => {
    if (!selectedLabel) return;
    blinkTimer.current = setInterval(() => setBlinkOn(v => !v), 600);
    return () => clearInterval(blinkTimer.current);
  }, [selectedLabel]);

  // ─── Render whenever display state changes ───────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !project) return;
    drawBoard(canvas, {
      project, doneSet, beadMap, cellPx, gapPx, roundBeads, showAllMode,
      selectedLabel, hiddenLabels, markedRows, markedCols,
      guideN, guideOriginCol, guideOriginRow, guideVisible, guideColor,
      showRulers, rulerRowOffset, rulerColOffset,
      highlightBlink: blinkOn,
    });
  }, [
    project, doneSet, cellPx, gapPx, roundBeads, showAllMode,
    selectedLabel, hiddenLabels, markedRows, markedCols,
    guideN, guideOriginCol, guideOriginRow, guideVisible, guideColor,
    showRulers, rulerRowOffset, rulerColOffset, blinkOn,
  ]);

  // ─── Keyboard navigation ─────────────────────────────────────────────────────
  const [kbFocus, setKbFocus] = useState(null); // {row, col} | null

  useEffect(() => {
    const handler = (e) => {
      if (!project) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); useStore.getState().undo(); return; }
        if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); useStore.getState().redo(); return; }
      }

      if (!kbFocus) return;
      const moves = { ArrowRight:[0,1], ArrowLeft:[0,-1], ArrowDown:[1,0], ArrowUp:[-1,0] };
      if (moves[e.key]) {
        e.preventDefault();
        const [dr, dc] = moves[e.key];
        let { row, col } = kbFocus;
        const cols = project.width, rows = project.height;
        let attempts = 0;
        do {
          row = clamp(row + dr, 0, rows - 1);
          col = clamp(col + dc, 0, cols - 1);
        } while (!beadMap.has(`${row}:${col}`) && ++attempts < Math.max(rows, cols));
        setKbFocus({ row, col });
        return;
      }
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (kbFocus && beadMap.has(`${kbFocus.row}:${kbFocus.col}`)) {
          toggleBead(kbFocus.row, kbFocus.col);
        }
        return;
      }
      if (e.key === 'Escape') setKbFocus(null);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [project, kbFocus, beadMap, toggleBead]);

  // ─── Mouse handlers ──────────────────────────────────────────────────────────
  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas || !project) return;
    const { row, col } = getBeadCoords(canvas, e, cellPx, gapPx);

    // Tooltip
    const bead = beadMap.get(`${row}:${col}`);
    if (bead) {
      const r = row + (showRulers ? rulerRowOffset : 0);
      const c = col + (showRulers ? rulerColOffset : 0);
      setTipPos({ x: e.clientX + 12, y: e.clientY + 12, text: `${bead.label}  col ${c}, row ${r}` });
    } else {
      setTipPos(null);
    }

    // Guide drag
    if (activeTool === null && !guideLocked && guideN > 0 && isDragging.current) {
      setGuideOrigin(clamp(col, 0, project.width), clamp(row, 0, project.height));
    }

    // Select drag
    if (activeTool === 'select' && isDragging.current && selectStart.current) {
      const canvas = canvasRef.current;
      const step = cellPx + gapPx;
      const rect = canvas.getBoundingClientRect();
      const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const sy = (e.clientY - rect.top)  * (canvas.height / rect.height);
      // Draw selection overlay
      const ctx = canvas.getContext('2d');
      // Re-draw board then overlay
      drawBoard(canvas, {
        project, doneSet, beadMap, cellPx, gapPx, roundBeads, showAllMode,
        selectedLabel, hiddenLabels, markedRows, markedCols,
        guideN, guideOriginCol, guideOriginRow, guideVisible, guideColor,
        showRulers, rulerRowOffset, rulerColOffset, highlightBlink: blinkOn,
      });
      const x0 = Math.min(selectStart.current.x, sx);
      const y0 = Math.min(selectStart.current.y, sy);
      const w0 = Math.abs(sx - selectStart.current.x);
      const h0 = Math.abs(sy - selectStart.current.y);
      ctx.strokeStyle = 'rgba(91, 164, 245, 0.9)';
      ctx.fillStyle   = 'rgba(91, 164, 245, 0.08)';
      ctx.lineWidth   = 1.5;
      ctx.setLineDash([5, 3]);
      ctx.fillRect(x0, y0, w0, h0);
      ctx.strokeRect(x0, y0, w0, h0);
      ctx.setLineDash([]);
    }
  }, [project, beadMap, cellPx, gapPx, activeTool, guideLocked, guideN,
      showRulers, rulerRowOffset, rulerColOffset, setGuideOrigin,
      doneSet, roundBeads, showAllMode, selectedLabel, hiddenLabels,
      markedRows, markedCols, guideOriginCol, guideOriginRow, guideVisible,
      guideColor, blinkOn]);

  const handleMouseLeave = useCallback(() => setTipPos(null), []);

  // ─── Click-drag panning (scrolls the board wrapper) ──────────────────────────
  const startPan = useCallback((e, wrapper) => {
    const startX = e.clientX, startY = e.clientY;
    const scrollLeft0 = wrapper.scrollLeft, scrollTop0 = wrapper.scrollTop;
    let moved = false;
    setPanning(true);
    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) moved = true;
      wrapper.scrollLeft = scrollLeft0 - dx;
      wrapper.scrollTop  = scrollTop0  - dy;
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setPanning(false);
      if (moved) suppressClick.current = true;  // swallow the click after a drag
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  const handleMouseDown = useCallback((e) => {
    if (!project) return;
    const canvas = canvasRef.current;
    const wrapper = canvas?.closest('.board-wrapper');

    // Pan with middle button anywhere, or left button in plain cursor mode.
    // A left click that doesn't move still toggles the bead (handled in onClick).
    const leftPanOk = e.button === 0 && activeTool === null && (guideLocked || guideN === 0);
    if (wrapper && (e.button === 1 || leftPanOk)) {
      if (e.button === 1) e.preventDefault();   // stop middle-click autoscroll
      startPan(e, wrapper);
      return;
    }
    if (e.button !== 0) return;

    const { row, col } = getBeadCoords(canvas, e, cellPx, gapPx);
    isDragging.current = true;

    if (activeTool === 'select') {
      const rect = canvas.getBoundingClientRect();
      const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const sy = (e.clientY - rect.top)  * (canvas.height / rect.height);
      selectStart.current = { x: sx, y: sy, row, col };
      e.preventDefault();
      return;
    }

    if (!guideLocked && guideN > 0) {
      // Guide drag starts — do nothing else
      return;
    }
  }, [project, cellPx, gapPx, activeTool, guideLocked, guideN, startPan]);

  const handleMouseUp = useCallback((e) => {
    if (!project || !isDragging.current) return;
    isDragging.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { row, col } = getBeadCoords(canvas, e, cellPx, gapPx);

    if (activeTool === 'select' && selectStart.current) {
      const r1 = Math.min(selectStart.current.row, row);
      const r2 = Math.max(selectStart.current.row, row);
      const c1 = Math.min(selectStart.current.col, col);
      const c2 = Math.max(selectStart.current.col, col);
      markSelection(r1, c1, r2, c2);
      selectStart.current = null;
      return;
    }
  }, [project, cellPx, gapPx, activeTool, markSelection]);

  const handleClick = useCallback((e) => {
    if (suppressClick.current) { suppressClick.current = false; return; }
    if (!project) return;
    const canvas = canvasRef.current;
    const { row, col } = getBeadCoords(canvas, e, cellPx, gapPx);

    if (!beadMap.has(`${row}:${col}`)) return;

    if (activeTool === 'fill') {
      floodFill(row, col);
      return;
    }
    if (activeTool === 'markRow') {
      toggleMarkedRow(row);
      return;
    }
    if (activeTool === 'markCol') {
      toggleMarkedCol(col);
      return;
    }
    if (activeTool === 'select') return; // handled in mouseup

    toggleBead(row, col);
    setKbFocus({ row, col });
  }, [project, beadMap, cellPx, gapPx, activeTool,
      toggleBead, floodFill, toggleMarkedRow, toggleMarkedCol]);

  // ─── Zoom-to-fit ─────────────────────────────────────────────────────────────
  const zoomToFit = useCallback(() => {
    if (!project) return;
    const wrapper = canvasRef.current?.closest('.board-wrapper');
    if (!wrapper) return;
    const availW = wrapper.clientWidth  - 40;
    const availH = wrapper.clientHeight - 40;
    const gp = gapPx;
    const fit = Math.max(1, Math.floor(Math.min(
      (availW - gp * (project.width  - 1)) / project.width,
      (availH - gp * (project.height - 1)) / project.height
    )));
    useStore.getState().setCellPx(fit);
  }, [project, gapPx]);

  // ─── Canvas cursor ────────────────────────────────────────────────────────────
  const getCursor = () => {
    if (panning) return 'grabbing';
    if (!guideLocked && guideN > 0) return isDragging.current ? 'grabbing' : 'grab';
    if (activeTool === 'fill')    return 'cell';
    if (activeTool === 'select')  return 'crosshair';
    if (activeTool === 'markRow' || activeTool === 'markCol') return 'crosshair';
    return 'pointer';
  };

  return {
    canvasRef,
    tipPos,
    kbFocus,
    getCursor,
    zoomToFit,
    handlers: {
      onClick:       handleClick,
      onMouseMove:   handleMouseMove,
      onMouseLeave:  handleMouseLeave,
      onMouseDown:   handleMouseDown,
      onMouseUp:     handleMouseUp,
    },
  };
}
