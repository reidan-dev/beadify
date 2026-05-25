const SHORTCUTS = [
  ['Arrow keys',           'Move focus bead by bead'],
  ['Space / Enter',        'Toggle focused bead'],
  ['Ctrl+Z',               'Undo'],
  ['Ctrl+Y / Ctrl+Shift+Z','Redo'],
  ['Escape',               'Clear keyboard focus'],
  ['Ctrl+Scroll',          'Zoom in / out'],
];

export function AboutModal({ onClose }) {
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ width: 520 }}>

        {/* Header */}
        <div className="modal-header">
          <span className="modal-title">About Beadify</span>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>

          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', lineHeight: 1.7 }}>
            <strong style={{ color: 'var(--text)' }}>Beadify</strong> turns any image into a bead
            art pattern. Upload a photo or pixel art and Beadify converts it into a color-matched
            grid using your physical Hama / Perler bead palette.
          </p>

          <Section title="How it works">
            <ol style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 5, color: 'var(--text-muted)', fontSize: 'var(--text-sm)', lineHeight: 1.65 }}>
              <li>Upload your image in the sidebar (single or multi-image mode)</li>
              <li>Optionally crop, flip, or rotate it</li>
              <li>Set the bead size or force an exact column / row count</li>
              <li>Click <strong style={{ color: 'var(--accent)' }}>Generate Board</strong> — each cell is matched to the closest palette color via CIEDE2000</li>
              <li>On the <strong style={{ color: 'var(--text)' }}>Board</strong> tab, click beads to mark them as placed</li>
              <li>Progress saves automatically on every click</li>
            </ol>
          </Section>

          <Section title="Keyboard shortcuts">
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'max-content 1fr',
              columnGap: 20,
              rowGap: 5,
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
            }}>
              {SHORTCUTS.map(([key, desc]) => (
                <Row key={key} label={key} value={desc} />
              ))}
            </div>
          </Section>

          <Section title="Tips">
            <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 5, color: 'var(--text-muted)', fontSize: 'var(--text-sm)', lineHeight: 1.65 }}>
              <li><strong style={{ color: 'var(--text)' }}>Multi-Image</strong> mode tiles multiple images into one board (horizontal, vertical, or grid)</li>
              <li>The <strong style={{ color: 'var(--text)' }}>Guide grid</strong> overlays an N×N repeating grid — great for sectioning large boards</li>
              <li>Click a color in the Legend to dim all others and focus that color on the board</li>
              <li><strong style={{ color: 'var(--text)' }}>Export CSV</strong> gives you per-color bead counts as a shopping list</li>
              <li>Display settings (zoom, theme, sort, guide) persist in your browser</li>
            </ul>
          </Section>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn btn-primary btn-sm" onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: 'var(--radius)',
      padding: '12px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{
        fontWeight: 700,
        color: 'var(--text)',
        fontSize: 'var(--text-xs)',
        textTransform: 'uppercase',
        letterSpacing: '0.09em',
        paddingBottom: 4,
        borderBottom: '1px solid var(--border)',
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <>
      <span style={{ color: 'var(--accent)', whiteSpace: 'nowrap', paddingTop: 1 }}>{label}</span>
      <span style={{ color: 'var(--text-muted)', paddingTop: 1 }}>{value}</span>
    </>
  );
}
