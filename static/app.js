'use strict';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let currentProject   = null;
let loadedImage      = null;   // HTMLImageElement of the selected file
let cropSelection    = null;   // {x,y,w,h} as fractions 0-1
let cropModalPending = null;
let cropDragStart    = null;
let cropDragMode     = null;   // null | 'new' | 'move' | 'tl' | 'tr' | 'bl' | 'br' | 'tc' | 'bc'
let cropDragInitRect = null;   // snapshot of rect at drag start
let showAllMode      = false;  // legend "show all" toggle
let selectedLabel    = null;   // currently highlighted legend label
let lineMarkMode     = null;   // null | 'row' | 'col'
const markedRows     = new Set();
const markedCols     = new Set();
let imgFlipX         = false;
let imgFlipY         = false;
let imgRotation      = 0;      // 0 | 90 | 180 | 270
let guideN           = 0;
let guideOriginCol   = null;
let guideOriginRow   = null;
let guideLocked      = true;
let guideDragging    = false;
let guideDragStart   = null;
let guideDragMoved   = false;

// Undo / redo
const undoStack      = [];
const redoStack      = [];

// Fill mode
let fillMode         = false;

// Region select
let selectMode       = false;
let selectDragging   = false;
let selectStart      = null;   // {x, y} pixels on bead board

// Rulers
let showNumbers      = false;
let rulerRowOffset   = 0;
let rulerColOffset   = 0;
let subFocusMode     = false;
let subFocusSi       = 0;   // row-section index
let subFocusSj       = 0;   // col-section index
let savedRulerRowOffset = 0; // saved before entering focus mode
let savedRulerColOffset = 0;

// Keyboard navigation
let kbRow            = null;
let kbCol            = null;

// Color swap
let swapSourceLabel  = null;

// Label visibility
const hiddenLabels   = new Set();

// View rotation (degrees, 0-315 in 45° steps)
let viewRotation     = 0;

// O(1) lookup maps — rebuilt on each renderGrid call
let cellMap        = new Map(); // "row:col" → DOM cell element
let projectBeadMap = new Map(); // "row:col" → bead data object

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------

const fileInput            = document.getElementById('file-input');
const beadSizeInput        = document.getElementById('bead-size');
const forceColsInput       = document.getElementById('force-cols');
const forceRowsInput       = document.getElementById('force-rows');
const removeBgCheck        = document.getElementById('remove-bg');
const oneToOneCheck        = document.getElementById('one-to-one');
const deThresholdInput     = document.getElementById('de-threshold');
const oneToOneThreshold    = document.querySelector('.one-to-one-threshold');

oneToOneCheck.addEventListener('change', () => {
  oneToOneThreshold.classList.toggle('invisible', !oneToOneCheck.checked);
});
const showGridCheck        = document.getElementById('show-grid-check');
const processBtn           = document.getElementById('process-btn');
const loadBtn              = document.getElementById('load-btn');
const saveBtn              = document.getElementById('save-btn');
const statusBar            = document.getElementById('status-bar');
const previewPanel         = document.getElementById('preview-panel');
const liveCanvas           = document.getElementById('live-canvas');
const previewDims          = document.getElementById('preview-dims');
const previewDimsSub       = document.getElementById('preview-dims-sub');
const openCropBtn          = document.getElementById('open-crop-btn');
const clearCropBtn         = document.getElementById('clear-crop-btn');
const cropStatus           = document.getElementById('crop-status');
const progressLabel        = document.getElementById('progress-label');
const progressPct          = document.getElementById('progress-pct');
const progressFill         = document.getElementById('progress-fill');
const beadBoard            = document.getElementById('bead-board');
const boardSection         = document.getElementById('board-section');
const legend               = document.getElementById('legend');
const legendList           = document.getElementById('legend-list');
const legendDeselectBtn    = document.getElementById('legend-deselect-btn');
const legendCollapseAllBtn = document.getElementById('legend-collapse-all-btn');
const legendVisAllBtn      = document.getElementById('legend-vis-all-btn');
const boardZoomVal         = document.getElementById('board-zoom-val');
const zoomInBtn            = document.getElementById('zoom-in-btn');
const zoomOutBtn           = document.getElementById('zoom-out-btn');
const zoomFitBtn           = document.getElementById('zoom-fit-btn');
const clearAllBtn          = document.getElementById('clear-all-btn');
const legendToggleBtn      = document.getElementById('legend-toggle-btn');
const beadTip              = document.getElementById('bead-tip');
const fillBtn              = document.getElementById('fill-btn');
const selectBtn            = document.getElementById('select-btn');
const rotateViewCwBtn      = document.getElementById('rotate-view-cw-btn');
const rotateViewCcwBtn     = document.getElementById('rotate-view-ccw-btn');
const boardWrapper         = document.querySelector('.board-wrapper');
const boardWithRulers      = document.querySelector('.board-with-rulers');
const flipXBtn             = document.getElementById('flip-x-btn');
const flipYBtn             = document.getElementById('flip-y-btn');
const rotateCwBtn          = document.getElementById('rotate-cw-btn');
const rotateCcwBtn         = document.getElementById('rotate-ccw-btn');
const markRowBtn           = document.getElementById('mark-row-btn');
const markColBtn           = document.getElementById('mark-col-btn');
const markClearBtn         = document.getElementById('mark-clear-btn');
const guideNInput          = document.getElementById('guide-n-input');
const guideToggleBtn       = document.getElementById('guide-toggle-btn');
const guideLockBtn         = document.getElementById('guide-lock-btn');
const guideColorInput      = document.getElementById('guide-color-input');
const guideClearBtn        = document.getElementById('guide-clear-btn');
// Ruler refs
const rulerCol             = document.getElementById('ruler-col');
const rulerRow             = document.getElementById('ruler-row');
const rulerCorner          = document.querySelector('.ruler-corner');
const numbersBtn           = document.getElementById('numbers-btn');
const rulerRowOffsetInput  = document.getElementById('ruler-row-offset');
const rulerColOffsetInput  = document.getElementById('ruler-col-offset');
const focusBtn             = document.getElementById('focus-btn');
const focusNav             = document.getElementById('focus-nav');
const focusLabel           = document.getElementById('focus-label');
const focusMinimap         = document.getElementById('focus-minimap');
const focusUpBtn           = document.getElementById('focus-up-btn');
const focusDownBtn         = document.getElementById('focus-down-btn');
const focusLeftBtn         = document.getElementById('focus-left-btn');
const focusRightBtn        = document.getElementById('focus-right-btn');
// Preview panel controls
const zoomSlider           = document.getElementById('zoom-slider');
const zoomInput            = document.getElementById('zoom-input');
const gapSlider            = document.getElementById('gap-slider');
const gapInput             = document.getElementById('gap-input');
// Focus picker modal
const focusPickerModal     = document.getElementById('focus-picker-modal');
const focusPickerGrid      = document.getElementById('focus-picker-grid');
const focusPickerCancelBtn = document.getElementById('focus-picker-cancel-btn');
// Tab bar
const tabBar               = document.getElementById('tab-bar');
const tabPreviewBtn        = document.getElementById('tab-preview-btn');
const tabBoardBtn          = document.getElementById('tab-board-btn');
// Setup panel collapse
const setupPanel           = document.getElementById('setup-panel');
const panelToggleBtn       = document.getElementById('panel-toggle-btn');

