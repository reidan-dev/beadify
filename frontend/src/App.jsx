import { useState, useEffect } from 'react';
import { useStore } from './store.js';
import { exportCountsUrl } from './api.js';
import { SetupPanel } from './components/SetupPanel.jsx';
import { PreviewPanel } from './components/PreviewPanel.jsx';
import { BoardPanel } from './components/BoardPanel.jsx';
import { CropModal } from './components/modals/CropModal.jsx';
import { PaletteModal } from './components/modals/PaletteModal.jsx';
import { AboutModal } from './components/modals/AboutModal.jsx';

export default function App() {
  const {
    activeTab, setActiveTab,
    project, loadedImage,
    status, clearStatus,
    theme, toggleTheme,
    resetAll,
  } = useStore();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showCropModal,    setShowCropModal]     = useState(false);
  const [showPaletteModal, setShowPaletteModal]  = useState(false);
  const [showAbout,        setShowAbout]          = useState(false);

  // Apply theme to <html> element so CSS [data-theme] selectors work
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const hasContent = loadedImage || project;

  const handleReset = () => {
    if (!hasContent || window.confirm('Reset everything and start over?')) {
      resetAll();
    }
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-logo">
          <div className="header-logo-dot">◉</div>
          <span className="header-logo-name">Beadify</span>
          <span className="header-logo-badge">v2</span>
        </div>

        {hasContent && (
          <div className="tab-bar" style={{ borderBottom: 'none', marginLeft: 12, padding: 0 }}>
            <button
              className={`tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
              onClick={() => setActiveTab('preview')}
              disabled={!loadedImage}
            >
              Preview
            </button>
            <button
              className={`tab-btn ${activeTab === 'board' ? 'active' : ''}`}
              onClick={() => setActiveTab('board')}
              disabled={!project}
            >
              Board
            </button>
          </div>
        )}

        <div className="header-spacer" />

        <div className="header-actions">
          {project && (
            <button className="btn btn-ghost btn-sm" onClick={() => setShowPaletteModal(true)}>
              Palette
            </button>
          )}
          {project && (
            <a href={exportCountsUrl(project.name)} download className="btn btn-ghost btn-sm">
              Export CSV
            </a>
          )}
          {hasContent && (
            <button className="btn btn-ghost btn-sm" onClick={handleReset} title="Reset — clear project and start over">
              Reset
            </button>
          )}
          <button
            className="btn btn-ghost btn-sm btn-icon"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowAbout(true)}>
            About
          </button>
        </div>
      </header>

      {status && (
        <div
          className={`status-bar ${status.type}`}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <span>{status.msg}</span>
          <button
            onClick={clearStatus}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '0 4px' }}
          >
            ✕
          </button>
        </div>
      )}

      <div className="app-body">
        <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed(v => !v)}
            title={sidebarCollapsed ? 'Expand' : 'Collapse'}
          >
            {sidebarCollapsed ? '›' : '‹'}
          </button>
          {!sidebarCollapsed && (
            <div className="sidebar-content">
              <SetupPanel onOpenCrop={() => setShowCropModal(true)} />
            </div>
          )}
        </aside>

        <main className="app-main">
          {activeTab === 'preview' && loadedImage && <PreviewPanel />}
          {activeTab === 'board'   && project     && <BoardPanel />}
          {!hasContent && <EmptyState onAbout={() => setShowAbout(true)} />}
        </main>
      </div>

      {showCropModal    && <CropModal    onClose={() => setShowCropModal(false)} />}
      {showPaletteModal && <PaletteModal onClose={() => setShowPaletteModal(false)} />}
      {showAbout        && <AboutModal   onClose={() => setShowAbout(false)} />}
    </div>
  );
}

function EmptyState({ onAbout }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">◉ ○ ◉</div>
      <p className="empty-title">No image loaded</p>
      <p className="empty-sub">
        Upload an image in the sidebar to get started.
        Your image will be converted into a bead pattern.
      </p>
      <button className="btn btn-ghost btn-sm" onClick={onAbout}>
        How does this work?
      </button>
    </div>
  );
}
