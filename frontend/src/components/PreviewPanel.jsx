import { useEffect, useRef } from 'react';
import { useStore } from '../store.js';
import { getTransformedCanvas, computeGridDims, createPixelatedPreview } from '../utils.js';

export function PreviewPanel() {
  const {
    loadedImage, cropSelection, imgFlipX, imgFlipY, imgRotation,
    beadSize, forceCols, forceRows,
  } = useStore();

  const canvasRef = useRef(null);
  const pixelatedCanvasRef = useRef(null);

  // Render transformed image onto preview canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !loadedImage) return;

    const transformed = getTransformedCanvas(loadedImage, {
      cropSelection, flipX: imgFlipX, flipY: imgFlipY, rotation: imgRotation,
    });

    const maxW = canvas.parentElement?.clientWidth  || 800;
    const maxH = canvas.parentElement?.clientHeight || 600;
    const scale = Math.min(1, maxW / transformed.width, maxH / transformed.height);

    canvas.width  = Math.round(transformed.width  * scale);
    canvas.height = Math.round(transformed.height * scale);
    canvas.getContext('2d').drawImage(transformed, 0, 0, canvas.width, canvas.height);
  }, [loadedImage, cropSelection, imgFlipX, imgFlipY, imgRotation]);

  // Render pixelated preview
  useEffect(() => {
    const canvas = pixelatedCanvasRef.current;
    if (!canvas || !loadedImage) return;

    // Create pixelated preview based on current bead size
    const pixelated = createPixelatedPreview(loadedImage, {
      cropSelection, flipX: imgFlipX, flipY: imgFlipY, rotation: imgRotation,
      beadSize: beadSize || 20,
    });

    const maxW = canvas.parentElement?.clientWidth  || 800;
    const maxH = canvas.parentElement?.clientHeight || 600;
    const scale = Math.min(1, maxW / pixelated.width, maxH / pixelated.height);

    canvas.width  = Math.round(pixelated.width  * scale);
    canvas.height = Math.round(pixelated.height * scale);
    canvas.getContext('2d').drawImage(pixelated, 0, 0, canvas.width, canvas.height);
  }, [loadedImage, cropSelection, imgFlipX, imgFlipY, imgRotation, beadSize]);

  const dims = computeGridDims(loadedImage, {
    cropSelection, rotation: imgRotation, beadSize, forceCols, forceRows,
  });

  if (!loadedImage) return null;

  return (
    <div className="preview-panel">
      <div className="preview-toolbar">
        {dims && (
          <div>
            <div className="preview-dims">{dims.cols} × {dims.rows}</div>
            <div className="preview-dims-sub">estimated beads (columns × rows)</div>
          </div>
        )}
        <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
          Configure grid and options in the sidebar, then click Generate Board.
        </div>
      </div>

      <div className="preview-canvas-wrap" ref={el => {
        // Store wrapper ref for scale calc — canvas ref handles rendering
      }}>
        <canvas ref={canvasRef} id="preview-canvas" />
        <canvas ref={pixelatedCanvasRef} id="pixelated-preview" className="pixelated-preview" />
      </div>
    </div>
  );
}