panelToggleBtn.addEventListener('click', () => {
  setupPanel.classList.toggle('collapsed');
});
// Palette modal
const paletteBtn           = document.getElementById('palette-btn');
const paletteModal         = document.getElementById('palette-modal');
const paletteCloseBtn      = document.getElementById('palette-close-btn');
const paletteGrid          = document.getElementById('palette-grid');
// Crop modal
const cropModal            = document.getElementById('crop-modal');
const cropModalBody        = document.getElementById('crop-modal-body');
const cropCanvas           = document.getElementById('crop-canvas');
const cropApplyBtn         = document.getElementById('crop-apply-btn');
const cropClearModalBtn    = document.getElementById('crop-clear-modal-btn');
const cropCancelBtn        = document.getElementById('crop-cancel-btn');
const cropModalHint        = document.getElementById('crop-modal-hint');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function showStatus(msg, type = 'info') {
  statusBar.textContent = msg;
  statusBar.className   = `status-bar ${type}`;
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

function switchTab(tab) {
  // tab: 'preview' | 'board'
  const showPreview = tab === 'preview';
  previewPanel.classList.toggle('hidden', !showPreview);
  boardSection.classList.toggle('hidden',  showPreview);
  tabPreviewBtn.classList.toggle('active',  showPreview);
  tabBoardBtn.classList.toggle('active',   !showPreview);
}

tabPreviewBtn.addEventListener('click', () => switchTab('preview'));
tabBoardBtn.addEventListener('click',   () => switchTab('board'));

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function getCellPx() { return Math.max(1, parseInt(zoomInput.value)  || 24); }
function getGapPx()  { return Math.max(0, parseInt(gapInput.value)   || 0);  }

function boardTotalSize(cols, rows) {
  const c = getCellPx(), g = getGapPx();
  return {
    w: cols * c + Math.max(0, cols - 1) * g,
    h: rows * c + Math.max(0, rows - 1) * g,
  };
}

// ---------------------------------------------------------------------------
// Linked slider + number input (no duplicate events, no stale reads)
// onChange is called AFTER both values are in sync
// ---------------------------------------------------------------------------

function linkControl(slider, input, onChange) {
  slider.addEventListener('input', () => {
    input.value = slider.value;   // sync input first, then fire
    onChange();
  });

  const debouncedChange = debounce(() => {
    const min = parseFloat(slider.min) || 0;
    const max = parseFloat(slider.max) || 9999;
    const v   = parseFloat(input.value);
    if (isNaN(v)) return;
    // clamp slider (which has a max), but allow input to hold larger values
    slider.value = Math.min(Math.max(v, min), max);
    onChange();
  }, 180);

  input.addEventListener('input',  debouncedChange);
  input.addEventListener('change', () => {   // also fire immediately on blur/Enter
    debouncedChange.cancel?.();
    const min = parseFloat(slider.min) || 0;
    const max = parseFloat(slider.max) || 9999;
    const v   = parseFloat(input.value);
    if (!isNaN(v)) slider.value = Math.min(Math.max(v, min), max);
    onChange();
  });
}

function onDisplayChange() {
  updateBoardZoomLabel();
  updateLivePreview();
  applyBoardSize();
}

linkControl(zoomSlider, zoomInput, onDisplayChange);
linkControl(gapSlider,  gapInput,  onDisplayChange);

// ---------------------------------------------------------------------------
// Button state
// ---------------------------------------------------------------------------

function updateButtonStates() {
  const hasFile = !!(fileInput.files && fileInput.files.length > 0);
  processBtn.disabled = !hasFile;
  loadBtn.disabled    = !currentProject;
  saveBtn.disabled    = !currentProject;
}

// ---------------------------------------------------------------------------
// File load → live preview
// ---------------------------------------------------------------------------

fileInput.addEventListener('change', () => {
  updateButtonStates();
  if (!fileInput.files || !fileInput.files.length) return;

  // Reset transforms for new image
  imgFlipX = false; imgFlipY = false; imgRotation = 0;
  flipXBtn.classList.remove('active');
  flipYBtn.classList.remove('active');

  const url = URL.createObjectURL(fileInput.files[0]);
  loadedImage = new Image();
  loadedImage.onload = () => {
    tabBar.classList.remove('hidden');
    switchTab('preview');
    updateLivePreview();
  };
  loadedImage.src = url;
});

flipXBtn.addEventListener('click', () => {
  imgFlipX = !imgFlipX;
  flipXBtn.classList.toggle('active', imgFlipX);
  updateLivePreview();
});

flipYBtn.addEventListener('click', () => {
  imgFlipY = !imgFlipY;
  flipYBtn.classList.toggle('active', imgFlipY);
  updateLivePreview();
});

rotateCwBtn.addEventListener('click', () => {
  imgRotation = (imgRotation + 90) % 360;
  updateLivePreview();
});

rotateCcwBtn.addEventListener('click', () => {
  imgRotation = (imgRotation + 270) % 360;
  updateLivePreview();
});

// Grid calc params → debounced preview redraw
const debouncedPreview = debounce(updateLivePreview, 180);
[beadSizeInput, forceColsInput, forceRowsInput].forEach(el => {
  el.addEventListener('input',  debouncedPreview);
  el.addEventListener('change', updateLivePreview);
});
showGridCheck.addEventListener('change', () => {
  beadBoard.classList.toggle('show-grid', showGridCheck.checked);
  updateLivePreview();
});

// ---------------------------------------------------------------------------
// Compute grid dimensions (mirrors backend logic)
// ---------------------------------------------------------------------------

// Returns a canvas with the image cropped, flipped, and rotated per current state.
function getTransformedSourceCanvas() {
  const iw = loadedImage.naturalWidth, ih = loadedImage.naturalHeight;
  let sx = 0, sy = 0, sw = iw, sh = ih;
  if (cropSelection) {
    sx = Math.round(cropSelection.x * iw); sy = Math.round(cropSelection.y * ih);
    sw = Math.round(cropSelection.w * iw); sh = Math.round(cropSelection.h * ih);
  }

  // Step 1: crop
  const src = document.createElement('canvas');
  src.width = sw; src.height = sh;
  src.getContext('2d').drawImage(loadedImage, sx, sy, sw, sh, 0, 0, sw, sh);

  // Step 2: flip
  let cur = src;
  if (imgFlipX || imgFlipY) {
    const fc = document.createElement('canvas');
    fc.width = sw; fc.height = sh;
    const fctx = fc.getContext('2d');
    fctx.save();
    fctx.translate(imgFlipX ? sw : 0, imgFlipY ? sh : 0);
    fctx.scale(imgFlipX ? -1 : 1, imgFlipY ? -1 : 1);
    fctx.drawImage(cur, 0, 0);
    fctx.restore();
    cur = fc;
  }

  // Step 3: rotate
  if (imgRotation !== 0) {
    const swap = imgRotation === 90 || imgRotation === 270;
    const rc = document.createElement('canvas');
    rc.width  = swap ? sh : sw;
    rc.height = swap ? sw : sh;
    const rctx = rc.getContext('2d');
    rctx.translate(rc.width / 2, rc.height / 2);
    rctx.rotate(imgRotation * Math.PI / 180);
    rctx.drawImage(cur, -sw / 2, -sh / 2);
    cur = rc;
  }

  return cur;
}

function computeGridDims() {
  if (!loadedImage) return null;

  let iw = loadedImage.naturalWidth;
  let ih = loadedImage.naturalHeight;
  if (cropSelection) {
    iw = Math.round(iw * cropSelection.w);
    ih = Math.round(ih * cropSelection.h);
  }
  // Swap dims for 90/270 rotation
  if (imgRotation === 90 || imgRotation === 270) { const tmp = iw; iw = ih; ih = tmp; }

  const forceCols = parseInt(forceColsInput.value) || 0;
  const forceRows = parseInt(forceRowsInput.value) || 0;
  const beadSize  = Math.max(1, parseInt(beadSizeInput.value) || 20);

  let cols, rows;
  if (forceCols > 0 && forceRows > 0)      { cols = forceCols; rows = forceRows; }
  else if (forceCols > 0) { cols = forceCols; rows = Math.max(1, Math.round(ih * cols / iw)); }
  else if (forceRows > 0) { rows = forceRows; cols = Math.max(1, Math.round(iw * rows / ih)); }
  else { cols = Math.max(1, Math.floor(iw / beadSize)); rows = Math.max(1, Math.floor(ih / beadSize)); }

  return { cols, rows };
}

// ---------------------------------------------------------------------------
// Live preview canvas
// ---------------------------------------------------------------------------

function updateLivePreview() {
  if (!loadedImage) return;
  const dims = computeGridDims();
  if (!dims) return;
  const { cols, rows } = dims;

  // Pixelate transformed source to cols×rows
  const transformed = getTransformedSourceCanvas();
  const off = document.createElement('canvas');
  off.width = cols; off.height = rows;
  const offCtx = off.getContext('2d');
  offCtx.imageSmoothingEnabled = false;
  offCtx.drawImage(transformed, 0, 0, cols, rows);

  // Render at exact cell+gap size (same math as board)
  const cellPx = getCellPx();
  const gapPx  = getGapPx();
  const { w: dispW, h: dispH } = boardTotalSize(cols, rows);

  liveCanvas.width  = dispW;
  liveCanvas.height = dispH;
  liveCanvas.style.width  = dispW + 'px';
  liveCanvas.style.height = dispH + 'px';

  const ctx = liveCanvas.getContext('2d');
  ctx.clearRect(0, 0, dispW, dispH);
  ctx.imageSmoothingEnabled = false;

  if (gapPx === 0) {
    ctx.drawImage(off, 0, 0, dispW, dispH);
  } else {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.drawImage(off, c, r, 1, 1,
          c * (cellPx + gapPx), r * (cellPx + gapPx), cellPx, cellPx);
      }
    }
  }

  // Grid overlay when gap = 0
  if (showGridCheck.checked && gapPx === 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth   = 1;
    for (let c = 1; c < cols; c++) {
      const x = c * cellPx + 0.5;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, dispH); ctx.stroke();
    }
    for (let r = 1; r < rows; r++) {
      const y = r * cellPx + 0.5;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(dispW, y); ctx.stroke();
    }
  }

  previewDims.textContent    = `${cols} × ${rows} beads`;
  previewDimsSub.textContent = `${loadedImage.naturalWidth}×${loadedImage.naturalHeight}px  |  cell ${cellPx}px  gap ${gapPx}px`;
}

// ---------------------------------------------------------------------------
// Crop modal
// ---------------------------------------------------------------------------

openCropBtn.addEventListener('click', openCropModal);

cropCancelBtn.addEventListener('click', () => {
  cropModal.classList.add('hidden');
  cropModalPending = null; cropDragStart = null; cropDragMode = null; cropDragInitRect = null;
});

cropClearModalBtn.addEventListener('click', () => {
  cropModalPending = null;
  cropApplyBtn.disabled = true;
  cropModalHint.textContent = 'Drag to create • drag inside to move • drag corners to resize';
  redrawCropCanvas();
});

cropApplyBtn.addEventListener('click', () => {
  if (!cropModalPending) return;
  cropSelection = { ...cropModalPending };
  cropModal.classList.add('hidden');
  cropModalPending = null; cropDragStart = null; cropDragMode = null; cropDragInitRect = null;
  clearCropBtn.classList.remove('invisible');
  const p = v => Math.round(v * 100);
  cropStatus.textContent = `Crop: ${p(cropSelection.x)}%,${p(cropSelection.y)}% → ${p(cropSelection.x+cropSelection.w)}%,${p(cropSelection.y+cropSelection.h)}%`;
  updateLivePreview();
});

clearCropBtn.addEventListener('click', () => {
  cropSelection = null;
  clearCropBtn.classList.add('invisible');
  cropStatus.textContent = '';
  updateLivePreview();
});

function openCropModal() {
  if (!loadedImage) return;
  cropModalPending = cropSelection ? { ...cropSelection } : null;
  cropApplyBtn.disabled = !cropModalPending;
  cropModalHint.textContent = 'Drag to create • drag inside to move • drag corners to resize';
  cropModal.classList.remove('hidden');
  sizeCropCanvas();
  redrawCropCanvas();
}

function sizeCropCanvas() {
  const maxW = Math.min(window.innerWidth * 0.88, 960);
  const maxH = Math.min(window.innerHeight * 0.72, 720);
  const ratio = Math.min(maxW / loadedImage.naturalWidth, maxH / loadedImage.naturalHeight, 4);
  cropCanvas.width  = Math.round(loadedImage.naturalWidth  * ratio);
  cropCanvas.height = Math.round(loadedImage.naturalHeight * ratio);
}

function redrawCropCanvas() {
  const ctx = cropCanvas.getContext('2d');
  ctx.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(loadedImage, 0, 0, cropCanvas.width, cropCanvas.height);

  const sel = cropModalPending;
  if (!sel) return;

  const cx = sel.x * cropCanvas.width,  cy = sel.y * cropCanvas.height;
  const cw = sel.w * cropCanvas.width,  ch = sel.h * cropCanvas.height;

  ctx.fillStyle = 'rgba(0,0,0,0.52)';
  ctx.fillRect(0, 0, cropCanvas.width, cy);
  ctx.fillRect(0, cy + ch, cropCanvas.width, cropCanvas.height - cy - ch);
  ctx.fillRect(0, cy, cx, ch);
  ctx.fillRect(cx + cw, cy, cropCanvas.width - cx - cw, ch);

  ctx.strokeStyle = '#e07583';
  ctx.lineWidth   = 2;
  ctx.setLineDash([6, 3]);
  ctx.strokeRect(cx, cy, cw, ch);
  ctx.setLineDash([]);

  // 8 handles: 4 corners + 4 edge midpoints
  ctx.fillStyle = '#e07583';
  const hs = 8;
  [
    [cx,        cy       ],   // top-left
    [cx + cw/2, cy       ],   // top-center
    [cx + cw,   cy       ],   // top-right
    [cx,        cy + ch/2],   // left-center
    [cx + cw,   cy + ch/2],   // right-center
    [cx,        cy + ch  ],   // bottom-left
    [cx + cw/2, cy + ch  ],   // bottom-center
    [cx + cw,   cy + ch  ],   // bottom-right
  ].forEach(([hx, hy]) => {
    ctx.fillRect(hx - hs/2, hy - hs/2, hs, hs);
  });
}

