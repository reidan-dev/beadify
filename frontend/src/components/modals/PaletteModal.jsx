import { useEffect, useState, useMemo, useRef } from 'react';
import { useStore } from '../../store.js';
import { getPalette } from '../../api.js';
import { drawBoardThumbnail, applyOpacity, flattenPalette } from '../../utils.js';

export function PaletteModal({ onClose }) {
  const { project, selectedLabel, swapColor, paletteMode, opacityLevel, boardBg } = useStore();
  const [palette,   setPalette]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [swapMode,  setSwapMode]  = useState(false);
  const [swapFrom,  setSwapFrom]  = useState(selectedLabel ?? null);
  const [search,    setSearch]    = useState('');
  const [hoverEntry, setHoverEntry] = useState(null); // palette entry being previewed

  const beforeCanvasRef = useRef(null);
  const afterCanvasRef  = useRef(null);

  useEffect(() => {
    setLoading(true);
    getPalette(paletteMode)
      .then(data => setPalette(flattenPalette(data)))
      .catch(() => setPalette([]))
      .finally(() => setLoading(false));
  }, [paletteMode]);

  // Labels currently used in the board
  const usedLabels = useMemo(() => {
    if (!project) return new Set();
    return new Set(project.beads.filter(b => !b.transparent).map(b => b.label));
  }, [project]);

  // Current color of swapFrom label
  const swapFromColor = useMemo(() => {
    if (!project || !swapFrom) return null;
    return project.beads.find(b => b.label === swapFrom)?.color ?? null;
  }, [project, swapFrom]);

  const filtered = palette.filter(c => {
    const q = search.toLowerCase();
    return !q || c.label.toLowerCase().includes(q) || c.hex.toLowerCase().includes(q);
  });

  const showPreview = swapMode && !!swapFrom && !!project;

  // Reset any pending preview when the swap target or mode changes.
  useEffect(() => { setHoverEntry(null); }, [swapFrom, swapMode]);

  // "Before" thumbnail — the board as it stands now.
  useEffect(() => {
    if (!showPreview) return;
    drawBoardThumbnail(beforeCanvasRef.current, project, { boardBg });
  }, [showPreview, project, boardBg]);

  // "After" thumbnail — the board with the hovered swatch applied to swapFrom.
  useEffect(() => {
    if (!showPreview) return;
    const overrideColor = hoverEntry
      ? (paletteMode === 'miracle_works' ? applyOpacity(hoverEntry.hex, opacityLevel) : hoverEntry.hex)
      : null;
    drawBoardThumbnail(afterCanvasRef.current, project, {
      boardBg,
      overrideLabel: hoverEntry ? swapFrom : null,
      overrideColor,
    });
  }, [showPreview, project, boardBg, hoverEntry, swapFrom, paletteMode, opacityLevel]);

  const handlePaletteClick = (entry) => {
    if (!swapMode || !swapFrom) return;
    swapColor(swapFrom, entry.label, entry.hex);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ width: 680, maxHeight: '85vh' }}>
        <div className="modal-header">
          <span className="modal-title">
            {paletteMode === 'miracle_works' ? 'Miracle Works Palette' : 'Bead Palette'}
          </span>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>

        {/* Swap controls */}
        {project && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <label className="toggle" style={{ flexShrink: 0 }}>
              <input type="checkbox" checked={swapMode} onChange={e => setSwapMode(e.target.checked)} />
              Swap color mode
            </label>

            {swapMode && (
              <>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                  Replacing:
                </span>
                <select
                  className="input"
                  value={swapFrom ?? ''}
                  onChange={e => setSwapFrom(e.target.value || null)}
                  style={{ width: 'auto' }}
                >
                  <option value="">Pick a label…</option>
                  {[...usedLabels].sort().map(label => (
                    <option key={label} value={label}>{label}</option>
                  ))}
                </select>
                {swapFromColor && (
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: swapFromColor, border: '2px solid rgba(255,255,255,0.2)',
                    flexShrink: 0,
                  }} />
                )}
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  → hover a color below to preview, click to swap
                </span>
              </>
            )}
          </div>
        )}

        {/* Before / after board preview */}
        {showPreview && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <div className="modal-hint" style={{ marginBottom: 4 }}>Before</div>
              <canvas ref={beforeCanvasRef} style={{ display: 'block', border: '1px solid var(--border)', borderRadius: 4 }} />
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-lg)' }}>→</span>
            <div style={{ textAlign: 'center' }}>
              <div className="modal-hint" style={{ marginBottom: 4 }}>
                {hoverEntry ? `After (→ ${hoverEntry.label})` : 'After (hover a color)'}
              </div>
              <canvas ref={afterCanvasRef} style={{ display: 'block', border: '1px solid var(--border)', borderRadius: 4 }} />
            </div>
          </div>
        )}

        {/* Search */}
        <input
          className="num-input full"
          type="text"
          placeholder="Search by label or hex…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading palette…
          </div>
        ) : (
          <div style={{ overflowY: 'auto', flex: 1 }}>
            <div className="palette-grid">
              {filtered.map(entry => {
                const inUse = usedLabels.has(entry.label);
                return (
                  <div
                    key={entry.label}
                    className={`palette-card ${inUse ? 'used' : ''}`}
                    onClick={() => handlePaletteClick(entry)}
                    onMouseEnter={() => showPreview && setHoverEntry(entry)}
                    onMouseLeave={() => showPreview && setHoverEntry(null)}
                    style={{ cursor: swapMode && swapFrom ? 'pointer' : 'default' }}
                    title={swapMode && swapFrom ? `Swap to ${entry.label}` : entry.label}
                  >
                    <div
                      className="palette-dot"
                      style={{ background: entry.hex }}
                    />
                    <div className="palette-card-label">{entry.label}</div>
                    <div className="palette-card-hex">{entry.hex}</div>
                    {inUse && (
                      <div style={{ fontSize: '0.6rem', color: 'var(--accent-light)', fontWeight: 700 }}>
                        IN USE
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="modal-footer">
          <span className="modal-hint">
            {palette.length} colors in palette · {usedLabels.size} used in current board
          </span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
