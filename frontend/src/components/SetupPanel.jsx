import { useRef, useState, useCallback } from 'react';
import { useStore } from '../store.js';
import { CropModal } from './modals/CropModal.jsx';

export function SetupPanel({ onOpenCrop }) {
  const {
    loadedImage, setLoadedImage, cropSelection, setCropSelection,
    imgFlipX, imgFlipY, imgRotation, toggleFlipX, toggleFlipY, rotateCw, rotateCcw,
    beadSize, setBeadSize, forceCols, setForceCols, forceRows, setForceRows,
    useLanczos, setUseLanczos, dither, setDither, oneToOne, setOneToOne,
    deThreshold, setDeThreshold,
    tilesMode, setTilesMode, tiles, addTile, removeTile, updateTile, clearTiles,
    tileArrangement, setTileArrangement, tileGridCols, setTileGridCols,
    generating, generateBoard,
  } = useStore();

  const fileRef  = useRef(null);
  const tileRef  = useRef(null);
  const [dragOver, setDragOver]           = useState(false);
  const [tileBeingCropped, setTileBeingCropped] = useState(null); // tile object | null

  // ─── Single image load ───────────────────────────────────────────────────────
  const loadFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const img = new Image();
    img.onload = () => setLoadedImage(img);
    img.src = URL.createObjectURL(file);
  }, [setLoadedImage]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  }, [loadFile]);

  // ─── Add tile ────────────────────────────────────────────────────────────────
  const addTileFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const id  = crypto.randomUUID();
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => addTile({
      id, name: file.name, image: img, thumbUrl: url,
      beadSize: 2, forceCols: 0, forceRows: 0,
      cropSelection: null, flipX: false, flipY: false, rotation: 0,
    });
    img.src = url;
  }, [addTile]);

  return (
    <>
      {/* Mode toggle */}
      <div className="panel-section">
        <span className="panel-section-label">Mode</span>
        <div className="panel-inline">
          <button className={`btn btn-sm ${!tilesMode ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTilesMode(false)} style={{ flex: 1 }}>
            Single
          </button>
          <button className={`btn btn-sm ${tilesMode ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTilesMode(true)} style={{ flex: 1 }}>
            Multi-Image
          </button>
        </div>
      </div>

      {/* ── Single image ───────────────────────────────────────────────── */}
      {!tilesMode && (
        <div className="panel-section">
          <span className="panel-section-label">Image</span>
          <div
            className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => loadFile(e.target.files[0])} />
            {loadedImage
              ? <img src={loadedImage.src} alt="loaded" style={{ width: '100%', height: 72, objectFit: 'cover', borderRadius: 6 }} />
              : <p className="drop-zone-hint">Drop image here or click to browse</p>
            }
          </div>

          {loadedImage && (
            <>
              <TransformControls
                flipX={imgFlipX} flipY={imgFlipY} rotation={imgRotation}
                cropSelection={cropSelection}
                onFlipX={toggleFlipX} onFlipY={toggleFlipY}
                onRotateCcw={rotateCcw} onRotateCw={rotateCw}
                onOpenCrop={onOpenCrop}
                onClearCrop={() => setCropSelection(null)}
              />
            </>
          )}
        </div>
      )}

      {/* ── Multi-image tiles ──────────────────────────────────────────── */}
      {tilesMode && (
        <div className="panel-section">
          <span className="panel-section-label">Images</span>
          <div className="tile-list">
            {tiles.map(tile => (
              <TileItem
                key={tile.id}
                tile={tile}
                onRemove={() => removeTile(tile.id)}
                onUpdate={upd => updateTile(tile.id, upd)}
                onCrop={() => setTileBeingCropped(tile)}
              />
            ))}
          </div>

          <input ref={tileRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { addTileFile(e.target.files[0]); e.target.value = ''; }} />
          <button className="btn btn-ghost btn-sm" onClick={() => tileRef.current?.click()} style={{ width: '100%' }}>
            + Add image
          </button>
          {tiles.length > 0 && (
            <button className="btn btn-ghost btn-xs" onClick={clearTiles} style={{ width: '100%' }}>Clear all</button>
          )}

          <div className="panel-field">
            <span className="panel-field-label">Arrangement</span>
            <select className="input" value={tileArrangement} onChange={e => setTileArrangement(e.target.value)}>
              <option value="horizontal">Horizontal</option>
              <option value="vertical">Vertical</option>
              <option value="grid">Grid</option>
            </select>
          </div>
          {tileArrangement === 'grid' && (
            <div className="panel-inline">
              <span className="panel-field-label">Cols</span>
              <input className="num-input sm" type="number" min="1" max="10"
                value={tileGridCols} onChange={e => setTileGridCols(+e.target.value)} />
            </div>
          )}
        </div>
      )}

      {/* ── Grid settings ─────────────────────────────────────────────── */}
      <div className="panel-section">
        <span className="panel-section-label">Grid</span>
        <div className="panel-field">
          <span className="panel-field-label">Bead size (source px)</span>
          <input className="num-input full" type="number" min="1" max="200"
            value={beadSize} onChange={e => setBeadSize(+e.target.value)} />
        </div>
        <div className="panel-inline">
          <div className="panel-field" style={{ flex: 1 }}>
            <span className="panel-field-label">Force cols</span>
            <input className="num-input full" type="number" min="0"
              value={forceCols} onChange={e => setForceCols(+e.target.value)} placeholder="auto" />
          </div>
          <div className="panel-field" style={{ flex: 1 }}>
            <span className="panel-field-label">Force rows</span>
            <input className="num-input full" type="number" min="0"
              value={forceRows} onChange={e => setForceRows(+e.target.value)} placeholder="auto" />
          </div>
        </div>
      </div>

      {/* ── Processing options ────────────────────────────────────────── */}
      <div className="panel-section">
        <span className="panel-section-label">Options</span>
        <label className="toggle">
          <input type="checkbox" checked={useLanczos} onChange={e => setUseLanczos(e.target.checked)} />
          Smooth resize (Lanczos)
        </label>
        <label className="toggle">
          <input type="checkbox" checked={dither} onChange={e => setDither(e.target.checked)} />
          Dithering
        </label>
        <label className="toggle">
          <input type="checkbox" checked={oneToOne} onChange={e => setOneToOne(e.target.checked)} />
          1:1 pixel mapping
        </label>
        <div className="panel-field">
          <span className="panel-field-label">Color delta threshold ({deThreshold})</span>
          <input type="range" min="0" max="30" step="1" value={deThreshold}
            onChange={e => setDeThreshold(+e.target.value)}
            style={{ width: '100%', accentColor: 'var(--accent)' }} />
        </div>
      </div>

      {/* ── Process button ────────────────────────────────────────────── */}
      <div className="panel-footer">
        <button
          className="btn btn-primary btn-process"
          onClick={generateBoard}
          disabled={generating || (!tilesMode && !loadedImage) || (tilesMode && tiles.length < 2)}
        >
          {generating ? 'Processing…' : 'Generate Board'}
        </button>
      </div>

      {/* Per-tile crop modal */}
      {tileBeingCropped && (
        <CropModal
          image={tileBeingCropped.image}
          initialSelection={tileBeingCropped.cropSelection}
          onApply={sel => updateTile(tileBeingCropped.id, { cropSelection: sel })}
          onClose={() => setTileBeingCropped(null)}
        />
      )}
    </>
  );
}