// ---------------------------------------------------------------------------
// Crop interaction helpers
// ---------------------------------------------------------------------------

function cropPosFrac(e) {
  const r = cropCanvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
    y: Math.max(0, Math.min(1, (e.clientY - r.top)  / r.height)),
  };
}

function cropHitRegion(pos) {
  if (!cropModalPending || cropModalPending.w < 0.001) return 'new';
  const { x, y, w, h } = cropModalPending;
  const cr = cropCanvas.getBoundingClientRect();
  const tx = 10 / cr.width, ty = 10 / cr.height;
  const nearL = Math.abs(pos.x - x)         <= tx;
  const nearR = Math.abs(pos.x - (x + w))   <= tx;
  const nearT = Math.abs(pos.y - y)         <= ty;
  const nearB = Math.abs(pos.y - (y + h))   <= ty;
  // Corners first (take priority over edge midpoints)
  if (nearT && nearL) return 'tl';
  if (nearT && nearR) return 'tr';
  if (nearB && nearL) return 'bl';
  if (nearB && nearR) return 'br';
  // Edge midpoints
  if (nearT) return 'tc';
  if (nearB) return 'bc';
  const nearMidY = Math.abs(pos.y - (y + h / 2)) <= ty;
  if (nearL && nearMidY) return 'lc';
  if (nearR && nearMidY) return 'rc';
  // Interior
  if (pos.x >= x && pos.x <= x + w && pos.y >= y && pos.y <= y + h) return 'move';
  return 'new';
}

const CROP_CURSORS = {
  tl: 'nwse-resize', br: 'nwse-resize',
  tr: 'nesw-resize', bl: 'nesw-resize',
  tc: 'ns-resize',   bc: 'ns-resize',
  lc: 'ew-resize',  rc: 'ew-resize',
  move: 'move', new: 'crosshair',
};

cropModalBody.addEventListener('mousemove', e => {
  const pos = cropPosFrac(e);

  if (!cropDragStart) {
    // Hover: update cursor to signal what a drag will do
    cropCanvas.style.cursor = CROP_CURSORS[cropHitRegion(pos)] || 'crosshair';
    return;
  }

  const ir = cropDragInitRect;
  const MIN = 0.005;

  if (cropDragMode === 'new') {
    cropModalPending = {
      x: Math.min(cropDragStart.x, pos.x),
      y: Math.min(cropDragStart.y, pos.y),
      w: Math.abs(pos.x - cropDragStart.x),
      h: Math.abs(pos.y - cropDragStart.y),
    };
  } else if (cropDragMode === 'move') {
    const dx = pos.x - cropDragStart.x, dy = pos.y - cropDragStart.y;
    cropModalPending = {
      x: Math.max(0, Math.min(1 - ir.w, ir.x + dx)),
      y: Math.max(0, Math.min(1 - ir.h, ir.y + dy)),
      w: ir.w, h: ir.h,
    };
  } else {
    let { x, y, w, h } = ir;
    if (cropDragMode === 'br') {
      w = Math.max(MIN, Math.min(1 - x,     pos.x - x));
      h = Math.max(MIN, Math.min(1 - y,     pos.y - y));
    } else if (cropDragMode === 'tl') {
      const nx = Math.max(0, Math.min(x + w - MIN, pos.x));
      const ny = Math.max(0, Math.min(y + h - MIN, pos.y));
      w = x + w - nx; h = y + h - ny; x = nx; y = ny;
    } else if (cropDragMode === 'tr') {
      const ny = Math.max(0, Math.min(y + h - MIN, pos.y));
      w = Math.max(MIN, Math.min(1 - x,     pos.x - x));
      h = y + h - ny; y = ny;
    } else if (cropDragMode === 'bl') {
      const nx = Math.max(0, Math.min(x + w - MIN, pos.x));
      w = x + w - nx; x = nx;
      h = Math.max(MIN, Math.min(1 - y,     pos.y - y));
    } else if (cropDragMode === 'tc') {
      const ny = Math.max(0, Math.min(y + h - MIN, pos.y));
      h = y + h - ny; y = ny;
    } else if (cropDragMode === 'bc') {
      h = Math.max(MIN, Math.min(1 - y, pos.y - y));
    } else if (cropDragMode === 'lc') {
      const nx = Math.max(0, Math.min(x + w - MIN, pos.x));
      w = x + w - nx; x = nx;
    } else if (cropDragMode === 'rc') {
      w = Math.max(MIN, Math.min(1 - x, pos.x - x));
    }
    cropModalPending = { x, y, w, h };
  }

  redrawCropCanvas();
});

cropModalBody.addEventListener('mousedown', e => {
  const pos = cropPosFrac(e);
  cropDragMode     = cropHitRegion(pos);
  cropDragStart    = pos;
  cropDragInitRect = cropModalPending ? { ...cropModalPending } : null;
  if (cropDragMode === 'new') {
    cropModalPending = { x: pos.x, y: pos.y, w: 0, h: 0 };
    cropApplyBtn.disabled = true;
  }
  e.preventDefault();
});

cropModalBody.addEventListener('mouseup', () => {
  if (!cropDragStart) return;
  const wasNew = cropDragMode === 'new';
  cropDragStart = null; cropDragMode = null; cropDragInitRect = null;

  if (!cropModalPending || cropModalPending.w < 0.01 || cropModalPending.h < 0.01) {
    if (wasNew) cropModalPending = null;
    cropApplyBtn.disabled = !cropModalPending;
    if (!cropModalPending) cropModalHint.textContent = 'Drag to create • drag inside to move • drag corners to resize';
  } else {
    cropApplyBtn.disabled = false;
    const iw = Math.round(cropModalPending.w * loadedImage.naturalWidth);
    const ih = Math.round(cropModalPending.h * loadedImage.naturalHeight);
    cropModalHint.textContent = `${iw} × ${ih} px selected`;
  }
  redrawCropCanvas();
});

cropModal.addEventListener('click', e => {
  if (e.target === cropModal) {
    cropModal.classList.add('hidden');
    cropModalPending = null; cropDragStart = null; cropDragMode = null; cropDragInitRect = null;
  }
});

// ---------------------------------------------------------------------------
// Show grid toggle
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Process image
// ---------------------------------------------------------------------------

processBtn.addEventListener('click', async () => {
  if (!fileInput.files || !fileInput.files.length) return;

  const file      = fileInput.files[0];
  const beadSize  = parseInt(beadSizeInput.value)  || 20;
  const forceCols = parseInt(forceColsInput.value) || 0;
  const forceRows = parseInt(forceRowsInput.value) || 0;
  const removeBg  = removeBgCheck.checked;

  showStatus(removeBg ? 'Removing background… (first run may download ~170 MB)' : 'Processing…', 'info');
  processBtn.disabled = true;

  try {
    // Apply crop + flip + rotation client-side before sending
    const transformed = getTransformedSourceCanvas();
    const blob = await new Promise(res => transformed.toBlob(res, 'image/png'));
    const stem = file.name.replace(/\.[^.]+$/, '') || 'image';

    const fd = new FormData();
    fd.append('file',       blob, stem + '.png');
    fd.append('bead_size',  beadSize);
    fd.append('force_cols', forceCols);
    fd.append('force_rows', forceRows);
    fd.append('remove_bg',  removeBg);
    fd.append('one_to_one', oneToOneCheck.checked);
    fd.append('de_threshold', parseFloat(deThresholdInput.value) || 10);

    const resp = await fetch('/process', { method: 'POST', body: fd });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ detail: resp.statusText }));
      throw new Error(err.detail || resp.statusText);
    }

    const data = await resp.json();
    currentProject = data;
    await tryAutoLoadProgress(data.name);

    renderGrid(currentProject);
    zoomToFit();

    // After bg removal: update live canvas to show processed image (with transparency)
    if (removeBg && data.image_url) {
      const boardImg = new Image();
      boardImg.onload = () => {
        const cellPx = getCellPx(), gapPx = getGapPx();
        const { w: dW, h: dH } = boardTotalSize(data.width, data.height);
        liveCanvas.width  = dW; liveCanvas.height = dH;
        liveCanvas.style.width = dW + 'px'; liveCanvas.style.height = dH + 'px';
        const ctx = liveCanvas.getContext('2d');
        ctx.clearRect(0, 0, dW, dH);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(boardImg, 0, 0, dW, dH);
      };
      boardImg.src = data.image_url + '?t=' + Date.now();
    }

    updateButtonStates();
    localStorage.setItem('lastProjectName', data.name);
    showStatus(`Ready — ${data.width} × ${data.height} beads (${data.beads.filter(b => !b.transparent).length} active)`, 'ok');
  } catch (err) {
    showStatus(`Error: ${err.message}`, 'error');
  } finally {
    processBtn.disabled = !(fileInput.files && fileInput.files.length > 0);
  }
});

// ---------------------------------------------------------------------------
// Color utilities
// ---------------------------------------------------------------------------

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function labelColor(hex) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return (0.299*r + 0.587*g + 0.114*b) / 255 > 0.45
    ? 'rgba(0,0,0,0.82)'
    : 'rgba(255,255,255,0.88)';
}

// ---------------------------------------------------------------------------
// Render grid
// ---------------------------------------------------------------------------

// Persistent overlay for region selection — re-appended each render
const selectRectEl = document.createElement('div');
selectRectEl.className = 'select-rect-overlay';

