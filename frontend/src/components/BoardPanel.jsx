import { useCallback, useEffect, useRef } from 'react';
import { useStore } from '../store.js';
import { useCanvasBoard } from '../hooks/useCanvasBoard.js';
import { Legend } from './Legend.jsx';

export function BoardPanel() {
  const {
    project, doneSet, beadMap,
    cellPx, setCellPx, gapPx, setGapPx,
    roundBeads, toggleRoundBeads, showAllMode, toggleShowAll,
    activeTool, setActiveTool,
    showRulers, toggleRulers, rulerRowOffset, setRulerRowOffset, rulerColOffset, setRulerColOffset,
    guideN, setGuideN, guideVisible, toggleGuideVisible, guideLocked, toggleGuideLock,
    guideColor, setGuideColor, clearGuide,
    viewRotation, rotateViewCw, rotateViewCcw,
    manualSave, clearAll, clearMarks, resetAll,
  } = useStore();

  const { canvasRef, tipPos, kbFocus, getCursor, zoomToFit, handlers } = useCanvasBoard();
  const wrapperRef = useRef(null);

  // Ctrl/Cmd + scroll to zoom
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const handler = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? 2 : -2;
      const { cellPx: cur } = useStore.getState();
      useStore.getState().setCellPx(cur + delta);
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  // Export PNG
  const exportPng = useCallback(() => {
    if (!project) return;
    const px = 20, gap = 1, step = px + gap;
    const c = document.createElement('canvas');
    c.width  = project.width  * step - gap;
    c.height = project.height * step - gap;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#07070e';
    ctx.fillRect(0, 0, c.width, c.height);
    for (const b of project.beads) {
      if (b.transparent) continue;
      if (doneSet.has(`${b.row}:${b.col}`)) continue;
      ctx.fillStyle = b.color;
      ctx.fillRect(b.col * step, b.row * step, px, px);
    }
    const a = document.createElement('a');
    a.href     = c.toDataURL('image/png');
    a.download = `${project.name || 'beadify'}.png`;
    a.click();
  }, [project, doneSet]);

  if (!project) return null;

  const totalBeads = [...beadMap.values()].length;
  const doneCount  = doneSet.size;
  const pct        = totalBeads > 0 ? Math.round((doneCount / totalBeads) * 100) : 0;

  const toolBtn = (tool, label, title) => (
    <button
      className={`btn btn-ghost btn-sm ${activeTool === tool ? 'active' : ''}`}
      onClick={() => setActiveTool(tool)}
      title={title}
    >
      {label}
    </button>
  );

  return (
    <div className="board-section">
      {/* Top controls */}
      <div className="board-controls">
        <div className="ctrl-group">
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setCellPx(cellPx - 2)} title="Zoom out (Ctrl+scroll)">−</button>
          <span className="zoom-val">{cellPx}px</span>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setCellPx(cellPx + 2)} title="Zoom in (Ctrl+scroll)">+</button>
          <button className="btn btn-ghost btn-sm" onClick={zoomToFit}>Fit</button>
        </div>

        <div className="ctrl-sep" />

        <div className="ctrl-group">
          <button className="btn btn-ghost btn-sm" onClick={() => useStore.getState().undo()} title="Undo (Ctrl+Z)">↩</button>
          <button className="btn btn-ghost btn-sm" onClick={() => useStore.getState().redo()} title="Redo (Ctrl+Y)">↪</button>
        </div>

        <div className="ctrl-sep" />

        <div className="ctrl-group">
          <button className="btn btn-ghost btn-sm" onClick={manualSave}>Save</button>
          <button className="btn btn-ghost btn-sm" onClick={exportPng} title="Export PNG">PNG</button>
          <button className="btn btn-ghost btn-sm" onClick={clearAll} title="Unmark all beads">Clear all</button>
        </div>

        <div className="ctrl-spacer" />

        <div className="progress-bar-wrap">
          <span className="progress-label">Done</span>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="progress-pct">{doneCount}/{totalBeads} · {pct}%</span>
        </div>
      </div>

      {/* Tools row */}
      <div className="board-controls board-controls-tools">
        <div className="toolbar-group">
          <span className="toolbar-group-label">Tool</span>
          {toolBtn(null,      '✦ Cursor', 'Click to toggle bead')}
          {toolBtn('fill',    '◈ Fill',   'Flood-fill same-color region')}
          {toolBtn('select',  '⬚ Box',    'Drag to select rectangle')}
          {toolBtn('markRow', '↔ Row',    'Click to mark row')}
          {toolBtn('markCol', '↕ Col',    'Click to mark column')}
        </div>

        <div className="toolbar-group">
          <span className="toolbar-group-label">View</span>
          <button className={`btn btn-ghost btn-sm ${roundBeads ? 'active' : ''}`} onClick={toggleRoundBeads} title="Round beads">○ Round</button>
          <button className={`btn btn-ghost btn-sm ${showAllMode ? 'active' : ''}`} onClick={toggleShowAll} title="Show all beads">◎ All</button>
          <button className={`btn btn-ghost btn-sm ${showRulers ? 'active' : ''}`} onClick={toggleRulers} title="Show rulers"># Rulers</button>
          {showRulers && (
            <>
              <input className="num-input sm" type="number" value={rulerRowOffset}
                onChange={e => setRulerRowOffset(+e.target.value)} title="Row offset" style={{ width: 44 }} />
              <input className="num-input sm" type="number" value={rulerColOffset}
                onChange={e => setRulerColOffset(+e.target.value)} title="Col offset" style={{ width: 44 }} />
            </>
          )}
        </div>

        <div className="toolbar-group">
          <span className="toolbar-group-label">Guide {guideN > 0 ? `(${guideN}×${guideN})` : ''}</span>
          <input
            className="num-input sm"
            type="number" min="0" max="50"
            value={guideN}
            onChange={e => setGuideN(+e.target.value)}
            title="Guide every N beads (0 = off)"
            style={{ width: 44 }}
          />
          {guideN > 0 && (
            <>
              <button className={`btn btn-ghost btn-sm ${guideVisible ? 'active' : ''}`} onClick={toggleGuideVisible} title="Show/hide guide">Show</button>
              <button className={`btn btn-ghost btn-sm ${!guideLocked ? 'active' : ''}`} onClick={toggleGuideLock} title="Lock/drag guide">
                {guideLocked ? '🔒' : '🔓'}
              </button>
              <input
                type="color" value={guideColor} onChange={e => setGuideColor(e.target.value)}
                style={{ width: 26, height: 26, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                title="Guide color"
              />
              <button className="btn btn-ghost btn-xs" onClick={clearGuide} title="Remove guide">✕</button>
            </>
          )}
        </div>

        <div className="toolbar-group">
          <span className="toolbar-group-label">Rotate</span>
          <button className="btn btn-ghost btn-sm" onClick={rotateViewCcw} title="Rotate view CCW">↺</button>
          <button className="btn btn-ghost btn-sm" onClick={rotateViewCw}  title="Rotate view CW">↻</button>
        </div>

        <button className="btn btn-ghost btn-sm" onClick={clearMarks} title="Clear row/col marks">Clear marks</button>
      </div>

      {/* Board + Legend */}
      <div className="board-layout">
        <div
          className="board-wrapper"
          ref={wrapperRef}
          title="Ctrl+scroll to zoom · Scroll or drag (left/middle button) to pan"
        >
          <div
            className="board-canvas-container"
            style={{ transform: viewRotation ? `rotate(${viewRotation}deg)` : undefined }}
          >
            <canvas
              ref={canvasRef}
              className="board-canvas"
              style={{ cursor: getCursor() }}
              tabIndex={0}
              {...handlers}
            />

            {kbFocus && (
              <div style={{
                position: 'absolute', pointerEvents: 'none',
                border: '2px solid var(--accent)', borderRadius: 2,
                boxShadow: '0 0 0 3px var(--accent-glow)',
                left: kbFocus.col * (cellPx + gapPx),
                top:  kbFocus.row * (cellPx + gapPx),
                width: cellPx, height: cellPx,
              }} />
            )}

            {activeTool && (
              <div className="mode-badge">
                {activeTool === 'fill'    && 'Fill mode'}
                {activeTool === 'select'  && 'Select mode'}
                {activeTool === 'markRow' && 'Mark row'}
                {activeTool === 'markCol' && 'Mark col'}
              </div>
            )}
          </div>
        </div>

        <Legend />
      </div>

      {tipPos && (
        <div className="bead-tip visible" style={{ left: tipPos.x, top: tipPos.y }}>
          {tipPos.text}
        </div>
      )}
    </div>
  );
}
