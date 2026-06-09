import { useState, useMemo } from 'react';
import { useStore } from '../store.js';

function hexToHue(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  if (max === r) return (((g - b) / d + (g < b ? 6 : 0)) / 6) * 360;
  if (max === g) return (((b - r) / d + 2) / 6) * 360;
  return (((r - g) / d + 4) / 6) * 360;
}

export function Legend() {
  const {
    project, doneSet, selectedLabel, hiddenLabels, legendSort, setLegendSort,
    selectLabel, clearSelection, toggleHiddenLabel, toggleAllLabels, markAllByLabel,
  } = useStore();

  const [collapsed, setCollapsed] = useState({ done: false, pending: false });

  const allEntries = useMemo(() => {
    if (!project) return [];
    const counts = new Map();
    for (const b of project.beads) {
      if (b.transparent) continue;
      if (!counts.has(b.label)) counts.set(b.label, { label: b.label, color: b.color, total: 0, done: 0 });
      const e = counts.get(b.label);
      e.total++;
      if (doneSet.has(`${b.row}:${b.col}`)) e.done++;
    }
    return [...counts.values()];
  }, [project, doneSet]);

  const sorted = useMemo(() => {
    const arr = [...allEntries];
    if (legendSort === 'name')  arr.sort((a, b) => a.label.localeCompare(b.label));
    if (legendSort === 'count') arr.sort((a, b) => (b.total - b.done) - (a.total - a.done));
    if (legendSort === 'color') arr.sort((a, b) => hexToHue(a.color) - hexToHue(b.color));
    return arr;
  }, [allEntries, legendSort]);

  const pending = sorted.filter(e => e.done < e.total);
  const done    = sorted.filter(e => e.done === e.total);

  const totalBeads = allEntries.reduce((s, e) => s + e.total, 0);
  const totalDone  = allEntries.reduce((s, e) => s + e.done,  0);

  if (!project) return null;

  return (
    <div className="legend">
      <div className="legend-header">
        <span className="legend-title">Legend</span>
        <span className="legend-count">{totalDone}/{totalBeads}</span>
        {selectedLabel && (
          <button className="btn btn-ghost btn-xs" onClick={clearSelection} title={`Deselect ${selectedLabel}`}>
            ✕ {selectedLabel}
          </button>
        )}
        <button className="btn btn-ghost btn-xs" onClick={toggleAllLabels} title="Toggle all visibility">👁</button>
      </div>

      {/* Sort controls */}
      <div style={{ display: 'flex', gap: 4, padding: '6px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {(['name', 'count', 'color']).map(s => (
          <button
            key={s}
            className={`btn btn-xs ${legendSort === s ? 'active btn-primary' : 'btn-ghost'}`}
            onClick={() => setLegendSort(s)}
            style={{ flex: 1 }}
          >
            {s === 'name' ? 'A-Z' : s === 'count' ? '#' : '🎨'}
          </button>
        ))}
      </div>

      <div className="legend-list">
        {pending.length > 0 && (
          <div className={`legend-group-section ${collapsed.pending ? 'collapsed' : ''}`}>
            <div
              className="legend-group-header"
              onClick={() => setCollapsed(s => ({ ...s, pending: !s.pending }))}
            >
              <span className="legend-chevron">▾</span>
              Remaining
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-dim)' }}>
                {pending.length}
              </span>
            </div>
            <div className="legend-group-body">
              {pending.map(entry => (
                <LegendItem
                  key={entry.label}
                  entry={entry}
                  isSelected={selectedLabel === entry.label}
                  isHidden={hiddenLabels.has(entry.label)}
                  onClick={() => selectLabel(entry.label)}
                  onToggleHide={() => toggleHiddenLabel(entry.label)}
                  onMarkAll={val => markAllByLabel(entry.label, val)}
                />
              ))}
            </div>
          </div>
        )}

        {done.length > 0 && (
          <div className={`legend-group-section ${collapsed.done ? 'collapsed' : ''}`}>
            <div
              className="legend-group-header all-done"
              onClick={() => setCollapsed(s => ({ ...s, done: !s.done }))}
            >
              <span className="legend-chevron">▾</span>
              Completed
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.62rem' }}>
                {done.length}
              </span>
            </div>
            <div className="legend-group-body">
              {done.map(entry => (
                <LegendItem
                  key={entry.label}
                  entry={entry}
                  isSelected={selectedLabel === entry.label}
                  isHidden={hiddenLabels.has(entry.label)}
                  allDone
                  onClick={() => selectLabel(entry.label)}
                  onToggleHide={() => toggleHiddenLabel(entry.label)}
                  onMarkAll={val => markAllByLabel(entry.label, val)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {totalBeads > 0 && (
        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <div className="progress-bar-wrap" style={{ maxWidth: '100%' }}>
            <span className="progress-label">Progress</span>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${Math.round((totalDone / totalBeads) * 100)}%` }} />
            </div>
            <span className="progress-pct">{Math.round((totalDone / totalBeads) * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

function LegendItem({ entry, isSelected, isHidden, allDone, onClick, onToggleHide, onMarkAll }) {
  return (
    <div
      className={`legend-item ${isSelected ? 'selected' : ''} ${allDone ? 'all-done' : ''}`}
      style={{ opacity: isHidden ? 0.45 : 1 }}
      onClick={onClick}
    >
      <div className="legend-swatch" style={{ background: entry.color }} />
      <div className="legend-info">
        <div className="legend-label">{entry.label}</div>
        <div className="legend-done">{entry.done}/{entry.total}</div>
      </div>
      <div className="legend-item-actions">
        <button
          className="btn btn-ghost btn-xs btn-icon"
          title={isHidden ? 'Show' : 'Hide'}
          onClick={e => { e.stopPropagation(); onToggleHide(); }}
        >
          {isHidden ? '○' : '●'}
        </button>
        {!allDone ? (
          <button
            className="btn btn-ghost btn-xs btn-icon"
            title="Mark all done"
            onClick={e => { e.stopPropagation(); onMarkAll(true); }}
          >✓</button>
        ) : (
          <button
            className="btn btn-ghost btn-xs btn-icon"
            title="Mark all undone"
            onClick={e => { e.stopPropagation(); onMarkAll(false); }}
          >↩</button>
        )}
      </div>
    </div>
  );
}