function renderGrid(project) {
  beadBoard.innerHTML = '';
  cellMap.clear();
  projectBeadMap.clear();
  selectedLabel = null;
  markedRows.clear();
  markedCols.clear();
  setLineMarkMode(null);
  guideN = 0;
  guideOriginCol = null;
  guideOriginRow = null;
  guideLocked = true;
  guideLockBtn.textContent = '\uD83D\uDD12';
  guideLockBtn.classList.remove('active');
  guideToggleBtn.classList.remove('active');
  focusBtn.classList.add('invisible');
  setSubFocusMode(false);
  hiddenLabels.clear();
  legendVisAllBtn.textContent = '👁';
  viewRotation = 0;
  rotateViewCwBtn.classList.remove('active');
  rotateViewCcwBtn.classList.remove('active');
  undoStack.length = 0;
  redoStack.length = 0;
  setFillMode(false);
  setSelectMode(false);
  beadBoard.classList.toggle('show-grid', showGridCheck.checked);
  if (showAllMode) beadBoard.classList.add('show-all');

  const cellPx = getCellPx(), gapPx = getGapPx();
  applyBoardLayout(project.width, project.height, cellPx, gapPx);

  if (project.image_url) {
    beadBoard.style.backgroundImage = `url(${project.image_url}?t=${Date.now()})`;
    beadBoard.style.backgroundSize  = '100% 100%';
  }

  const sorted = [...project.beads].sort((a,b) => a.row - b.row || a.col - b.col);

  for (const bead of sorted) {
    // Transparent beads are completely absent from the DOM
    if (bead.transparent) continue;

    const cell = document.createElement('div');
    cell.className = 'bead' + (bead.done ? ' done' : '');
    cell.dataset.row   = bead.row;
    cell.dataset.col   = bead.col;
    cell.dataset.label = bead.label;
    cell.dataset.color = bead.color;
    // Explicit grid placement so layout is correct without filler cells
    cell.style.gridColumn = (bead.col + 1) + '';
    cell.style.gridRow    = (bead.row + 1) + '';
    cell.style.width      = cellPx + 'px';
    cell.style.height     = cellPx + 'px';
    cell.style.background = hexToRgba(bead.color, 0.78);
    cell.style.setProperty('--label-color', labelColor(bead.color));

    const span = document.createElement('span');
    span.className   = 'label';
    span.textContent = bead.label;
    span.style.fontSize = Math.max(5, Math.round(cellPx * 0.38)) + 'px';
    span.style.color    = labelColor(bead.color);
    cell.appendChild(span);

    const key = `${bead.row}:${bead.col}`;
    cellMap.set(key, cell);
    beadBoard.appendChild(cell);
  }

  // Build O(1) bead data map
  for (const b of project.beads) {
    if (!b.transparent) projectBeadMap.set(`${b.row}:${b.col}`, b);
  }

  beadBoard.appendChild(selectRectEl);  // keep overlay on top

  tabBoardBtn.disabled = false;
  switchTab('board');
  updateBoardZoomLabel();
  updateProgress();
  renderLegend();
  kbRow = null; kbCol = null;
  renderRulers();
}

// ---------------------------------------------------------------------------
// Board layout helpers
// ---------------------------------------------------------------------------

function applyBoardLayout(cols, rows, cellPx, gapPx) {
  const { w, h } = boardTotalSize(cols, rows);
  beadBoard.style.gridTemplateColumns = `repeat(${cols}, ${cellPx}px)`;
  beadBoard.style.gridTemplateRows    = `repeat(${rows}, ${cellPx}px)`;
  beadBoard.style.gap    = gapPx + 'px';
  beadBoard.style.width  = w + 'px';
  beadBoard.style.height = h + 'px';
  document.documentElement.style.setProperty('--bead-size', cellPx + 'px');
}

function applyBoardSize() {
  if (!currentProject) return;
  const cellPx = getCellPx(), gapPx = getGapPx();
  for (const cell of cellMap.values()) {
    cell.style.width  = cellPx + 'px';
    cell.style.height = cellPx + 'px';
    const span = cell.querySelector('.label');
    if (span) span.style.fontSize = Math.max(5, Math.round(cellPx * 0.38)) + 'px';
  }
  if (subFocusMode) {
    applySubFocus();
  } else {
    applyBoardLayout(currentProject.width, currentProject.height, cellPx, gapPx);
    applyLineMarks();
    renderGuideLines();
    updateBoardZoomLabel();
    renderRulers();
  }
  applyViewRotation();
}

function updateBoardZoomLabel() {
  const txt = `${getCellPx()}px`;
  boardZoomVal.textContent = txt;
}

// ---------------------------------------------------------------------------
// Rulers
// ---------------------------------------------------------------------------

function syncRulerCorner() {
  if (!rulerCorner || rulerCorner.style.display === 'none') return;
  rulerCorner.style.transform =
    `translate(${boardWrapper.scrollLeft}px, ${boardWrapper.scrollTop}px)`;
}

boardWrapper.addEventListener('scroll', syncRulerCorner);

function renderRulers() {
  if (!showNumbers || !currentProject) {
    rulerCol.style.display    = 'none';
    rulerRow.style.display    = 'none';
    rulerCorner.style.display = 'none';
    rulerCorner.style.transform = '';
    return;
  }
  rulerCol.style.display    = '';
  rulerRow.style.display    = '';
  rulerCorner.style.display = '';
  syncRulerCorner();

  rulerCol.style.width  = beadBoard.style.width;
  rulerCol.style.height = '22px';
  rulerRow.style.height = beadBoard.style.height;
  rulerRow.style.width  = '22px';

  rulerCol.innerHTML = '';
  rulerRow.innerHTML = '';

  const step   = getCellPx() + getGapPx();
  const cellPx = getCellPx();

  // Use section dims when focused, full project dims otherwise
  let effectiveCols, effectiveRows;
  if (subFocusMode) {
    const { rowBounds, colBounds } = getGuideBounds();
    effectiveRows = (rowBounds[subFocusSi + 1] ?? currentProject.height) - (rowBounds[subFocusSi] ?? 0);
    effectiveCols = (colBounds[subFocusSj + 1] ?? currentProject.width)  - (colBounds[subFocusSj] ?? 0);
  } else {
    effectiveCols = currentProject.width;
    effectiveRows = currentProject.height;
  }

  const interval = effectiveCols <= 20 ? 1 : effectiveCols <= 50 ? 5 : 10;
  const colOff = parseInt(rulerColOffsetInput.value) || 0;
  for (let c = 0; c <= effectiveCols; c++) {
    if (c % interval !== 0) continue;
    const span = document.createElement('span');
    span.className   = 'ruler-num';
    span.textContent = c + colOff;
    span.style.left  = (c * step + cellPx / 2) + 'px';
    rulerCol.appendChild(span);
  }

  const rowInterval = effectiveRows <= 20 ? 1 : effectiveRows <= 50 ? 5 : 10;
  const rowOff = parseInt(rulerRowOffsetInput.value) || 0;
  for (let r = 0; r <= effectiveRows; r++) {
    if (r % rowInterval !== 0) continue;
    const span = document.createElement('span');
    span.className   = 'ruler-num';
    span.textContent = r + rowOff;
    span.style.top   = (r * step + cellPx / 2) + 'px';
    rulerRow.appendChild(span);
  }
}

numbersBtn.addEventListener('click', () => {
  showNumbers = !showNumbers;
  numbersBtn.classList.toggle('active', showNumbers);
  renderRulers();
});

rulerRowOffsetInput.addEventListener('input', () => { if (showNumbers) renderRulers(); });
rulerColOffsetInput.addEventListener('input', () => { if (showNumbers) renderRulers(); });

// ---------------------------------------------------------------------------
// Board magnification buttons
// ---------------------------------------------------------------------------

zoomInBtn.addEventListener('click', () => {
  const v = getCellPx();
  const next = v < 10 ? v + 1 : v < 30 ? v + 2 : v + 4;
  zoomInput.value  = next;
  zoomSlider.value = Math.min(next, parseInt(zoomSlider.max));
  onDisplayChange();
});

zoomOutBtn.addEventListener('click', () => {
  const v = getCellPx();
  const next = Math.max(1, v < 10 ? v - 1 : v < 30 ? v - 2 : v - 4);
  zoomInput.value  = next;
  zoomSlider.value = Math.min(next, parseInt(zoomSlider.max));
  onDisplayChange();
});

function zoomToFit() {
  if (!currentProject) return;
  const wrapper = document.querySelector('.board-wrapper');
  const availW  = wrapper.clientWidth  - 4;
  const availH  = window.innerHeight   * 0.7;
  const gapPx   = getGapPx();
  const fitCell = Math.max(1, Math.floor(
    Math.min(
      (availW - gapPx * (currentProject.width  - 1)) / currentProject.width,
      (availH - gapPx * (currentProject.height - 1)) / currentProject.height
    )
  ));
  zoomInput.value  = fitCell;
  zoomSlider.value = Math.min(fitCell, parseInt(zoomSlider.max));
  onDisplayChange();
}

zoomFitBtn.addEventListener('click', () => zoomToFit());

// ---------------------------------------------------------------------------
// View rotation
// ---------------------------------------------------------------------------

function applyViewRotation() {
  if (!currentProject) return;
  const { w, h } = boardTotalSize(currentProject.width, currentProject.height);
  if (viewRotation === 0) {
    boardWithRulers.style.transform = '';
    boardWithRulers.style.margin    = '';
  } else {
    const rad  = (viewRotation * Math.PI) / 180;
    const rotW = Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad));
    const rotH = Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad));
    const mh   = Math.ceil((rotH - h) / 2) + 20;
    const mw   = Math.ceil((rotW - w) / 2) + 20;
    boardWithRulers.style.transform = `rotate(${viewRotation}deg)`;
    boardWithRulers.style.margin    = `${mh}px ${mw}px`;
  }
}

rotateViewCwBtn.addEventListener('click', () => {
  viewRotation = (viewRotation + 45) % 360;
  rotateViewCwBtn.classList.toggle('active', viewRotation !== 0);
  rotateViewCcwBtn.classList.remove('active');
  applyViewRotation();
});

rotateViewCcwBtn.addEventListener('click', () => {
  viewRotation = (viewRotation - 45 + 360) % 360;
  rotateViewCcwBtn.classList.toggle('active', viewRotation !== 0);
  rotateViewCwBtn.classList.remove('active');
  applyViewRotation();
});

// ---------------------------------------------------------------------------
// Clear all beads
// ---------------------------------------------------------------------------

clearAllBtn.addEventListener('click', () => {
  if (!currentProject) return;
  for (const bead of currentProject.beads) bead.done = false;
  for (const cell of cellMap.values()) cell.classList.remove('done');
  updateProgress();
  renderLegend();
  saveProgress();
});

// ---------------------------------------------------------------------------
// Legend show-all toggle
// ---------------------------------------------------------------------------

legendToggleBtn.addEventListener('click', () => {
  showAllMode = !showAllMode;
  beadBoard.classList.toggle('show-all', showAllMode);
  legendToggleBtn.textContent = showAllMode ? 'Hide done' : 'Show all';
});

