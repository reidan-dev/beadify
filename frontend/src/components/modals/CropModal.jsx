import { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '../../store.js';

const HANDLE_R = 7;

/**
 * Generic crop modal.
 * - Pass `image` + `onApply(sel)` for tile crops.
 * - Omit both to use the global loadedImage / setCropSelection from the store.
 */
export function CropModal({ image: imageProp, initialSelection, onApply, onClose }) {
  const { loadedImage, cropSelection, setCropSelection } = useStore();

  const image    = imageProp   ?? loadedImage;
  const initSel  = initialSelection !== undefined ? initialSelection : cropSelection;
  const applyFn  = onApply ?? ((sel) => setCropSelection(sel));

  const canvasRef  = useRef(null);
  const imageRef   = useRef(null);
  const stateRef   = useRef(null);
  const dragging   = useRef(null);
  const dragStart  = useRef(null);
  const [, redraw] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    const maxW = Math.min(window.innerWidth  * 0.8, 900);
    const maxH = Math.min(window.innerHeight * 0.7, 700);
    const scale = Math.min(maxW / image.naturalWidth, maxH / image.naturalHeight, 1);
    const dw = Math.round(image.naturalWidth  * scale);
    const dh = Math.round(image.naturalHeight * scale);

    canvas.width  = dw;
    canvas.height = dh;
    imageRef.current = { scale, dw, dh };

    if (initSel) {
      stateRef.current = {
        x: Math.round(initSel.x * dw),
        y: Math.round(initSel.y * dh),
        w: Math.round(initSel.w * dw),
        h: Math.round(initSel.h * dh),
      };
    } else {
      stateRef.current = { x: 0, y: 0, w: dw, h: dh };
    }
    paint(canvas, image, stateRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image]);

  function paint(canvas, img, rect) {
    const ctx = canvas.getContext('2d');
    const { width: cw, height: ch } = canvas;
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, 0, 0, cw, ch);
    if (!rect) return;
    const { x, y, w, h } = rect;

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0,   0,   cw, y);
    ctx.fillRect(0,   y+h, cw, ch - y - h);
    ctx.fillRect(0,   y,   x,  h);
    ctx.fillRect(x+w, y,   cw - x - w, h);

    ctx.strokeStyle = 'rgba(96, 165, 250, 0.95)';
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([5, 3]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);

    for (const [hx, hy] of Object.values(corners(rect))) {
      ctx.beginPath();
      ctx.arc(hx, hy, 5, 0, Math.PI * 2);
      ctx.fillStyle   = 'rgba(96, 165, 250, 0.95)';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth   = 1.5;
      ctx.fill();
      ctx.stroke();
    }
  }

  function corners(r) {
    return {
      nw: [r.x,       r.y      ],
      ne: [r.x + r.w, r.y      ],
      sw: [r.x,       r.y + r.h],
      se: [r.x + r.w, r.y + r.h],
    };
  }

  function hitHandle(mx, my, rect) {
    for (const [name, [hx, hy]] of Object.entries(corners(rect))) {
      if (Math.hypot(mx - hx, my - hy) < HANDLE_R) return name;
    }
    return null;
  }

  function canvasXY(e) {
    const r  = canvasRef.current.getBoundingClientRect();
    const sx = canvasRef.current.width  / r.width;
    const sy = canvasRef.current.height / r.height;
    return [(e.clientX - r.left) * sx, (e.clientY - r.top) * sy];
  }

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const onMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    const [mx, my] = canvasXY(e);
    const rect   = stateRef.current;
    const handle = rect ? hitHandle(mx, my, rect) : null;
    dragStart.current = { x: mx, y: my, rect: rect ? { ...rect } : null };
    dragging.current  = handle ?? 'new';
    e.preventDefault();
  }, []);

  const onMouseMove = useCallback((e) => {
    if (!dragging.current) return;
    const canvas = canvasRef.current;
    const cw = canvas.width, ch = canvas.height;
    const [mx, my] = canvasXY(e);
    const { x: sx, y: sy, rect: orig } = dragStart.current;
    const dx = mx - sx, dy = my - sy;

    if (dragging.current === 'new') {
      const x = clamp(Math.min(sx, mx), 0, cw);
      const y = clamp(Math.min(sy, my), 0, ch);
      stateRef.current = { x, y, w: clamp(Math.abs(mx - sx), 0, cw - x), h: clamp(Math.abs(my - sy), 0, ch - y) };
    } else if (dragging.current === 'move' && orig) {
      stateRef.current = { x: clamp(orig.x + dx, 0, cw - orig.w), y: clamp(orig.y + dy, 0, ch - orig.h), w: orig.w, h: orig.h };
    } else if (orig) {
      let { x, y, w, h } = orig;
      if      (dragging.current === 'se') { w = clamp(w + dx, 10, cw - x); h = clamp(h + dy, 10, ch - y); }
      else if (dragging.current === 'sw') { const nx = clamp(x + dx, 0, x + w - 10); w = x + w - nx; x = nx; h = clamp(h + dy, 10, ch - y); }
      else if (dragging.current === 'ne') { const ny = clamp(y + dy, 0, y + h - 10); h = y + h - ny; y = ny; w = clamp(w + dx, 10, cw - x); }
      else if (dragging.current === 'nw') { const nx = clamp(x + dx, 0, x + w - 10); const ny = clamp(y + dy, 0, y + h - 10); w = x + w - nx; h = y + h - ny; x = nx; y = ny; }
      stateRef.current = { x, y, w, h };
    }
    paint(canvas, image, stateRef.current);
    redraw(n => n + 1);
  }, [image]);

  const onMouseUp = useCallback(() => {
    if (dragging.current === 'new' && stateRef.current) {
      const { w, h } = stateRef.current;
      if (w < 4 && h < 4) stateRef.current = null;
    }
    dragging.current = null;
    paint(canvasRef.current, image, stateRef.current);
    redraw(n => n + 1);
  }, [image]);

  const handleApply = () => {
    const rect   = stateRef.current;
    const { dw, dh } = imageRef.current ?? {};
    if (!rect || !dw) { applyFn(null); onClose(); return; }
    applyFn({ x: rect.x / dw, y: rect.y / dh, w: rect.w / dw, h: rect.h / dh });
    onClose();
  };

  const handleReset = () => {
    const { dw, dh } = imageRef.current ?? {};
    stateRef.current = dw ? { x: 0, y: 0, w: dw, h: dh } : null;
    paint(canvasRef.current, image, stateRef.current);
    redraw(n => n + 1);
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ width: 'fit-content' }}>
        <div className="modal-header">
          <span className="modal-title">Crop Image</span>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ overflow: 'hidden' }}>
          <canvas
            ref={canvasRef}
            id="crop-canvas"
            style={{ display: 'block', maxWidth: '80vw', maxHeight: '70vh', cursor: 'crosshair' }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
          />
        </div>

        <div className="modal-footer">
          <span className="modal-hint">Drag to select · drag corners to resize · drag inside to move</span>
          <button className="btn btn-ghost btn-sm" onClick={handleReset}>Reset</button>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={handleApply}>Apply Crop</button>
        </div>
      </div>
    </div>
  );
}
