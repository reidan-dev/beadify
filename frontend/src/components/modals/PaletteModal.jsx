import { useEffect, useState, useMemo } from 'react';
import { useStore } from '../../store.js';
import { getPalette } from '../../api.js';

export function PaletteModal({ onClose }) {
  const { project, selectedLabel, swapColor } = useStore();
  const [palette,   setPalette]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [swapMode,  setSwapMode]  = useState(false);
  const [swapFrom,  setSwapFrom]  = useState(selectedLabel ?? null);
  const [search,    setSearch]    = useState('');

  useEffect(() => {
    getPalette()
      .then(setPalette)
      .catch(() => setPalette([]))
      .finally(() => setLoading(false));
  }, []);

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

  const handlePaletteClick = (entry) => {
    if (!swapMode || !swapFrom) return;
    swapColor(swapFrom, entry.label, entry.hex);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ width: 680, maxHeight: '85vh' }}>
        <div className="modal-header">
          <span className="modal-title">Bead Palette</span>
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
                  → click a color below to swap
                </span>
              </>
            )}
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