// ---------------------------------------------------------------------------
// Bead hover tooltip
// ---------------------------------------------------------------------------

beadBoard.addEventListener('mousemove', e => {
  const cell = e.target.closest('.bead');
  if (!cell) { beadTip.classList.remove('visible'); return; }

  const absRow = parseInt(cell.dataset.row, 10);
  const absCol = parseInt(cell.dataset.col, 10);

  // Compute display coords — relative to current sub-focus section if active,
  // otherwise apply ruler offsets so numbers match what the rulers show.
  let displayCol, displayRow;
  if (subFocusMode) {
    const { rowBounds, colBounds } = getGuideBounds();
    const r1 = rowBounds[subFocusSi] ?? 0;
    const c1 = colBounds[subFocusSj] ?? 0;
    displayRow = absRow - r1 + 1;   // 1-indexed within section
    displayCol = absCol - c1 + 1;
  } else {
    displayRow = absRow + (parseInt(rulerRowOffsetInput.value) || 0);
    displayCol = absCol + (parseInt(rulerColOffsetInput.value) || 0);
  }

  beadTip.textContent = `col ${displayCol}, row ${displayRow}`;
  beadTip.classList.add('visible');

  // Position near cursor, avoiding viewport edges
  const pad = 12;
  let x = e.clientX + pad;
  let y = e.clientY + pad;
  const tw = beadTip.offsetWidth || 80;
  const th = beadTip.offsetHeight || 22;
  if (x + tw > window.innerWidth  - pad) x = e.clientX - tw - pad;
  if (y + th > window.innerHeight - pad) y = e.clientY - th - pad;
  beadTip.style.left = x + 'px';
  beadTip.style.top  = y + 'px';
});

beadBoard.addEventListener('mouseleave', () => {
  beadTip.classList.remove('visible');
});

// Delegated click listener — single handler for all beads
beadBoard.addEventListener('click', e => {
  const cell = e.target.closest('.bead');
  if (cell) onBeadClick(cell);
});

// ---------------------------------------------------------------------------
// Bead click
// ---------------------------------------------------------------------------

function onBeadClick(cell) {
  if (guideN > 0 && !guideLocked) return;
  if (selectMode) return;

  if (fillMode) {
    floodFillMark(parseInt(cell.dataset.row, 10), parseInt(cell.dataset.col, 10));
    return;
  }

  const row  = parseInt(cell.dataset.row, 10);
  const col  = parseInt(cell.dataset.col, 10);

  if (lineMarkMode === 'row') {
    if (markedRows.has(row)) markedRows.delete(row);
    else markedRows.add(row);
    applyLineMarks();
    return;
  }
  if (lineMarkMode === 'col') {
    if (markedCols.has(col)) markedCols.delete(col);
    else markedCols.add(col);
    applyLineMarks();
    return;
  }

  const prev   = cell.classList.contains('done');
  const isDone = cell.classList.toggle('done');
  const bead   = projectBeadMap.get(`${row}:${col}`);
  if (bead) bead.done = isDone;

  pushUndo([{ row, col, prev, next: isDone }]);
  updateProgress();
  renderLegend();
  saveProgress();
  setKbFocus(row, col);
}

// ---------------------------------------------------------------------------
// Keyboard navigation
// ---------------------------------------------------------------------------

function setKbFocus(row, col) {
  if (kbRow !== null) cellMap.get(`${kbRow}:${kbCol}`)?.classList.remove('kb-focus');
  kbRow = row; kbCol = col;
  if (row === null) return;
  const cell = cellMap.get(`${row}:${col}`);
  if (!cell) return;
  cell.classList.add('kb-focus');
  // Scroll into view inside board-wrapper
  const wrapper = document.querySelector('.board-wrapper');
  const br = cell.getBoundingClientRect();
  const wr = wrapper.getBoundingClientRect();
  if (br.left < wr.left)       wrapper.scrollLeft += br.left - wr.left - 10;
  if (br.right > wr.right)     wrapper.scrollLeft += br.right - wr.right + 10;
  if (br.top < wr.top)         wrapper.scrollTop  += br.top - wr.top - 10;
  if (br.bottom > wr.bottom)   wrapper.scrollTop  += br.bottom - wr.bottom + 10;
}

document.addEventListener('keydown', e => {
  if (!currentProject || kbRow === null) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  const cols = currentProject.width;
  const rows = currentProject.height;

  const moves = { ArrowRight: [0,1], ArrowLeft: [0,-1], ArrowDown: [1,0], ArrowUp: [-1,0] };
  if (moves[e.key]) {
    e.preventDefault();
    const [dr, dc] = moves[e.key];
    let nr = kbRow + dr, nc = kbCol + dc;
    nr = Math.max(0, Math.min(rows - 1, nr));
    nc = Math.max(0, Math.min(cols - 1, nc));
    let attempts = 0;
    while (attempts++ < Math.max(rows, cols)) {
      if (projectBeadMap.has(`${nr}:${nc}`)) break;
      nr = Math.max(0, Math.min(rows - 1, nr + dr));
      nc = Math.max(0, Math.min(cols - 1, nc + dc));
    }
    setKbFocus(nr, nc);
    return;
  }

  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    const cell = cellMap.get(`${kbRow}:${kbCol}`);
    if (cell) onBeadClick(cell);
    return;
  }

  if (e.key === 'Escape') {
    setKbFocus(null, null);
  }
});

function applyLineMarks() {
  // Remove old overlays
  beadBoard.querySelectorAll('.line-mark').forEach(el => el.remove());

  if (subFocusMode) return;  // pixel positions are invalid after grid remap

  const cellPx = getCellPx();
  const gapPx  = getGapPx();
  const step = cellPx + gapPx;

  for (const r of markedRows) {
    const line = document.createElement('div');
    line.className = 'line-mark row-line';
    line.style.top = (r * step - 1) + 'px';
    beadBoard.appendChild(line);
  }

  for (const c of markedCols) {
    const line = document.createElement('div');
    line.className = 'line-mark col-line';
    line.style.left = (c * step - 1) + 'px';
    beadBoard.appendChild(line);
  }
}

function setLineMarkMode(mode) {
  lineMarkMode = lineMarkMode === mode ? null : mode;
  markRowBtn.classList.toggle('active', lineMarkMode === 'row');
  markColBtn.classList.toggle('active', lineMarkMode === 'col');
  beadBoard.classList.toggle('mark-row-mode', lineMarkMode === 'row');
  beadBoard.classList.toggle('mark-col-mode', lineMarkMode === 'col');
}

markRowBtn.addEventListener('click', () => setLineMarkMode('row'));
markColBtn.addEventListener('click', () => setLineMarkMode('col'));
markClearBtn.addEventListener('click', () => {
  markedRows.clear();
  markedCols.clear();
  applyLineMarks();
});

// ---------------------------------------------------------------------------
// Guide grid
// ---------------------------------------------------------------------------

function renderGuideLines() {
  beadBoard.querySelectorAll('.guide-line, .guide-origin').forEach(el => el.remove());

  // Update board cursor based on lock state
  beadBoard.classList.toggle('guide-unlocked', guideN > 0 && !guideLocked && !subFocusMode);

  if (subFocusMode) return;  // pixel positions are invalid after grid remap
  if (!guideN || guideN < 1 || !currentProject) return;

  const cols = currentProject.width;
  const rows = currentProject.height;
  const cellPx = getCellPx();
  const gapPx  = getGapPx();
  const step   = cellPx + gapPx;

  const oCol  = guideOriginCol ?? Math.round(cols / 2);
  const oRow  = guideOriginRow ?? Math.round(rows / 2);
  const color = guideColorInput.value;

  // Propagate color to crosshair pseudo-elements via CSS var
  beadBoard.style.setProperty('--guide-color', color);

  // Vertical guide lines
  const colSet = new Set();
  for (let c = oCol; c >= 0;    c -= guideN) colSet.add(c);
  for (let c = oCol + guideN; c <= cols; c += guideN) colSet.add(c);
  for (const c of colSet) {
    const line = document.createElement('div');
    line.className        = 'line-mark col-line guide-line';
    line.style.left       = (c * step - 1) + 'px';
    line.style.background = color;
    beadBoard.appendChild(line);
  }

  // Horizontal guide lines
  const rowSet = new Set();
  for (let r = oRow; r >= 0;    r -= guideN) rowSet.add(r);
  for (let r = oRow + guideN; r <= rows; r += guideN) rowSet.add(r);
  for (const r of rowSet) {
    const line = document.createElement('div');
    line.className        = 'line-mark row-line guide-line';
    line.style.top        = (r * step - 1) + 'px';
    line.style.background = color;
    beadBoard.appendChild(line);
  }

  // Origin crosshair marker
  const marker = document.createElement('div');
  marker.className  = 'guide-origin';
  marker.style.left = (oCol * step) + 'px';
  marker.style.top  = (oRow * step) + 'px';
  beadBoard.appendChild(marker);
}

// Board-level drag to move guide (active only when unlocked)
beadBoard.addEventListener('mousedown', e => {
  if (guideLocked || guideN === 0 || !currentProject || subFocusMode) return;
  e.preventDefault();
  guideDragging  = true;
  guideDragMoved = false;
  guideDragStart = {
    mouseX:    e.clientX,
    mouseY:    e.clientY,
    originCol: guideOriginCol ?? Math.round(currentProject.width  / 2),
    originRow: guideOriginRow ?? Math.round(currentProject.height / 2),
  };
  beadBoard.style.cursor = 'grabbing';
});

document.addEventListener('mousemove', e => {
  if (!guideDragging || !guideDragStart || !currentProject) return;
  const step = getCellPx() + getGapPx();
  const dx = Math.round((e.clientX - guideDragStart.mouseX) / step);
  const dy = Math.round((e.clientY - guideDragStart.mouseY) / step);
  if (dx !== 0 || dy !== 0) guideDragMoved = true;
  guideOriginCol = Math.max(0, Math.min(currentProject.width,  guideDragStart.originCol + dx));
  guideOriginRow = Math.max(0, Math.min(currentProject.height, guideDragStart.originRow + dy));
  renderGuideLines();
  if (subFocusMode) applySubFocus();
});

document.addEventListener('mouseup', () => {
  if (guideDragging) {
    guideDragging = false;
    guideDragStart = null;
    beadBoard.style.cursor = '';
  }
});

guideToggleBtn.addEventListener('click', () => {
  const n = parseInt(guideNInput.value) || 0;
  if (n < 1) return;
  if (guideN === n) {
    guideN = 0;
    guideToggleBtn.classList.remove('active');
    setSubFocusMode(false);
    renderGuideLines();
  } else {
    guideN = n;
    guideToggleBtn.classList.add('active');
    renderGuideLines();
  }
  focusBtn.classList.toggle('invisible', guideN === 0);
});