// ─── Shared transform controls (used by both single and tile) ───────────────

function TransformControls({ flipX, flipY, rotation, cropSelection, onFlipX, onFlipY, onRotateCcw, onRotateCw, onOpenCrop, onClearCrop }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div className="panel-inline">
        <button className={`btn btn-ghost btn-sm ${flipX ? 'active' : ''}`} onClick={onFlipX} style={{ flex: 1 }} title="Flip horizontal">
          ↔ Flip X
        </button>
        <button className={`btn btn-ghost btn-sm ${flipY ? 'active' : ''}`} onClick={onFlipY} style={{ flex: 1 }} title="Flip vertical">
          ↕ Flip Y
        </button>
      </div>
      <div className="panel-inline">
        <button className="btn btn-ghost btn-sm" onClick={onRotateCcw} style={{ flex: 1 }} title="Rotate CCW">↺ CCW</button>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', whiteSpace: 'nowrap', minWidth: 28, textAlign: 'center' }}>{rotation}°</span>
        <button className="btn btn-ghost btn-sm" onClick={onRotateCw}  style={{ flex: 1 }} title="Rotate CW">↻ CW</button>
      </div>
      <div className="panel-inline">
        <button className="btn btn-ghost btn-sm" onClick={onOpenCrop} style={{ flex: 1 }}>
          ✂ Crop{cropSelection ? ' ✓' : ''}
        </button>
        {cropSelection && (
          <button className="btn btn-ghost btn-xs" onClick={onClearCrop} title="Clear crop">✕</button>
        )}
      </div>
    </div>
  );
}

// ─── Tile item component ────────────────────────────────────────────────────

function TileItem({ tile, onRemove, onUpdate, onCrop }) {
  return (
    <div className="tile-item">
      <div className="tile-item-header">
        <img src={tile.thumbUrl} alt={tile.name} className="tile-thumb" />
        <span className="tile-name">{tile.name}</span>
        <button className="btn btn-ghost btn-xs btn-icon" onClick={onRemove} title="Remove">✕</button>
      </div>

      {/* Size overrides */}
      <div className="panel-inline">
        <span className="panel-field-label" style={{ minWidth: 28 }}>Cols</span>
        <input className="num-input sm" type="number" min="0" value={tile.forceCols}
          onChange={e => onUpdate({ forceCols: +e.target.value })} />
        <span className="panel-field-label" style={{ minWidth: 28 }}>Rows</span>
        <input className="num-input sm" type="number" min="0" value={tile.forceRows}
          onChange={e => onUpdate({ forceRows: +e.target.value })} />
      </div>

      {/* Transforms */}
      <TransformControls
        flipX={tile.flipX ?? false}
        flipY={tile.flipY ?? false}
        rotation={tile.rotation ?? 0}
        cropSelection={tile.cropSelection ?? null}
        onFlipX={() => onUpdate({ flipX: !(tile.flipX ?? false) })}
        onFlipY={() => onUpdate({ flipY: !(tile.flipY ?? false) })}
        onRotateCcw={() => onUpdate({ rotation: ((tile.rotation ?? 0) + 270) % 360 })}
        onRotateCw={() => onUpdate({ rotation: ((tile.rotation ?? 0) + 90)  % 360 })}
        onOpenCrop={onCrop}
        onClearCrop={() => onUpdate({ cropSelection: null })}
      />
    </div>
  );
}