guideNInput.addEventListener('change', () => {
  if (guideN > 0) {
    guideN = parseInt(guideNInput.value) || 0;
    renderGuideLines();
  }
});

guideColorInput.addEventListener('input', () => {
  if (guideN > 0) renderGuideLines();
});

guideLockBtn.addEventListener('click', () => {
  guideLocked = !guideLocked;
  guideLockBtn.textContent  = guideLocked ? '\uD83D\uDD12' : '\uD83D\uDD13';  // 🔒 / 🔓
  guideLockBtn.title        = guideLocked ? 'Unlock to drag guide grid' : 'Lock guide grid';
  guideLockBtn.classList.toggle('active', !guideLocked);
  renderGuideLines();
});

guideClearBtn.addEventListener('click', () => {
  guideN = 0;
  guideOriginCol = null;
  guideOriginRow = null;
  guideLocked = true;
  guideLockBtn.textContent = '\uD83D\uDD12';
  guideLockBtn.classList.remove('active');
  guideToggleBtn.classList.remove('active');
  focusBtn.classList.add('invisible');
  setSubFocusMode(false);
  renderGuideLines();
});

// ---------------------------------------------------------------------------
// Sub-grid focus
// ---------------------------------------------------------------------------

function getGuideBounds() {
  if (!currentProject || !guideN) return { rowBounds: [0, currentProject?.height ?? 0], colBounds: [0, currentProject?.width ?? 0] };
  const totalRows = currentProject.height;
  const totalCols = currentProject.width;
  const oRow = guideOriginRow ?? Math.round(totalRows / 2);
  const oCol = guideOriginCol ?? Math.round(totalCols / 2);

  const rowSet = new Set([0, totalRows]);
  for (let r = oRow; r >= 0; r -= guideN) rowSet.add(Math.max(0, r));
  for (let r = oRow; r <= totalRows; r += guideN) rowSet.add(Math.min(totalRows, r));

  const colSet = new Set([0, totalCols]);
  for (let c = oCol; c >= 0; c -= guideN) colSet.add(Math.max(0, c));
  for (let c = oCol; c <= totalCols; c += guideN) colSet.add(Math.min(totalCols, c));

  return {
    rowBounds: [...rowSet].sort((a, b) => a - b),
    colBounds: [...colSet].sort((a, b) => a - b),
  };
}

function renderFocusMinimap() {
  if (!focusMinimap) return;
  const { rowBounds, colBounds } = getGuideBounds();
  const numSi = rowBounds.length - 1;
  const numSj = colBounds.length - 1;

  focusMinimap.innerHTML = '';
  focusMinimap.style.gridTemplateColumns = `repeat(${numSj}, 9px)`;
  focusMinimap.style.gridTemplateRows    = `repeat(${numSi}, 9px)`;

  for (let si = 0; si < numSi; si++) {
    for (let sj = 0; sj < numSj; sj++) {
      const cell = document.createElement('div');
      cell.className = 'minimap-cell';
      if (si === subFocusSi && sj === subFocusSj) cell.classList.add('active');
      if (!sectionHasBeads(si, sj, rowBounds, colBounds))  cell.classList.add('empty');
      focusMinimap.appendChild(cell);
    }
  }
}

function applySubFocus() {
  const { rowBounds, colBounds } = getGuideBounds();
  const r1 = rowBounds[subFocusSi]       ?? 0;
  const r2 = (rowBounds[subFocusSi + 1]  ?? currentProject.height) - 1;
  const c1 = colBounds[subFocusSj]       ?? 0;
  const c2 = (colBounds[subFocusSj + 1]  ?? currentProject.width)  - 1;
  const sectionRows = r2 - r1 + 1;
  const sectionCols = c2 - c1 + 1;
  const cellPx = getCellPx(), gapPx = getGapPx();

  // Show only section beads, remap grid positions to start at 1×1
  for (const cell of cellMap.values()) {
    const r = parseInt(cell.dataset.row, 10);
    const c = parseInt(cell.dataset.col, 10);
    const inSection = r >= r1 && r <= r2 && c >= c1 && c <= c2;
    cell.style.display = inSection ? '' : 'none';
    if (inSection) {
      cell.style.gridColumn = (c - c1 + 1) + '';
      cell.style.gridRow    = (r - r1 + 1) + '';
    }
  }

  // Resize board to section dimensions
  applyBoardLayout(sectionCols, sectionRows, cellPx, gapPx);

  // Remove line marks and guide lines (positions invalid after remap)
  beadBoard.querySelectorAll('.line-mark, .guide-origin').forEach(el => el.remove());
  beadBoard.classList.remove('guide-unlocked');

  // Hide background image (would show wrong region after board resize)
  beadBoard.style.backgroundImage = 'none';

  updateBoardZoomLabel();

  const totalSi = rowBounds.length - 1;
  const totalSj = colBounds.length - 1;
  focusLabel.textContent = `${subFocusSi + 1}/${totalSi} × ${subFocusSj + 1}/${totalSj}`;

  // Ruler offsets show absolute coordinates within the full grid
  rulerRowOffsetInput.value = r1;
  rulerColOffsetInput.value = c1;
  renderRulers();

  renderFocusMinimap();
}

function clearSubFocus() {
  if (!currentProject) return;
  // Restore all beads with original grid positions
  for (const cell of cellMap.values()) {
    cell.style.display = '';
    const r = parseInt(cell.dataset.row, 10);
    const c = parseInt(cell.dataset.col, 10);
    cell.style.gridColumn = (c + 1) + '';
    cell.style.gridRow    = (r + 1) + '';
  }
  const cellPx = getCellPx(), gapPx = getGapPx();
  applyBoardLayout(currentProject.width, currentProject.height, cellPx, gapPx);
  // Restore background image
  if (currentProject.image_url) {
    beadBoard.style.backgroundImage = `url(${currentProject.image_url})`;
    beadBoard.style.backgroundSize  = '100% 100%';
  }
  // Restore ruler offsets to what they were before focus mode
  rulerRowOffsetInput.value = savedRulerRowOffset;
  rulerColOffsetInput.value = savedRulerColOffset;
  // Clear minimap
  if (focusMinimap) focusMinimap.innerHTML = '';
  applyLineMarks();
  renderGuideLines();
  updateBoardZoomLabel();
  renderRulers();
}

function sectionHasBeads(si, sj, rowBounds, colBounds) {
  const r1 = rowBounds[si], r2 = rowBounds[si + 1] - 1;
  const c1 = colBounds[sj], c2 = colBounds[sj + 1] - 1;
  return currentProject.beads.some(b => !b.transparent && b.row >= r1 && b.row <= r2 && b.col >= c1 && b.col <= c2);
}

function showFocusPicker() {
  const { rowBounds, colBounds } = getGuideBounds();
  const numSi = rowBounds.length - 1;
  const numSj = colBounds.length - 1;

  focusPickerGrid.innerHTML = '';
  focusPickerGrid.style.gridTemplateColumns = `repeat(${numSj}, minmax(48px, 1fr))`;

  for (let si = 0; si < numSi; si++) {
    for (let sj = 0; sj < numSj; sj++) {
      if (!sectionHasBeads(si, sj, rowBounds, colBounds)) continue;
      const r1 = rowBounds[si] + 1, r2 = rowBounds[si + 1];
      const c1 = colBounds[sj] + 1, c2 = colBounds[sj + 1];
      const btn = document.createElement('button');
      btn.className = 'focus-picker-tile';
      btn.style.gridRow    = si + 1;
      btn.style.gridColumn = sj + 1;
      btn.innerHTML = `<strong>${si + 1}&times;${sj + 1}</strong><br><span style="opacity:.6">R${r1}–${r2}<br>C${c1}–${c2}</span>`;
      btn.addEventListener('click', () => {
        focusPickerModal.classList.add('hidden');
        subFocusSi = si;
        subFocusSj = sj;
        // Save ruler offsets before first entry into focus mode
        if (!subFocusMode) {
          savedRulerRowOffset = parseInt(rulerRowOffsetInput.value) || 0;
          savedRulerColOffset = parseInt(rulerColOffsetInput.value) || 0;
        }
        subFocusMode = true;
        focusBtn.classList.add('active');
        focusNav.classList.remove('hidden');
        applySubFocus();
      });
      focusPickerGrid.appendChild(btn);
    }
  }

  focusPickerModal.classList.remove('hidden');
}

focusPickerCancelBtn.addEventListener('click', () => {
  focusPickerModal.classList.add('hidden');
});

function setSubFocusMode(on) {
  if (!on) {
    subFocusMode = false;
    focusBtn.classList.remove('active');
    focusNav.classList.add('hidden');
    clearSubFocus();
    focusLabel.textContent = '';
    return;
  }
  showFocusPicker();
}

function navigateFocus(dsi, dsj) {
  const { rowBounds, colBounds } = getGuideBounds();
  subFocusSi = Math.max(0, Math.min(rowBounds.length - 2, subFocusSi + dsi));
  subFocusSj = Math.max(0, Math.min(colBounds.length - 2, subFocusSj + dsj));
  applySubFocus();
}

focusBtn.addEventListener('click', () => {
  if (!guideN || !currentProject) return;
  setSubFocusMode(!subFocusMode);
});

focusUpBtn.addEventListener('click',    () => navigateFocus(-1,  0));
focusDownBtn.addEventListener('click',  () => navigateFocus( 1,  0));
focusLeftBtn.addEventListener('click',  () => navigateFocus( 0, -1));
focusRightBtn.addEventListener('click', () => navigateFocus( 0,  1));

// ---------------------------------------------------------------------------
// Undo / Redo
// ---------------------------------------------------------------------------

function pushUndo(changes) {
  undoStack.push(changes);
  if (undoStack.length > 100) undoStack.shift();
  redoStack.length = 0;
}

function applyChanges(changes, reverse) {
  for (const { row, col, prev, next } of changes) {
    const done = reverse ? prev : next;
    const bead = projectBeadMap.get(`${row}:${col}`);
    if (bead) bead.done = done;
    const cell = cellMap.get(`${row}:${col}`);
    if (cell) cell.classList.toggle('done', done);
  }
  updateProgress();
  renderLegend();
  saveProgress();
}

function undo() {
  if (!undoStack.length) return;
  const changes = undoStack.pop();
  redoStack.push(changes);
  applyChanges(changes, true);
}

function redo() {
  if (!redoStack.length) return;
  const changes = redoStack.pop();
  undoStack.push(changes);
  applyChanges(changes, false);
}

document.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey)) return;
  if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
});

// ---------------------------------------------------------------------------
// Region select
// ---------------------------------------------------------------------------

function setFillMode(on) {
  fillMode = on;
  fillBtn.classList.toggle('active', on);
  beadBoard.classList.toggle('fill-mode', on);
  if (on) { setSelectMode(false); setLineMarkMode(null); }
}

fillBtn.addEventListener('click', () => setFillMode(!fillMode));

function floodFillMark(startRow, startCol) {
  const startBead = projectBeadMap.get(`${startRow}:${startCol}`);
  if (!startBead) return;
  const targetLabel = startBead.label;

  const changes = [];
  const visited = new Set();
  const queue   = [[startRow, startCol]];
  visited.add(`${startRow}:${startCol}`);

  while (queue.length) {
    const [r, c] = queue.shift();
    const b = projectBeadMap.get(`${r}:${c}`);
    if (!b || b.label !== targetLabel) continue;
    if (!b.done) changes.push({ row: r, col: c, prev: false, next: true });

    // 8-directional neighbours
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const key = `${r + dr}:${c + dc}`;
        if (!visited.has(key) && projectBeadMap.has(key)) {
          visited.add(key);
          queue.push([r + dr, c + dc]);
        }
      }
    }
  }

  if (changes.length === 0) return;
  pushUndo(changes);
  applyChanges(changes, false);
}

function setSelectMode(on) {
  selectMode = on;
  selectBtn.classList.toggle('active', on);
  beadBoard.classList.toggle('select-mode', on);
  if (on) { setFillMode(false); setLineMarkMode(null); }
}

selectBtn.addEventListener('click', () => setSelectMode(!selectMode));

beadBoard.addEventListener('mousedown', e => {
  if (!selectMode || !currentProject) return;
  if (e.button !== 0) return;
  e.preventDefault();
  const rect = beadBoard.getBoundingClientRect();
  selectDragging = true;
  selectStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  selectRectEl.style.left   = selectStart.x + 'px';
  selectRectEl.style.top    = selectStart.y + 'px';
  selectRectEl.style.width  = '0px';
  selectRectEl.style.height = '0px';
  selectRectEl.classList.add('visible');
});

document.addEventListener('mousemove', e => {
  if (!selectDragging || !selectStart) return;
  const rect  = beadBoard.getBoundingClientRect();
  const curX  = Math.max(0, Math.min(beadBoard.offsetWidth,  e.clientX - rect.left));
  const curY  = Math.max(0, Math.min(beadBoard.offsetHeight, e.clientY - rect.top));
  const x = Math.min(selectStart.x, curX);
  const y = Math.min(selectStart.y, curY);
  const w = Math.abs(curX - selectStart.x);
  const h = Math.abs(curY - selectStart.y);
  selectRectEl.style.left   = x + 'px';
  selectRectEl.style.top    = y + 'px';
  selectRectEl.style.width  = w + 'px';
  selectRectEl.style.height = h + 'px';
});

document.addEventListener('mouseup', e => {
  if (!selectDragging || !selectStart || !currentProject) return;
  selectDragging = false;
  selectRectEl.classList.remove('visible');

  const rect  = beadBoard.getBoundingClientRect();
  const endX  = Math.max(0, Math.min(beadBoard.offsetWidth,  e.clientX - rect.left));
  const endY  = Math.max(0, Math.min(beadBoard.offsetHeight, e.clientY - rect.top));
  const step  = getCellPx() + getGapPx();
  const c1    = Math.floor(Math.min(selectStart.x, endX) / step);
  const c2    = Math.floor(Math.max(selectStart.x, endX) / step);
  const r1    = Math.floor(Math.min(selectStart.y, endY) / step);
  const r2    = Math.floor(Math.max(selectStart.y, endY) / step);
  selectStart = null;

  if (c2 < c1 || r2 < r1 || (c2 - c1 < 1 && r2 - r1 < 1)) return;

  // Collect beads in rect
  const inRect = [];
  for (const cell of cellMap.values()) {
    const r = parseInt(cell.dataset.row, 10);
    const c = parseInt(cell.dataset.col, 10);
    if (r >= r1 && r <= r2 && c >= c1 && c <= c2) inRect.push(cell);
  }
  if (!inRect.length) return;

  // Toggle: if all done → undone; else → done
  const allDone = inRect.every(cell => cell.classList.contains('done'));
  const next    = !allDone;
  const changes = [];
  inRect.forEach(cell => {
    const prev = cell.classList.contains('done');
    if (prev === next) return;
    cell.classList.toggle('done', next);
    const row  = parseInt(cell.dataset.row, 10);
    const col  = parseInt(cell.dataset.col, 10);
    const bead = projectBeadMap.get(`${row}:${col}`);
    if (bead) bead.done = next;
    changes.push({ row, col, prev, next });
  });
  if (changes.length) pushUndo(changes);
  updateProgress();
  renderLegend();
  saveProgress();
});

// ---------------------------------------------------------------------------
// Label visibility
// ---------------------------------------------------------------------------

function applyLabelVisibility(label, hidden) {
  for (const cell of cellMap.values()) {
    if (cell.dataset.label === label) cell.classList.toggle('color-hidden', hidden);
  }
}

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------

function updateProgress() {
  if (!currentProject) return;
  const active = currentProject.beads.filter(b => !b.transparent);
  const done   = active.filter(b => b.done).length;
  const total  = active.length;
  const pct    = total === 0 ? 0 : Math.round((done / total) * 100);
  progressLabel.textContent = `${done} / ${total} beads done`;
  progressPct.textContent   = `${pct}%`;
  progressFill.style.width  = `${pct}%`;
}

// ---------------------------------------------------------------------------
// Legend — collapse state (persists across re-renders)
// ---------------------------------------------------------------------------

const expandedGroups  = new Set(); // groupKey  e.g. "group_1"  — default collapsed
const expandedLetters = new Set(); // "group_1:A"               — default collapsed

function buildLegendItem(label, color, total, done) {
  const item = document.createElement('div');
  item.className = 'legend-item' +
    (done === total ? ' all-done' : '') +
    (label === selectedLabel ? ' selected' : '');

  const top = document.createElement('div');
  top.className = 'legend-item-top';

  const swatch = document.createElement('div');
  swatch.className = 'legend-swatch';
  swatch.style.background = color;

  const info = document.createElement('div');
  info.className = 'legend-info';
  info.innerHTML = `<div class="legend-label">${label}</div><div class="legend-count">${done}/${total}</div>`;

  const isHidden = hiddenLabels.has(label);
  const visBtn = document.createElement('button');
  visBtn.className = 'btn btn-secondary btn-sm legend-visibility-btn' + (isHidden ? ' hidden-active' : '');
  visBtn.textContent = isHidden ? '🚫' : '👁';
  visBtn.title = isHidden ? 'Show color' : 'Hide color';
  visBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (hiddenLabels.has(label)) { hiddenLabels.delete(label); applyLabelVisibility(label, false); }
    else                         { hiddenLabels.add(label);    applyLabelVisibility(label, true);  }
    renderLegend();
  });

  const swapBtn = document.createElement('button');
  swapBtn.className   = 'btn btn-secondary btn-sm legend-swap-btn';
  swapBtn.textContent = '⇄';
  swapBtn.title       = 'Swap this color';
  swapBtn.addEventListener('click', e => { e.stopPropagation(); startColorSwap(label); });

  const allDone = done === total;
  const markAllBtn = document.createElement('button');
  markAllBtn.className   = 'btn btn-secondary btn-sm legend-markall-btn';
  markAllBtn.textContent = allDone ? '✕' : '✓';
  markAllBtn.title       = allDone ? 'Reset all beads of this color' : 'Mark all beads of this color as done';
  markAllBtn.addEventListener('click', e => {
    e.stopPropagation();
    const changes = [];
    for (const b of currentProject.beads) {
      if (b.label === label && !b.transparent && b.done !== !allDone)
        changes.push({ row: b.row, col: b.col, prev: b.done, next: !allDone });
    }
    if (!changes.length) return;
    pushUndo(changes);
    applyChanges(changes, false);
  });

  const actionBtns = document.createElement('div');
  actionBtns.className = 'legend-action-btns';
  actionBtns.appendChild(visBtn);
  actionBtns.appendChild(markAllBtn);
  actionBtns.appendChild(swapBtn);

  top.appendChild(swatch);
  top.appendChild(info);
  top.appendChild(actionBtns);
  top.addEventListener('click', () => selectLegendLabel(label));
  item.appendChild(top);
  return item;
}

function renderLegend() {
  if (!currentProject) return;
  const counts = {};
  for (const b of currentProject.beads) {
    if (b.transparent) continue;
    if (!counts[b.label]) counts[b.label] = { color: b.color, total: 0, done: 0 };
    counts[b.label].total++;
    if (b.done) counts[b.label].done++;
  }

  const colorCountEl = document.getElementById('color-count');
  if (colorCountEl) {
    const usedColors = Object.keys(counts).length;
    const totalPalette = paletteData
      ? Object.values(paletteData).reduce((n, g) => n + Object.keys(g).length, 0)
      : 0;
    colorCountEl.textContent = totalPalette ? `${usedColors} / ${totalPalette}` : `${usedColors}`;
  }

  // label → palette group key
  const labelToGroup = {};
  if (paletteData) {
    for (const [grp, colors] of Object.entries(paletteData))
      for (const lbl of Object.keys(colors)) labelToGroup[lbl] = grp;
  }

  // Bucket used colors into palette groups
  const grouped = {};
  for (const [label, data] of Object.entries(counts)) {
    const g = labelToGroup[label] ?? 'other';
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push([label, data]);
  }
  const sortedGroups = Object.entries(grouped).sort((a, b) =>
    a[0].localeCompare(b[0], undefined, { numeric: true })
  );

  legendList.innerHTML = '';

  for (const [groupKey, items] of sortedGroups) {
    const groupName = groupKey.replace('_', '\u00A0').replace(/\b\w/g, c => c.toUpperCase());
    const groupCollapsed = !expandedGroups.has(groupKey);

    // Sub-group by first letter, sort by count then numeric code
    const byLetter = {};
    for (const entry of items) {
      const letter = entry[0][0];
      if (!byLetter[letter]) byLetter[letter] = [];
      byLetter[letter].push(entry);
    }
    for (const arr of Object.values(byLetter)) {
      arr.sort((a, b) => {
        if (a[1].total !== b[1].total) return b[1].total - a[1].total;
        return a[0].localeCompare(b[0], undefined, { numeric: true });
      });
    }
    const sortedLetters = Object.keys(byLetter).sort();

    const groupAllDone = items.every(([, { total, done }]) => done === total);

    // Group section
    const groupSection = document.createElement('div');
    groupSection.className = 'legend-group-section' + (groupCollapsed ? ' collapsed' : '');

    const groupHdr = document.createElement('div');
    groupHdr.className = 'legend-group-header' + (groupAllDone ? ' all-done' : '');
    groupHdr.dataset.groupKey = groupKey;
    groupHdr.innerHTML = `<span class="legend-chevron">&#9662;</span>${groupName}`;
    groupHdr.addEventListener('click', () => {
      groupSection.classList.toggle('collapsed');
      expandedGroups[groupSection.classList.contains('collapsed') ? 'delete' : 'add'](groupKey);
    });

    const groupBody = document.createElement('div');
    groupBody.className = 'legend-group-body';

    for (const letter of sortedLetters) {
      const letterKey      = `${groupKey}:${letter}`;
      const letterCollapsed = !expandedLetters.has(letterKey);
      const letterAllDone  = byLetter[letter].every(([, { total, done }]) => done === total);

      const letterSection = document.createElement('div');
      letterSection.className = 'legend-subletter-section' + (letterCollapsed ? ' collapsed' : '');

      const letterHdr = document.createElement('div');
      letterHdr.className = 'legend-subletter-header' + (letterAllDone ? ' all-done' : '');
      letterHdr.dataset.letterKey = letterKey;
      letterHdr.innerHTML = `<span class="legend-chevron">&#9662;</span>${letter}`;
      letterHdr.addEventListener('click', () => {
        letterSection.classList.toggle('collapsed');
        expandedLetters[letterSection.classList.contains('collapsed') ? 'delete' : 'add'](letterKey);
      });

      const letterBody = document.createElement('div');
      letterBody.className = 'legend-subletter-body';

      for (const [label, { color, total, done }] of byLetter[letter])
        letterBody.appendChild(buildLegendItem(label, color, total, done));

      letterSection.appendChild(letterHdr);
      letterSection.appendChild(letterBody);
      groupBody.appendChild(letterSection);
    }

    groupSection.appendChild(groupHdr);
    groupSection.appendChild(groupBody);
    legendList.appendChild(groupSection);
  }

  legendDeselectBtn.classList.toggle('invisible', !selectedLabel);
}

function selectLegendLabel(label) {
  for (const b of cellMap.values()) b.classList.remove('highlighted');

  if (selectedLabel === label) {
    selectedLabel = null;
  } else {
    selectedLabel = label;
    for (const b of cellMap.values()) {
      if (b.dataset.label === label) b.classList.add('highlighted');
    }
  }

  renderLegend();
}

legendDeselectBtn.addEventListener('click', () => {
  for (const b of cellMap.values()) b.classList.remove('highlighted');
  selectedLabel = null;
  renderLegend();
});

legendCollapseAllBtn.addEventListener('click', () => {
  // Toggle: if any group is expanded, collapse all; otherwise expand all
  const anyExpanded = expandedGroups.size > 0 || expandedLetters.size > 0;
  if (anyExpanded) {
    expandedGroups.clear();
    expandedLetters.clear();
    legendCollapseAllBtn.title = 'Expand all groups';
  } else {
    // Expand everything currently rendered
    legendList.querySelectorAll('.legend-group-section').forEach(sec => {
      expandedGroups.add(sec.querySelector('.legend-group-header').dataset.groupKey);
    });
    legendList.querySelectorAll('.legend-subletter-section').forEach(sec => {
      expandedLetters.add(sec.querySelector('.legend-subletter-header').dataset.letterKey);
    });
    legendCollapseAllBtn.title = 'Collapse all groups';
  }
  renderLegend();
});

legendVisAllBtn.addEventListener('click', () => {
  if (!currentProject) return;
  const allLabels = [...new Set(currentProject.beads.filter(b => !b.transparent).map(b => b.label))];
  // If any are visible, hide all; if all hidden, show all
  const anyVisible = allLabels.some(l => !hiddenLabels.has(l));
  if (anyVisible) {
    allLabels.forEach(l => { hiddenLabels.add(l); applyLabelVisibility(l, true); });
  } else {
    allLabels.forEach(l => { hiddenLabels.delete(l); applyLabelVisibility(l, false); });
  }
  legendVisAllBtn.textContent = anyVisible ? '🚫' : '👁';
  renderLegend();
});

// ---------------------------------------------------------------------------
// Save / load
// ---------------------------------------------------------------------------

async function saveProgress() {
  if (!currentProject) return;
  try {
    await fetch(`/progress/${encodeURIComponent(currentProject.name)}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(currentProject),
    });
    showStatus('Saved.', 'ok');
  } catch (err) {
    showStatus(`Save failed: ${err.message}`, 'error');
  }
}

saveBtn.addEventListener('click', saveProgress);
loadBtn.addEventListener('click', async () => {
  if (currentProject) await loadProgress(currentProject.name, true);
});

async function loadProgress(name, verbose = false) {
  try {
    const resp = await fetch(`/progress/${encodeURIComponent(name)}`);
    if (resp.status === 404) { if (verbose) showStatus('No saved progress.', 'info'); return false; }
    if (!resp.ok) throw new Error(resp.statusText);

    const saved   = await resp.json();
    const doneSet = new Set(saved.beads.filter(b => b.done).map(b => `${b.row}:${b.col}`));

    for (const bead of currentProject.beads) {
      bead.done = doneSet.has(`${bead.row}:${bead.col}`);
    }
    for (const cell of cellMap.values()) {
      const key = `${cell.dataset.row}:${cell.dataset.col}`;
      cell.classList.toggle('done', doneSet.has(key));
    }

    updateProgress();
    renderLegend();
    if (verbose) showStatus('Progress loaded.', 'ok');
    return true;
  } catch (err) {
    if (verbose) showStatus(`Load failed: ${err.message}`, 'error');
    return false;
  }
}

async function tryAutoLoadProgress(name) {
  try {
    const resp = await fetch(`/progress/${encodeURIComponent(name)}`);
    if (!resp.ok) return;
    const saved   = await resp.json();
    const doneSet = new Set(saved.beads.filter(b => b.done).map(b => `${b.row}:${b.col}`));
    for (const bead of currentProject.beads) {
      bead.done = doneSet.has(`${bead.row}:${bead.col}`);
    }
    showStatus('Previous progress restored.', 'ok');
  } catch (_) { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Color swap
// ---------------------------------------------------------------------------

function startColorSwap(label) {
  swapSourceLabel = label;
  // Update palette modal title
  const titleEl = paletteModal.querySelector('.modal-title');
  if (titleEl) titleEl.textContent = `Swap color for: ${label}`;
  paletteModal.dataset.swapMode = 'true';
  // Open palette (load if needed then render)
  paletteBtn.click();
}

function applyColorSwap(newLabel, newHex) {
  if (!currentProject || !swapSourceLabel) return;
  const oldLabel = swapSourceLabel;
  for (const bead of currentProject.beads) {
    if (bead.label === oldLabel) {
      bead.label = newLabel;
      bead.color = newHex;
    }
  }
  for (const cell of cellMap.values()) {
    if (cell.dataset.label !== oldLabel) continue;
    cell.dataset.label = newLabel;
    cell.dataset.color = newHex;
    cell.style.background = hexToRgba(newHex, 0.78);
    cell.style.setProperty('--label-color', labelColor(newHex));
    const span = cell.querySelector('.label');
    if (span) {
      span.textContent = newLabel;
      span.style.color = labelColor(newHex);
    }
  }
  swapSourceLabel = null;
  renderLegend();
  saveProgress();
}

// ---------------------------------------------------------------------------
// Palette modal
// ---------------------------------------------------------------------------

let paletteData = null;   // { group_1: { label: hex }, group_2: ... }

// Pre-fetch palette so color count is available immediately
fetch('/palette').then(r => r.json()).then(d => { paletteData = d; }).catch(() => {});

paletteBtn.addEventListener('click', async () => {
  if (!paletteData) {
    try {
      const resp = await fetch('/palette');
      paletteData = await resp.json();
    } catch {
      showStatus('Failed to load palette.', 'error');
      return;
    }
  }
  renderPaletteModal();
  paletteModal.classList.remove('hidden');
});

function closePaletteModal() {
  paletteModal.classList.add('hidden');
  // Reset swap mode state
  swapSourceLabel = null;
  delete paletteModal.dataset.swapMode;
  const titleEl = paletteModal.querySelector('.modal-title');
  if (titleEl) titleEl.textContent = 'Color Palette';
}

paletteCloseBtn.addEventListener('click', () => closePaletteModal());
paletteModal.addEventListener('click', e => { if (e.target === paletteModal) closePaletteModal(); });

function renderPaletteModal() {
  if (!paletteData) return;

  // Collect which labels are currently used in the image
  const usedLabels = new Set(
    currentProject ? currentProject.beads.filter(b => !b.transparent).map(b => b.label) : []
  );

  // Flatten grouped palette to { label: hex }
  const flatPalette = Object.assign({}, ...Object.values(paletteData));

  paletteGrid.innerHTML = '';
  for (const [label, hex] of Object.entries(flatPalette).sort((a,b) => a[0].localeCompare(b[0], undefined, { numeric: true }))) {
    const card = document.createElement('div');
    card.className = 'palette-swatch' + (usedLabels.has(label) ? ' used-in-image' : '');

    const circle = document.createElement('div');
    circle.className        = 'palette-swatch-circle';
    circle.style.background = hex;

    const lbl = document.createElement('div');
    lbl.className   = 'palette-swatch-label';
    lbl.textContent = label;

    const hexEl = document.createElement('div');
    hexEl.className   = 'palette-swatch-hex';
    hexEl.textContent = hex;

    card.appendChild(circle);
    card.appendChild(lbl);
    card.appendChild(hexEl);

    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
      if (swapSourceLabel) {
        applyColorSwap(label, hex);
        closePaletteModal();
      }
    });

    paletteGrid.appendChild(card);
  }
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

window.addEventListener('DOMContentLoaded', () => {
  updateButtonStates();
  // Defaults
  zoomInput.value  = '12';
  zoomSlider.value = '12';
  gapInput.value   = gapSlider.value;
  updateBoardZoomLabel();
  const last = localStorage.getItem('lastProjectName');
  if (last) showStatus(`Last project: "${last}". Upload the same image and Process to continue.`, 'info');
});
